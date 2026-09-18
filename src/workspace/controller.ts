import type { EzynotaBlock, EzynotaDocument, FocusOptions, EzynotaEvents } from "../types";
import type {
  FolderRecord,
  NoteRecord,
  SearchHit,
  StorageAdapter,
  WorkspaceBackup,
  WorkspaceTheme
} from "./types";
import { WorkspaceState, defaultWorkspaceId, encodeBackupForExport } from "./workspace";
import { IndexedDbStorage } from "./storage";
import { registerAssetStore, registerAssetLoader } from "./asset-registry";
import { WorkspaceUI, resolveTheme } from "./ui/workspace-ui";
import type { HistoryState } from "../core/history";
import { exportDocumentToString, downloadTextFile, safeFilename, blocksToHtml, resolveDocumentAssets } from "../io/export";
import { parseImportFile, blocksToDocument } from "../io/import";
import { printDocument } from "../io/print";
import { WorkspaceLinkSuggester } from "./ui/note-links";
import { createDefaultIdGenerator } from "../core/id";
import { GENERATOR_VERSION } from "../core/schema";

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
export class WorkspaceController {
  readonly state: WorkspaceState;
  private host: WorkspaceHost;
  private ui: WorkspaceUI | null = null;
  private suggester: WorkspaceLinkSuggester | null = null;
  private histories = new Map<string, HistoryState>();
  private disposers: (() => void)[] = [];
  private destroyed = false;
  private theme: WorkspaceTheme;
  private themeMedia: MediaQueryList | null = null;
  private fullscreenOn = false;
  private fullscreenPending = false;
  private surface: HTMLElement;
  private lastFocus: HTMLElement | null = null;
  private switching = false;
  private options: WorkspaceControllerOptions;

  constructor(host: WorkspaceHost, surface: HTMLElement, options: WorkspaceControllerOptions) {
    this.host = host;
    this.surface = surface;
    this.options = options;
    this.theme = options.theme ?? "system";
    const storage = options.storage
      ? typeof options.storage === "function" ? options.storage() : options.storage
      : new IndexedDbStorage();
    const workspaceId = options.explicitWorkspaceId ?? defaultWorkspaceId(options.targetId);
    this.state = new WorkspaceState({ workspaceId, storage, generateId: createWorkspaceId });

    this.disposers.push(
      host.on("change", (batch) => {
        this.ui?.refreshHistory();
        if (this.switching) return;
        if (batch.origin === "history" || batch.origin === "migration") return;
        this.persistActiveNote();
      }),
      host.on("history:changed", () => this.ui?.refreshHistory()),
      host.on("readOnly:changed", () => this.ui?.refreshHistory()),
      host.on("ready", () => this.ui?.refreshHistory())
    );

    const deps = this.buildDeps();
    this.depsBridge = deps;
    this.ui = new WorkspaceUI(surface, this.state, deps, options.showSidebar !== false);
    surface.ownerDocument.addEventListener("fullscreenchange", this.onFullscreenChange);
    this.suggester = new WorkspaceLinkSuggester(surface, {
      listNotes: () => this.state.listNotes().map((note) => ({ id: note.id, title: note.title })),
      openNote: (id) => this.depsBridge?.openNote(id) ?? void this.loadNoteIntoEditor(id),
      getActiveNoteId: () => this.state.activeNoteId
    });
    // Per-instance asset registration tokens: destroying one controller
    // must not rip out another controller's handlers.
    this.disposers.push(registerAssetStore(this.storeFile.bind(this)));
    this.disposers.push(registerAssetLoader((assetId) => this.state.loadAsset(assetId)));
    this.disposers.push(
      this.state.on((event) => {
        options.onEvent?.(event);
      })
    );
  }

  /** Bridge to the UI deps (set during construction) for note navigation. */
  private depsBridge: ReturnType<WorkspaceController["buildDeps"]> | null = null;

