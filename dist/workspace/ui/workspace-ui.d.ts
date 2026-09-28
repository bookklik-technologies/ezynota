import type { WorkspaceState } from "../workspace";
import type { SearchHit, WorkspaceTheme } from "../types";
import type { EzynotaBlock } from "../../types";
export interface WorkspaceUIDeps {
    undo(): void;
    redo(): void;
    getHistoryState(): {
        canUndo: boolean;
        canRedo: boolean;
    };
    createNote(title?: string, folderId?: string | null): string | null;
    createFolder(name?: string, parentId?: string | null): string | null;
    renameNote(id: string, title: string): void;
    renameWorkspace(name: string): void;
    renameFolder(id: string, name: string): void;
    moveNote(id: string, folderId: string | null): void;
    moveFolder(id: string, parentId: string | null): boolean;
    /** Returns a promise when the note load is asynchronous (used to queue goToBlock). */
    openNote(id: string): void | Promise<void>;
    openFolder(id: string | null): void;
    duplicateNote(id: string): void;
    trashNote(id: string): void;
    trashFolder(id: string): void;
    restoreNote(id: string): void;
    deleteNoteForever(id: string): void;
    restoreFolder(id: string): void;
    deleteFolderForever(id: string): void;
    emptyTrash(): void;
    retrySave(): void;
    searchWorkspace(query: string): SearchHit[];
    exportActiveNote(format: "json" | "md" | "html" | "txt"): void;
    printActiveNote(): void;
    importFiles(files: File[]): void;
    createBackup(): void;
    restoreBackupFile(file: File): void;
    setTheme(theme: WorkspaceTheme): void;
    toggleFullscreen(): void;
    retryLoad(): void;
    downloadOriginal(): void;
    findInDocument(query: string, replaceWith: string, replaceAll: boolean): void;
    goToBlock(blockId: string): void;
    getWordCount(): number;
    getLegacyDraft(): string | null;
    importLegacyDraft(data: string): void;
    dismissLegacyDraft(): void;
}
/**
 * WorkspaceUI renders the notes workspace shell around the document
 * surface: sidebar, header, outline, search and fullscreen. It is a view
 * of WorkspaceState and never mutates data directly — all actions go
 * through the controller-provided deps.
 */
export declare class WorkspaceUI {
    private root;
    private state;
    private deps;
    private showSidebar;
    private sidebar;
    private sidebarToggle;
    private notesTree;
    private noteCount;
    private searchInput;
    private searchResults;
    private titleInput;
    private workspaceTitle;
    private breadcrumbs;
    private saveStatusEl;
    private saveStatusDot;
    private wordCountEl;
    private outlinePanel;
    private fullscreenBtn;
    private undoButton;
    private redoButton;
    private themeMenu;
    private docMenu;
    private exportMenu;
    private importInput;
    private errorPanel;
    private legacyPanel;
    private noticeEl;
    private noticeTimer;
    private findDialog;
    private findReturnFocus;
    private findInput;
    private replaceInput;
    private disposers;
    private expandedFolders;
    private refreshTimer;
    private treeDrag;
    private treeDropHighlight;
    constructor(root: HTMLElement, state: WorkspaceState, deps: WorkspaceUIDeps, showSidebar?: boolean);
    mount(): void;
    destroy(): void;
    /** Public event entry point used by the controller. */
    notifyEvent(event: import("../types").WorkspaceEvent): void;
    refreshHistory(): void;
    /** Highlight and expand a folder in the sidebar tree. */
    highlightFolder(folderId: string): void;
    private handleEvent;
    private scheduleSidebarRefresh;
    private scheduleHeaderRefresh;
    private buildShell;
    private buildSidebarToggle;
    /** Suite-standard topbar: brand + document actions, shared with the shell. */
    private buildTopbar;
    private buildSidebarContent;
    private closeMobileSidebar;
    private renderSidebar;
    /**
     * Native drag & drop inside the sidebar tree: notes and folders can be
     * dragged onto a folder row (moved into it) or onto the tree background /
     * the "Your notes" section label (moved back to the workspace root).
     */
    private setupTreeDragAndDrop;
    /** True when `folderId` sits anywhere inside `ancestorId`'s subtree. */
    private isFolderDescendant;
    private renderFolder;
    private renderNote;
    private noteActions;
    private folderActions;
    private renderSearchResults;
    private buildTrashSection;
    private buildHeader;
    private buildStatusbar;
    private updateHeader;
    private refreshThemeIcons;
    private updateSaveStatus;
    applyTheme(theme: WorkspaceTheme): void;
    setFullscreen(on: boolean): void;
    private buildOutline;
    private collectHeadings;
    private buildFindDialog;
    openFindDialog(): void;
    closeFindDialog(): void;
    private runReplace;
    private buildErrorPanel;
    private showErrorPanel;
    /** Public entry point used when a load fails before the UI listener exists. */
    showLoadError(): void;
    /** Transient status/banner message (e.g. import failures). */
    showNotice(message: string): void;
    private hideErrorPanel;
    private buildLegacyPanel;
    private maybeShowLegacyDraft;
    private buildHiddenImportInput;
    private pickBackupFile;
}
export declare function resolveTheme(theme: WorkspaceTheme): "light" | "dark";
interface MenuEntry {
    label: string;
    run: () => void;
    danger?: boolean;
}
export declare function openSidebarMenu(entries: MenuEntry[], anchor?: HTMLElement): void;
/** Plain-text projection of a document used for word counts and search. */
export declare function documentPlainText(blocks: EzynotaBlock[]): string;
export {};
