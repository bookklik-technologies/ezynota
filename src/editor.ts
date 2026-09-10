import { EventBus } from "./core/event-bus";
import { DocumentState } from "./core/document-state";
import { TransactionManager } from "./core/transaction-manager";
import { BlockManager } from "./core/block-manager";
import { HistoryManager } from "./core/history";
import { CommandManager, EZ } from "./core/command-manager";
import { ToolRegistry } from "./core/tool-registry";
import { MigrationManager, compareVersions } from "./core/migration-manager";
import { I18n } from "./i18n/i18n";
import { createIdFactory } from "./core/id";
import { SCHEMA_VERSION, GENERATOR_VERSION, salvageDocument } from "./core/schema";
import { EzynotaError, toolNotFound } from "./core/errors";
import type {
  BlockPosition,
  BlockRef,
  BlockTool,
  ChangeBatch,
  ChangeOrigin,
  EditorSelection,
  EzynotaBlock,
  EzynotaChange,
  EzynotaConfig,
  EzynotaDocument,
  EzynotaEditorAPI,
  EzynotaEvents,
  FocusOptions,
  InsertBlockOptions,
  JsonValue,
  ToolDefinition
} from "./types";
import type { InlineContent } from "./rich-text/types";
import { Paragraph, Heading, Quote, CodeTool, Delimiter, TextBlockTool } from "./tools/text-tools";
import { ListTool } from "./tools/list-tool";
import { BUILTIN_INLINE_TOOLS } from "./inline/inline-tools";
import { AlignmentTune } from "./tunes/alignment";
import { Renderer } from "./render/renderer";
import { SelectionManager, setCaretAtTextOffset } from "./selection/selection-manager";
import { InputManager } from "./input/input-manager";
import { KeyboardManager } from "./input/keyboard";
import { ClipboardManager } from "./input/clipboard";
import { applyInlineTool, InlineToolbar } from "./ui/inline-toolbar";
import { BlockToolbar } from "./ui/block-toolbar";
import { SlashMenu } from "./ui/slash-menu";
import { DragManager } from "./ui/drag-manager";
import { TableTool } from "./tools/table-tool";
import { ImageTool } from "./tools/image-tool";
import { CalloutTool } from "./tools/callout-tool";
import { ToggleTool } from "./tools/toggle-tool";
import { convertData, mergeData, canMerge, dataIsEmpty, type TextBlockToolLike } from "./input/tool-interfaces";
import type { Host } from "./host";
import { WorkspaceController } from "./workspace/controller";
import type { WorkspaceHost } from "./workspace/controller";
import type { WorkspaceTheme } from "./workspace/types";
import { registerInstance, unregisterInstance } from "./init/registry";
import { initAll as initAllDeclarative, getInstance as getInstanceDeclarative } from "./init/declarative";

/**
 * Ezynota — the public editor class.
 *
 * Architecture (spec §3): every edit is a transaction against the document
 * state; the DOM is a view. Input flows InputManager → tool.save() →
 * validate → TransactionManager → DocumentState → Renderer → DOM.
 *
 * Modes (spec §Architecture): "workspace" (default) wraps the engine in a
 * browser-local notes workspace; "document" provides the writing surface
 * without note management; "embedded" preserves the compact experience;
 * "headless" mounts no UI at all (`ui: false` shorthand).
 */
export class Ezynota implements Host, EzynotaEditorAPI, WorkspaceHost {
  ready: Promise<void> = Promise.resolve();

  private config: EzynotaConfig;
  private holderEl: HTMLElement;
  /** The document surface: inner element in workspace modes, otherwise the holder. */
  private surfaceEl!: HTMLElement;
  private bus = new EventBus();
  private state: DocumentState;
  private tm: TransactionManager;
  private blockManager: BlockManager;
  private history: HistoryManager;
  private commands = new CommandManager();
  readonly registry = new ToolRegistry();
  private migrations = new MigrationManager();
  private i18nInstance: I18n;
  private renderer!: Renderer;
  private selectionManager!: SelectionManager;
  private inputManager!: InputManager;
  private keyboardManager!: KeyboardManager;
  private clipboardManager!: ClipboardManager;
  private dragManager: DragManager | null = null;
  private blockToolbar: BlockToolbar | null = null;
  private inlineToolbar: InlineToolbar | null = null;
  private documentToolbar: InlineToolbar | null = null;
  private slashMenu: SlashMenu | null = null;
  private announcerEl: HTMLElement | null = null;
  private destroyed = false;
  private defaultBlockName: string;
  private resolveReady!: () => void;
  private disposers: (() => void)[] = [];
  /** Read-only recovery state for documents from a newer/unknown schema. */
  private recoveryMode = false;
  private originalDocument: EzynotaDocument | null = null;
  /** Guards async tool saves against newer edits or destruction. */
  private blockSaveVersions = new Map<string, number>();
  /** Resolved lifecycle mode. */
  private mode: import("./types").EzynotaMode;
  /** Workspace note management (workspace/document modes only). */
  private workspaceController: WorkspaceController | null = null;
  /** Editing is prevented until the initial workspace load completes. */
  private editingLocked = false;
  private themeListenerDisposer: (() => void) | null = null;
  /** Set by Ezynota.initAll for declaratively created instances. */
  declarative = false;

  constructor(config: EzynotaConfig) {
    if (typeof document === "undefined") {
      throw new EzynotaError("EZ_RENDER_FAILED", "Ezynota requires a DOM environment (SSR-safe: construct inside useEffect/onMounted)");
    }
    this.config = config;
    this.mode = resolveMode(config);
    this.holderEl = this.resolveHolder(config.holder);
    this.i18nInstance = new I18n(config.locale ?? "en", config.i18n?.messages ?? {});
    this.defaultBlockName = config.defaultBlock ?? "paragraph";

    this.registerBuiltinTools();
    this.registerUserTools(config);

    if (!this.registry.has(this.defaultBlockName)) {
      throw toolNotFound(this.defaultBlockName);
    }

    // In workspace mode explicit document data opens as a new note (handled
    // by the workspace controller), so the engine starts empty.
    const initialDocument = this.mode === "workspace" || this.mode === "document" ? null : config.data;
    this.state = this.createState(this.migrateInitialData(initialDocument));
    // A document from a newer/unknown schema opens in protected read-only
    // recovery mode; content is preserved verbatim (spec §19).
    if (this.recoveryMode) {
      this.config = { ...this.config, readOnly: true };
    }
    this.tm = new TransactionManager(this.state, (batch) => this.handleCommit(batch));
    this.blockManager = new BlockManager(this.tm, createIdFactory(config.idGenerator), { onBatch: () => {} });
    this.history = new HistoryManager(this.tm, {
      onRestoreSelection: (selection) => this.restoreHistorySelection(selection)
    });
    this.registerBuiltinCommands();

    this.setupDom();
    this.renderer = new Renderer(this, this.surfaceEl);
    this.renderer.renderAll(this.state.get().blocks);
    if (this.config.readOnly) {
      this.renderer.setReadOnly(true);
    }
    this.wireFindReplace();
    this.setupMarkdownShortcuts();

    this.selectionManager = new SelectionManager(this, this.surfaceEl);
    this.selectionManager.start();
    this.inputManager = new InputManager(this, this.surfaceEl);
    this.inputManager.start();
    this.keyboardManager = new KeyboardManager(this, this.surfaceEl);
    this.keyboardManager.start();
    this.clipboardManager = new ClipboardManager(this, this.surfaceEl);
    this.clipboardManager.start();
    if (this.uiEnabled() && !config.readOnly) {
      this.dragManager = new DragManager(this, this.surfaceEl);
      this.dragManager.start();
    }
    this.setupDefaultUi();
    this.wireEvents();
    this.renderer.startObserver((id) => {
      if (!this.inputManager.wasInputRecently(id)) {
        this.requestSaveBlock(id, "user");
      }
    });

    registerInstance(this);

    if (this.mode === "workspace" || this.mode === "document") {
      this.editingLocked = true;
      this.holderEl.classList.add("ez-loading");
      this.initializeWorkspace();
    } else {
      this.ready = new Promise<void>((resolve) => {
        this.resolveReady = resolve;
      });
      this.resolveReady();
      this.bus.emit("ready");
      this.emitDomEvent("ezn:ready");
      this.fireReady();
      if (config.autofocus && !config.readOnly) {
        queueMicrotask(() => this.focus({ at: "end" }));
      }
    }
  }

