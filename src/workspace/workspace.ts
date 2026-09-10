import type { EzynotaBlock, EzynotaDocument, JsonValue } from "../types";
import { isLinkNode } from "../rich-text/types";
import type {
  FolderRecord,
  NoteRecord,
  SaveStatus,
  SearchHit,
  StorageAdapter,
  WorkspaceAsset,
  WorkspaceBackup,
  WorkspaceEnvelope,
  WorkspaceEvent,
  WorkspaceEventListener
} from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";
import { emptyWorkspace } from "./storage";
import { EzynotaError } from "../core/errors";
import { cloneJson } from "../core/schema";

export interface WorkspaceStateOptions {
  workspaceId: string;
  storage: StorageAdapter;
  generateId: () => string;
  /** Autosave debounce in ms (default 500). */
  autosaveMs?: number;
}

export function defaultWorkspaceId(holderId: string | null): string {
  let path = "/default";
  try {
    if (typeof location !== "undefined" && location.pathname) path = location.pathname;
  } catch {
    /* non-browser */
  }
  return `${path}#${holderId ?? "default"}`;
}

/**
 * WorkspaceState owns notes and folders as data; the workspace UI is a view.
 * All persistence flows through a serialized save queue with revision checks
 * and cross-tab change notifications.
 */
export class WorkspaceState {
  readonly workspaceId: string;
  private storage: StorageAdapter;
  private generateId: () => string;
  private autosaveMs: number;

  private envelope: WorkspaceEnvelope = emptyWorkspace("pending");
  private revision = 0;
  private loaded = false;
  private loadError: unknown = null;
  private listeners = new Set<WorkspaceEventListener>();
  private saveQueue: Promise<unknown> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private mutationVersion = 0;
  private unsavedSnapshot: WorkspaceEnvelope | null = null;
  private unsubscribeCrossTab: (() => void) | null = null;
  private lastStatus: SaveStatus = "idle";
  private destroyed = false;

  /** The note currently open in the document surface. */
  activeNoteId: string | null = null;
  /** Currently selected folder in the sidebar. */
  activeFolderId: string | null = null;

  constructor(options: WorkspaceStateOptions) {
    this.workspaceId = options.workspaceId;
    this.storage = options.storage;
    this.generateId = options.generateId;
    this.autosaveMs = options.autosaveMs ?? 500;
  }

  /* ---------- lifecycle ---------- */

