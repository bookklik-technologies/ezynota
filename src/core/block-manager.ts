import type { BlockPosition, ChangeOrigin, EzynotaBlock, EzynotaChange, JsonValue, EzynotaDocument } from "./types";
import type { IdGenerator } from "./id";
import { TransactionManager } from "./transaction-manager";

export interface BlockManagerCallbacks {
  onBatch: (origin: ChangeOrigin, changes: EzynotaChange[]) => void;
}

/**
 * BlockManager performs all block CRUD through transactions.
 * It resolves BlockPosition into concrete indices and always emits
 * payload-complete changes so history can invert them.
 */
export class BlockManager {
  constructor(
    private tm: TransactionManager,
    private generateId: IdGenerator,
    private callbacks: BlockManagerCallbacks
  ) {}

  private run(origin: ChangeOrigin, build: () => EzynotaChange[]): void {
    const changes = build();
    if (changes.length === 0) return;
    this.tm.commit(origin, changes);
    this.callbacks.onBatch(origin, changes);
  }

  document(): EzynotaDocument {
    return this.tm.getDocument();
  }

  get blocks(): EzynotaBlock[] {
    return this.document().blocks;
  }

  get length(): number {
    return this.blocks.length;
  }

  getById(id: string): EzynotaBlock | undefined {
    return this.blocks.find((b) => b.id === id);
  }

  /** Recursive lookup: root blocks first, then nested children. */
  getByIdRecursive(id: string): EzynotaBlock | undefined {
    const findIn = (blocks: EzynotaBlock[]): EzynotaBlock | undefined => {
      for (const block of blocks) {
        if (block.id === id) return block;
        if (Array.isArray(block.children)) {
          const found = findIn(block.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findIn(this.blocks);
  }

  /** Parent context for a block: null at root level, parent id when nested. */
  getParentId(id: string): string | null {
    for (const block of this.blocks) {
      if (block.id === id) return null;
      if (Array.isArray(block.children) && block.children.some((b) => b.id === id)) return block.id;
    }
    return null;
  }

  getIndex(id: string): number {
    return this.blocks.findIndex((b) => b.id === id);
  }

  insert(type: string, data: JsonValue, origin: ChangeOrigin = "api", index = -1, opts?: { withId?: string }): string {
    const blocks = this.blocks;
    const id = opts?.withId ?? this.generateId();
    const block: EzynotaBlock = { id, type, data };
    const at = index >= 0 ? Math.max(0, Math.min(index, blocks.length)) : blocks.length;
    this.run(origin, () => [{ type: "block:insert", block, index: at }]);
    return id;
  }

  update(id: string, data: JsonValue, origin: ChangeOrigin = "api"): void {
    const block = this.getById(id);
    if (!block) return;
    if (JSON.stringify(block.data) === JSON.stringify(data)) return;
    const previous = cloneJsonData(block.data);
    const current = cloneJsonData(data);
    this.run(origin, () => [{ type: "block:update", id, previous, current }]);
  }

  remove(id: string, origin: ChangeOrigin = "api"): void {
    const blocks = this.blocks;
    const index = blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    const block = JSON.parse(JSON.stringify(blocks[index])) as EzynotaBlock;
    this.run(origin, () => [{ type: "block:remove", id, index, block }]);
  }

  /**
   * Move a block. `target` resolves to the block's FINAL index in the
   * resulting array (shared convention with drag, keyboard and undo).
   */
  move(id: string, target: BlockPosition, origin: ChangeOrigin = "api"): void {
    const blocks = this.blocks;
    const from = blocks.findIndex((b) => b.id === id);
    if (from < 0) return;
    let to: number;
    if (typeof target === "number") {
      to = target;
    } else if ("before" in target) {
      const i = blocks.findIndex((b) => b.id === target.before);
      if (i < 0) to = blocks.length;
      else to = i > from ? i - 1 : i;
    } else if ("after" in target) {
      const i = blocks.findIndex((b) => b.id === target.after);
      if (i < 0) to = blocks.length;
      else to = i > from ? i : i + 1;
    } else {
      to = target.at === "start" ? 0 : blocks.length;
    }
    to = Math.max(0, Math.min(to, blocks.length));
    if (to === from) return;
    this.run(origin, () => [{ type: "block:move", id, from, to }]);
  }

  duplicate(id: string, origin: ChangeOrigin = "api"): string {
    const index = this.getIndex(id);
    const block = this.getById(id);
    if (index < 0 || !block) return "";
    const newId = this.generateId();
    const copy = JSON.parse(JSON.stringify(block)) as EzynotaBlock;
    copy.id = newId;
    copy.meta = {};
    // Descendant IDs are regenerated so the copy is independent.
    regenerateDescendantIds(copy, this.generateId);
    this.run(origin, () => [{ type: "block:insert", block: copy, index: index + 1 }]);
    return newId;
  }

  convert(id: string, targetType: string, data: JsonValue, origin: ChangeOrigin = "api"): void {
    const block = this.getById(id);
    if (!block) return;
    const fromType = block.type;
    if (fromType === targetType) return;
    const previous = cloneJsonData(block.data);
    const current = cloneJsonData(data);
    this.run(origin, () => [
      { type: "block:update", id, previous, current },
      { type: "block:convert", id, fromType, toType: targetType }
    ]);
  }

  setTune(id: string, tune: string, value: JsonValue, origin: ChangeOrigin = "user"): void {
    const block = this.getById(id);
    if (!block) return;
    const previous = cloneJsonData(block.tunes?.[tune] ?? null);
    if (JSON.stringify(previous) === JSON.stringify(value)) return;
    this.run(origin, () => [{ type: "tune:update", id, tune, previous, value: cloneJsonData(value) }]);
  }
}

function cloneJsonData<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Assign fresh IDs to every descendant block of a duplicated subtree. */
function regenerateDescendantIds(block: EzynotaBlock, generateId: IdGenerator): void {
  if (!Array.isArray(block.children)) return;
  for (const child of block.children) {
    child.id = generateId();
    regenerateDescendantIds(child, generateId);
  }
}
