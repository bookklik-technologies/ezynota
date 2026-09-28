import type { ChangeBatch, ChangeOrigin, EzynotaChange, EzynotaDocument, EzynotaBlock } from "./types";
import type { IdGenerator } from "./id";
import { DocumentState } from "./document-state";
export interface CommitResult {
    batch: ChangeBatch;
    changed: boolean;
}
/**
 * TransactionManager is the single write path into DocumentState.
 * A transaction applies a set of typed changes and produces a ChangeBatch.
 * Inverse transactions are computed mechanically from change payloads.
 */
export declare class TransactionManager {
    private state;
    private onCommit;
    constructor(state: DocumentState, onCommit: (batch: ChangeBatch) => void);
    getDocument(): EzynotaDocument;
    replaceDocument(next: unknown, generateId: IdGenerator): void;
    /**
     * Apply changes to the document. Each change carries enough context
     * (previous values / removed blocks / move offsets) to compute its inverse.
     */
    commit(origin: ChangeOrigin, changes: EzynotaChange[]): CommitResult;
    /** Apply a batch of inverse changes (used by history). */
    private applyChange;
    emptyBatch(origin: ChangeOrigin): ChangeBatch;
    /** Invert a set of changes (mechanical, payload-driven). */
    invert(changes: EzynotaChange[]): EzynotaChange[];
}
export declare function cloneBlock(block: EzynotaBlock): EzynotaBlock;
