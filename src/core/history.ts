import type { ChangeOrigin, EditorSelection, EzynotaChange } from "./types";
import { TransactionManager } from "./transaction-manager";

export interface HistoryEntry {
  changes: EzynotaChange[];
  inverse: EzynotaChange[];
  origin: ChangeOrigin;
  selection?: EditorSelection | null;
  time: number;
}

export interface HistoryCallbacks {
  /** Runs before undo applies, to restore caret/selection. */
  onRestoreSelection?: (selection: EditorSelection | null) => void;
}

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

    const top = this.undoStack[this.undoStack.length - 1];
    const isTextLikeEdit =
      batch.changes.every(
        (c) => c.type === "block:update" || c.type === "tune:update"
      );
    if (
      top &&
      isTextLikeEdit &&
      top.origin === "user" &&
      batch.origin === "user" &&
      batch.timestamp - top.time < this.coalesceWindowMs &&
      sameSubject(top.changes, batch.changes)
    ) {
      // Coalesce: keep the oldest inverse (first previous state).
      top.changes = top.changes.concat(batch.changes);
      top.inverse = this.tm.invert(top.changes);
      top.time = batch.timestamp;
      this.redoStack.length = 0;
      return;
    }

    this.undoStack.push({
      changes: batch.changes,
      inverse,
      origin: batch.origin,
      selection: selection ?? null,
      time: batch.timestamp
    });
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack.length = 0;
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
    this.callbacks.onRestoreSelection?.(entry.selection ?? null);
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
    list
      .map((c) => ("id" in c ? c.id : "block" in c ? c.block.id : ""))
      .sort()
      .join("|");
  return idsOf(a) === idsOf(b);
}
