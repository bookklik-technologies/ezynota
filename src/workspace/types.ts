import type { EzynotaDocument, JsonValue } from "../types";

/** Workspace envelope version — independent from the document schema. */
export const WORKSPACE_SCHEMA_VERSION = "1.0.0";

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  /** Present while the folder lives in the trash. */
  trashed?: boolean;
  trashedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteRecord {
  id: string;
  /** Null when the note lives at the workspace root. */
  folderId: string | null;
  title: string;
  document: EzynotaDocument;
  trashed?: boolean;
  trashedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Monotonic per-note revision, bumped on every successful commit. */
  revision: number;
}

export interface WorkspaceAsset {
  id: string;
  mime: string;
  name?: string;
  /** Raw asset bytes. */
  bytes: Uint8Array;
  createdAt: number;
}

/**
 * The serialized workspace. Stored as one record per workspace; also the
 * shape of workspace backup files (workspace backup = envelope + assets).
 */
export interface WorkspaceEnvelope {
  workspaceSchemaVersion: string;
  id: string;
  notes: NoteRecord[];
  folders: FolderRecord[];
  savedAt: number;
  /** Adapter metadata returned with a load, read atomically with the notes.
   * Omit for a new workspace; portable backups do not need this field. */
  storageRevision?: number;
  generator?: { name: "ezynota"; version: string };
}

export interface WorkspaceBackup extends WorkspaceEnvelope {
  assets: WorkspaceAsset[];
}

export interface CommitResultOk {
  ok: true;
  revision: number;
}

export type CommitFailureReason = "stale" | "quota" | "error" | "closed";

export interface CommitResultFailed {
  ok: false;
  reason: CommitFailureReason;
}

export type CommitResult = CommitResultOk | CommitResultFailed;

/**
 * Configurable asynchronous storage adapter. The default implementation
 * stores workspace records and image blobs in IndexedDB. Document,
 * embedded and headless modes remain memory-backed unless storage is
 * configured.
 */
export interface StorageAdapter {
  /** Prepare the adapter (open databases, wire subscriptions). */
  init(): Promise<void>;
  /** Read the current workspace and its storageRevision atomically, or null
   * when absent. Revision-checked adapters must return the stored revision. */
  loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null>;
  /**
   * Persist the workspace. `expectedRevision` guards against silent
   * overwrites from other tabs; return a typed failure instead of throwing
   * for recoverable conditions.
   */
  commit(
    workspaceId: string,
    envelope: WorkspaceEnvelope,
    expectedRevision: number
  ): Promise<CommitResult>;
  loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null>;
  saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean>;
  /** Cross-tab change notifications for the given workspace. */
  subscribe(workspaceId: string, listener: () => void): () => void;
  close(): Promise<void>;
}

export type WorkspaceTheme = "light" | "dark" | "system";

export interface SearchHit {
  noteId: string;
  title: string;
  /** Matched text fragment with context. */
  excerpt: string;
  /** Block id inside the note document, when the match came from content. */
  blockId?: string;
  /** Character offset of the match within the excerpt. */
  offset?: number;
  inTitle?: boolean;
}

export interface WorkspaceEventListener {
  (event: WorkspaceEvent): void;
}

export type WorkspaceEvent =
  | { type: "loaded" }
  | { type: "loadFailed"; error: unknown }
  | { type: "notes:changed" }
  | { type: "folders:changed" }
  | { type: "trash:changed" }
  | { type: "activeNote:changed"; noteId: string | null }
  | { type: "activeFolder:changed"; folderId: string | null }
  | { type: "saveStatus"; status: SaveStatus; error?: unknown }
  | { type: "remoteChange" }
  | { type: "noteRenamed"; noteId: string; title: string }
  | { type: "fullscreen"; on: boolean };

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type { JsonValue };
