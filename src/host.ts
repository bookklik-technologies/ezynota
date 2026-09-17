import type { BlockManager } from "./core/block-manager";
import type { ToolRegistry } from "./core/tool-registry";
import type { I18n } from "./i18n/i18n";
import type { BlockTool, ChangeOrigin, EditorSelection, JsonValue } from "./types";

/**
 * Host is the internal contract between the editor core and its
 * UI/input/render modules. Keeps those modules decoupled from the
 * Ezynota class to avoid circular imports.
 */
export interface Host {
  readonly target: HTMLElement;
  readonly readOnly: boolean;
  readonly i18n: I18n;
  readonly registry: ToolRegistry;
  readonly blocks: BlockManager;
  readonly defaultBlock: string;
  readonly placeholder: string;

  getBlockIndex(id: string): number;
  getBlockData(id: string): JsonValue | undefined;
  getBlockType(id: string): string | undefined;
  updateBlockData(id: string, data: JsonValue, origin?: ChangeOrigin): void;
  /** Commit raw changes as one transaction (used by typed internal modules). */
  commitChanges(origin: ChangeOrigin, changes: import("./core/types").EzynotaChange[]): void;
  insertBlock(type: string, data?: JsonValue, opts?: { index?: number; after?: string; focus?: boolean }): string;
  removeBlock(id: string, origin?: ChangeOrigin): void;
  moveBlock(id: string, target: number | { before: string } | { after: string }, origin?: ChangeOrigin): void;
  duplicateBlock(id: string): string;
  convertBlock(id: string, targetType: string): void;
  mergeBlocks(prevId: string, currentId: string, origin?: ChangeOrigin): void;
  /**
   * Split the block at its current caret in ONE transaction (one undo step):
   * `before` replaces the block's data, `after` becomes a new block below.
   */
  splitBlock(id: string, before: JsonValue, after: JsonValue): string;
  /**
   * Insert pasted content relative to the caret in ONE transaction
   * (one undo step): replaces the selection when present, splits the
   * anchor block when the caret sits mid-content.
   */
  pasteBlocks(entries: { type: string; data: JsonValue }[], blockId: string, origin?: ChangeOrigin): void;
  focusBlock(id: string, at?: "start" | "end"): void;
  focusNextBlock(id: string, at?: "start" | "end"): boolean;
  focusPrevBlock(id: string, at?: "start" | "end"): boolean;
  requestSaveBlock(id: string, origin?: ChangeOrigin): void;
  /**
   * Save a nested child block (e.g. a toggle section's children) through
   * the parent tool that owns its lifecycle.
   */
  requestSaveNestedChild(parentId: string, childId: string): void;

  getEditableElement(id: string): HTMLElement | null;
  getTool(id: string): BlockTool | undefined;
  /** Nested child-block capability for tools hosting collapsible sections. */
  nestedHost?(parentId: string): import("./core/types").NestedBlockHost;

  getRange(): Range | null;
  getSelectionInfo(): EditorSelection | null;
  setSelectionFromRange(range: Range): void;
  announce(message: string): void;
  closeMenus(): void;
  isDestroyed(): boolean;
  undo(): void;
  redo(): void;
  dispatchInlineTool(name: string): void;
  openBlockPicker(blockId?: string, insert?: boolean): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

/** Options passed to block tool constructors inside the library. */
export interface ToolHostOptions {
  api: import("./core/types").BlockAPI;
  config: Record<string, unknown>;
  block: import("./core/types").EzynotaBlock;
  readOnly: boolean;
  locale: string;
}
