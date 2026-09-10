import type { EzynotaBlock, EzynotaDocument, JsonValue, JsonObject } from "./types";
import { EzynotaError, invalidDocument } from "./errors";
import { isSafeUrl } from "./url";

export const SCHEMA_VERSION = "1.0.0";
export const GENERATOR_VERSION = "0.2.1";

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

export interface BlockInput {
  id?: string;
  type: string;
  data: JsonValue;
  tunes?: Record<string, JsonValue>;
  meta?: { createdAt?: number; updatedAt?: number };
  children?: BlockInput[];
}

/**
 * Validate and normalize a block coming from any source (user data, import,
 * paste). Throws EZ_INVALID_BLOCK on malformed input. Unknown tool data is
 * preserved as-is when structurally valid.
 */
/** Recursively strip keys that could be used for prototype pollution. */
function sanitizeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeJsonValue(v));
  }
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      out[key] = sanitizeJsonValue(val);
    }
    return out;
  }
  return value;
}

export function normalizeBlock(input: unknown, generateId: () => string): EzynotaBlock {
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
  if (!isJsonValue(data)) {
    throw new EzynotaError("EZ_INVALID_BLOCK", "Block data is not JSON-serializable", { type: (input as { type: string }).type });
  }
  const id = typeof (input as { id?: unknown }).id === "string" && (input as { id: string }).id !== "" ? (input as { id: string }).id : generateId();

  const block: EzynotaBlock = { id, type: (input as { type: string }).type, data: sanitizeJsonValue(data) };
  const tunes = (input as { tunes?: unknown }).tunes;
  if (isPlainObject(tunes) && isJsonValue(tunes as unknown)) {
    block.tunes = sanitizeJsonValue(tunes as unknown as JsonValue) as Record<string, JsonValue>;
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
    block.children = children.map((child) => normalizeBlock(child, generateId));
  }
  return block;
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
  const byId = new Map<string, EzynotaBlock>();
  const blocks: EzynotaBlock[] = blocksRaw.map((raw) => {
    const block = normalizeBlock(raw, generateId);
    if (byId.has(block.id)) {
      throw invalidDocument(`duplicate block id "${block.id}"`);
    }
    byId.set(block.id, block);
    return block;
  });

  const schemaVersion = typeof (input as { schemaVersion?: unknown }).schemaVersion === "string" ? (input as { schemaVersion: string }).schemaVersion : SCHEMA_VERSION;

  const doc: EzynotaDocument = { schemaVersion, blocks };
  const meta = (input as { meta?: unknown }).meta;
  if (isPlainObject(meta) && isJsonValue(meta as unknown)) doc.meta = meta as JsonObject;
  if (typeof (input as { createdAt?: unknown }).createdAt === "number") doc.createdAt = (input as { createdAt: number }).createdAt;
  if (typeof (input as { updatedAt?: unknown }).updatedAt === "number") doc.updatedAt = (input as { updatedAt: number }).updatedAt;
  const generator = (input as { generator?: unknown }).generator;
  if (isPlainObject(generator) && (generator as { name?: unknown }).name === "ezynota" && typeof (generator as { version?: unknown }).version === "string") {
    doc.generator = { name: "ezynota", version: (generator as { version: string }).version };
  }
  return doc;
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

/** Links are validated wherever they are persisted. */
export function sanitizeHref(value: unknown): string | null {
  return isSafeUrl(value) ? (value as string) : null;
}
