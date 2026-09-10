import type { EzynotaBlock, EzynotaDocument, JsonValue, JsonObject } from "./types";
import { EzynotaError, invalidDocument } from "./errors";
import { isSafeUrl } from "./url";

export const SCHEMA_VERSION = "1.0.0";
export const GENERATOR_VERSION = "0.2.1";

/** Maximum nesting depth accepted for JSON data, tunes, meta and children. */
export const MAX_JSON_DEPTH = 200;

const KNOWN_BLOCK_KEYS = new Set(["id", "type", "data", "tunes", "meta", "children"]);

function isPlainObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
  if (proto === null) return true; // Object.create(null)
  // Cross-realm documents (iframes, workers, sandboxes) have a different
  // Object.prototype — recognize plain objects by constructor name.
  return proto === Object.prototype || proto.constructor?.name === "Object";
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) return value.every((v) => isJsonValue(v));
  if (isPlainObject(value)) return Object.values(value as JsonObject).every((v) => isJsonValue(v));
  return false;
}

/**
 * Maximum structural depth of a JSON-like value, computed iteratively so
 * hostile input cannot overflow the real stack. Depth 0 = a primitive.
 */
function jsonDepth(value: unknown): number {
  let max = 0;
  const stack: Array<{ v: unknown; d: number }> = [{ v: value, d: 0 }];
  while (stack.length > 0) {
    const { v, d } = stack.pop()!;
    if (d > max) max = d;
    if (max > MAX_JSON_DEPTH) return max;
    if (Array.isArray(v)) {
      for (const item of v) stack.push({ v: item, d: d + 1 });
    } else if (isPlainObject(v)) {
      for (const item of Object.values(v as JsonObject)) stack.push({ v: item, d: d + 1 });
    }
  }
  return max;
}

function exceedsDepth(value: unknown): boolean {
  return jsonDepth(value) > MAX_JSON_DEPTH;
}

export interface BlockInput {
  id?: string;
  type: string;
  data: JsonValue;
  tunes?: Record<string, JsonValue>;
  meta?: { createdAt?: number; updatedAt?: number };
  children?: BlockInput[];
}

/**
 * Recursively strip keys that could be used for prototype pollution.
 * Rejects (EZ_INVALID_DOCUMENT) structures deeper than MAX_JSON_DEPTH.
 */
function sanitizeJsonValue(value: JsonValue, depth = 0): JsonValue {
  if (depth > MAX_JSON_DEPTH) {
    throw invalidDocument(`value exceeds the maximum nesting depth of ${MAX_JSON_DEPTH}`);
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeJsonValue(v, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      out[key] = sanitizeJsonValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Inline links carrying unsafe hrefs (javascript:, data:, vbscript:…) are
 * unwrapped to their inner text content; unsafe link marks are stripped.
 */
function stripUnsafeLinks(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    const out: JsonValue[] = [];
    for (const item of value) {
      if (isPlainObject(item) && (item as { type?: unknown }).type === "link") {
        const node = item as { href?: unknown; content?: unknown };
        const safeHref = sanitizeHref(node.href);
        if (safeHref === null) {
          const inner = Array.isArray(node.content) ? stripUnsafeLinks(node.content as JsonValue) : [];
          if (Array.isArray(inner)) out.push(...inner);
          continue;
        }
        out.push(stripUnsafeLinks(item as JsonValue));
        continue;
      }
      out.push(stripUnsafeLinks(item));
    }
    return out;
  }
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === "marks" && Array.isArray(val)) {
        out[key] = (val as JsonValue[])
          .filter((mark) => {
            if (!isPlainObject(mark) || (mark as { type?: unknown }).type !== "link") return true;
            const attrs = (mark as { attrs?: { href?: unknown } }).attrs;
            const href = (mark as { href?: unknown }).href ?? attrs?.href;
            return typeof href === "string" && sanitizeHref(href) !== null;
          })
          .map((mark) => stripUnsafeLinks(mark));
        continue;
      }
      out[key] = stripUnsafeLinks(val);
    }
    return out;
  }
  return value;
}

