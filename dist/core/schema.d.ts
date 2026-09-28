import type { EzynotaBlock, EzynotaDocument, JsonValue } from "./types";
export declare const SCHEMA_VERSION = "1.0.0";
export declare const GENERATOR_VERSION = "0.1.1";
/** Maximum nesting depth accepted for JSON data, tunes, meta and children. */
export declare const MAX_JSON_DEPTH = 200;
export interface BlockInput {
    id?: string;
    type: string;
    data: JsonValue;
    tunes?: Record<string, JsonValue>;
    meta?: {
        createdAt?: number;
        updatedAt?: number;
    };
    children?: BlockInput[];
}
export declare function normalizeBlock(input: unknown, generateId: () => string, depth?: number): EzynotaBlock;
/**
 * Validate + normalize a full document. Accepts loose input and returns a
 * clean EzynotaDocument; throws EZ_INVALID_DOCUMENT when unusable.
 */
export declare function normalizeDocument(input: unknown, generateId: () => string): EzynotaDocument;
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
export declare function salvageDocument(doc: unknown, generateId?: () => string): SalvageResult;
/** Deep-clone JSON data via structuredClone with JSON fallback. */
export declare function cloneJson<T>(value: T): T;
/** Freeze a document (and nested blocks) for safe snapshots. */
export declare function freezeDocument(doc: EzynotaDocument): Readonly<EzynotaDocument>;
/** Validate a link target; returns the trimmed href when safe, else null. */
export declare function sanitizeHref(value: unknown): string | null;
