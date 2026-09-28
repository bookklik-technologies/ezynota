import type { EzynotaDocument, FocusOptions, EzynotaEvents } from "../types";
import type { FolderRecord, NoteRecord, SearchHit, StorageAdapter, WorkspaceBackup, WorkspaceTheme } from "./types";
import { WorkspaceState } from "./workspace";
import type { HistoryState } from "../core/history";
/** What the controller needs from the Ezynota editor instance. */
export interface WorkspaceHost {
    readonly readOnly: boolean;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    getSnapshot(): Readonly<EzynotaDocument>;
    render(document: EzynotaDocument): Promise<void>;
    focus(options?: FocusOptions): void;
    focusBlock(id: string, at?: "start" | "end"): void;
    getBlockIndex(id: string): number;
    setReadOnly(value: boolean): void;
    setDocumentTitle(title: string): void;
    on<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): () => void;
    exportHistoryState(): HistoryState;
    importHistoryState(state: HistoryState): void;
    announce(message: string): void;
}
export interface WorkspaceControllerOptions {
    targetId: string | null;
    explicitWorkspaceId?: string;
    storage?: StorageAdapter | (() => StorageAdapter);
    theme?: WorkspaceTheme;
    initialData?: EzynotaDocument | null;
    /** Sidebar shown for workspace mode; document mode shows only the writing surface. */
    showSidebar?: boolean;
    onEvent?: (event: import("./types").WorkspaceEvent) => void;
}
/**
 * WorkspaceController owns note sessions: it swaps documents and undo
 * histories when notes change, autosaves through WorkspaceState, and
 * exposes the public `editor.workspace` API.
 */
export declare class WorkspaceController {
    readonly state: WorkspaceState;
    private host;
    private ui;
    private suggester;
    private histories;
    private disposers;
    private destroyed;
    private theme;
    private themeMedia;
    private fullscreenOn;
    private fullscreenPending;
    private surface;
    private lastFocus;
    private switching;
    private options;
    constructor(host: WorkspaceHost, surface: HTMLElement, options: WorkspaceControllerOptions);
    /** Bridge to the UI deps (set during construction) for note navigation. */
    private depsBridge;
    /** Store a file as a workspace asset; resolves to `asset:<id>`. */
    private storeFile;
    /** Load stored notes and open the first one. Resolves when the workspace is usable. */
    start(): Promise<void>;
    destroy(): void;
    private persistActiveNote;
    /** Serialize writes: one async save at a time, then autosave on idle. */
    saveActiveNote(): Promise<void>;
    private loadGeneration;
    private loadNoteIntoEditor;
    private noteTitleOf;
    private emit;
    toggleFullscreen(force?: boolean): Promise<void>;
    isFullscreen(): boolean;
    private onFullscreenChange;
    private removeFullscreenListeners;
    setTheme(theme: WorkspaceTheme): void;
    getTheme(): WorkspaceTheme;
    resolvedTheme(): "light" | "dark";
    private buildDeps;
    getActiveNoteId(): string | null;
    openNoteById(id: string): Promise<void>;
    exportActiveNote(format: "json" | "md" | "html" | "txt"): Promise<void>;
    importFiles(files: File[]): Promise<void>;
    private reportImportError;
    /** Report a runtime failure to the UI banner and the host event listener. */
    private reportRuntimeError;
    createBackup(): Promise<void>;
    restoreBackupFile(file: File): Promise<void>;
    /** Restore a workspace backup under a new workspace ID by default. */
    restoreBackup(backup: WorkspaceBackup): Promise<{
        workspaceId: string;
    }>;
    retryLoad(): Promise<void>;
    /** Recovery download: retain the last known stored payload. */
    downloadStoredData(): void;
    findInDocument(query: string, replaceWith: string, replaceAll: boolean): Promise<void>;
    /** Set by the editor when it wires the find/replace engine. */
    findEngine: ((query: string, replaceWith: string, replaceAll: boolean) => void) | null;
    wordCount(): number;
    private legacyDraft;
    importLegacyDraft(data: string): Promise<void>;
    /** Search across titles and text (public API). */
    search(query: string): SearchHit[];
    /** Notes linking to the given note. */
    backlinks(noteId: string): NoteRecord[];
    /** Read-only projection of workspace notes (public API). */
    listNotes(includeTrashed?: boolean): readonly NoteRecord[];
    listFolders(includeTrashed?: boolean): readonly FolderRecord[];
    /** Resolve the active note document into a portable HTML string. */
    activeNoteHtml(): Promise<string>;
    /** Resolve assets to data URLs for external consumers. */
    portableSnapshot(): Promise<EzynotaDocument>;
    get generatorVersion(): string;
}