  /** Run the consumer onReady callback without letting it break the boot. */
  private fireReady(): void {
    try {
      this.config.onReady?.(this);
    } catch (err) {
      this.bus.emit("error", new EzynotaError("EZ_UNKNOWN_ERROR", "An onReady handler threw", undefined, err));
    }
  }

  /** Map workspace lifecycle events onto the public event bus. */
  private onWorkspaceEvent(event: import("./workspace/types").WorkspaceEvent): void {
    if (this.destroyed) return;
    switch (event.type) {
      case "loaded":
        this.bus.emit("workspace:changed", { kind: "loaded" });
        break;
      case "loadFailed":
        this.bus.emit("workspace:changed", { kind: "loadFailed", detail: event.error });
        break;
      case "notes:changed":
        this.bus.emit("workspace:changed", { kind: "notes" });
        break;
      case "folders:changed":
        this.bus.emit("workspace:changed", { kind: "folders" });
        break;
      case "trash:changed":
        this.bus.emit("workspace:changed", { kind: "trash" });
        break;
      case "activeNote:changed":
        this.bus.emit("workspace:changed", { kind: "activeNote", detail: event.noteId });
        break;
      case "activeFolder:changed":
        this.bus.emit("workspace:changed", { kind: "activeFolder", detail: event.folderId });
        break;
      case "saveStatus":
        this.bus.emit("workspace:changed", { kind: "saveStatus", detail: event.status });
        break;
      case "remoteChange":
        this.bus.emit("workspace:changed", { kind: "remoteChange" });
        break;
      case "noteRenamed":
        this.bus.emit("workspace:changed", { kind: "noteRenamed", detail: event.noteId });
        break;
      case "fullscreen":
        this.bus.emit("fullscreen:changed", event.on);
        break;
    }
  }

  /** Async workspace boot: load notes, then unlock editing and fire ready. */
  private initializeWorkspace(): void {
    const holderId = this.holderEl.id || null;
    this.workspaceController = new WorkspaceController(
      this,
      this.holderEl,
      {
        holderId,
        explicitWorkspaceId: this.config.workspace,
        storage: this.config.storage,
        theme: this.config.theme,
        initialData: this.config.data ?? null,
        showSidebar: this.mode === "workspace",
        onEvent: (event) => this.onWorkspaceEvent(event)
      }
    );
    this.workspaceController.findEngine = (query, replaceWith, all) => this.findReplace(query, replaceWith, all);
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
    void this.workspaceController
      .start()
      .catch((error) => {
        this.bus.emit(
          "error",
          error instanceof EzynotaError ? error : new EzynotaError("EZ_UNKNOWN_ERROR", "Workspace failed to load", undefined, error)
        );
      })
      .finally(() => {
        if (this.destroyed) return;
        this.editingLocked = false;
        // The initial note was rendered while loading made host.readOnly
        // true. Rebuild its tools and empty input after releasing the lock
        // so their edit controls match the configured read-only setting.
        this.renderer.renderAll(this.state.get().blocks);
        this.holderEl.classList.remove("ez-loading");
        if (this.config.theme) this.applyTheme(this.config.theme);
        this.resolveReady();
        this.bus.emit("ready");
        this.emitDomEvent("ezn:ready");
        this.fireReady();
        if (this.config.autofocus && !this.config.readOnly) {
          queueMicrotask(() => this.focus({ at: "end" }));
        }
      });
  }

  /* ===================== Public API (spec §8) ===================== */

  /**
   * Mutations are rejected while the initial workspace load is still in
   * flight: anything committed before the note render would be silently
   * wiped by the document replacement. Await `editor.ready` first.
   */
  private assertEditable(): void {
    if (this.editingLocked) {
      throw new EzynotaError(
        "EZ_EDITING_LOCKED",
        "Editing is locked until the initial workspace load completes; await editor.ready first"
      );
    }
  }

  async save(): Promise<EzynotaDocument> {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    // In recovery mode the original payload is preserved verbatim — never
    // relabel foreign documents with the current schema version (spec §19).
    if (this.recoveryMode && this.originalDocument) {
      return cloneDocument(this.originalDocument);
    }
    const blocks: EzynotaBlock[] = [];
    let invalidCount = 0;
    for (const block of this.state.get().blocks) {
      const tool = this.renderer.getTool(block.id);
      let data: JsonValue = block.data;
      if (tool) {
        try {
          data = (await tool.save(this.toolElement(block.id))) as JsonValue;
          if (tool.validate && !(await tool.validate(data))) {
            invalidCount++;
            this.bus.emit("error", new EzynotaError("EZ_INVALID_DATA", `Block "${block.id}" produced invalid data`, { blockId: block.id, tool: block.type }));
            continue;
          }
        } catch (err) {
          throw new EzynotaError("EZ_SAVE_FAILED", `Failed to save block "${block.id}"`, { blockId: block.id }, err);
        }
      }
      blocks.push({ ...block, data });
    }
    // A save that would silently drop blocks must reject so callers never
    // mistake an incomplete document for a successful save.
    if (invalidCount > 0) {
      throw new EzynotaError("EZ_INVALID_DATA", `Save rejected: ${invalidCount} block(s) produced invalid data`, { count: invalidCount });
    }
    const doc = this.state.get();
    return { ...doc, blocks, updatedAt: Date.now(), schemaVersion: SCHEMA_VERSION, generator: { name: "ezynota", version: GENERATOR_VERSION } };
  }

  getSnapshot(): Readonly<EzynotaDocument> {
    return this.state.snapshot();
  }

  /** True when an unsupported document is open in protected read-only mode. */
  isRecoveryMode(): boolean {
    return this.recoveryMode;
  }

  /** The untouched payload of a document that could not be migrated. */
  getOriginalDocument(): Readonly<EzynotaDocument> | null {
    return this.originalDocument ? cloneDocument(this.originalDocument) : null;
  }

