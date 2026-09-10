import type { EzynotaDocument } from "./types";
import { cloneJson, freezeDocument, normalizeDocument } from "./schema";
import type { IdGenerator } from "./id";

/**
 * DocumentState owns the authoritative document model.
 * Everything mutates through this class; DOM is only a view.
 */
export class DocumentState {
  private document: EzynotaDocument;
  private version = 0;

  constructor(initial: EzynotaDocument | null | undefined, generateId: IdGenerator) {
    this.document = normalizeDocument(initial ?? null, generateId);
  }

  getVersion(): number {
    return this.version;
  }

  bump(): void {
    this.version++;
  }

  /** Raw mutable reference — only TransactionManager may use this. */
  raw(): EzynotaDocument {
    return this.document;
  }

  get(): EzynotaDocument {
    return this.document;
  }

  /**
   * Frozen snapshot of the document. Blocks and the top-level document
   * object are shallow-frozen (freezeDocument) — nested data/tunes objects
   * stay mutable, so callers must treat the snapshot as read-only and
   * never mutate nested values in place.
   */
  snapshot(): Readonly<EzynotaDocument> {
    return freezeDocument(cloneJson(this.document));
  }

  replace(next: unknown, generateId: IdGenerator): void {
    this.document = normalizeDocument(next, generateId);
    this.version++;
  }

  updatedAt(): void {
    this.document.updatedAt = Date.now();
  }

  clone(): EzynotaDocument {
    return cloneJson(this.document);
  }
}