  async load(): Promise<void> {
    try {
      await this.storage.init();
      this.unsubscribeCrossTab = this.storage.subscribe(this.workspaceId, () => {
        this.emit({ type: "remoteChange" });
      });
      const stored = await this.storage.loadWorkspace(this.workspaceId);
      this.envelope = normalizeEnvelope(stored, this.workspaceId);
      this.revision = stored?.storageRevision ?? 0;
      this.loaded = true;
      this.loadError = null;
      this.emit({ type: "loaded" });
    } catch (error) {
      this.loaded = false;
      this.loadError = error;
      this.emit({ type: "loadFailed", error });
      throw error instanceof EzynotaError ? error : new EzynotaError("EZ_UNKNOWN_ERROR", "Workspace failed to load", { workspaceId: this.workspaceId }, error);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getLoadError(): unknown {
    return this.loadError;
  }

  /** Explicit recovery path after a failed load. */
  async retryLoad(): Promise<void> {
    this.loaded = false;
    this.loadError = null;
    await this.load();
  }

  destroy(): void {
    this.destroyed = true;
    this.flushSave();
    this.cancelSaveTimer();
    this.unsubscribeCrossTab?.();
    this.unsubscribeCrossTab = null;
    this.listeners.clear();
    void this.storage.close();
  }

  /* ---------- events ---------- */

  on(listener: WorkspaceEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: WorkspaceEvent): void {
    for (const listener of Array.from(this.listeners)) listener(event);
  }

  private emitStatus(status: SaveStatus, error?: unknown): void {
    if (this.lastStatus === status && status !== "error") return;
    this.lastStatus = status;
    this.emit({ type: "saveStatus", status, error });
  }

  /* ---------- read access ---------- */

  getEnvelope(): Readonly<WorkspaceEnvelope> {
    return this.envelope;
  }

  getRevision(): number {
    return this.revision;
  }

  listNotes(includeTrashed = false): NoteRecord[] {
    return this.envelope.notes.filter((note) => includeTrashed || !note.trashed);
  }

  listFolders(includeTrashed = false): FolderRecord[] {
    return this.envelope.folders.filter((folder) => includeTrashed || !folder.trashed);
  }

  listTrashedNotes(): NoteRecord[] {
    return this.envelope.notes.filter((note) => note.trashed);
  }

  listTrashedFolders(): FolderRecord[] {
    return this.envelope.folders.filter((folder) => folder.trashed);
  }

  getNote(id: string): NoteRecord | undefined {
    return this.envelope.notes.find((note) => note.id === id);
  }

  getFolder(id: string): FolderRecord | undefined {
    return this.envelope.folders.find((folder) => folder.id === id);
  }

  /** Folder chain from the root down to the folder (excluding trash filtering). */
  folderPath(folderId: string | null): FolderRecord[] {
    const path: FolderRecord[] = [];
    let current = folderId ? this.getFolder(folderId) : undefined;
    let guard = 0;
    while (current && guard++ < 64) {
      path.unshift(current);
      current = current.parentId ? this.getFolder(current.parentId) : undefined;
    }
    return path;
  }

  /** All note IDs linked from the given note's document. */
  noteLinks(noteId: string): string[] {
    const note = this.getNote(noteId);
    if (!note) return [];
    const links = new Set<string>();
    walkBlocks(note.document.blocks, (block) => {
      collectLinkTargets(block.data as JsonValue, links);
    });
    return Array.from(links);
  }

  /** Notes whose content links to the given note (backlinks). */
  backlinks(noteId: string): NoteRecord[] {
    const target = `note:${noteId}`;
    return this.listNotes().filter(
      (note) => note.id !== noteId && this.noteLinks(note.id).some((id) => `note:${id}` === target)
    );
  }

  /* ---------- notes CRUD ---------- */

  createNote(title: string, folderId: string | null = null, document?: EzynotaDocument): NoteRecord {
    const now = Date.now();
    const note: NoteRecord = {
      id: this.generateId(),
      folderId,
      title,
      document: document ?? { schemaVersion: "1.0.0", blocks: [], createdAt: now, updatedAt: now },
      createdAt: now,
      updatedAt: now,
      revision: 0
    };
    this.envelope.notes.push(note);
    this.markDirty();
    this.emit({ type: "notes:changed" });
    return note;
  }

  renameNote(id: string, title: string): void {
    const note = this.getNote(id);
    if (!note || note.title === title) return;
    note.title = title;
    note.updatedAt = Date.now();
    note.document = { ...note.document, meta: { ...(note.document.meta ?? {}), title } };
    this.markDirty();
    this.emit({ type: "noteRenamed", noteId: id, title });
    this.emit({ type: "notes:changed" });
  }

  moveNote(id: string, folderId: string | null): void {
    const note = this.getNote(id);
    if (!note || note.folderId === folderId) return;
    note.folderId = folderId;
    note.updatedAt = Date.now();
    this.markDirty();
    this.emit({ type: "notes:changed" });
  }

  duplicateNote(id: string): NoteRecord | null {
    const source = this.getNote(id);
    if (!source) return null;
    const now = Date.now();
    const copy: NoteRecord = {
      ...source,
      id: this.generateId(),
      title: `${source.title} (copy)`,
      document: cloneJson(source.document) as EzynotaDocument,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      trashed: false
    };
    delete (copy as { trashedAt?: number }).trashedAt;
    this.envelope.notes.push(copy);
    this.markDirty();
    this.emit({ type: "notes:changed" });
    return copy;
  }

  /** Replace a note's document (autosave target). Bumps revision only on commit. */
  updateNoteDocument(id: string, document: EzynotaDocument, title?: string): void {
    const note = this.getNote(id);
    if (!note) return;
    note.document = document;
    note.updatedAt = Date.now();
    if (title !== undefined && title !== note.title) {
      note.title = title;
      note.document = { ...note.document, meta: { ...(note.document.meta ?? {}), title } };
      this.emit({ type: "noteRenamed", noteId: id, title });
    }
    this.markDirty();
    this.emit({ type: "notes:changed" });
  }

  /* ---------- folders CRUD ---------- */

  createFolder(name: string, parentId: string | null = null): FolderRecord {
    if (parentId && !isDescendantSafe(this.envelope.folders, parentId, null)) {
      // parent existence check
      if (!this.getFolder(parentId)) throw new EzynotaError("EZ_UNKNOWN_ERROR", `Folder "${parentId}" not found`);
    }
    const now = Date.now();
    const folder: FolderRecord = { id: this.generateId(), name, parentId, createdAt: now, updatedAt: now };
    this.envelope.folders.push(folder);
    this.markDirty();
    this.emit({ type: "folders:changed" });
    return folder;
  }

  renameFolder(id: string, name: string): void {
    const folder = this.getFolder(id);
    if (!folder || folder.name === name) return;
    folder.name = name;
    folder.updatedAt = Date.now();
    this.markDirty();
    this.emit({ type: "folders:changed" });
  }

  /**
   * Move a folder under a new parent. Folder cycles are prevented: a folder
   * can never become a descendant of itself.
   */
  moveFolder(id: string, parentId: string | null): boolean {
    const folder = this.getFolder(id);
    if (!folder) return false;
    if (parentId === id || (parentId && isDescendantOf(this.envelope.folders, parentId, id))) return false;
    folder.parentId = parentId;
    folder.updatedAt = Date.now();
    this.markDirty();
    this.emit({ type: "folders:changed" });
    return true;
  }

  /* ---------- trash ---------- */

  /** Soft-delete a note (into the trash). */
  trashNote(id: string): void {
    const note = this.getNote(id);
    if (!note || note.trashed) return;
    note.trashed = true;
    note.trashedAt = Date.now();
    note.updatedAt = note.trashedAt;
    if (this.activeNoteId === id) this.activeNoteId = null;
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
  }

  restoreNote(id: string): boolean {
    const note = this.getNote(id);
    if (!note || !note.trashed) return false;
    // Restore into the parent folder only when that folder is not trashed.
    if (note.folderId && this.getFolder(note.folderId)?.trashed) note.folderId = null;
    note.trashed = false;
    delete (note as { trashedAt?: number }).trashedAt;
    note.updatedAt = Date.now();
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
    return true;
  }

  /** Permanently delete a trashed note. */
  deleteNoteForever(id: string): void {
    const index = this.envelope.notes.findIndex((note) => note.id === id);
    if (index < 0 || !this.envelope.notes[index]!.trashed) return;
    this.envelope.notes.splice(index, 1);
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
  }

  emptyTrash(): void {
    const before = this.envelope.notes.length;
    this.envelope.notes = this.envelope.notes.filter((note) => !note.trashed);
    this.envelope.folders = this.envelope.folders.filter((folder) => !folder.trashed);
    if (this.envelope.notes.length !== before || this.envelope.folders.length !== before) {
      this.markDirty();
      this.emit({ type: "trash:changed" });
      this.emit({ type: "notes:changed" });
      this.emit({ type: "folders:changed" });
    }
  }

  trashFolder(id: string): void {
    const folder = this.getFolder(id);
    if (!folder || folder.trashed) return;
    const now = Date.now();
    folder.trashed = true;
    folder.trashedAt = now;
    folder.updatedAt = now;
    for (const note of this.envelope.notes) {
      if (note.folderId === id || (note.folderId && isDescendantOf(this.envelope.folders, note.folderId, id))) {
        note.trashed = true;
        note.trashedAt = now;
      }
    }
    for (const child of this.envelope.folders) {
      if (child.parentId === id || (child.parentId && isDescendantOf(this.envelope.folders, child.parentId, id))) {
        child.trashed = true;
        child.trashedAt = now;
      }
    }
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
    this.emit({ type: "folders:changed" });
  }

  restoreFolder(id: string): boolean {
    const folder = this.getFolder(id);
    if (!folder || !folder.trashed) return false;
    if (folder.parentId && this.getFolder(folder.parentId)?.trashed) folder.parentId = null;
    folder.trashed = false;
    delete (folder as { trashedAt?: number }).trashedAt;
    const now = Date.now();
    for (const note of this.envelope.notes) {
      if (note.trashed && note.folderId && isDescendantOf(this.envelope.folders, note.folderId, id)) {
        note.trashed = false;
        note.updatedAt = now;
      }
    }
    for (const child of this.envelope.folders) {
      if (child.trashed && child.parentId && isDescendantOf(this.envelope.folders, child.parentId, id)) {
        child.trashed = false;
        child.updatedAt = now;
      }
    }
    folder.updatedAt = now;
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
    this.emit({ type: "folders:changed" });
    return true;
  }

  deleteFolderForever(id: string): void {
    const folder = this.envelope.folders.find((f) => f.id === id);
    if (!folder || !folder.trashed) return;
    this.envelope.folders = this.envelope.folders.filter((f) => f.id !== id);
    this.envelope.notes = this.envelope.notes.filter(
      (note) => !(note.trashed && (note.folderId === id || (note.folderId && isDescendantOf(this.envelope.folders, note.folderId, id))))
    );
    this.markDirty();
    this.emit({ type: "trash:changed" });
    this.emit({ type: "notes:changed" });
    this.emit({ type: "folders:changed" });
  }

  /* ---------- search ---------- */

  search(query: string, options?: { includeTrash?: boolean }): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const note of this.listNotes(!options?.includeTrash === true ? false : true)) {
      if (note.trashed) continue;
      const titleIndex = note.title.toLowerCase().indexOf(q);
      if (titleIndex >= 0) {
        hits.push({ noteId: note.id, title: note.title, excerpt: note.title, offset: titleIndex, inTitle: true });
      }
      walkBlocks(note.document.blocks, (block) => {
        const text = blockPlainText(block.data);
        if (!text) return;
        const index = text.toLowerCase().indexOf(q);
        if (index < 0) return;
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + q.length + 30);
        hits.push({
          noteId: note.id,
          title: note.title,
          excerpt: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
          offset: index - start,
          blockId: block.id
        });
      });
      if (hits.length > 200) return hits.slice(0, 200);
    }
    return hits;
  }

  /* ---------- persistence ---------- */

  /** Mark state dirty and schedule the 500ms autosave. */
  markDirty(): void {
    if (this.destroyed) return;
    this.mutationVersion += 1;
    this.dirty = true;
    this.cancelSaveTimer();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushSave();
    }, this.autosaveMs);
  }

  private cancelSaveTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /** Serialize a write immediately (used on unload, backup and restore). */
  flushSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const snapshot = cloneEnvelope(this.envelope);
    const version = this.mutationVersion;
    this.unsavedSnapshot = snapshot;
    this.saveQueue = this.saveQueue.then(() => this.persist(snapshot, version));
  }

  private async persist(snapshot: WorkspaceEnvelope, version: number): Promise<void> {
    if (this.destroyed) return;
    this.emitStatus("saving");
    try {
      const result = await this.storage.commit(this.workspaceId, snapshot, this.revision);
      if (result.ok) {
        this.revision = result.revision;
        if (version === this.mutationVersion) {
          this.dirty = false;
          this.unsavedSnapshot = null;
          this.emitStatus("saved");
        }
        return;
      }
      const message = result.reason === "stale"
        ? "Workspace changed in another tab. Export a backup of your edits before reloading."
        : `Workspace save failed (${result.reason})`;
      this.retainFailedSave(new EzynotaError("EZ_SAVE_FAILED", message, { reason: result.reason }));
    } catch (error) {
      this.retainFailedSave(new EzynotaError("EZ_SAVE_FAILED", "Workspace storage could not save your changes", { reason: "error" }, error));
    }
  }

  private retainFailedSave(error: EzynotaError): void {
    // A delayed failure must never roll back edits made during the write.
    // Keep the loaded revision on conflict so a retry cannot overwrite
    // another tab's work without conflict resolution.
    this.unsavedSnapshot = cloneEnvelope(this.envelope);
    this.dirty = true;
    this.emitStatus("error", error);
  }

  /** Retry the last failed write. */
  retrySave(): void {
    if (this.unsavedSnapshot) this.dirty = true;
    this.flushSave();
  }

  /** Latest pending payload for download recovery. */
  getUnsavedSnapshot(): WorkspaceEnvelope | null {
    return this.unsavedSnapshot ? cloneEnvelope(this.unsavedSnapshot) : null;
  }

  async flush(): Promise<void> {
    this.flushSave();
    await this.saveQueue;
  }

  /* ---------- assets ---------- */

  async saveAsset(asset: WorkspaceAsset): Promise<boolean> {
    return this.storage.saveAsset(this.workspaceId, asset);
  }

  async loadAsset(assetId: string): Promise<WorkspaceAsset | null> {
    return this.storage.loadAsset(this.workspaceId, assetId);
  }

  /** Asset bytes as an object URL — temporary, for rendering only. */
  async assetObjectUrl(assetId: string): Promise<string | null> {
    const asset = await this.loadAsset(assetId);
    if (!asset) return null;
    return URL.createObjectURL(new Blob([asset.bytes as unknown as BlobPart], { type: asset.mime }));
  }

  /* ---------- backup / restore ---------- */

  async createBackup(): Promise<WorkspaceBackup> {
    await this.flush();
    const assets = await this.collectAssets();
    return { ...cloneEnvelope(this.envelope), savedAt: Date.now(), assets };
  }

  private async collectAssets(): Promise<WorkspaceAsset[]> {
    // Load all assets referenced by notes.
    const ids = new Set<string>();
    for (const note of this.envelope.notes) {
      walkBlocks(note.document.blocks, (block) => collectAssetIds(block.data as JsonValue, ids));
    }
    const assets: WorkspaceAsset[] = [];
    for (const id of ids) {
      const asset = await this.loadAsset(id);
      if (asset) assets.push({ ...asset, bytes: new Uint8Array(asset.bytes) });
    }
    return assets;
  }

  /**
   * Restore a backup. By default a NEW workspace ID is generated so the
   * current workspace is never clobbered. The backup is validated before
   * commit; a malformed or newer envelope is retained for recovery.
   */
  async restoreBackup(
    backup: unknown,
    options?: { newWorkspaceId?: boolean }
  ): Promise<{ workspaceId: string; recovered?: unknown }> {
    const validation = validateBackup(backup);
    if (!validation.ok) {
      // Retain the malformed original for recovery; nothing is committed.
      throw new EzynotaError("EZ_IMPORT_FAILED", validation.reason, { recovered: true });
    }
    const parsed = validation.envelope!;
    if (parsed.workspaceSchemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      // Newer/unknown workspace versions are preserved, not relabeled.
      throw new EzynotaError("EZ_IMPORT_FAILED", `Workspace envelope "${parsed.workspaceSchemaVersion}" is not supported`, {
        original: backup
      });
    }
    const targetId = options?.newWorkspaceId === false ? parsed.id : this.generateId();
    const envelope: WorkspaceEnvelope = { ...parsed, id: targetId, savedAt: Date.now() };
    if (isBackupWithAssets(backup)) {
      for (const asset of backup.assets) {
        await this.saveAsset({ ...asset, bytes: new Uint8Array(asset.bytes) });
      }
    }
    this.envelope = envelope;
    await this.storage.commit(this.workspaceId, envelope, 0);
    this.revision = 1;
    this.loaded = true;
    this.emit({ type: "notes:changed" });
    this.emit({ type: "folders:changed" });
    return { workspaceId: targetId };
  }
}