export function normalizeBlock(input: unknown, generateId: () => string, depth = 0): EzynotaBlock {
  if (depth > MAX_JSON_DEPTH) {
    throw invalidDocument(`block nesting exceeds ${MAX_JSON_DEPTH} levels`);
  }
  if (!isPlainObject(input)) {
    throw new EzynotaError("EZ_INVALID_BLOCK", "Block must be an object", { received: typeof input });
  }
  if (typeof (input as { type?: unknown }).type !== "string" || (input as { type: string }).type === "") {
    throw new EzynotaError("EZ_INVALID_BLOCK", "Block is missing a valid \"type\"", { id: String((input as { id?: unknown }).id ?? "") });
  }
  const data = (input as { data?: unknown }).data;
  if (data === undefined) {
    throw new EzynotaError("EZ_INVALID_BLOCK", "Block is missing \"data\"", { type: (input as { type: string }).type });
  }
  if (exceedsDepth(data)) {
    throw invalidDocument(`block data exceeds the maximum nesting depth of ${MAX_JSON_DEPTH}`, { type: (input as { type: string }).type });
  }
  if (!isJsonValue(data)) {
    throw new EzynotaError("EZ_INVALID_BLOCK", "Block data is not JSON-serializable", { type: (input as { type: string }).type });
  }
  const id = typeof (input as { id?: unknown }).id === "string" && (input as { id: string }).id !== "" ? (input as { id: string }).id : generateId();

  const block: EzynotaBlock = {
    id,
    type: (input as { type: string }).type,
    data: stripUnsafeLinks(sanitizeJsonValue(data)) as EzynotaBlock["data"]
  };
  const tunes = (input as { tunes?: unknown }).tunes;
  if (isPlainObject(tunes)) {
    if (exceedsDepth(tunes)) {
      throw invalidDocument(`block tunes exceed the maximum nesting depth of ${MAX_JSON_DEPTH}`, { id });
    }
    if (isJsonValue(tunes as unknown)) {
      block.tunes = sanitizeJsonValue(tunes as unknown as JsonValue) as Record<string, JsonValue>;
    }
  }
  const meta = (input as { meta?: unknown }).meta;
  if (isPlainObject(meta)) {
    const m: { createdAt?: number; updatedAt?: number } = {};
    if (typeof meta.createdAt === "number") m.createdAt = meta.createdAt;
    if (typeof meta.updatedAt === "number") m.updatedAt = meta.updatedAt;
    if (m.createdAt !== undefined || m.updatedAt !== undefined) block.meta = m;
  }
  const children = (input as { children?: unknown }).children;
  if (Array.isArray(children)) {
    block.children = children.map((child) => normalizeBlock(child, generateId, depth + 1));
  }
  for (const key of Object.keys(input)) {
    if (KNOWN_BLOCK_KEYS.has(key)) continue;
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const value = (input as Record<string, unknown>)[key];
    if (exceedsDepth(value)) {
      throw invalidDocument(`block field "${key}" exceeds the maximum nesting depth of ${MAX_JSON_DEPTH}`, { id });
    }
    if (!isJsonValue(value)) continue;
    (block as unknown as JsonObject)[key] = sanitizeJsonValue(value as JsonValue);
  }
  return block;
}

/** Deterministic id factory used by the salvage path. */
function createSalvageIdFactory(): () => string {
  let n = 0;
  return () => `ez_salvaged_${(++n).toString(36)}`;
}

/** First free deterministic candidate derived from a taken id. */
function uniqueId(base: string, used: Set<string>): string {
  let candidate = `${base}_2`;
  for (let n = 2; used.has(candidate); n++) candidate = `${base}_${n}`;
  return candidate;
}

/** Best-effort JSON-safe copy of an arbitrary raw block (never throws). */
function jsonSafeClone(value: unknown): JsonValue | null {
  try {
    const parsed = JSON.parse(JSON.stringify(value)) as unknown;
    if (exceedsDepth(parsed)) return null;
    return sanitizeJsonValue(parsed as JsonValue);
  } catch {
    return null;
  }
}

/**
 * Rename duplicate ids among nested children (root duplicates are handled
 * by the caller). Deterministic: keep the first occurrence, rename every
 * subsequent one to `<id>_2`, `<id>_3`, … against the set of used ids.
 */
function renumberNestedDuplicates(blocks: EzynotaBlock[], used: Set<string>): number {
  let renamed = 0;
  const visit = (block: EzynotaBlock): void => {
    if (!Array.isArray(block.children)) return;
    for (const child of block.children) {
      if (used.has(child.id)) {
        child.id = uniqueId(child.id, used);
        renamed++;
      }
      used.add(child.id);
      visit(child);
    }
  };
  for (const block of blocks) visit(block);
  return renamed;
}

/**
 * Build the document envelope (schemaVersion, meta, timestamps, generator)
 * around an already-normalized blocks array.
 */
function documentEnvelope(input: JsonObject, blocks: EzynotaBlock[]): EzynotaDocument {
  const schemaVersion = typeof input.schemaVersion === "string" ? input.schemaVersion : SCHEMA_VERSION;

  const doc: EzynotaDocument = { schemaVersion, blocks };
  const meta = input.meta;
  if (isPlainObject(meta)) {
    if (exceedsDepth(meta)) {
      throw invalidDocument("document meta exceeds the maximum nesting depth");
    }
    if (isJsonValue(meta as unknown)) doc.meta = sanitizeJsonValue(meta as unknown as JsonValue) as JsonObject;
  }
  if (typeof input.createdAt === "number") doc.createdAt = input.createdAt;
  if (typeof input.updatedAt === "number") doc.updatedAt = input.updatedAt;
  const generator = input.generator;
  if (isPlainObject(generator) && (generator as { name?: unknown }).name === "ezynota" && typeof (generator as { version?: unknown }).version === "string") {
    doc.generator = { name: "ezynota", version: (generator as { version: string }).version };
  }
  return doc;
}

