import type { JsonPrimitive, JsonObject, JsonValue } from "./json";
import type { EzynotaError } from "./errors";
import type { StorageAdapter, WorkspaceTheme } from "../workspace/types";

export type { JsonPrimitive, JsonObject, JsonValue };

export type ChangeOrigin = "user" | "api" | "paste" | "history" | "remote" | "migration";

export interface BlockMeta {
  createdAt?: number;
  updatedAt?: number;
}

export interface EzynotaBlock<TData extends JsonValue = JsonValue> {
  id: string;
  type: string;
  data: TData;
  tunes?: Record<string, JsonValue>;
  meta?: BlockMeta;
  /**
   * Reserved for future nested-block support. Not edited by the MVP UI,
   * but the schema keeps the field so future versions avoid a migration.
   */
  children?: EzynotaBlock[];
}

export interface DocumentGenerator {
  name: "ezynota";
  version: string;
}

export interface EzynotaDocument {
  schemaVersion: string;
  blocks: EzynotaBlock[];
  createdAt?: number;
  updatedAt?: number;
  meta?: JsonObject;
  generator?: DocumentGenerator;
}

export type EzynotaChange =
  | { type: "block:insert"; block: EzynotaBlock; index: number }
  | { type: "block:update"; id: string; previous: JsonValue; current: JsonValue }
  | { type: "block:remove"; id: string; index: number; block: EzynotaBlock }
  | { type: "block:move"; id: string; from: number; to: number }
  | { type: "block:convert"; id: string; fromType: string; toType: string }
  | { type: "tune:update"; id: string; tune: string; previous: JsonValue; value: JsonValue }
  | { type: "title:update"; previous: string; current: string }
  | { type: "children:update"; id: string; previous: EzynotaBlock[]; current: EzynotaBlock[] }
  | { type: "document:replace" };

export interface ChangeBatch {
  id: string;
  origin: ChangeOrigin;
  timestamp: number;
  changes: EzynotaChange[];
}

export type BlockPosition =
  | number
  | { before: string }
  | { after: string }
  | { at: "start" | "end" };

export interface EditorSelection {
  blockId: string;
  index: number;
  collapsed: boolean;
  anchorOffset: number;
  focusOffset: number;
  text?: string;
  /** Explicit block boundaries for cross-block selections. */
  anchorBlockId?: string;
  focusBlockId?: string;
  /** Editable-region identifier inside compound blocks (e.g. table cells). */
  regionId?: string;
}

export interface FocusOptions {
  at?: "start" | "end" | "default";
  blockId?: string;
}

export interface InsertBlockOptions {
  index?: number;
  after?: string;
  before?: string;
  focus?: boolean;
}

export interface EzynotaEvents {
  ready: () => void;
  change: (batch: ChangeBatch) => void;
  "block:inserted": (change: { id: string; index: number }) => void;
  "block:updated": (change: { id: string }) => void;
  "block:removed": (change: { id: string; index: number }) => void;
  "block:moved": (change: { id: string; from: number; to: number }) => void;
  "selection:changed": (selection: EditorSelection | null) => void;
  focus: () => void;
  blur: () => void;
  "readOnly:changed": (readOnly: boolean) => void;
  "history:changed": (state: { canUndo: boolean; canRedo: boolean }) => void;
  "fullscreen:changed": (fullscreen: boolean) => void;
  "workspace:changed": (payload: { kind: "notes" | "folders" | "trash" | "activeNote" | "activeFolder" | "saveStatus" | "remoteChange" | "loaded" | "loadFailed" | "noteRenamed"; detail?: unknown }) => void;
  error: (error: EzynotaError) => void;
  destroyed: () => void;
}

export type EzynotaErrorCode =
  | "EZ_TOOL_NOT_FOUND"
  | "EZ_TOOL_LOAD_FAILED"
  | "EZ_INVALID_DOCUMENT"
  | "EZ_INVALID_BLOCK"
  | "EZ_INVALID_DATA"
  | "EZ_RENDER_FAILED"
  | "EZ_SAVE_FAILED"
  | "EZ_IMPORT_FAILED"
  | "EZ_EXPORT_FAILED"
  | "EZ_SANITIZE_FAILED"
  | "EZ_MIGRATION_FAILED"
  | "EZ_COLLAB_FAILED"
  | "EZ_DESTROYED"
  | "EZ_EDITING_LOCKED"
  | "EZ_UNKNOWN_ERROR";