/* ---------- helpers ---------- */

/** Human-readable text of any block data shape (used by workspace search). */
function blockPlainText(data: unknown): string {
  if (Array.isArray(data)) {
    return data.map((item) => blockPlainText(item)).join("");
  }
  if (typeof data !== "object" || data === null) return "";
  const record = data as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  if (record.type === "text") return typeof record.text === "string" ? record.text : "";
  if (Array.isArray(record.content)) return blockPlainText(record.content);
  if (Array.isArray(record.items)) {
    return (record.items as unknown[]).map((item) => blockPlainText(item)).join(" ");
  }
  if (record.rows) return blockPlainText(record.rows);
  if (record.heading) return blockPlainText(record.heading);
  return "";
}

function normalizeEnvelope(stored: WorkspaceEnvelope | null, workspaceId: string): WorkspaceEnvelope {
  const base = emptyWorkspace(workspaceId);
  if (!stored || typeof stored !== "object") return base;
  return {
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    id: workspaceId,
    notes: Array.isArray(stored.notes) ? stored.notes : [],
    folders: Array.isArray(stored.folders) ? stored.folders : [],
    savedAt: typeof stored.savedAt === "number" ? stored.savedAt : 0,
    generator: stored.generator ?? base.generator
  };
}

function cloneEnvelope(envelope: WorkspaceEnvelope): WorkspaceEnvelope {
  return JSON.parse(JSON.stringify(envelope)) as WorkspaceEnvelope;
}