  async render(document: EzynotaDocument): Promise<void> {
    const migrated = this.migrateDocument(document);
    this.blockManagerReplaceAll(migrated);
    if (this.recoveryMode) {
      this.config = { ...this.config, readOnly: true };
      this.holderEl.classList.add("ez-readonly");
      this.renderer.setReadOnly(true);
      this.closeMenus();
    }
    // A document replacement is not an undoable user edit: reset history
    // so undo/redo never reaches across documents.
    this.history.clear();
    this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  clear(): void {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const blocks = this.state.get().blocks.slice();
    if (blocks.length === 0) return;
    const changes = blocks.map((block) => ({ type: "block:remove" as const, id: block.id, index: 0, block }));
    this.tm.commit("api", changes);
  }

  focus(options?: FocusOptions): void {
    if (this.destroyed || this.readOnly) return;
    const raw = options?.at;
    const at = raw === "default" ? undefined : raw;
    if (options?.blockId) {
      this.focusBlock(options.blockId, at);
      return;
    }
    const first = this.state.get().blocks[0];
    if (first) {
      this.focusBlock(first.id, at);
      return;
    }
    this.insertBlock(this.defaultBlockName, undefined, { focus: true });
  }

  setReadOnly(value: boolean): void {
    if (this.config.readOnly === value) return;
    this.config = { ...this.config, readOnly: value };
    this.surfaceEl.classList.toggle("ez-readonly", value);
    this.renderer.setReadOnly(value);
    if (value) this.closeMenus();
    if (!value && this.uiEnabled() && !this.dragManager) {
      this.dragManager = new DragManager(this, this.surfaceEl);
      this.dragManager.start();
    }
    this.documentToolbar?.refresh();
    this.bus.emit("readOnly:changed", value);
  }

  insertBlock(type: string, data?: JsonValue, options?: InsertBlockOptions): string {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    if (!this.registry.has(type)) throw toolNotFound(type);
    const index =
      options?.index !== undefined
        ? options.index
        : options?.before !== undefined
          ? Math.max(0, this.blockManager.getIndex(options.before))
          : options?.after !== undefined
            ? this.blockManager.getIndex(options.after) + 1
            : -1;
    const id = this.blockManager.insert(type, data ?? initialDataShape(type), "api", index);
    if (options?.focus !== false && !this.config.readOnly) {
      queueMicrotask(() => this.focusBlock(id, "start"));
    }
    return id;
  }

  updateBlock(id: string, data: JsonValue): void {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    this.blockManager.update(id, data, "api");
  }

  removeBlock(id: string): void {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    this.blockManager.remove(id, "api");
  }

  moveBlock(id: string, target: BlockPosition): void {
    this.assertEditable();
    this.blockManager.move(id, target, "api");
  }

  duplicateBlock(id: string): string {
    this.assertEditable();
    return this.blockManager.duplicate(id, "api");
  }

  convertBlock(id: string, targetType: string): void {
    this.assertEditable();
    const block = this.blockManager.getById(id);
    if (!block) return;
    if (!this.registry.has(targetType)) throw toolNotFound(targetType);
    const target = this.registry.get(targetType);
    const mapper = target?.toolClass.conversion?.from?.[block.type];
    const data = mapper ? mapper(block.data) : convertData(targetType, block.data);
    this.blockManager.convert(id, targetType, data as JsonValue, "api");
  }

  getBlockById(id: string): BlockRef | undefined {
    return this.blockRef(id);
  }

  getBlocks(): readonly BlockRef[] {
    return this.state.get().blocks.map((block) => this.blockRef(block.id)!).filter(Boolean);
  }

  getBlockIndex(id: string): number {
    return this.blockManager.getIndex(id);
  }

  undo(): void {
    this.history.undo();
    this.refreshAfterHistory();
  }

  redo(): void {
    this.history.redo();
    this.refreshAfterHistory();
  }

  private refreshAfterHistory(): void {
    this.selectionManager.refresh();
    if (!this.getSelectionInfo() && this.surfaceEl.contains(document.activeElement) && !this.readOnly) {
      const first = this.blocks.blocks[0];
      if (first) this.focusBlock(first.id, "end");
    }
    this.documentToolbar?.refresh();
    this.inlineToolbar?.refresh();
    this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  on<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): () => void {
    return this.bus.on(event, handler);
  }

  /** Public actions go through commands — no event impersonation (spec §8.2). */
  dispatch<T extends JsonValue>(command: string, payload: T): void {
    this.commands.dispatch(command, payload, this);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    // Unblock `await editor.ready` for consumers waiting on a load that
    // will never finish after destruction.
    try {
      this.resolveReady?.();
    } catch {
      /* resolveReady is always assigned after construction; guard partial init */
    }
    // Tolerant teardown: a constructor that threw part-way still leaves a
    // partially initialized editor that must be destroyable.
    const guarded = (step: () => void): void => {
      try {
        step();
      } catch (err) {
        this.bus.emit("error", new EzynotaError("EZ_UNKNOWN_ERROR", "Cleanup failed during destroy", undefined, err));
      }
    };
    guarded(() => this.keyboardManager?.stop());
    guarded(() => this.inputManager?.stop());
    guarded(() => this.selectionManager?.stop());
    guarded(() => this.clipboardManager?.stop());
    guarded(() => this.dragManager?.stop());
    guarded(() => this.surfaceEl?.dispatchEvent(new Event("ez-close-popovers")));
    guarded(() => this.slashMenu?.destroy());
    guarded(() => this.blockToolbar?.destroy());
    guarded(() => this.inlineToolbar?.destroy());
    guarded(() => this.documentToolbar?.destroy());
    guarded(() => this.renderer?.destroy());
    guarded(() => this.workspaceController?.destroy());
    this.workspaceController = null;
    guarded(() => this.themeListenerDisposer?.());
    this.themeListenerDisposer = null;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    unregisterInstance(this);
    // Suppress immediate automatic remounting for declarative mounts.
    if (this.declarative) this.holderEl.setAttribute("data-ezn-destroyed", "");
    this.bus.emit("destroyed");
    this.bus.destroy();
    this.holderEl.classList.remove("ez-editor-mount", "ez-editor", "ez-readonly", "ez-has-block-toolbar", "ez-loading");
    this.holderEl.removeAttribute("data-ez-mode");
    this.holderEl.removeAttribute("data-ez-theme");
    this.holderEl.innerHTML = "";
  }

  /* ===================== Host implementation ===================== */

  get holder(): HTMLElement {
    return this.surfaceEl;
  }

  /** Editing stays locked until the initial workspace load completes. */
  get readOnly(): boolean {
    return this.config.readOnly === true || this.editingLocked;
  }

  get i18n(): I18n {
    return this.i18nInstance;
  }

  get blocks(): BlockManager {
    return this.blockManager;
  }

  get defaultBlock(): string {
    return this.defaultBlockName;
  }

  get placeholder(): string {
    return this.config.placeholder ?? this.i18n.t("core.placeholder");
  }

  /** Resolved lifecycle mode. */
  getMode(): import("./types").EzynotaMode {
    return this.mode;
  }

  /**
   * Workspace note management (workspace/document modes): note/folder CRUD,
   * navigation, search, trash, backup/restore, fullscreen and themes.
   */
  get workspace(): WorkspaceController | null {
    return this.workspaceController;
  }

  openBlockPicker(blockId?: string, insert = false): void {
    if (this.readOnly) return;
    let id = blockId ?? this.getSelectionInfo()?.blockId ?? this.blocks.blocks[this.blocks.length - 1]?.id;
    if (!this.slashMenu) {
      this.insertBlock(this.defaultBlock, undefined, { after: id, focus: true });
      return;
    }
    if (!id) id = this.insertBlock(this.defaultBlock, undefined, { focus: false });
    this.slashMenu.open(id, insert);
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  getBlockData(id: string): JsonValue | undefined {
    return this.blockManager.getById(id)?.data;
  }

  getBlockType(id: string): string | undefined {
    return this.blockManager.getById(id)?.type;
  }

  updateBlockData(id: string, data: JsonValue, origin: ChangeOrigin = "api"): void {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    // Any newer edit supersedes async tool saves that are still in flight.
    this.invalidatePendingSave(id);
    this.blockManager.update(id, data, origin);
  }

  /** Commit raw changes as one transaction (used by typed internal modules). */
  commitChanges(origin: ChangeOrigin, changes: EzynotaChange[]): void {
    if (this.destroyed || changes.length === 0) return;
    this.assertEditable();
    this.tm.commit(origin, changes);
  }

  mergeBlocks(prevId: string, currentId: string, origin: ChangeOrigin = "user"): void {
    this.assertEditable();
    const prevBlock = this.blockManager.getById(prevId);
    const curBlock = this.blockManager.getById(currentId);
    if (!prevBlock || !curBlock) return;
    if (!canMerge(prevBlock.type, curBlock.type)) return;
    const previous = JSON.parse(JSON.stringify(prevBlock.data)) as JsonValue;
    const merged = mergeData(prevBlock.type, prevBlock.data, curBlock.type, curBlock.data) as JsonValue;
    const index = this.blockManager.getIndex(currentId);
    const removed = JSON.parse(JSON.stringify(curBlock)) as EzynotaBlock;
    this.tm.commit(origin, [
      { type: "block:update", id: prevId, previous, current: merged },
      { type: "block:remove", id: currentId, index, block: removed }
    ]);
    // The DOM of the previous block was not edited by the user — re-render it.
    const fresh = this.blockManager.getById(prevId);
    if (fresh) this.renderer.convert(prevId, fresh);
    this.focusBlock(prevId, "end");
  }

  /**
   * Split a block in ONE transaction: `before` replaces the block data,
   * `after` becomes a new block of the same type directly below. A single
   * history entry means one undo restores the pre-split block completely.
   */
  splitBlock(id: string, before: JsonValue, after: JsonValue): string {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const block = this.blockManager.getById(id);
    if (!block) return "";
    const previous = cloneDocument(block.data) as JsonValue;
    const index = this.blockManager.getIndex(id);
    const newId = createIdFactory(this.config.idGenerator)();
    const newBlock: EzynotaBlock = { id: newId, type: block.type, data: cloneDocument(after) as JsonValue };
    this.tm.commit("user", [
      { type: "block:update", id, previous, current: cloneDocument(before) as JsonValue },
      { type: "block:insert", block: newBlock, index: index + 1 }
    ]);
    // The anchor block's DOM was not edited by the user — re-render it.
    const fresh = this.blockManager.getById(id);
    if (fresh) this.renderer.convert(id, fresh);
    return newId;
  }

  /**
   * Paste pasted content relative to the caret as ONE transaction:
   * - empty anchor block → the block is replaced by the pasted content;
   * - non-collapsed selection → replaced by the pasted content;
   * - caret mid-content → the anchor block splits around the paste;
   * - otherwise → content is inserted after the anchor block.
   */
  pasteBlocks(entries: { type: string; data: JsonValue }[], blockId: string, origin: ChangeOrigin = "paste"): void {
    if (this.destroyed) throw new EzynotaError("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const usable = entries.filter((entry) => this.registry.has(entry.type));
    if (usable.length === 0) return;
    const changes: EzynotaChange[] = [];
    const firstId = () => {
      const insert = changes.find((c) => c.type === "block:insert");
      return insert ? (insert as { block: EzynotaBlock }).block.id : "";
    };
    const lastId = () => {
      for (let i = changes.length - 1; i >= 0; i--) {
        const change = changes[i];
        if (change && change.type === "block:insert") return (change as { block: EzynotaBlock }).block.id;
      }
      return "";
    };
    const blocks = this.state.get().blocks;
    const anchor = this.blockManager.getById(blockId);
    let focusTarget: { id: string; at: "start" | "end" } | null = null;

    if (!anchor) {
      let index = blocks.length;
      for (const entry of usable) {
        changes.push({ type: "block:insert", block: this.shapedBlock(entry).block, index });
        index++;
      }
      focusTarget = { id: firstId(), at: "start" };
    } else if (dataIsEmpty(anchor.type, anchor.data)) {
      // Empty anchor block: replace it in place with the pasted content.
      const index = this.blockManager.getIndex(anchor.id);
      const removed = cloneDocument(anchor) as EzynotaBlock;
      changes.push({ type: "block:remove", id: anchor.id, index, block: removed });
      usable.forEach((entry, i) => {
        changes.push({ type: "block:insert", block: this.shapedBlock(entry).block, index: index + i });
      });
      focusTarget = { id: firstId(), at: "start" };
    } else {
      const tool = this.renderer.getTool(anchor.id);
      const selection = this.getSelectionInfo();
      const splitter = tool as unknown as TextBlockToolLike;
      const selectionInAnchor = selection?.blockId === anchor.id;
      let split: [JsonValue, JsonValue] | null = null;
      if (selectionInAnchor && typeof splitter.splitAtRange === "function") {
        const range = this.getRange();
        if (range) {
          try {
            split = splitter.splitAtRange(range) as [JsonValue, JsonValue] | null;
          } catch {
            split = null;
          }
        }
      }
      const anchorIndex = this.blockManager.getIndex(anchor.id);
      if (split) {
        const [before, after] = split;
        const previous = cloneDocument(anchor.data) as JsonValue;
        const beforeEmpty = dataIsEmpty(anchor.type, before);
        const afterEmpty = dataIsEmpty(anchor.type, after);
        if (beforeEmpty) {
          // Paste goes above; the anchor keeps the remainder.
          usable.forEach((entry, i) => {
            changes.push({ type: "block:insert", block: this.shapedBlock(entry).block, index: anchorIndex + i });
          });
          changes.push({ type: "block:update", id: anchor.id, previous, current: cloneDocument(after) as JsonValue });
          focusTarget = { id: firstId(), at: "start" };
        } else {
          changes.push({ type: "block:update", id: anchor.id, previous, current: cloneDocument(before) as JsonValue });
          let insertIndex = anchorIndex + 1;
          for (const entry of usable) {
            changes.push({ type: "block:insert", block: this.shapedBlock(entry).block, index: insertIndex });
            insertIndex++;
          }
          if (!afterEmpty) {
            const tailId = createIdFactory(this.config.idGenerator)();
            changes.push({
              type: "block:insert",
              block: { id: tailId, type: anchor.type, data: cloneDocument(after) as JsonValue },
              index: insertIndex
            });
            focusTarget = { id: tailId, at: "start" };
          } else {
            focusTarget = { id: lastId(), at: "end" };
          }
        }
      } else {
        // No split support: replace the selection when present, else append.
        let currentData = cloneDocument(anchor.data) as JsonValue;
        if (selectionInAnchor && selection && !selection.collapsed) {
          const range = this.getRange();
          if (range) {
            range.deleteContents();
            try {
              const saved = tool?.save(this.toolElement(anchor.id));
              if (saved && !(saved instanceof Promise)) currentData = saved as JsonValue;
            } catch {
              /* keep current data */
            }
          }
        }
        changes.push({ type: "block:update", id: anchor.id, previous: cloneDocument(anchor.data) as JsonValue, current: currentData });
        let insertIndex = anchorIndex + 1;
        for (const entry of usable) {
          changes.push({ type: "block:insert", block: this.shapedBlock(entry).block, index: insertIndex });
          insertIndex++;
        }
      }
    }

    this.tm.commit(origin, changes);
    // Re-render the anchor when it was updated rather than removed.
    const updatedAnchor = changes.find((c) => c.type === "block:update");
    if (updatedAnchor && updatedAnchor.type === "block:update") {
      const fresh = this.blockManager.getById((updatedAnchor as { id: string }).id);
      if (fresh) this.renderer.convert((updatedAnchor as { id: string }).id, fresh);
    }
    if (focusTarget?.id) this.focusBlock(focusTarget.id, focusTarget.at);
    this.announce("Pasted content inserted");
  }

  private shapedBlock(entry: { type: string; data: JsonValue }): { block: EzynotaBlock } {
    return {
      block: { id: createIdFactory(this.config.idGenerator)(), type: entry.type, data: cloneDocument(entry.data) as JsonValue }
    };
  }

  focusBlock(id: string, at?: "start" | "end"): void {
    if (this.destroyed) return;
    this.renderer.focus(id, at);
  }

  focusNextBlock(id: string, at?: "start" | "end"): boolean {
    const index = this.blockManager.getIndex(id);
    const next = this.state.get().blocks[index + 1];
    if (!next) return false;
    this.focusBlock(next.id, at);
    return true;
  }

  focusPrevBlock(id: string, at?: "start" | "end"): boolean {
    const index = this.blockManager.getIndex(id);
    const prev = this.state.get().blocks[index - 1];
    if (!prev) return false;
    this.focusBlock(prev.id, at);
    return true;
  }

  requestSaveBlock(id: string, origin: ChangeOrigin = "user"): void {
    if (this.destroyed || this.editingLocked) return;
    const block = this.blockManager.getById(id);
    const tool = this.renderer.getTool(id);
    if (!block || !tool) return;
    const version = this.invalidatePendingSave(id);
    try {
      const element = this.toolElement(id);
      const result = tool.save(element) as JsonValue | Promise<JsonValue>;
      if (result instanceof Promise) {
        // Tools may save asynchronously; guard the result against newer
        // edits, block removal and destruction.
        void result.then(
          (data) => this.applySavedBlock(id, data, tool, origin, version),
          (err) => {
            if (!this.destroyed) {
              this.bus.emit("error", new EzynotaError("EZ_SAVE_FAILED", `Save failed for block "${id}"`, { blockId: id }, err));
            }
          }
        );
        return;
      }
      this.applySavedBlock(id, result, tool, origin, version);
    } catch (err) {
      this.bus.emit("error", new EzynotaError("EZ_SAVE_FAILED", `Save failed for block "${id}"`, { blockId: id }, err));
    }
  }

  /** Bump the save epoch for a block; returns the new epoch. */
  private invalidatePendingSave(id: string): number {
    const version = (this.blockSaveVersions.get(id) ?? 0) + 1;
    this.blockSaveVersions.set(id, version);
    return version;
  }

  /** Route a nested child save (e.g. toggle children) to the owning tool. */
  requestSaveNestedChild(parentId: string, childId: string): void {
    if (this.destroyed || this.editingLocked) return;
    const tool = this.renderer.getTool(parentId);
    const saveChild = (tool as unknown as { requestSaveChild?: (id: string) => void }).requestSaveChild;
    if (typeof saveChild === "function") {
      try {
        saveChild.call(tool, childId);
      } catch (err) {
        this.bus.emit("error", new EzynotaError("EZ_SAVE_FAILED", `Save failed for nested block "${childId}"`, { blockId: childId }, err));
      }
    }
  }

  private applySavedBlock(id: string, data: JsonValue, tool: BlockTool, origin: ChangeOrigin, version: number): void {
    if (this.destroyed) return;
    if (this.blockSaveVersions.get(id) !== version) return;
    const block = this.blockManager.getById(id);
    if (!block) return;
    try {
      if (tool.validate) {
        const valid = tool.validate(data as never);
        if (valid === false) {
          this.bus.emit("error", new EzynotaError("EZ_INVALID_DATA", `Invalid data in block "${id}"`, { blockId: id }));
          return;
        }
        if (valid instanceof Promise) {
          void Promise.resolve(valid).then((ok) => {
            if (ok && !this.destroyed && this.blockSaveVersions.get(id) === version && this.blockManager.getById(id)) {
              this.blockManager.update(id, data, origin);
            }
          });
          return;
        }
      }
      this.blockManager.update(id, data, origin);
    } catch (err) {
      this.bus.emit("error", new EzynotaError("EZ_SAVE_FAILED", `Save failed for block "${id}"`, { blockId: id }, err));
    }
  }

  getEditableElement(id: string): HTMLElement | null {
    return this.renderer.getEditableElement(id);
  }

  getTool(id: string): BlockTool | undefined {
    return this.renderer.getTool(id);
  }

  /** Nested child-block operations for tools hosting collapsible sections. */
  nestedHost(parentId: string): import("./core/types").NestedBlockHost {
    return {
      getBlocks: () => cloneDocument(this.blockManager.getById(parentId)?.children ?? []) as EzynotaBlock[],
      insert: (type, data, index) => this.insertNestedBlock(parentId, type, data, index),
      update: (id, data) => this.updateNestedBlock(parentId, id, data),
      remove: (id) => this.removeNestedBlock(parentId, id),
      move: (id, to) => this.moveNestedBlock(parentId, id, to),
      createToolInstance: (block, element, api) => this.renderer.createToolInstancePublic(block, element, parentId, api),
      focusBlock: (id, at) => this.focusBlock(id, at),
      readOnly: this.readOnly
    };
  }

  private commitChildren(parentId: string, children: EzynotaBlock[]): void {
    const parent = this.blockManager.getById(parentId);
    if (!parent) return;
    const previous = cloneDocument(parent.children ?? []) as EzynotaBlock[];
    this.tm.commit("user", [{ type: "children:update", id: parentId, previous, current: children }]);
  }

  private insertNestedBlock(parentId: string, type: string, data: JsonValue | undefined, index?: number): string {
    if (!this.registry.has(type)) throw toolNotFound(type);
    const children = cloneDocument(this.blockManager.getById(parentId)?.children ?? []) as EzynotaBlock[];
    const block: EzynotaBlock = { id: createIdFactory(this.config.idGenerator)(), type, data: (data ?? initialDataShape(type)) as JsonValue };
    const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, block);
    this.commitChildren(parentId, children);
    return block.id;
  }

  private updateNestedBlock(parentId: string, childId: string, data: JsonValue): void {
    const children = cloneDocument(this.blockManager.getById(parentId)?.children ?? []) as EzynotaBlock[];
    const child = children.find((b) => b.id === childId);
    if (!child) return;
    child.data = data;
    this.commitChildren(parentId, children);
  }

  private removeNestedBlock(parentId: string, childId: string): void {
    const children = cloneDocument(this.blockManager.getById(parentId)?.children ?? []) as EzynotaBlock[];
    const index = children.findIndex((b) => b.id === childId);
    if (index < 0) return;
    children.splice(index, 1);
    this.commitChildren(parentId, children);
  }

  private moveNestedBlock(parentId: string, childId: string, to: number): void {
    const children = cloneDocument(this.blockManager.getById(parentId)?.children ?? []) as EzynotaBlock[];
    const from = children.findIndex((b) => b.id === childId);
    if (from < 0) return;
    const [child] = children.splice(from, 1);
    if (!child) return;
    children.splice(Math.max(0, Math.min(to, children.length)), 0, child);
    this.commitChildren(parentId, children);
  }

  getRange(): Range | null {
    return this.selectionManager.getRange();
  }

  getSelectionInfo(): import("./types").EditorSelection | null {
    return this.selectionManager.getSelection();
  }

  setSelectionFromRange(range: Range): void {
    this.selectionManager.setRange(range);
  }

  announce(message: string): void {
    if (!this.announcerEl) return;
    this.announcerEl.textContent = message;
  }

  closeMenus(): void {
    this.slashMenu?.close();
    if (this.blockToolbar) this.blockToolbar.hide();
    this.inlineToolbar?.hide();
    this.documentToolbar?.hide();
    this.holderEl.dispatchEvent(new Event("ez-close-popovers"));
  }

  undoInternal(): void {
    this.undo();
  }

  redoInternal(): void {
    this.redo();
  }

  dispatchInlineTool(name: string): void {
    applyInlineTool(this, name);
    this.inlineToolbar?.refresh();
    this.documentToolbar?.refresh();
  }

  /* ===================== Workspace host bridge ===================== */

  /** Title changes route through an undoable transaction (document metadata). */
  setDocumentTitle(title: string): void {
    if (this.destroyed || this.editingLocked) return;
    const previous = this.currentTitle();
    if (previous === title) return;
    this.tm.commit("user", [{ type: "title:update", previous, current: title }]);
  }

  currentTitle(): string {
    const meta = (this.state.get().meta as { title?: unknown } | undefined) ?? {};
    return typeof meta.title === "string" ? meta.title : "";
  }

  /** Per-note undo/redo isolation: snapshot or restore in-memory history. */
  exportHistoryState(): import("./core/history").HistoryState {
    return this.history.exportState();
  }

  importHistoryState(state: import("./core/history").HistoryState): void {
    this.history.importState(state);
    this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  /** Find/replace across blocks of the active document. */
  findReplace(query: string, replaceWith: string, replaceAll: boolean): void {
    this.findReplaceEngine?.(query, replaceWith, replaceAll);
  }

  private findReplaceEngine: ((query: string, replaceWith: string, replaceAll: boolean) => void) | null = null;

  /** Register the find/replace engine once loaded (called during setup). */
  private wireFindReplace(): void {
    void import("./features/find-replace").then(({ createFindReplace }) => {
      this.findReplaceEngine = createFindReplace(this, this.surfaceEl);
    });
  }

  /** Markdown typing shortcuts (headings, lists, quotes, inline marks). */
  private setupMarkdownShortcuts(): void {
    if (this.mode === "headless" || this.config.readOnly) return;
    void import("./input/markdown-shortcuts").then(({ MarkdownShortcuts }) => {
      if (this.destroyed) return;
      const shortcuts = new MarkdownShortcuts(this, this.surfaceEl);
      shortcuts.start();
      this.disposers.push(() => shortcuts.stop());
    });
  }

  /* ===================== Internals ===================== */

  private toolElement(id: string): HTMLElement {
    return this.renderer.getBlockElement(id) ?? this.holderEl;
  }

  /** Emit a bubbling, composed DOM event carrying the instance + payload. */
  private emitDomEvent(name: string, payload?: JsonValue): void {
    const detail = { instance: this, ...(payload !== undefined ? { payload } : {}) };
    this.holderEl.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  /** Apply the UI theme (light/dark/system) and track system changes. */
  private applyTheme(theme: WorkspaceTheme): void {
    this.holderEl.setAttribute("data-ez-theme", theme);
    let resolved: "light" | "dark" = theme === "dark" ? "dark" : theme === "light" ? "light" : "light";
    try {
      if (theme === "system") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        resolved = media.matches ? "dark" : "light";
        const listener = (): void => {
          const next = media.matches ? "dark" : "light";
          this.holderEl.setAttribute("data-ez-resolved-theme", next);
        };
        media.addEventListener("change", listener);
        this.themeListenerDisposer?.();
        this.themeListenerDisposer = () => media.removeEventListener("change", listener);
      }
    } catch {
      /* matchMedia unavailable */
    }
    this.holderEl.setAttribute("data-ez-resolved-theme", resolved);
  }

  private resolveHolder(holder: HTMLElement | string): HTMLElement {
    const el = typeof holder === "string" ? document.querySelector<HTMLElement>(holder) : holder;
    if (!el) {
      throw new EzynotaError("EZ_RENDER_FAILED", `Holder not found: ${typeof holder === "string" ? holder : "element"}`);
    }
    return el;
  }

  private registerBuiltinTools(): void {
    this.registry.registerBlockTool("paragraph", Paragraph, true);
    this.registry.registerBlockTool("heading", Heading);
    this.registry.registerBlockTool("list", ListTool);
    this.registry.registerBlockTool("quote", Quote);
    this.registry.registerBlockTool("code", CodeTool);
    this.registry.registerBlockTool("delimiter", Delimiter);
    this.registry.registerBlockTool("table", TableTool);
    this.registry.registerBlockTool("image", ImageTool);
    this.registry.registerBlockTool("callout", CalloutTool);
    this.registry.registerBlockTool("toggle", ToggleTool);
  }

  private registerUserTools(config: EzynotaConfig): void {
    for (const [name, tool] of Object.entries(config.tools ?? {})) {
      this.registry.registerBlockTool(name, tool as unknown as ToolDefinition, name === config.defaultBlock);
    }
    for (const tool of config.inlineTools ?? []) {
      const name = inlineToolName(tool);
      this.registry.registerInlineTool(name, tool as never);
    }
    if ((config.inlineTools ?? []).length === 0 && this.uiEnabled()) {
      for (const [name, cls] of Object.entries(BUILTIN_INLINE_TOOLS)) {
        this.registry.registerInlineTool(name, cls as never);
      }
    }
    for (const tune of config.tunes ?? []) {
      const name = tuneName(tune);
      this.registry.registerTune(name, tune as never);
    }
    if ((config.tunes ?? []).length === 0) {
      this.registry.registerTune("alignment", AlignmentTune);
    }
  }

  private registerBuiltinCommands(): void {
    const commands: [string, (payload: JsonValue) => void][] = [
      [EZ.INSERT_BLOCK, (p) => {
        const { type, data, index } = p as { type: string; data?: JsonValue; index?: number };
        this.insertBlock(type, data, { index, focus: true });
      }],
      [EZ.DELETE_BLOCK, (p) => this.removeBlock((p as { id: string }).id)],
      [EZ.MOVE_BLOCK, (p) => {
        const { id, to } = p as { id: string; to: number };
        this.moveBlock(id, to);
      }],
      [EZ.DUPLICATE_BLOCK, (p) => this.duplicateBlock((p as { id: string }).id)],
      [EZ.CONVERT_BLOCK, (p) => {
        const { id, type } = p as { id: string; type: string };
        this.convertBlock(id, type);
      }],
      [EZ.UPDATE_BLOCK, (p) => {
        const { id, data } = p as { id: string; data: JsonValue };
        this.updateBlock(id, data);
      }],
      [EZ.FOCUS_BLOCK, (p) => {
        const { id, at } = p as { id: string; at?: "start" | "end" };
        this.focusBlock(id, at);
      }],
      [EZ.UNDO, () => this.undo()],
      [EZ.REDO, () => this.redo()],
      [EZ.OPEN_SLASH_MENU, (p) => {
        const id = (p as { blockId?: string }).blockId;
        const selection = this.getSelectionInfo();
        if (id) this.slashMenu?.open(id);
        else if (selection) this.slashMenu?.open(selection.blockId);
      }],
      [EZ.SET_READ_ONLY, (p) => this.setReadOnly((p as { value: boolean }).value)]
    ];
    for (const [name, run] of commands) {
      this.commands.register({ name, run: (payload: JsonValue) => run(payload) });
    }
  }

  private migrateInitialData(data: EzynotaDocument | null | undefined): EzynotaDocument | null {
    if (!data) return null;
    return this.migrateDocument(data);
  }

  /**
   * Build the document state without letting malformed payloads crash the
   * host application: invalid blocks are salvaged into read-only
   * "unknown" placeholders (or the editor starts empty when the envelope
   * itself is unusable) instead of throwing out of the constructor.
   */
  private createState(document: EzynotaDocument | null): DocumentState {
    try {
      return new DocumentState(document, createIdFactory(this.config.idGenerator));
    } catch (error) {
      const result = salvageDocument(document, createIdFactory(this.config.idGenerator));
      if (!result.document) {
        this.bus.emit("error", new EzynotaError("EZ_INVALID_DOCUMENT", "The document payload is unusable; the editor started empty", undefined, error));
        return new DocumentState(null, createIdFactory(this.config.idGenerator));
      }
      this.bus.emit(
        "error",
        new EzynotaError("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: result.dropped }, error)
      );
      return new DocumentState(result.document, createIdFactory(this.config.idGenerator));
    }
  }

  private migrateDocument(document: EzynotaDocument): EzynotaDocument {
    const version = document?.schemaVersion;
    if (!version || version === SCHEMA_VERSION) {
      this.recoveryMode = false;
      this.originalDocument = null;
      return document;
    }
    // Backwards migration only: a NEWER schema version must never be
    // relabeled as current (that would misrepresent future content).
    const canMigrate = compareVersions(version, SCHEMA_VERSION) < 0 && this.migrations.canMigrate(version, SCHEMA_VERSION);
    if (canMigrate) {
      this.recoveryMode = false;
      this.originalDocument = null;
      return this.migrations.migrate(document, SCHEMA_VERSION);
    }
    // Unknown schema: keep the payload verbatim and open the editor in a
    // protected read-only recovery state (spec §19).
    this.recoveryMode = true;
    this.originalDocument = cloneDocument(document);
    this.bus.emit(
      "error",
      new EzynotaError("EZ_MIGRATION_FAILED", `Document schema "${version}" is not supported; opened in read-only recovery mode`, { schemaVersion: version })
    );
    return document;
  }

  private setupDom(): void {
    this.holderEl.classList.add("ez-editor-mount");
    if (this.mode === "workspace" || this.mode === "document") {
      // The engine mounts into an inner surface; the holder becomes the
      // workspace shell root (sidebar + header are built by the controller).
      this.holderEl.setAttribute("data-ez-mode", this.mode);
      this.surfaceEl = document.createElement("div");
      this.surfaceEl.className = "ez-editor";
      this.holderEl.appendChild(this.surfaceEl);
    } else {
      this.holderEl.classList.add("ez-editor");
      this.holderEl.setAttribute("data-ez-mode", this.mode);
      this.surfaceEl = this.holderEl;
    }
    if (this.config.readOnly) this.surfaceEl.classList.add("ez-readonly");
    if (this.config.minHeight) this.surfaceEl.style.minHeight = `${this.config.minHeight}px`;
    this.surfaceEl.setAttribute("dir", document.body.getAttribute("dir") ?? (this.config.locale === "he" || this.config.locale === "ar" || this.config.locale === "fa" || this.config.locale === "ur" ? "rtl" : "ltr"));
    this.announcerEl = document.createElement("div");
    this.announcerEl.className = "ez-visually-hidden";
    this.announcerEl.setAttribute("aria-live", "polite");
    this.announcerEl.setAttribute("role", "status");
    this.surfaceEl.appendChild(this.announcerEl);
  }

  private setupDefaultUi(): void {
    if (!this.uiEnabled()) return;
    const ui = this.config.ui;
    const uiConfig = typeof ui === "object" ? ui : {};
    // Controls use document-surface coordinates and must move with that
    // surface when the workspace shell wraps it with the sidebar and header.
    if (uiConfig.blockToolbar !== false) {
      this.blockToolbar = new BlockToolbar(this);
      this.surfaceEl.appendChild(this.blockToolbar.getElement());
      this.surfaceEl.classList.add("ez-has-block-toolbar");
    }
    if (uiConfig.inlineToolbar !== false) {
      this.inlineToolbar = new InlineToolbar(this);
      this.inlineToolbar.getElement().style.display = "none";
      this.surfaceEl.appendChild(this.inlineToolbar.getElement());
    }
    if (uiConfig.slashMenu !== false) {
      this.slashMenu = new SlashMenu(this);
      this.surfaceEl.appendChild(this.slashMenu.getElement());
    }
    if (uiConfig.documentToolbar === true) {
      this.documentToolbar = new InlineToolbar(this, true);
      this.surfaceEl.prepend(this.documentToolbar.getElement());
    }
  }

  private uiEnabled(): boolean {
    return this.config.ui !== false;
  }

  private wireEvents(): void {
    const offError = this.bus.on("error", (error) => {
      this.emitDomEvent("ezn:error", { message: error.message, code: error.code });
    });
    const offSelection = this.selectionManager.on("selection", (selection) => {
      this.inlineToolbar?.updateSelection(selection);
      this.documentToolbar?.updateSelection(selection);
      this.bus.emit("selection:changed", selection);
      if (selection && !selection.collapsed) {
        if (this.blockToolbar) this.blockToolbar.hide();
      } else if (selection) {
        this.blockToolbar?.showFor(selection.blockId);
      }
    });
    const offFocus = this.selectionManager.on("focus", () => this.bus.emit("focus"));
    const offBlur = this.selectionManager.on("blur", () => {
      this.closeMenus();
      this.bus.emit("blur");
    });
    const offInput = this.inputManager.onBlockInput((blockId) => {
      if (!this.slashMenu) return;
      const text = (this.getEditableElement(blockId)?.textContent ?? "").trim();
      if (text === "/") {
        this.slashMenu.open(blockId);
      } else if (this.slashMenu.isOpenMenu()) {
        if (text === "" || text.startsWith("/")) {
          this.slashMenu.setQuery(text.replace(/^\//, ""));
        } else {
          this.slashMenu.close();
        }
      }
    });
    this.disposers.push(offError, offSelection, offFocus, offBlur, offInput);
  }

  /** Single post-commit path: history + DOM sync + events. */
  private handleCommit(batch: ChangeBatch): void {
    // History restores supersede async tool saves that are still in flight,
    // otherwise a slow save() re-applies pre-undo data over the restored
    // state (undo race).
    if (batch.origin === "history") {
      for (const change of batch.changes) {
        if (change.type === "block:update" || change.type === "block:remove" || change.type === "children:update") {
          this.invalidatePendingSave(change.id);
        }
      }
    }
    // Document replacements are handled explicitly (render/clear reset the
    // history) — they have no reversible payload for mechanical inversion.
    const replaceOnly = batch.changes.length > 0 && batch.changes.every((c) => c.type === "document:replace");
    let recorded = false;
    if (batch.origin !== "history" && !replaceOnly) {
      this.history.record({ origin: batch.origin, changes: batch.changes, timestamp: batch.timestamp }, this.getSelectionInfo());
      recorded = true;
    }
    for (const change of batch.changes) {
      this.applyToDom(change, batch.origin);
    }
    // Capture the post-change caret for redo only after the DOM applied
    // the change (record time is intentionally pre-change for undo).
    if (recorded) this.history.updatePostSelection(this.getSelectionInfo());
    this.bus.emit("change", batch);
    this.emitDomEvent("ezn:change", { origin: batch.origin, batchId: batch.id });
    for (const change of batch.changes) {
      switch (change.type) {
        case "block:insert":
          this.bus.emit("block:inserted", { id: change.block.id, index: change.index });
          break;
        case "block:remove":
          this.bus.emit("block:removed", { id: change.id, index: change.index });
          break;
        case "block:move":
          this.bus.emit("block:moved", { id: change.id, from: change.from, to: change.to });
          break;
        case "block:update":
          this.bus.emit("block:updated", { id: change.id });
          break;
        case "block:convert":
          this.bus.emit("block:updated", { id: change.id });
          break;
        case "tune:update":
          this.bus.emit("block:updated", { id: change.id });
          break;
        case "title:update":
          this.documentToolbar?.refresh();
          this.bus.emit("block:updated", { id: "title" });
          break;
        case "children:update":
          this.bus.emit("block:updated", { id: change.id });
          break;
        case "document:replace":
          break;
      }
    }
    // A throwing consumer callback must never break transaction processing.
    try {
      this.config.onChange?.(this, batch);
    } catch (err) {
      this.bus.emit("error", new EzynotaError("EZ_UNKNOWN_ERROR", "An onChange handler threw", undefined, err));
    }
    this.documentToolbar?.refresh();
    this.inlineToolbar?.refresh();
  }

  private applyToDom(change: EzynotaChange, origin: ChangeOrigin): void {
    switch (change.type) {
      case "block:insert": {
        const block = this.blockManager.getById(change.block.id);
        if (block) this.renderer.insert(block, change.index, origin);
        break;
      }
      case "block:remove":
        this.renderer.remove(change.id);
        break;
      case "block:move":
        this.renderer.move(change.id, change.to);
        break;
      case "block:update": {
        const block = this.blockManager.getById(change.id);
        if (block) this.renderer.update(change.id, origin);
        break;
      }
      case "block:convert": {
        const block = this.blockManager.getById(change.id);
        if (block) this.renderer.convert(change.id, block);
        break;
      }
      case "tune:update": {
        const block = this.blockManager.getById(change.id);
        if (block) this.renderer.convert(change.id, block);
        break;
      }
      case "children:update": {
        const block = this.blockManager.getById(change.id);
        if (block) this.renderer.update(change.id, origin);
        break;
      }
      case "document:replace":
        break;
    }
  }

  /** Full document replace. The caller owns history reset (undoable or not). */
  private blockManagerReplaceAll(next: EzynotaDocument): void {
    try {
      this.state.replace(next, createIdFactory(this.config.idGenerator));
    } catch (error) {
      const result = salvageDocument(next, createIdFactory(this.config.idGenerator));
      if (!result.document) throw error;
      this.bus.emit(
        "error",
        new EzynotaError("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: result.dropped }, error)
      );
      this.state.replace(result.document, createIdFactory(this.config.idGenerator));
    }
    this.tm.commit("api", [{ type: "document:replace" }]);
    this.renderer.renderAll(this.state.get().blocks);
  }

  /** Restore the caret recorded with a history entry (undo/redo). */
  private restoreHistorySelection(selection: EditorSelection | null): void {
    if (!selection || this.readOnly) return;
    const editable = this.getEditableElement(selection.blockId);
    if (!editable) return;
    editable.focus();
    setCaretAtTextOffset(editable, selection.focusOffset > selection.anchorOffset ? selection.focusOffset : selection.anchorOffset);
  }

  /* ===================== Declarative initialization ===================== */

  /** Initialize every `[data-ezn-editor]` under `root` (default: document). */
  static initAll(root?: ParentNode): Ezynota[] {
    return initAllDeclarative(root);
  }

  /** Look up the instance for an element or selector. */
  static getInstance(elementOrSelector: Element | string): Ezynota | undefined {
    return getInstanceDeclarative(elementOrSelector);
  }

  private blockRef(id: string): BlockRef | undefined {
    const block = this.blockManager.getById(id);
    if (this.blockManager.getIndex(id) < 0 || !block) return undefined;
    const getType = (): string => this.blockManager.getById(id)?.type ?? "";
    const getIndex = (): number => this.blockManager.getIndex(id);
    return {
      id,
      get type() {
        return getType();
      },
      get index() {
        return getIndex();
      },
      getData: () => JSON.parse(JSON.stringify(block.data)) as JsonValue,
      update: (data) => this.updateBlock(id, data),
      patch: (data) => {
        const current = (this.getBlockData(id) as Record<string, unknown>) ?? {};
        this.updateBlock(id, { ...current, ...data } as JsonValue);
      },
      remove: () => this.removeBlock(id),
      move: (position) => this.moveBlock(id, position),
      duplicate: () => this.duplicateBlock(id),
      convert: (targetType) => this.convertBlock(id, targetType)
    };
  }
}

/** Deep-clone any JSON-safe payload (state data must never be shared). */
function cloneDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialDataShape(type: string): JsonValue {  switch (type) {
    case "paragraph":
    case "quote":
      return { content: [] as InlineContent[] } as unknown as JsonValue;
    case "heading":
      return { level: 2, content: [] as InlineContent[] } as unknown as JsonValue;
    case "list":
      return { style: "unordered", items: [{ content: [] as InlineContent[] }] } as unknown as JsonValue;
    case "code":
      return { code: "" };
    case "delimiter":
      return {};
    default:
      return {};
  }
}

function inlineToolName(tool: unknown): string {
  const constructor = (tool as { class?: unknown }).class ?? tool;
  const builtin = Object.entries(BUILTIN_INLINE_TOOLS).find(([, cls]) => cls === constructor);
  if (builtin) return builtin[0];
  const cls = tool as { name?: string; class?: new (...args: never[]) => unknown };
  return (cls.class?.name ?? cls.name ?? `inline-${Math.random().toString(36).slice(2, 8)}`).toLowerCase();
}

function tuneName(tune: unknown): string {
  if (tune === AlignmentTune || (tune as { class?: unknown }).class === AlignmentTune) return "alignment";
  const cls = tune as { class?: { name?: string }; name?: string };
  return cls.class?.name ?? cls.name ?? `tune-${Math.random().toString(36).slice(2, 8)}`;
}

export type { ToolDefinition, TextBlockTool };

/** Resolve the lifecycle mode from config (spec: mode / ui:false / default). */
function resolveMode(config: EzynotaConfig): import("./types").EzynotaMode {
  if (config.mode) return config.mode;
  if (config.ui === false) return "headless";
  return "workspace";
}
