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

/** Coalescing limits: stop merging after 50 changes or 20s per group. */
const MAX_COALESCED_CHANGES = 50;
const MAX_COALESCE_GROUP_MS = 20_000;

/**
 * HistoryManager stores inverse transactions, not DOM snapshots (spec §21).
 * Consecutive user text edits on the same block are coalesced into one
 * history entry so undo does not step character-by-character.
 * Remote-origin changes never enter the local undo stack.
 */
export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private coalesceWindowMs: number;

  constructor(
    private tm: TransactionManager,
    private callbacks: HistoryCallbacks = {},
    coalesceWindowMs = 900
  ) {
    this.coalesceWindowMs = coalesceWindowMs;
  }

  record(batch: { origin: ChangeOrigin; changes: EzynotaChange[]; timestamp: number }, selection?: EditorSelection | null): void {
    if (batch.changes.length === 0) return;
    // Collaborative history is owned by adapters; remote changes skip local undo.
    if (batch.origin === "remote") return;
    const inverse = this.tm.invert(batch.changes);
    const postSelection = this.callbacks.onCaptureSelection ? this.callbacks.onCaptureSelection() : selection ?? null;

    const top = this.undoStack[this.undoStack.length - 1];
    const isTextLikeEdit =
      batch.changes.every(
        (c) => c.type === "block:update" || c.type === "tune:update" || c.type === "title:update"
      );
    const groupStart = top?.groupStart ?? top?.time ?? 0;
    const groupFull = (top?.changes.length ?? 0) + batch.changes.length > MAX_COALESCED_CHANGES;
    const groupExpired = batch.timestamp - groupStart >= MAX_COALESCE_GROUP_MS;
    if (
      top &&
      isTextLikeEdit &&
      !groupFull &&
      !groupExpired &&
      top.origin === "user" &&
      batch.origin === "user" &&
      batch.timestamp - top.time < this.coalesceWindowMs &&
      sameSubject(top.changes, batch.changes)
    ) {
      // Coalesce: keep the oldest inverse (first previous state).
      top.changes = top.changes.concat(batch.changes);
      top.inverse = this.tm.invert(top.changes);
      top.time = batch.timestamp;
      top.postSelection = postSelection;
      this.redoStack.length = 0;
      return;
    }

    this.undoStack.push({
      changes: batch.changes,
      inverse,
      origin: batch.origin,
      selection: selection ?? null,
      postSelection,
      time: batch.timestamp,
      groupStart: batch.timestamp
    });
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Refresh the post-change selection of the newest entry (after the DOM applied the change). */
  updatePostSelection(selection: EditorSelection | null): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top) top.postSelection = selection;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.tm.commit("history", entry.inverse);
    this.redoStack.push(entry);
    this.callbacks.onRestoreSelection?.(entry.selection ?? null);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    // Re-apply the forward changes to reach the post-change state again.
    this.tm.commit("history", entry.changes);
    this.undoStack.push(entry);
    this.callbacks.onRestoreSelection?.(entry.postSelection ?? entry.selection ?? null);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Snapshot the in-memory history stacks. Used by workspace mode to keep
   * an independent undo/redo timeline per note: content undo must never
   * reach into another note's document.
   */
  exportState(): HistoryState {
    return {
      undo: this.undoStack.slice(),
      redo: this.redoStack.slice()
    };
  }

  importState(state: HistoryState): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.undoStack.push(...state.undo);
    this.redoStack.push(...state.redo);
  }
}

export interface HistoryState {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

function sameSubject(a: EzynotaChange[], b: EzynotaChange[]): boolean {
  const idsOf = (list: EzynotaChange[]) =>
    Array.from(
      new Set(
        list.map((c) => (c.type === "title:update" ? "title" : "id" in c ? c.id : "block" in c ? c.block.id : ""))
      )
    )
      .sort()
      .join("|");
  return idsOf(a) === idsOf(b);
}