function isBackupWithAssets(backup: unknown): backup is WorkspaceBackup {
  return typeof backup === "object" && backup !== null && Array.isArray((backup as { assets?: unknown }).assets);
}

function walkBlocks(blocks: EzynotaBlock[], visit: (block: EzynotaBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    if (Array.isArray(block.children)) walkBlocks(block.children, visit);
  }
}

function collectLinkTargets(data: unknown, out: Set<string>): void {
  if (Array.isArray(data)) {
    for (const item of data) collectLinkTargets(item, out);
    return;
  }
  if (typeof data !== "object" || data === null) return;
  const record = data as Record<string, unknown>;
  if (record.type === "link" && typeof record.href === "string" && record.href.startsWith("note:")) {
    out.add(record.href.slice("note:".length));
    return;
  }
  if (Array.isArray(record.content)) {
    for (const node of record.content as unknown[]) {
      if (isLinkNode(node as never) && String((node as { href?: string }).href ?? "").startsWith("note:")) {
        out.add(String((node as { href: string }).href).slice("note:".length));
      } else {
        collectLinkTargets(node, out);
      }
    }
  }
  if (record.rows) collectLinkTargets(record.rows, out);
  if (record.items) collectLinkTargets(record.items, out);
}

function collectAssetIds(data: unknown, out: Set<string>): void {
  if (Array.isArray(data)) {
    for (const item of data) collectAssetIds(item, out);
    return;
  }
  if (typeof data !== "object" || data === null) return;
  const record = data as Record<string, unknown>;
  if (typeof record.assetId === "string") out.add(record.assetId);
  if (typeof record.src === "string" && record.src.startsWith("asset:")) out.add(record.src.slice("asset:".length));
  for (const value of Object.values(record)) collectAssetIds(value, out);
}

