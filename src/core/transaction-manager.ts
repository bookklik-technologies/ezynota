import type { ChangeBatch, ChangeOrigin, EzynotaChange, EzynotaDocument, EzynotaBlock, JsonValue } from "./types";
import type { IdGenerator } from "./id";import { DocumentState } from "./document-state";
import { cloneJson } from "./schema";
import { EzynotaError } from "./errors";

let batchCounter = 0;

export interface CommitResult {
  batch: ChangeBatch;
  changed: boolean;
}

/**
 * TransactionManager is the single write path into DocumentState.
 * A transaction applies a set of typed changes and produces a ChangeBatch.
 * Inverse transactions are computed mechanically from change payloads.
 */
export class TransactionManager {
  constructor(
    private state: DocumentState,
    private onCommit: (batch: ChangeBatch) => void
  ) {}

  getDocument(): EzynotaDocument {
    return this.state.get();
  }

  replaceDocument(next: unknown, generateId: IdGenerator): void {
    this.state.replace(next, generateId);
    this.state.bump();
  }

  /**
   * Apply changes to the document. Each change carries enough context
   * (previous values / removed blocks / move offsets) to compute its inverse.
   */
  commit(origin: ChangeOrigin, changes: EzynotaChange[]): CommitResult {
    if (changes.length === 0) return { batch: this.emptyBatch(origin), changed: false };
    const doc = this.state.raw();
    for (const change of changes) {
      this.applyChange(doc, change);
    }
    this.state.updatedAt();
    this.state.bump();
    const batch: ChangeBatch = {
      id: `ch_${Date.now().toString(36)}_${(batchCounter++).toString(36)}`,
      origin,
      timestamp: Date.now(),
      changes
    };
    this.onCommit(batch);
    return { batch, changed: true };
  }

  /** Apply a batch of inverse changes (used by history). */
  private applyChange(doc: EzynotaDocument, change: EzynotaChange): void {
    switch (change.type) {
      case "block:insert": {
        doc.blocks.splice(Math.max(0, Math.min(change.index, doc.blocks.length)), 0, cloneBlock(change.block));
        break;
      }
      case "block:remove": {
        const index = doc.blocks.findIndex((b) => b.id === change.id);
        if (index >= 0) doc.blocks.splice(index, 1);
        break;
      }
      case "block:update": {
        const block = doc.blocks.find((b) => b.id === change.id);
        if (block) block.data = cloneJson(change.current);
        break;
      }
      case "block:move": {
        moveInArray(doc.blocks, change.id, change.to);
        break;
      }
      case "block:convert": {
        const block = doc.blocks.find((b) => b.id === change.id);
        if (block) block.type = change.toType;
        break;
      }
      case "tune:update": {
        const block = doc.blocks.find((b) => b.id === change.id);
        if (block) {
          const tunes = block.tunes ?? (block.tunes = {});
          tunes[change.tune] = cloneJson(change.value);
        }
        break;
      }
      case "title:update": {
        doc.meta = { ...(doc.meta ?? {}), title: change.current };
        break;
      }
      case "children:update": {
        const block = doc.blocks.find((b) => b.id === change.id);
        if (block) block.children = cloneJson(change.current);
        break;
      }
      case "document:replace": {
        break;
      }
      default: {
        throw new EzynotaError("EZ_UNKNOWN_ERROR", `Unknown change type`, { change: (change as { type: string }).type });
      }
    }
  }

  emptyBatch(origin: ChangeOrigin): ChangeBatch {
    return { id: `ch_${Date.now().toString(36)}_${(batchCounter++).toString(36)}`, origin, timestamp: Date.now(), changes: [] };
  }

  /** Invert a set of changes (mechanical, payload-driven). */
  invert(changes: EzynotaChange[]): EzynotaChange[] {
    const inverse: EzynotaChange[] = [];
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i]!;
      switch (change.type) {
        case "block:insert":
          inverse.push({ type: "block:remove", id: change.block.id, index: change.index, block: change.block });
          break;
        case "block:remove":
          inverse.push({ type: "block:insert", block: change.block, index: change.index });
          break;
        case "block:update":
          inverse.push({ type: "block:update", id: change.id, previous: change.current, current: change.previous });
          break;
        case "block:move":
          inverse.push({ type: "block:move", id: change.id, from: change.to, to: change.from });
          break;
        case "block:convert":
          inverse.push({ type: "block:convert", id: change.id, fromType: change.toType, toType: change.fromType });
          break;
        case "tune:update":
          inverse.push({ type: "tune:update", id: change.id, tune: change.tune, previous: change.value, value: change.previous });
          break;
        case "title:update":
          inverse.push({ type: "title:update", previous: change.current, current: change.previous });
          break;
        case "children:update":
          inverse.push({ type: "children:update", id: change.id, previous: change.current, current: change.previous });
          break;
        case "document:replace":
          inverse.push({ type: "document:replace" });
          break;
      }
    }
    return inverse;
  }
}

export function cloneBlock(block: EzynotaBlock): EzynotaBlock {
  return cloneJson(block as unknown as JsonValue) as unknown as EzynotaBlock;
}

/**
 * Position convention: `to` is the block's final index in the resulting
 * array (after removal of the block from its original spot). All callers
 * — API, drag, keyboard, undo — share this convention.
 */
function moveInArray(blocks: EzynotaBlock[], id: string, to: number): void {
  const from = blocks.findIndex((b) => b.id === id);
  if (from < 0) return;
  const [block] = blocks.splice(from, 1);
  if (!block) return;
  const target = Math.max(0, Math.min(to, blocks.length));
  blocks.splice(target, 0, block);
}
