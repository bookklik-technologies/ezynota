import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../src/workspace/storage";
import { WorkspaceState } from "../src/workspace/workspace";
import type { CommitResult, WorkspaceEvent } from "../src/workspace/types";

const workspaces: WorkspaceState[] = [];
let nextId = 0;

function workspace(storage: MemoryStorage): WorkspaceState {
  const state = new WorkspaceState({
    workspaceId: "save-regression",
    storage,
    generateId: () => `note-${++nextId}`,
    autosaveMs: 60_000
  });
  workspaces.push(state);
  return state;
}

afterEach(() => {
  for (const state of workspaces.splice(0)) state.destroy();
  vi.restoreAllMocks();
});

describe("workspace autosave recovery", () => {
  it("continues saving after reopening an existing workspace", async () => {
    const storage = new MemoryStorage(false);
    const original = workspace(storage);
    await original.load();
    const note = original.createNote("First draft");
    await original.flush();
    original.renameNote(note.id, "Saved draft");
    await original.flush();

    const reopened = workspace(storage);
    await reopened.load();
    expect(reopened.getRevision()).toBe(2);
    reopened.renameNote(note.id, "Edited after reload");
    await reopened.flush();

    expect(reopened.getRevision()).toBe(3);
    expect(reopened.getUnsavedSnapshot()).toBeNull();
    expect((await storage.loadWorkspace(reopened.workspaceId))?.notes[0]?.title).toBe("Edited after reload");
  });

  it("retains local edits on a real conflict without overwriting the other tab", async () => {
    const storage = new MemoryStorage(false);
    const first = workspace(storage);
    await first.load();
    const note = first.createNote("Shared draft");
    await first.flush();
    const second = workspace(storage);
    await second.load();
    const events: WorkspaceEvent[] = [];
    second.on((event) => events.push(event));

    first.renameNote(note.id, "Other tab's edit");
    await first.flush();
    second.renameNote(note.id, "My unsaved edit");
    await second.flush();
    second.retrySave();
    await second.flush();

    expect(second.getNote(note.id)?.title).toBe("My unsaved edit");
    expect(second.getUnsavedSnapshot()?.notes[0]?.title).toBe("My unsaved edit");
    expect((await storage.loadWorkspace(second.workspaceId))?.notes[0]?.title).toBe("Other tab's edit");
    expect(events.at(-1)).toMatchObject({ type: "saveStatus", status: "error", error: { context: { reason: "stale" } } });
  });

  it("keeps edits made during a failed save and retries the latest version", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace(storage);
    await state.load();
    const note = state.createNote("Initial draft");
    await state.flush();

    let failWrite!: (result: CommitResult) => void;
    const pendingWrite = new Promise<CommitResult>((resolve) => { failWrite = resolve; });
    let writeStarted!: () => void;
    const started = new Promise<void>((resolve) => { writeStarted = resolve; });
    vi.spyOn(storage, "commit").mockImplementationOnce(() => {
      writeStarted();
      return pendingWrite;
    });
    state.renameNote(note.id, "Older pending edit");
    const flush = state.flush();
    await started;
    state.renameNote(note.id, "Latest edit");
    failWrite({ ok: false, reason: "quota" });
    await flush;

    expect(state.getNote(note.id)?.title).toBe("Latest edit");
    expect(state.getUnsavedSnapshot()?.notes[0]?.title).toBe("Latest edit");
    state.retrySave();
    await state.flush();
    expect((await storage.loadWorkspace(state.workspaceId))?.notes[0]?.title).toBe("Latest edit");
    expect(state.getUnsavedSnapshot()).toBeNull();
  });

  it("recovers from an adapter exception without leaving the save queue rejected", async () => {
    const storage = new MemoryStorage(false);
    const state = workspace(storage);
    await state.load();
    const events: WorkspaceEvent[] = [];
    state.on((event) => events.push(event));
    vi.spyOn(storage, "commit").mockRejectedValueOnce(new Error("Storage temporarily unavailable"));
    state.createNote("Keep this draft");
    await state.flush();
    expect(events.at(-1)).toMatchObject({ type: "saveStatus", status: "error" });
    expect(state.getUnsavedSnapshot()?.notes[0]?.title).toBe("Keep this draft");

    state.retrySave();
    await state.flush();
    expect(events.at(-1)).toMatchObject({ type: "saveStatus", status: "saved" });
    expect((await storage.loadWorkspace(state.workspaceId))?.notes[0]?.title).toBe("Keep this draft");
  });
});