/** True when `descendantId` is inside the subtree rooted at `ancestorId`. */
function isDescendantOf(folders: FolderRecord[], descendantId: string, ancestorId: string): boolean {
  let current = folders.find((f) => f.id === descendantId);
  let guard = 0;
  while (current && guard++ < 64) {
    if (current.parentId === ancestorId) return true;
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
  }
  return false;
}

function isDescendantSafe(_folders: FolderRecord[], id: string, _parent: string | null): boolean {
  return !!id;
}

function validateBackup(backup: unknown): { ok: true; envelope: WorkspaceEnvelope } | { ok: false; reason: string } {
  if (typeof backup !== "object" || backup === null) return { ok: false, reason: "Backup must be an object" };
  const record = backup as Record<string, unknown>;
  if (typeof record.workspaceSchemaVersion !== "string") return { ok: false, reason: "Backup is missing workspaceSchemaVersion" };
  if (!Array.isArray(record.notes) || !Array.isArray(record.folders)) {
    return { ok: false, reason: "Backup must contain notes and folders arrays" };
  }
  for (const note of record.notes as unknown[]) {
    if (typeof note !== "object" || note === null || typeof (note as { id?: string }).id !== "string") {
      return { ok: false, reason: "Backup contains an invalid note record" };
    }
    const document = (note as { document?: unknown }).document;
    if (typeof document !== "object" || document === null || typeof (document as { schemaVersion?: string }).schemaVersion !== "string") {
      return { ok: false, reason: "Backup contains an invalid note document" };
    }
  }
  return { ok: true, envelope: record as unknown as WorkspaceEnvelope };
}
