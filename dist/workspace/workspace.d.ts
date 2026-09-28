import type { EzynotaDocument } from "../types";
import type { FolderRecord, NoteRecord, SearchHit, StorageAdapter, WorkspaceAsset, WorkspaceBackup, WorkspaceEnvelope, WorkspaceEventListener } from "./types";
export interface WorkspaceStateOptions {
    workspaceId: string;
    storage: StorageAdapter;
    generateId: () => string;
    /** Autosave debounce in ms (default 500). */
    autosaveMs?: number;
}
/**
 * Default workspace id. NOTE: this binds to `location.pathname`, so every
 * editor on the same page path (and the same target id) shares one
 * workspace; host apps wanting per-page isolation should pass an explicit
 * workspace id instead.
 */
export declare function defaultWorkspaceId(targetId: string | null): string;
/**
 * WorkspaceState owns notes and folders as data; the workspace UI is a view.
 * All persistence flows through a serialized save queue with revision checks
 * and cross-tab change notifications.
 */
export declare class WorkspaceState {
    readonly workspaceId: string;
    private storage;
    private generateId;
    private autosaveMs;
    private envelope;
    private revision;
    private loaded;
    private loadError;
    private listeners;
    private saveQueue;
    private saveTimer;
    private dirty;
    private mutationVersion;
    private unsavedSnapshot;
    private unsubscribeCrossTab;
    private lastStatus;
    private destroyed;
    /** Storage key the state currently saves under (restore can retarget it). */
    private activeWorkspaceId;
    /** Cached object URLs per asset id, revoked on destroy. */
    private objectUrls;
    /** pagehide/visibilitychange listeners, removed on destroy. */
    private unloadDisposers;
    /** Remote revision observed while dirty, applied by the next explicit retrySave. */
    private conflictRemoteRevision;
    private conflictRetryRevision;
    /** The note currently open in the document surface. */
    activeNoteId: string | null;
    /** Currently selected folder in the sidebar. */
    activeFolderId: string | null;
    constructor(options: WorkspaceStateOptions);
    load(): Promise<void>;
    isLoaded(): boolean;
    getLoadError(): unknown;
    /** Explicit recovery path after a failed load. */
    retryLoad(): Promise<void>;
    destroy(): void;
    /** Final write on destroy — never rolls back and never checks `destroyed`. */
    private persistFinal;
    /** Best-effort flush on page unload / tab hide. */
    private registerUnloadListeners;
    /** (Re)subscribe to cross-tab change notifications for the active id. */
    private subscribeCrossTab;
    /**
     * Another tab committed to this workspace. When nothing is dirty, reload
     * the stored envelope and revision so the UI renders fresh data and the
     * next commit is not stale forever. While dirty, keep the local edits
     * (conflict state) but remember the remote revision so an explicit
     * retrySave can succeed.
     */
    private handleRemoteChange;
    private reloadFromStorage;
    on(listener: WorkspaceEventListener): () => void;
    private emit;
    private emitStatus;
    getEnvelope(): Readonly<WorkspaceEnvelope>;
    /** Editable workspace display name shown in the topbar title field. */
    getWorkspaceName(): string;
    /** Rename the workspace (persists via autosave and notifies listeners). */
    renameWorkspace(name: string): void;
    getRevision(): number;
    listNotes(includeTrashed?: boolean): NoteRecord[];
    listFolders(includeTrashed?: boolean): FolderRecord[];
    listTrashedNotes(): NoteRecord[];
    listTrashedFolders(): FolderRecord[];
    getNote(id: string): NoteRecord | undefined;
    getFolder(id: string): FolderRecord | undefined;
    /** Folder chain from the root down to the folder (excluding trash filtering). */
    folderPath(folderId: string | null): FolderRecord[];
    /** All note IDs linked from the given note's document. */
    noteLinks(noteId: string): string[];
    /** Notes whose content links to the given note (backlinks). */
    backlinks(noteId: string): NoteRecord[];
    createNote(title: string, folderId?: string | null, document?: EzynotaDocument): NoteRecord;
    renameNote(id: string, title: string): void;
    moveNote(id: string, folderId: string | null): void;
    duplicateNote(id: string): NoteRecord | null;
    /** Replace a note's document (autosave target). Bumps revision only on commit. */
    updateNoteDocument(id: string, document: EzynotaDocument, title?: string): void;
    createFolder(name: string, parentId?: string | null): FolderRecord;
    renameFolder(id: string, name: string): void;
    /**
     * Move a folder under a new parent. Folder cycles are prevented: a folder
     * can never become a descendant of itself.
     */
    moveFolder(id: string, parentId: string | null): boolean;
    /** Soft-delete a note (into the trash). */
    trashNote(id: string): void;
    restoreNote(id: string): boolean;
    /** Permanently delete a trashed note. */
    deleteNoteForever(id: string): void;
    emptyTrash(): void;
    trashFolder(id: string): void;
    restoreFolder(id: string): boolean;
    deleteFolderForever(id: string): void;
    search(query: string, options?: {
        includeTrash?: boolean;
    }): SearchHit[];
    /** Mark state dirty and schedule the 500ms autosave. */
    markDirty(): void;
    private cancelSaveTimer;
    /** Serialize a write immediately (used on unload, backup and restore). */
    flushSave(): void;
    /**
     * Chain a job onto the serialized save queue. A rejected job must never
     * poison the queue: the chain always resolves so later autosaves (and
     * destroy()'s final write) still run. The job's own error handling decides
     * whether the failure is reported; a rejected promise returned by `job` is
     * re-thrown to the caller of the awaited queue via `result`.
     */
    private enqueue;
    private persist;
    private retainFailedSave;
    /** Retry the last failed write. */
    retrySave(): void;
    /** Latest pending payload for download recovery. */
    getUnsavedSnapshot(): WorkspaceEnvelope | null;
    flush(): Promise<void>;
    saveAsset(asset: WorkspaceAsset): Promise<boolean>;
    loadAsset(assetId: string): Promise<WorkspaceAsset | null>;
    /** Asset bytes as an object URL — cached one per asset id and revoked on destroy. */
    assetObjectUrl(assetId: string): Promise<string | null>;
    private revokeObjectUrls;
    createBackup(): Promise<WorkspaceBackup>;
    private collectAssets;
    /**
     * Restore a backup. By default a NEW workspace ID is generated so the
     * current workspace is never clobbered: pending autosaves for the current
     * workspace are flushed first and the restored envelope is committed under
     * the target ID through the serialized save queue, so no queued persist
     * can resurrect stale state afterwards. The backup is validated before
     * commit; a malformed or newer envelope is retained for recovery.
     */
    restoreBackup(backup: unknown, options?: {
        newWorkspaceId?: boolean;
    }): Promise<{
        workspaceId: string;
        recovered?: unknown;
    }>;
}
/**
 * Base64 encode/decode for asset bytes in exported backups. A raw
 * Uint8Array survives `JSON.stringify` as `{"0":65,...}`, which silently
 * corrupts the payload — backups therefore carry base64 strings, and
 * restore also accepts plain byte arrays (older backups) and Uint8Array
 * (in-memory consumers).
 */
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function base64ToBytes(base64: string): Uint8Array;
/** Serialized asset record for portable backup files (bytes as base64). */
export interface SerializedWorkspaceAsset {
    id: string;
    mime: string;
    name?: string;
    bytes: string;
    createdAt: number;
}
export type SerializedWorkspaceBackup = Omit<WorkspaceBackup, "assets"> & {
    assets: SerializedWorkspaceAsset[];
};
/** Convert a backup into a JSON-safe payload for export/download. */
export declare function encodeBackupForExport(backup: WorkspaceBackup): SerializedWorkspaceBackup;