export interface EzynotaEventsMapInit {
  [key: string]: JsonPrimitive | JsonValue[] | JsonObject;
}

export interface I18nMessages {
  [key: string]: string;
}

/** Editor lifecycle modes (spec §Architecture). */
export type EzynotaMode = "workspace" | "document" | "embedded" | "headless";

export interface EzynotaConfig {
  holder: HTMLElement | string;
  data?: EzynotaDocument | null;
  tools?: Record<string, BlockToolConstructor | ToolDefinition>;
  inlineTools?: (InlineToolConstructor | InlineToolDefinition)[];
  tunes?: (BlockTuneConstructor | TuneDefinition)[];
  defaultBlock?: string;
  readOnly?: boolean;
  autofocus?: boolean;
  placeholder?: string;
  minHeight?: number;
  locale?: string;
  i18n?: { messages?: Record<string, I18nMessages> };
  idGenerator?: () => string;
  ui?: boolean | { blockToolbar?: boolean; inlineToolbar?: boolean; slashMenu?: boolean; documentToolbar?: boolean };
  /**
   * Lifecycle mode. Defaults to "workspace" (browser-local multi-note
   * writing workspace); `ui: false` without an explicit mode is the
   * shorthand for "headless".
   */
  mode?: EzynotaMode;
  /** Explicit workspace id; defaults to pathname + holder id. */
  workspace?: string;
  /** Configurable storage adapter (default: IndexedDB in workspace mode). */
  storage?: StorageAdapter | (() => StorageAdapter);
  /** UI theme: light, dark or system. */
  theme?: WorkspaceTheme;
  onReady?: (api: EzynotaEditorAPI) => void;
  onChange?: (api: EzynotaEditorAPI, batch: ChangeBatch) => void;
}

export interface ToolDefinition {
  class: BlockToolConstructor;
  config?: JsonObject;
  shortcut?: string;
}

export interface InlineToolDefinition {
  class: InlineToolConstructor;
  config?: JsonObject;
}

export interface TuneDefinition {
  class: BlockTuneConstructor;
  config?: JsonObject;
}

/* ---------- Tool SDK ---------- */

export interface ToolboxConfigEntry {
  icon?: string;
  title: string;
  label?: string;
  /** Optional group/section name used by the slash menu. */
  category?: string;
}

export interface ToolboxConfig {
  icon?: string;
  title: string;
  category?: string;
}

export interface PasteConfig {
  tags?: string[];
  files?: { mimeTypes?: string[]; extensions?: string[] };
  patterns?: Record<string, RegExp>;
}

export interface ConversionConfig {
  /** Source types this tool can convert from, and the data mapper. */
  from?: Record<string, (data: JsonValue) => JsonValue>;
  /** Names of tools this block can be converted into directly. */
  to?: string[];
}

export interface ToolPasteEvent {
  tag?: string;
  files?: File[];
  pattern?: string;
  data?: JsonObject;
  text?: string;
}

export interface BlockMoveEvent {
  from: number;
  to: number;
}

export interface BlockToolOptions<TData extends JsonValue = JsonValue> {
  api: BlockAPI<TData>;
  config: JsonObject;
  block: EzynotaBlock<TData>;
  readOnly: boolean;
  locale: string;
  /** Present for tools that host nested child blocks (e.g. toggles). */
  nested?: NestedBlockHost;
}

/**
 * Capability for tools that contain editable child blocks (collapsible
 * sections). Operations commit through `children:update` transactions.
 */
export interface NestedBlockHost {
  getBlocks(): EzynotaBlock[];
  insert(type: string, data?: JsonValue, index?: number): string;
  update(id: string, data: JsonValue): void;
  remove(id: string): void;
  move(id: string, to: number): void;
  /** Create a tool instance for a nested child block. */
  createToolInstance(block: EzynotaBlock, element: HTMLElement, api?: BlockAPI): BlockTool;
  focusBlock(id: string, at?: "start" | "end"): void;
  readonly readOnly: boolean;
}

export interface BlockTool<TData extends JsonValue = JsonValue> {
  render(): HTMLElement;
  save(element: HTMLElement): TData | Promise<TData>;
  validate?(data: TData): boolean | Promise<boolean>;
  merge?(incoming: TData): TData | void;
  renderSettings?(): HTMLElement | null;
  onPaste?(event: ToolPasteEvent): void | Promise<void>;
  rendered?(): void;
  updated?(): void;
  moved?(event: BlockMoveEvent): void;
  removed?(): void;
  destroy?(): void;
}

