import { BlockManager } from "./core/block-manager";
import { ToolRegistry } from "./core/tool-registry";
import { I18n } from "./i18n/i18n";
import type { BlockPosition, BlockRef, BlockTool, ChangeOrigin, EzynotaChange, EzynotaConfig, EzynotaDocument, EzynotaEditorAPI, EzynotaEvents, FocusOptions, InsertBlockOptions, JsonValue, ToolDefinition } from "./types";
import { TextBlockTool } from "./tools/text-tools";
import type { Host } from "./host";
import { WorkspaceController } from "./workspace/controller";
import type { WorkspaceHost } from "./workspace/controller";
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
export declare class Ezynota implements Host, EzynotaEditorAPI, WorkspaceHost {
    ready: Promise<void>;
    private config;
    private targetEl;
    /** The document surface: inner element in workspace modes, otherwise the target. */
    private surfaceEl;
    private bus;
    private state;
    private tm;
    private blockManager;
    private history;
    private commands;
    readonly registry: ToolRegistry;
    private migrations;
    private i18nInstance;
    private renderer;
    private selectionManager;
    private inputManager;
    private keyboardManager;
    private clipboardManager;
    private dragManager;
    private blockToolbar;
    private inlineToolbar;
    private documentToolbar;
    private slashMenu;
    private announcerEl;
    private destroyed;
    private defaultBlockName;
    private resolveReady;
    private disposers;
    /** Read-only recovery state for documents from a newer/unknown schema. */
    private recoveryMode;
    private originalDocument;
    /** True while recovery mode has force-latched readOnly over the user's config. */
    private recoveryLocked;
    /** The user-configured readOnly value before recovery latched it. */
    private preRecoveryReadOnly;
    /** Guards async tool saves against newer edits or destruction. */
    private blockSaveVersions;
    /** Resolved lifecycle mode. */
    private mode;
    /** Workspace note management (workspace/document modes only). */
    private workspaceController;
    /** Editing is prevented until the initial workspace load completes. */
    private editingLocked;
    private themeListenerDisposer;
    /** Set by Ezynota.initAll for declaratively created instances. */
    declarative: boolean;
    constructor(config: EzynotaConfig);
    /** Run the consumer onReady callback without letting it break the boot. */
    private fireReady;
    /** Map workspace lifecycle events onto the public event bus. */
    private onWorkspaceEvent;
    /** Async workspace boot: load notes, then unlock editing and fire ready. */
    private initializeWorkspace;
    /**
     * Mutations are rejected while the initial workspace load is still in
     * flight: anything committed before the note render would be silently
     * wiped by the document replacement. Await `editor.ready` first.
     */
    private assertEditable;
    save(): Promise<EzynotaDocument>;
    getSnapshot(): Readonly<EzynotaDocument>;
    /** True when an unsupported document is open in protected read-only mode. */
    isRecoveryMode(): boolean;
    /** The untouched payload of a document that could not be migrated. */
    getOriginalDocument(): Readonly<EzynotaDocument> | null;
    render(document: EzynotaDocument): Promise<void>;
    /** Force readOnly for recovery mode, remembering the user's own setting. */
    private latchRecoveryReadOnly;
    /** Undo a recovery read-only latch once a valid document is rendered. */
    private clearRecoveryLock;
    clear(): void;
    focus(options?: FocusOptions): void;
    setReadOnly(value: boolean): void;
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
    private refreshAfterHistory;
    canUndo(): boolean;
    canRedo(): boolean;
    on<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): () => void;
    /** Public actions go through commands — no event impersonation (spec §8.2). */
    dispatch<T extends JsonValue>(command: string, payload: T): void;
    destroy(): void;
    get target(): HTMLElement;
    /** Editing stays locked until the initial workspace load completes. */
    get readOnly(): boolean;
    get i18n(): I18n;
    get blocks(): BlockManager;
    get defaultBlock(): string;
    get placeholder(): string;
    /** Resolved lifecycle mode. */
    getMode(): import("./types").EzynotaMode;
    /**
     * Workspace note management (workspace/document modes): note/folder CRUD,
     * navigation, search, trash, backup/restore, fullscreen and themes.
     */
    get workspace(): WorkspaceController | null;
    openBlockPicker(blockId?: string, insert?: boolean): void;
    isDestroyed(): boolean;
    getBlockData(id: string): JsonValue | undefined;
    getBlockType(id: string): string | undefined;
    updateBlockData(id: string, data: JsonValue, origin?: ChangeOrigin): void;
    /** Commit raw changes as one transaction (used by typed internal modules). */
    commitChanges(origin: ChangeOrigin, changes: EzynotaChange[]): void;
    mergeBlocks(prevId: string, currentId: string, origin?: ChangeOrigin): void;
    /**
     * Split a block in ONE transaction: `before` replaces the block data,
     * `after` becomes a new block of the same type directly below. A single
     * history entry means one undo restores the pre-split block completely.
     */
    splitBlock(id: string, before: JsonValue, after: JsonValue): string;
    /**
     * Paste pasted content relative to the caret as ONE transaction:
     * - empty anchor block → the block is replaced by the pasted content;
     * - non-collapsed selection → replaced by the pasted content;
     * - caret mid-content → the anchor block splits around the paste;
     * - otherwise → content is inserted after the anchor block.
     */
    pasteBlocks(entries: {
        type: string;
        data: JsonValue;
    }[], blockId: string, origin?: ChangeOrigin): void;
    private shapedBlock;
    focusBlock(id: string, at?: "start" | "end"): void;
    focusNextBlock(id: string, at?: "start" | "end"): boolean;
    focusPrevBlock(id: string, at?: "start" | "end"): boolean;
    requestSaveBlock(id: string, origin?: ChangeOrigin): void;
    /** Bump the save epoch for a block; returns the new epoch. */
    private invalidatePendingSave;
    /** Route a nested child save (e.g. toggle children) to the owning tool. */
    requestSaveNestedChild(parentId: string, childId: string): void;
    private applySavedBlock;
    getEditableElement(id: string): HTMLElement | null;
    getTool(id: string): BlockTool | undefined;
    /** Nested child-block operations for tools hosting collapsible sections. */
    nestedHost(parentId: string): import("./core/types").NestedBlockHost;
    private commitChildren;
    private insertNestedBlock;
    private updateNestedBlock;
    private removeNestedBlock;
    private moveNestedBlock;
    getRange(): Range | null;
    getSelectionInfo(): import("./types").EditorSelection | null;
    setSelectionFromRange(range: Range): void;
    announce(message: string): void;
    closeMenus(): void;
    undoInternal(): void;
    redoInternal(): void;
    dispatchInlineTool(name: string): void;
    /** Title changes route through an undoable transaction (document metadata). */
    setDocumentTitle(title: string): void;
    currentTitle(): string;
    /** Per-note undo/redo isolation: snapshot or restore in-memory history. */
    exportHistoryState(): import("./core/history").HistoryState;
    importHistoryState(state: import("./core/history").HistoryState): void;
    /** Find/replace across blocks of the active document. */
    findReplace(query: string, replaceWith: string, replaceAll: boolean): void;
    private findReplaceEngine;
    /** Register the find/replace engine once loaded (called during setup). */
    private wireFindReplace;
    /** Markdown typing shortcuts (headings, lists, quotes, inline marks). */
    private setupMarkdownShortcuts;
    private toolElement;
    /** Emit a bubbling, composed DOM event carrying the instance + payload. */
    private emitDomEvent;
    /** Apply the UI theme (light/dark/system) and track system changes. */
    private applyTheme;
    private resolveTarget;
    private registerBuiltinTools;
    private registerUserTools;
    private registerBuiltinCommands;
    private migrateInitialData;
    /**
     * Build the document state without letting malformed payloads crash the
     * host application: invalid blocks are salvaged into read-only
     * "unknown" placeholders (or the editor starts empty when the envelope
     * itself is unusable) instead of throwing out of the constructor.
     */
    private createState;
    private migrateDocument;
    private setupDom;
    private setupDefaultUi;
    private uiEnabled;
    private wireEvents;
    /** Single post-commit path: history + DOM sync + events. */
    private handleCommit;
    private applyToDom;
    /** Full document replace. The caller owns history reset (undoable or not). */
    private blockManagerReplaceAll;
    /** Restore the caret recorded with a history entry (undo/redo). */
    private restoreHistorySelection;
    /** Initialize every `[data-ezn-editor]` under `root` (default: document). */
    static initAll(root?: ParentNode): Ezynota[];
    /** Look up the instance for an element or selector. */
    static getInstance(elementOrSelector: Element | string): Ezynota | undefined;
    private blockRef;
}
export type { ToolDefinition, TextBlockTool };
