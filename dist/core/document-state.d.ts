import type { EzynotaDocument } from "./types";
import type { IdGenerator } from "./id";
/**
 * DocumentState owns the authoritative document model.
 * Everything mutates through this class; DOM is only a view.
 */
export declare class DocumentState {
    private document;
    private version;
    constructor(initial: EzynotaDocument | null | undefined, generateId: IdGenerator);
    getVersion(): number;
    bump(): void;
    /** Raw mutable reference — only TransactionManager may use this. */
    raw(): EzynotaDocument;
    get(): EzynotaDocument;
    /**
     * Frozen snapshot of the document. Blocks and the top-level document
     * object are shallow-frozen (freezeDocument) — nested data/tunes objects
     * stay mutable, so callers must treat the snapshot as read-only and
     * never mutate nested values in place.
     */
    snapshot(): Readonly<EzynotaDocument>;
    replace(next: unknown, generateId: IdGenerator): void;
    updatedAt(): void;
    clone(): EzynotaDocument;
}
