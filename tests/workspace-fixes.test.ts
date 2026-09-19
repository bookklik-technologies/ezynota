import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage, IndexedDbStorage } from "../src/workspace/storage";
import { WorkspaceState, encodeBackupForExport } from "../src/workspace/workspace";
import { WorkspaceController } from "../src/workspace/controller";
import type {
  CommitResult,
  StorageAdapter,
  WorkspaceAsset,
  WorkspaceEnvelope,
  WorkspaceEvent,
  NoteRecord
} from "../src/workspace/types";
import type { EzynotaDocument } from "../src/types";
import type { HistoryState } from "../src/core/history";

/**
 * Two-tab test adapter: data is shared through module maps (like real
 * IndexedDB across tabs) while each instance keeps its own
 * BroadcastChannel, so commits in one "tab" notify the other.
 */
const sharedWorkspaces = new Map<string, { envelope: WorkspaceEnvelope; revision: number }>();
const sharedAssets = new Map<string, WorkspaceAsset>();

function cloneEnvelope(envelope: WorkspaceEnvelope): WorkspaceEnvelope {
  return JSON.parse(JSON.stringify(envelope)) as WorkspaceEnvelope;
}

class SharedMapStorage implements StorageAdapter {
  private listeners = new Map<string, Set<() => void>>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.channel = new BroadcastChannel("shared-map-storage");
    this.channel.onmessage = (event: MessageEvent) => {
      const workspaceId = (event.data as { workspaceId?: string }).workspaceId;
      if (!workspaceId) return;
      for (const listener of this.listeners.get(workspaceId) ?? []) listener();
    };
  }

  async init(): Promise<void> {}

  async loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null> {
    const record = sharedWorkspaces.get(workspaceId);
    return record ? { ...cloneEnvelope(record.envelope), storageRevision: record.revision } : null;
  }

  async commit(workspaceId: string, envelope: WorkspaceEnvelope, expectedRevision: number) {
    const current = sharedWorkspaces.get(workspaceId);
    if ((current?.revision ?? 0) !== expectedRevision) return { ok: false as const, reason: "stale" as const };
    const next = { envelope: cloneEnvelope(envelope), revision: (current?.revision ?? 0) + 1 };
    sharedWorkspaces.set(workspaceId, next);
    this.channel?.postMessage({ workspaceId });
    return { ok: true as const, revision: next.revision };
  }

  async loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null> {
    return sharedAssets.get(`${workspaceId}::${assetId}`) ?? null;
  }

  async saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean> {
    sharedAssets.set(`${workspaceId}::${asset.id}`, { ...asset, bytes: new Uint8Array(asset.bytes) });
    return true;
  }

  subscribe(workspaceId: string, listener: () => void): () => void {
    let set = this.listeners.get(workspaceId);
    if (!set) {
      set = new Set();
      this.listeners.set(workspaceId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }

  async close(): Promise<void> {
    this.channel?.close();
    this.channel = null;
  }
}

const states: WorkspaceState[] = [];
const controllers: WorkspaceController[] = [];
const storages: { close(): Promise<void> }[] = [];
let nextId = 0;

function id(): string {
  return `id-${++nextId}`;
}

function workspace(workspaceId: string, storage: StorageAdapter): WorkspaceState {
  const state = new WorkspaceState({
    workspaceId,
    storage,
    generateId: id,
    autosaveMs: 60_000
  });
  states.push(state);
  return state;
}

function documentWithText(text: string, extra: Record<string, unknown> = {}): EzynotaDocument {
  return {
    schemaVersion: "1.0.0",
    blocks: [{ id: `b-${text}`, type: "paragraph", data: { content: [{ type: "text", text }], ...extra } }],
    createdAt: 1,
    updatedAt: 1
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/* ---------- fake host for controller-level tests ---------- */

interface RenderContext {
  gate: Promise<void> | null;
  rendered: EzynotaDocument[];
  focusedBlocks: string[];
}

function makeHost(context: RenderContext) {
  return {
    readOnly: false,
    undo: () => undefined,
    redo: () => undefined,
    canUndo: () => false,
    canRedo: () => false,
    getSnapshot: (): EzynotaDocument => ({ schemaVersion: "1.0.0", blocks: [], createdAt: 0, updatedAt: 0 }),
    render: (document: EzynotaDocument): Promise<void> => {
      context.rendered.push(JSON.parse(JSON.stringify(document)) as EzynotaDocument);
      return context.gate ?? Promise.resolve();
    },
    focus: () => undefined,
    focusBlock: (blockId: string) => {
      context.focusedBlocks.push(blockId);
    },
    getBlockIndex: () => 0,
    setReadOnly: () => undefined,
    setDocumentTitle: () => undefined,
    on: () => () => undefined,
    exportHistoryState: () => ({}) as HistoryState,
    importHistoryState: () => undefined,
    announce: () => undefined
  };
}

function createController(
  storage: MemoryStorage,
  options: { onEvent?: (event: WorkspaceEvent) => void } = {}
): { controller: WorkspaceController; context: RenderContext } {
  const context: RenderContext = { gate: null, rendered: [], focusedBlocks: [] };
  const surface = document.createElement("div");
  document.body.appendChild(surface);
  const controller = new WorkspaceController(makeHost(context), surface, {
    targetId: "test-target",
    explicitWorkspaceId: "fixes-regression",
    storage,
    onEvent: options.onEvent
  });
  controllers.push(controller);
  return { controller, context };
}

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  for (const state of states.splice(0)) state.destroy();
  for (const storage of storages.splice(0)) void storage.close();
  sharedWorkspaces.clear();
  sharedAssets.clear();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("workspace audit fixes", () => {
  it("restoreBackup flushes first, commits under a new id and never clobbers the current workspace", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("restore-src", storage);
    await state.load();
    const note = state.createNote("Original note");
    await state.flush();
    const backup = await state.createBackup();

    // Dirty, unflushed edit that must be persisted to the OLD id before the
    // restored envelope replaces the in-memory state.
    state.renameNote(note.id, "Unsaved rename");
    const result = await state.restoreBackup(backup, { newWorkspaceId: true });

    expect(result.workspaceId).not.toBe("restore-src");
    // The current workspace was flushed first and is not clobbered.
    expect((await storage.loadWorkspace("restore-src"))?.notes[0]?.title).toBe("Unsaved rename");
    // The backup content was committed under the new id.
    expect((await storage.loadWorkspace(result.workspaceId))?.notes[0]?.title).toBe("Original note");
    // Subsequent saves target the restored workspace id.
    state.createNote("Post-restore note");
    await state.flush();
    const restored = await storage.loadWorkspace(result.workspaceId);
    expect(restored?.notes.map((entry) => entry.title)).toContain("Post-restore note");
  });

  it("restores assets with base64 bytes through a JSON round-trip", async () => {
    const storage = new MemoryStorage(false);
    const source = workspace("backup-src", storage);
    await source.load();
    const ok = await source.saveAsset({
      id: "asset-1",
      mime: "image/png",
      name: "dot.png",
      bytes: new Uint8Array([1, 2, 3, 4, 255, 0]),
      createdAt: 1
    });
    expect(ok).toBe(true);
    const note = source.createNote("With image");
    source.updateNoteDocument(note.id, {
      schemaVersion: "1.0.0",
      blocks: [{ id: "img", type: "image", data: { src: "asset:asset-1", alt: "" } }],
      createdAt: 1,
      updatedAt: 1
    });
    const backup = await source.createBackup();
    const json = JSON.stringify(encodeBackupForExport(backup));
    const parsed = JSON.parse(json) as unknown;

    const target = workspace("backup-target", storage);
    await target.load();
    const result = await target.restoreBackup(parsed, { newWorkspaceId: true });
    const asset = await storage.loadAsset(result.workspaceId, "asset-1");
    expect(asset).not.toBeNull();
    expect(Array.from(asset!.bytes)).toEqual([1, 2, 3, 4, 255, 0]);
  });

  it("rejects backups with malformed asset bytes", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("backup-invalid", storage);
    await state.load();
    const backup = {
      workspaceSchemaVersion: "1.0.0",
      id: "whatever",
      notes: [],
      folders: [],
      savedAt: 1,
      assets: [{ id: "asset-1", mime: "image/png", bytes: { "0": 1 }, createdAt: 1 }]
    };
    await expect(state.restoreBackup(backup, { newWorkspaceId: true })).rejects.toThrow();
  });

  it("drops stale overlapping note loads so note B's document never lands in note A", async () => {
    const storage = new MemoryStorage(false);
    const { controller, context } = createController(storage);
    const docA = documentWithText("doc-A");
    const docB = documentWithText("doc-B");
    const noteA = controller.state.createNote("Note A", null, docA);
    const noteB = controller.state.createNote("Note B", null, docB);

    const gateA = deferred();
    const gateB = deferred();
    context.gate = gateA.promise;
    const loadA = controller.openNoteById(noteA.id);
    context.gate = gateB.promise;
    const loadB = controller.openNoteById(noteB.id);

    gateB.resolve();
    await loadB;
    expect(controller.state.activeNoteId).toBe(noteB.id);

    // The stale load A completes later and must not mutate the session.
    gateA.resolve();
    await loadA;
    expect(controller.state.activeNoteId).toBe(noteB.id);
    expect(JSON.stringify(context.rendered.at(-1))).toContain("doc-B");
  });

  it("collects mark-based and link-node note links into noteLinks/backlinks", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("links-regression", storage);
    await state.load();

    // Mark-based link: { type: "text", marks: [{ type: "link", attrs: { href } }] }
    const markDoc = documentWithText("has marks", {
      content: [
        { type: "text", text: "plain" },
        { type: "text", text: "linked", marks: [{ type: "link", attrs: { href: "note:mark-target" } }] }
      ]
    });
    const markNote = state.createNote("Marks note", null, markDoc);

    // Link-node based link (the shape DOM-serialized documents carry):
    // { type: "link", href: "note:<id>", content: [{ type: "text", text }] }
    const linkDoc: EzynotaDocument = {
      schemaVersion: "1.0.0",
      blocks: [
        {
          id: "dom-block",
          type: "paragraph",
          data: { content: [{ type: "link", href: "note:node-target", content: [{ type: "text", text: "Dom link" }] }] }
        }
      ],
      createdAt: 1,
      updatedAt: 1
    };
    const nodeNote = state.createNote("Node note", null, linkDoc);

    expect(state.noteLinks(markNote.id)).toContain("mark-target");
    expect(state.noteLinks(nodeNote.id)).toContain("node-target");
    expect(state.backlinks("mark-target").map((n: NoteRecord) => n.id)).toContain(markNote.id);
    expect(state.backlinks("node-target").map((n: NoteRecord) => n.id)).toContain(nodeNote.id);
  });

  it("marks the workspace dirty when emptyTrash removes only folders", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("trash-regression", storage);
    await state.load();
    state.createNote("Kept note");
    const folder = state.createFolder("Doomed folder");
    state.trashFolder(folder.id);
    await state.flush();

    const commitSpy = vi.spyOn(storage, "commit");
    state.emptyTrash();
    expect(state.listFolders()).toHaveLength(0);
    await state.flush();
    expect(commitSpy).toHaveBeenCalled();
    expect((await storage.loadWorkspace("trash-regression"))?.folders).toHaveLength(0);
  });

  it("duplicateNote keeps the '(copy)' title in document.meta", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("duplicate-regression", storage);
    await state.load();
    const note = state.createNote("My note");
    const copy = state.duplicateNote(note.id)!;
    expect(copy.title).toBe("My note (copy)");
    expect((copy.document.meta as { title?: string }).title).toBe("My note (copy)");
  });

  it("importFiles continues past a bad file and reports the failure via importError", async () => {
    const storage = new MemoryStorage(false);
    const events: WorkspaceEvent[] = [];
    const { controller } = createController(storage, { onEvent: (event) => events.push(event) });
    const bad = new File(["{ not json"], "broken.json", { type: "application/json" });
    const good = new File(["Hello from text file"], "note.txt", { type: "text/plain" });

    await controller.importFiles([bad, good]);

    expect(controller.listNotes()).toHaveLength(1);
    expect(controller.listNotes()[0]?.title).toBe("note");
    expect(events.some((event) => (event as { type?: string }).type === "importError")).toBe(true);
  });

  it("destroy persists pending dirty state before closing storage", async () => {
    const storage = new MemoryStorage(false);
    const closeSpy = vi.spyOn(storage, "close");
    const state = workspace("destroy-regression", storage);
    await state.load();
    state.createNote("Final draft");
    state.destroy();
    await waitFor(() => closeSpy.mock.calls.length > 0);
    expect((await storage.loadWorkspace("destroy-regression"))?.notes[0]?.title).toBe("Final draft");
    expect(state.getUnsavedSnapshot()).toBeNull();
  });

  it("flushes dirty state on pagehide and on visibilitychange→hidden", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("unload-regression", storage);
    await state.load();
    state.createNote("Unload draft");
    window.dispatchEvent(new Event("pagehide"));
    await state.flush();
    expect((await storage.loadWorkspace("unload-regression"))?.notes[0]?.title).toBe("Unload draft");

    state.renameNote(state.listNotes()[0]!.id, "Hidden draft");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await state.flush();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect((await storage.loadWorkspace("unload-regression"))?.notes[0]?.title).toBe("Hidden draft");
  });

  it("reloads the envelope on remoteChange so the next save is not stale", async () => {
    const storage = new SharedMapStorage();
    storages.push(storage);
    const firstTab = new SharedMapStorage();
    storages.push(firstTab);
    const first = workspace("remote-regression", storage);
    const second = workspace("remote-regression", firstTab);
    await first.load();
    await second.load();
    const note = first.createNote("Shared note");
    await first.flush();

    await waitFor(() => second.getNote(note.id) !== undefined);
    expect(second.getRevision()).toBe(1);

    first.renameNote(note.id, "Remote edit");
    await first.flush();
    await waitFor(() => second.getNote(note.id)?.title === "Remote edit");

    // The refreshed revision lets the second tab commit cleanly.
    second.createNote("Second tab note");
    await second.flush();
    expect((await storage.loadWorkspace("remote-regression"))?.notes).toHaveLength(2);
  });

  it("keeps conflict state while dirty but lets an explicit retrySave win", async () => {
    const storage = new SharedMapStorage();
    storages.push(storage);
    const firstTab = new SharedMapStorage();
    storages.push(firstTab);
    const first = workspace("conflict-regression", storage);
    const second = workspace("conflict-regression", firstTab);
    await first.load();
    await second.load();
    const note = first.createNote("Shared note");
    await first.flush();
    await waitFor(() => second.getNote(note.id) !== undefined);

    const events: WorkspaceEvent[] = [];
    second.on((event) => events.push(event));
    second.renameNote(note.id, "Local unsaved");
    first.renameNote(note.id, "Remote edit");
    await first.flush();
    await waitFor(() => events.some((event) => event.type === "remoteChange"));

    second.retrySave();
    await second.flush();
    expect(second.getUnsavedSnapshot()).toBeNull();
    expect((await storage.loadWorkspace("conflict-regression"))?.notes[0]?.title).toBe("Local unsaved");
  });

  it("IndexedDbStorage falls back to working memory storage when open fails", async () => {
    const storage = new IndexedDbStorage();
    storages.push(storage);
    await storage.init();
    const result: CommitResult = await storage.commit(
      "idb-fallback",
      {
        workspaceSchemaVersion: "1.0.0",
        id: "idb-fallback",
        notes: [],
        folders: [],
        savedAt: 1
      },
      0
    );
    expect(result.ok).toBe(true);
    const loaded = await storage.loadWorkspace("idb-fallback");
    expect(loaded?.id).toBe("idb-fallback");
  });

  it("search honors the includeTrash option", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("search-regression", storage);
    await state.load();
    const note = state.createNote("Findable trashed note");
    state.trashNote(note.id);

    expect(state.search("findable")).toHaveLength(0);
    expect(state.search("findable", { includeTrash: true }).length).toBeGreaterThan(0);
  });

  it("renameWorkspace persists the envelope name, emits and round-trips through backup", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace("name-regression", storage);
    await state.load();
    expect(state.getWorkspaceName()).toBe("Untitled workspace");

    const events: WorkspaceEvent[] = [];
    state.on((event) => events.push(event));
    state.renameWorkspace("Field notes");
    expect(state.getWorkspaceName()).toBe("Field notes");
    expect(events.some((event) => event.type === "workspaceRenamed" && event.name === "Field notes")).toBe(true);

    // Whitespace-only renames fall back to the default label.
    state.renameWorkspace("   ");
    expect(state.getWorkspaceName()).toBe("Untitled workspace");

    await state.flush();
    expect((await storage.loadWorkspace("name-regression"))?.name).toBe("Untitled workspace");

    // The name survives a backup/restore round-trip.
    const backup = await state.createBackup();
    const restored = await state.restoreBackup(backup, { newWorkspaceId: true });
    expect(state.getWorkspaceName()).toBe("Untitled workspace");
    expect(restored.workspaceId).not.toBe("name-regression");
  });

  it("normalizeEnvelope defaults the name for legacy envelopes without one", async () => {
    const storage = new MemoryStorage(false);
    await storage.init();
    const legacy = await storage.loadWorkspace("legacy-name");
    expect(legacy).toBeNull();
    await storage.commit(
      "legacy-name",
      {
        workspaceSchemaVersion: "1.0.0",
        id: "legacy-name",
        notes: [],
        folders: [],
        savedAt: 1
      },
      0
    );

    const state = workspace("legacy-name", storage);
    await state.load();
    expect(state.getWorkspaceName()).toBe("Untitled workspace");
  });
});