/**
 * Validate + normalize a full document. Accepts loose input and returns a
 * clean EzynotaDocument; throws EZ_INVALID_DOCUMENT when unusable.
 */
export function normalizeDocument(input: unknown, generateId: () => string): EzynotaDocument {
  if (input === null || input === undefined) {
    const now = Date.now();
    return { schemaVersion: SCHEMA_VERSION, blocks: [], createdAt: now, updatedAt: now, generator: { name: "ezynota", version: GENERATOR_VERSION } };
  }
  if (!isPlainObject(input)) {
    throw invalidDocument("expected an object", { received: typeof input });
  }
  const blocksRaw = (input as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocksRaw)) {
    throw invalidDocument("\"blocks\" must be an array");
  }
  const byId = new Set<string>();
  const blocks: EzynotaBlock[] = blocksRaw.map((raw) => {
    const block = normalizeBlock(raw, generateId);
    if (byId.has(block.id)) {
      throw invalidDocument(`duplicate block id "${block.id}"`);
    }
    byId.add(block.id);
    return block;
  });
  renumberNestedDuplicates(blocks, byId);
  return documentEnvelope(input, blocks);
}

export interface SalvageResult {
  /** A usable document, or null when the envelope itself is unusable. */
  document: EzynotaDocument | null;
  /** True when any block was dropped, converted or renumbered. */
  salvaged: boolean;
  /** Ids (or "#index") of invalid blocks, converted to type "unknown". */
  dropped: string[];
}

/**
 * Never-throwing recovery path for malformed documents. Validates the
 * envelope, converts invalid blocks to `{ type: "unknown" }` blocks that
 * keep a JSON-safe copy of the raw payload, and de-duplicates ids
 * deterministically (first occurrence kept, later ones renamed to
 * `<id>_2`, `<id>_3`, …). Nesting beyond MAX_JSON_DEPTH is dropped.
 */
export function salvageDocument(doc: unknown, generateId?: () => string): SalvageResult {
  const gen = generateId ?? createSalvageIdFactory();
  if (doc === null || doc === undefined) {
    return { document: normalizeDocument(null, gen), salvaged: false, dropped: [] };
  }
  if (!isPlainObject(doc)) {
    return { document: null, salvaged: false, dropped: [] };
  }
  const blocksRaw = (doc as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocksRaw)) {
    return { document: null, salvaged: false, dropped: [] };
  }

  const dropped: string[] = [];
  const used = new Set<string>();
  const blocks: EzynotaBlock[] = [];
  let salvaged = false;

  for (let i = 0; i < blocksRaw.length; i++) {
    const raw = blocksRaw[i];
    try {
      const block = normalizeBlock(raw, gen);
      if (used.has(block.id)) {
        block.id = uniqueId(block.id, used);
        salvaged = true;
      }
      used.add(block.id);
      blocks.push(block);
    } catch {
      salvaged = true;
      const rawId = isPlainObject(raw) && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : "";
      dropped.push(rawId !== "" ? rawId : `#${i}`);
      const safe = jsonSafeClone(raw);
      if (safe === null) continue;
      const safeId = isPlainObject(safe) ? (safe as { id?: unknown }).id : undefined;
      let id = typeof safeId === "string" && safeId !== "" ? safeId : gen();
      if (used.has(id)) {
        id = uniqueId(id, used);
      }
      used.add(id);
      blocks.push({ id, type: "unknown", data: { raw: safe } });
    }
  }
  if (renumberNestedDuplicates(blocks, used) > 0) salvaged = true;

  let document: EzynotaDocument;
  try {
    document = documentEnvelope(doc, blocks);
  } catch {
    document = { schemaVersion: SCHEMA_VERSION, blocks };
  }
  return { document, salvaged, dropped };
}

/** Deep-clone JSON data via structuredClone with JSON fallback. */
export function cloneJson<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Freeze a document (and nested blocks) for safe snapshots. */
export function freezeDocument(doc: EzynotaDocument): Readonly<EzynotaDocument> {
  const frozenBlocks = Object.freeze(doc.blocks.map((b) => Object.freeze({ ...b }))) as unknown as EzynotaBlock[];
  return Object.freeze({ ...doc, blocks: frozenBlocks }) as Readonly<EzynotaDocument>;
}

/** Validate a link target; returns the trimmed href when safe, else null. */
export function sanitizeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return url !== "" && isSafeUrl(url) ? url : null;
}