export interface BlockToolConstructor<TData extends JsonValue = JsonValue> {
  new (options: BlockToolOptions<TData>): BlockTool<TData>;
  toolbox?: ToolboxConfig;
  sanitize?: unknown;
  paste?: PasteConfig;
  conversion?: ConversionConfig;
  shortcut?: string;
  supportsReadOnly?: boolean;
  apiVersion?: number;
  /** Marks that this tool hosts rich text and participates in inline formatting. */
  enableInlineTools?: boolean;
  /** How the Enter key behaves: "split" (default), "newline" (code blocks), "ignore". */
  enterKey?: "split" | "newline" | "ignore";
}

export interface BlockAPI<TData extends JsonValue = JsonValue> {
  readonly id: string;
  readonly type: string;
  readonly readOnly: boolean;
  readonly element: HTMLElement;
  getData(): Readonly<TData>;
  update(data: TData): void;
  patch(data: Partial<TData>): void;
  requestSave(): void;
  focus(at?: "start" | "end"): void;
  remove(): void;
  move(position: BlockPosition): void;
  duplicate(): void;
  convert(targetType: string): void;
}

/* ---------- Inline tools ---------- */

export interface InlineToolContext {
  blockId: string;
  blockElement: HTMLElement;
  range: Range;
  requestSave(): void;
  closeToolbar(): void;
}

export interface InlineToolOptions {
  config: JsonObject;
  closeToolbar(): void;
  /** Ask the editor to apply this tool with its preserved text selection. */
  onActivate?(): void;
  t(key: string): string;
}

export interface InlineTool {
  render(): HTMLElement;
  apply(range: Range, context: InlineToolContext): void;
  remove?(range: Range, context: InlineToolContext): void;
  isActive(selection: EditorSelection): boolean;
  destroy?(): void;
}

export interface InlineToolConstructor {
  new (options: InlineToolOptions): InlineTool;
  isInline: true;
  shortcut?: string;
  title?: string;
  icon?: string;
}

/* ---------- Block tunes ---------- */

export interface BlockTuneOptions {
  api: BlockAPI;
  config: JsonObject;
  value: JsonValue;
  /** Persist a tune value through the editor's undoable transaction stream. */
  onChange?(value: JsonValue): void;
  t(key: string): string;
}

export interface BlockTune {
  render(): HTMLElement;
  save?(): JsonValue;
  wrap?(element: HTMLElement): HTMLElement;
  destroy?(): void;
}

export interface BlockTuneConstructor {
  new (options: BlockTuneOptions): BlockTune;
  title?: string;
  icon?: string;
}

/* ---------- Menus ---------- */

export interface MenuItem {
  icon?: string;
  title: string;
  label?: string;
  category?: string;
  onClick?: () => void;
  children?: MenuItem[];
  isActive?: () => boolean;
  danger?: boolean;
}

export interface MenuConfig {
  items: MenuItem[];
}

/* ---------- Editor public API (surface given to consumers and tools) ---------- */

export interface BlockRef {
  readonly id: string;
  readonly type: string;
  readonly index: number;
  getData(): JsonValue;
  update(data: JsonValue): void;
  patch(data: JsonObject): void;
  remove(): void;
  move(position: BlockPosition): void;
  duplicate(): void;
  convert(targetType: string): void;
}

export interface EzynotaEditorAPI {
  save(): Promise<EzynotaDocument>;
  getSnapshot(): Readonly<EzynotaDocument>;
  insertBlock(type: string, data?: JsonValue, options?: InsertBlockOptions): string;
  updateBlock(id: string, data: JsonValue): void;
  removeBlock(id: string): void;
  moveBlock(id: string, target: BlockPosition): void;
  duplicateBlock(id: string): string;
  convertBlock(id: string, targetType: string): void;
  getBlockById(id: string): BlockRef | undefined;
  getBlocks(): readonly BlockRef[];
  getBlockIndex(id: string): number;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  focus(options?: FocusOptions): void;
  /** Open the block picker; insert after this block when insert is true. */
  openBlockPicker(blockId?: string, insert?: boolean): void;
}