  /** Store a file as a workspace asset; resolves to `asset:<id>`. */
  private async storeFile(file: File): Promise<string | null> {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const asset = { id: createWorkspaceId(), mime: file.type, name: file.name, bytes, createdAt: Date.now() };
      const ok = await this.state.saveAsset(asset);
      if (!ok) return null;
      return `asset:${asset.id}`;
    } catch {
      return null;
    }
  }

  /** Load stored notes and open the first one. Resolves when the workspace is usable. */
  async start(): Promise<void> {
    try {
      await this.state.load();
    } catch (error) {
      // Mount the UI even when the load fails so the recovery panel is
      // reachable and the user can retry.
      this.ui?.mount();
      this.ui?.showLoadError();
      throw error;
    }
    if (this.destroyed) return;
    this.ui?.mount();
    // Explicit initial data opens as a NEW note instead of replacing stored notes.
    const initial = this.options.initialData ?? null;
    // Select the target without making it active yet: loadNoteIntoEditor
    // persists the previous active document before loading the target.
    let active = this.state.activeNoteId;
    if (initial) {
      const note = this.state.createNote(this.noteTitleOf(initial) || "Imported note", null, cloneDoc(initial));
      active = note.id;
    } else if (active === null) {
      const first = this.state.listNotes()[0];
      if (first) active = first.id;
      else {
        const note = this.state.createNote("Untitled", null);
        active = note.id;
      }
    }
    if (active) await this.loadNoteIntoEditor(active, false);
  }

  destroy(): void {
    this.destroyed = true;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.ui?.destroy();
    this.suggester?.destroy();
    this.removeFullscreenListeners();
    this.state.destroy();
  }

  /* =================== note sessions =================== */

  private persistActiveNote(): void {
    const noteId = this.state.activeNoteId;
    if (!noteId) return;
    const snapshot = this.host.getSnapshot();
    const title = this.noteTitleOf(snapshot);
    this.state.updateNoteDocument(noteId, cloneDoc(snapshot), title);
  }

  /** Serialize writes: one async save at a time, then autosave on idle. */
  async saveActiveNote(): Promise<void> {
    this.persistActiveNote();
    await this.state.flush();
  }

  private loadGeneration = 0;

  private async loadNoteIntoEditor(noteId: string, preserveFocus = true): Promise<void> {
    const note = this.state.getNote(noteId);
    if (!note) return;
    // Generation token: overlapping loads (rapid note clicks) must not
    // interleave — only the latest generation may mutate the session.
    const generation = ++this.loadGeneration;
    this.switching = true;
    this.ui?.refreshHistory();
    try {
      // Retain independent in-memory history and selection per note.
      const previous = this.state.activeNoteId;
      if (previous) {
        this.persistActiveNote();
        this.histories.set(previous, this.host.exportHistoryState());
      }
      await this.host.render(cloneDoc(note.document));
      if (generation !== this.loadGeneration) return;
      const restored = this.histories.get(noteId);
      if (restored) this.host.importHistoryState(restored);
      this.state.activeNoteId = noteId;
      if (note.folderId) this.state.activeFolderId = note.folderId;
      if (preserveFocus) this.host.focus({ at: "start" });
      this.emit({ type: "activeNote:changed", noteId });
    } finally {
      if (generation === this.loadGeneration) {
        this.switching = false;
        this.ui?.refreshHistory();
      }
    }
  }

  private noteTitleOf(doc: Readonly<EzynotaDocument> | EzynotaDocument): string {
    const meta = (doc.meta as { title?: unknown } | undefined) ?? {};
    const title = typeof meta.title === "string" ? meta.title : "";
    if (title) return title;
    const firstHeading = doc.blocks.find((b) => b.type === "heading");
    if (firstHeading) {
      const content = (firstHeading.data as { content?: { text?: string }[] }).content ?? [];
      const text = content.map((node) => node.text ?? "").join("").trim();
      if (text) return text;
    }
    return "";
  }

  /* =================== editor-bridge helpers =================== */

  private emit(event: import("./types").WorkspaceEvent): void {
    this.ui?.notifyEvent(event);
  }

  /* =================== fullscreen =================== */

  async toggleFullscreen(force?: boolean): Promise<void> {
    if (this.destroyed || this.fullscreenPending) return;
    const doc = this.surface.ownerDocument;
    const current = doc.fullscreenElement === this.surface;
    const next = force ?? !current;
    if (next === current) return;
    this.fullscreenPending = true;
    try {
      if (next) {
        if (!this.surface.requestFullscreen) {
          this.ui?.showNotice("Fullscreen is unavailable in this browser.");
          return;
        }
        this.lastFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
        await this.surface.requestFullscreen();
        // A request can finish after the editor has been destroyed.
        if (this.destroyed) {
          if (doc.fullscreenElement === this.surface) await doc.exitFullscreen();
          return;
        }
      } else {
        await doc.exitFullscreen();
      }
      this.onFullscreenChange();
    } catch {
      if (!this.destroyed) this.ui?.showNotice("Unable to change fullscreen. Check your browser's fullscreen permissions and try again.");
    } finally {
      this.fullscreenPending = false;
    }
  }

  isFullscreen(): boolean {
    return this.fullscreenOn;
  }

  private onFullscreenChange = (): void => {
    if (this.destroyed) return;
    const next = this.surface.ownerDocument.fullscreenElement === this.surface;
    if (next === this.fullscreenOn) return;
    this.fullscreenOn = next;
    this.ui?.setFullscreen(next);
    if (next) {
      this.host.announce("Fullscreen enabled. Press Escape to exit.");
    } else {
      if (!this.surface.ownerDocument.fullscreenElement) this.lastFocus?.focus();
      this.lastFocus = null;
    }
    this.options.onEvent?.({ type: "fullscreen", on: next });
  };

  private removeFullscreenListeners(): void {
    const doc = this.surface.ownerDocument;
    doc.removeEventListener("fullscreenchange", this.onFullscreenChange);
    if (doc.fullscreenElement === this.surface) void doc.exitFullscreen().catch(() => {});
    this.fullscreenOn = false;
    this.lastFocus = null;
    this.ui?.setFullscreen(false);
  }

  /* =================== theme =================== */

  setTheme(theme: WorkspaceTheme): void {
    this.theme = theme;
    this.ui?.applyTheme(theme);
    if (theme === "system" && this.themeMedia === null && typeof matchMedia !== "undefined") {
      this.themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => this.ui?.applyTheme("system");
      try {
        this.themeMedia.addEventListener("change", listener);
        this.disposers.push(() => this.themeMedia?.removeEventListener("change", listener));
      } catch {
        /* older engines */
      }
    }
  }

  getTheme(): WorkspaceTheme {
    return this.theme;
  }

  resolvedTheme(): "light" | "dark" {
    return resolveTheme(this.theme);
  }

  /* =================== deps for the UI =================== */

  private buildDeps(): import("./ui/workspace-ui").WorkspaceUIDeps {
    return {
      undo: () => {
        if (this.host.readOnly || this.switching || !this.host.canUndo()) return;
        this.host.undo();
        this.persistActiveNote();
      },
      redo: () => {
        if (this.host.readOnly || this.switching || !this.host.canRedo()) return;
        this.host.redo();
        this.persistActiveNote();
      },
      getHistoryState: () => ({
        canUndo: !this.host.readOnly && !this.switching && this.host.canUndo(),
        canRedo: !this.host.readOnly && !this.switching && this.host.canRedo()
      }),
      createNote: (title, folderId) => {
        const note = this.state.createNote(title ?? "Untitled", folderId ?? null);
        void this.loadNoteIntoEditor(note.id);
        return note.id;
      },
      createFolder: (name, parentId) => {
        const folder = this.state.createFolder(name ?? "New folder", parentId ?? null);
        this.state.activeFolderId = folder.id;
        return folder.id;
      },
      renameNote: (id, title) => {
        if (this.state.activeNoteId === id) {
          this.host.setDocumentTitle(title);
          this.persistActiveNote();
        } else {
          this.state.renameNote(id, title);
        }
      },
      duplicateNote: (id) => {
        const copy = this.state.duplicateNote(id);
        if (copy) void this.loadNoteIntoEditor(copy.id);
      },
      trashNote: (id) => {
        this.state.trashNote(id);
        if (this.state.activeNoteId === null) {
          const next = this.state.listNotes()[0];
          if (next) void this.loadNoteIntoEditor(next.id);
          else {
            const note = this.state.createNote("Untitled", null);
            void this.loadNoteIntoEditor(note.id);
          }
        }
      },
      trashFolder: (id) => this.state.trashFolder(id),
      restoreNote: (id) => this.state.restoreNote(id),
      deleteNoteForever: (id) => this.state.deleteNoteForever(id),
      restoreFolder: (id) => this.state.restoreFolder(id),
      deleteFolderForever: (id) => this.state.deleteFolderForever(id),
      emptyTrash: () => this.state.emptyTrash(),
      retrySave: () => this.state.retrySave(),
      renameFolder: (id, name) => this.state.renameFolder(id, name),
      moveNote: (id, folderId) => this.state.moveNote(id, folderId),
      moveFolder: (id, parentId) => this.state.moveFolder(id, parentId),
      openNote: (id) => {
        if (id === this.state.activeNoteId) return;
        // Resolves when the note is fully loaded, so callers (e.g. the
        // search results) can queue follow-up actions like goToBlock.
        return this.loadNoteIntoEditor(id);
      },
      openFolder: (id) => {
        this.state.activeFolderId = id;
        if (id) this.ui?.highlightFolder(id);
        this.emit({ type: "activeFolder:changed", folderId: id });
      },
      searchWorkspace: (query) => this.state.search(query),
      exportActiveNote: (format) => {
        void this.exportActiveNote(format);
      },
      printActiveNote: () => {
        const snapshot = this.host.getSnapshot();
        printDocument(cloneDoc(snapshot) as EzynotaDocument);
      },
      importFiles: (files) => {
        void this.importFiles(files);
      },
      createBackup: () => {
        void this.createBackup();
      },
      restoreBackupFile: (file) => {
        void this.restoreBackupFile(file);
      },
      setTheme: (theme) => this.setTheme(theme),
      toggleFullscreen: () => this.toggleFullscreen(),
      retryLoad: () => {
        void this.retryLoad();
      },
      downloadOriginal: () => this.downloadStoredData(),
      findInDocument: (query, replaceWith, all) => {
        if (query) void this.findInDocument(query, replaceWith, all);
      },
      goToBlock: (blockId) => {
        this.host.focusBlock(blockId, "start");
      },
      getWordCount: () => this.wordCount(),
      getLegacyDraft: () => this.legacyDraft(),
      importLegacyDraft: (data) => {
        void this.importLegacyDraft(data);
      },
      dismissLegacyDraft: () => {
        try {
          localStorage.setItem("ezynota:legacy-draft-dismissed", "1");
        } catch {
          /* storage may be unavailable */
        }
      }
    };
  }

  /* =================== public API used by deps + editor.workspace =================== */

  getActiveNoteId(): string | null {
    return this.state.activeNoteId;
  }

  async openNoteById(id: string): Promise<void> {
    await this.loadNoteIntoEditor(id);
  }

  async exportActiveNote(format: "json" | "md" | "html" | "txt"): Promise<void> {
    const note = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null;
    const snapshot = this.host.getSnapshot();
    const title = note?.title || this.noteTitleOf(snapshot) || "note";
    const content = await exportDocumentToString(cloneDoc(snapshot) as EzynotaDocument, format, (assetId) =>
      this.state.loadAsset(assetId)
    );
    const mime = format === "json" ? "application/json" : format === "md" ? "text/markdown" : format === "html" ? "text/html" : "text/plain";
    const ext = format === "json" ? "json" : format === "md" ? "md" : format === "html" ? "html" : "txt";
    downloadTextFile(`${safeFilename(title, "note")}.${ext}`, content, mime);
  }

  async importFiles(files: File[]): Promise<void> {
    // Per-file error handling: one bad file must not abort the rest, and
    // failures are reported through events instead of an unhandled rejection.
    for (const file of files) {
      try {
        const parsed = await parseImportFile(file);
        if (parsed.result.kind === "backup") {
          await this.restoreBackup(parsed.result.backup);
          continue;
        }
        if (parsed.result.kind === "document") {
          const document = parsed.result.document;
          const note = this.state.createNote(this.noteTitleOf(document) || "Imported note", this.state.activeFolderId, document);
          await this.loadNoteIntoEditor(note.id);
          continue;
        }
        const document = blocksToDocument(parsed.result.blocks, parsed.result.suggestedTitle);
        const note = this.state.createNote(parsed.result.suggestedTitle ?? "Imported note", this.state.activeFolderId, document);
        await this.loadNoteIntoEditor(note.id);
      } catch (error) {
        this.reportImportError(error);
      }
    }
  }

  private reportImportError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Import failed";
    this.reportRuntimeError(message, error);
  }

  /** Report a runtime failure to the UI banner and the host event listener. */
  private reportRuntimeError(message: string, cause?: unknown): void {
    const event = { type: "importError", message, cause } as unknown as import("./types").WorkspaceEvent;
    this.ui?.notifyEvent(event);
    this.options.onEvent?.(event);
  }

  async createBackup(): Promise<void> {
    try {
      await this.saveActiveNote();
      const backup = await this.state.createBackup();
      // Assets are exported with base64 bytes: a raw Uint8Array would be
      // serialized as an object index map and silently corrupted.
      const payload = encodeBackupForExport(backup);
      downloadTextFile(`ezynota-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
    } catch (error) {
      this.reportRuntimeError("Could not create the workspace backup.", error);
    }
  }

  async restoreBackupFile(file: File): Promise<void> {
    let text = "";
    try {
      text = await file.text();
      const backup = JSON.parse(text) as WorkspaceBackup;
      await this.restoreBackup(backup);
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Retain the malformed original for recovery.
        downloadTextFile("malformed-backup.json", text, "application/json");
        this.reportRuntimeError("Backup file is not valid JSON; the original was downloaded for recovery", error);
        return;
      }
      this.reportRuntimeError("Could not restore the workspace backup.", error);
    }
  }

  /** Restore a workspace backup under a new workspace ID by default. */
  async restoreBackup(backup: WorkspaceBackup): Promise<{ workspaceId: string }> {
    // Flush the current workspace (including the live editor snapshot)
    // before the restored envelope replaces it.
    await this.saveActiveNote();
    this.histories.clear();
    const result = await this.state.restoreBackup(backup, { newWorkspaceId: true });
    const first = this.state.listNotes()[0];
    if (first) await this.loadNoteIntoEditor(first.id, false);
    else {
      await this.host.render({ schemaVersion: "1.0.0", blocks: [] });
    }
    return result;
  }

  async retryLoad(): Promise<void> {
    try {
      await this.state.retryLoad();
    } catch (error) {
      this.reportRuntimeError("The workspace still could not be loaded.", error);
      return;
    }
    const first = this.state.listNotes()[0];
    if (first) await this.loadNoteIntoEditor(first.id, false);
  }

  /** Recovery download: retain the last known stored payload. */
  downloadStoredData(): void {
    const payload = this.state.getUnsavedSnapshot();
    if (!payload) return;
    downloadTextFile("ezynota-stored-workspace.json", JSON.stringify(payload, null, 2), "application/json");
  }

  async findInDocument(query: string, replaceWith: string, replaceAll: boolean): Promise<void> {
    // Delegated to the editor's find/replace engine via the host surface.
    this.findEngine?.(query, replaceWith, replaceAll);
  }

  /** Set by the editor when it wires the find/replace engine. */
  findEngine: ((query: string, replaceWith: string, replaceAll: boolean) => void) | null = null;

  wordCount(): number {
    const text = documentText(this.host.getSnapshot().blocks);
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  private legacyDraft(): string | null {
    try {
      if (localStorage.getItem("ezynota:legacy-draft-dismissed")) return null;
      return localStorage.getItem("ezynota:draft:v1");
    } catch {
      return null;
    }
  }

  async importLegacyDraft(data: string): Promise<void> {
    try {
      const document = JSON.parse(data) as EzynotaDocument;
      if (!document || !Array.isArray(document.blocks)) return;
      const note = this.state.createNote("Imported draft", null, document);
      await this.loadNoteIntoEditor(note.id);
    } catch {
      /* malformed legacy draft is ignored (still preserved in localStorage) */
    }
  }

  /** Search across titles and text (public API). */
  search(query: string): SearchHit[] {
    return this.state.search(query);
  }

  /** Notes linking to the given note. */
  backlinks(noteId: string): NoteRecord[] {
    return this.state.backlinks(noteId);
  }

  /** Read-only projection of workspace notes (public API). */
  listNotes(includeTrashed = false): readonly NoteRecord[] {
    return this.state.listNotes(includeTrashed);
  }

  listFolders(includeTrashed = false): readonly FolderRecord[] {
    return this.state.listFolders(includeTrashed);
  }

  /** Resolve the active note document into a portable HTML string. */
  async activeNoteHtml(): Promise<string> {
    return blocksToHtml(this.host.getSnapshot().blocks);
  }

  /** Resolve assets to data URLs for external consumers. */
  async portableSnapshot(): Promise<EzynotaDocument> {
    await this.saveActiveNote();
    const snapshot = this.host.getSnapshot();
    return resolveDocumentAssets(cloneDoc(snapshot) as EzynotaDocument, (assetId) => this.state.loadAsset(assetId));
  }

  get generatorVersion(): string {
    return GENERATOR_VERSION;
  }
}

function documentText(blocks: EzynotaBlock[]): string {
  let out = "";
  const walk = (list: EzynotaBlock[]): void => {
    for (const block of list) {
      const content = (block.data as { content?: { text?: string }[] }).content;
      if (Array.isArray(content)) out += `${content.map((node) => node.text ?? "").join("")}\n`;
      if (block.type === "code") out += `${String((block.data as { code?: string }).code ?? "")}\n`;
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);
  return out;
}

function cloneDoc<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createWorkspaceId(): string {
  return createDefaultIdGenerator()();
}
