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
export declare class BlockManager {
    private tm;
    private generateId;
    private callbacks;
    constructor(tm: TransactionManager, generateId: IdGenerator, callbacks: BlockManagerCallbacks);
    private run;
    document(): EzynotaDocument;
    get blocks(): EzynotaBlock[];
    get length(): number;
    getById(id: string): EzynotaBlock | undefined;
    /** Recursive lookup: root blocks first, then nested children. */
    getByIdRecursive(id: string): EzynotaBlock | undefined;
    /** Parent context for a block: null at root level, parent id when nested. */
    getParentId(id: string): string | null;
    getIndex(id: string): number;
    insert(type: string, data: JsonValue, origin?: ChangeOrigin, index?: number, opts?: {
        withId?: string;
    }): string;
    update(id: string, data: JsonValue, origin?: ChangeOrigin): void;
    remove(id: string, origin?: ChangeOrigin): void;
    /**
     * Move a block. `target` resolves to the block's FINAL index in the
     * resulting array (shared convention with drag, keyboard and undo).
     */
    move(id: string, target: BlockPosition, origin?: ChangeOrigin): void;
    /** Move between root and nested lists atomically, preserving the whole subtree. */
    relocate(id: string, targetId: string, placement: "before" | "after" | "inside", origin?: ChangeOrigin): void;
    duplicate(id: string, origin?: ChangeOrigin): string;
    convert(id: string, targetType: string, data: JsonValue, origin?: ChangeOrigin): void;
    setTune(id: string, tune: string, value: JsonValue, origin?: ChangeOrigin): void;
}
