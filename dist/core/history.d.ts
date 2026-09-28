import type { ChangeOrigin, EditorSelection, EzynotaChange } from "./types";
import { TransactionManager } from "./transaction-manager";
export interface HistoryEntry {
    changes: EzynotaChange[];
    inverse: EzynotaChange[];
    origin: ChangeOrigin;
    /** Selection BEFORE the change was applied (restored by undo). */
    selection?: EditorSelection | null;
    /** Selection captured AFTER the change was applied (restored by redo). */
    postSelection?: EditorSelection | null;
    time: number;
    /** Timestamp of the first change in the coalesced group. */
    groupStart?: number;
}
export interface HistoryCallbacks {
    /** Runs before undo applies, to restore caret/selection. */
    onRestoreSelection?: (selection: EditorSelection | null) => void;
    /** Runs after a batch is recorded, to capture the post-change selection for redo. */
    onCaptureSelection?: () => EditorSelection | null;
}
/**
 * HistoryManager stores inverse transactions, not DOM snapshots (spec §21).
 * Consecutive user text edits on the same block are coalesced into one
 * history entry so undo does not step character-by-character.
 * Remote-origin changes never enter the local undo stack.
 */
export declare class HistoryManager {
    private tm;
    private callbacks;
    private undoStack;
    private redoStack;
    private coalesceWindowMs;
    constructor(tm: TransactionManager, callbacks?: HistoryCallbacks, coalesceWindowMs?: number);
    record(batch: {
        origin: ChangeOrigin;
        changes: EzynotaChange[];
        timestamp: number;
    }, selection?: EditorSelection | null): void;
    /** Refresh the post-change selection of the newest entry (after the DOM applied the change). */
    updatePostSelection(selection: EditorSelection | null): void;
    undo(): boolean;
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
    /**
     * Snapshot the in-memory history stacks. Used by workspace mode to keep
     * an independent undo/redo timeline per note: content undo must never
     * reach into another note's document.
     */
    exportState(): HistoryState;
    importState(state: HistoryState): void;
}
export interface HistoryState {
    undo: HistoryEntry[];
    redo: HistoryEntry[];
}
