import { afterEach, describe, expect, it, vi } from "vitest";
import { Ezynota } from "../src/editor";
import { ImageTool } from "../src/tools/image-tool";
import { IndexedDbStorage, MemoryStorage, emptyWorkspace } from "../src/workspace/storage";
import { WorkspaceState } from "../src/workspace/workspace";
import { registerAssetLoader, registerAssetStore, resolveAssetSrc, storeFileAsset } from "../src/workspace/asset-registry";

const editors: Ezynota[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function editor(workspace: string, storage: MemoryStorage): Ezynota {
  const target = document.createElement("div");
  document.body.append(target);
  const instance = new Ezynota({ target, workspace, storage, mode: "workspace", theme: "light" });
  editors.push(instance);
  return instance;
}

describe("audit regressions", () => {
  it("saves Undo and Redo content without requiring another edit", async () => {
    const storage = new MemoryStorage(false);
    const instance = editor("history-audit", storage);
    await instance.ready;
    const id = instance.insertBlock("paragraph", { content: [{ type: "text", text: "saved edit" }] });
    await instance.workspace!.state.flush();
    instance.undo();
    await instance.workspace!.state.flush();
    expect((await storage.loadWorkspace("history-audit"))!.notes[0]!.document.blocks.some(block => block.id === id)).toBe(false);
    instance.redo();
    await instance.workspace!.state.flush();
    expect((await storage.loadWorkspace("history-audit"))!.notes[0]!.document.blocks.some(block => block.id === id)).toBe(true);
  });

  it("stores images in their owning workspace with two editors alive", async () => {
    const firstStorage = new MemoryStorage(false);
    const secondStorage = new MemoryStorage(false);
    const first = editor("assets-a", firstStorage);
    const second = editor("assets-b", secondStorage);
    await Promise.all([first.ready, second.ready]);
    const file = new File([new Uint8Array([1, 2, 3])], "first.png", { type: "image/png" });
    const data = await ImageTool.filesToBlockDataAsync([file], first.target);
    const src = (data[0]!.data as { src: string }).src;
    expect(await firstStorage.loadAsset("assets-a", src.slice(6))).not.toBeNull();
    expect(await secondStorage.loadAsset("assets-b", src.slice(6))).toBeNull();
    second.destroy();
    expect((await ImageTool.filesToBlockDataAsync([file], first.target))[0]).toBeDefined();
  });

  it("does not use another scope or complete a disposed asset load", async () => {
    const a = {}, b = {};
    const offA = registerAssetStore(async () => "asset:a", a);
    const offB = registerAssetStore(async () => "asset:b", b);
    expect(await storeFileAsset(new File([], "a.png"), a)).toBe("asset:a");
    let finish!: (value: null) => void;
    const offLoad = registerAssetLoader(() => new Promise(resolve => { finish = resolve; }), a);
    const pending = resolveAssetSrc("asset:a", a);
    offLoad(); finish(null);
    expect(await pending).toBeNull();
    offA(); offB();
  });

  it("retains the old workspace when a backup asset cannot be written", async () => {
    const storage = new MemoryStorage(false);
    const state = new WorkspaceState({ workspaceId: "original", storage, generateId: () => "restored" });
    await state.load();
    state.createNote("Original");
    await state.flush();
    const backup = { ...emptyWorkspace("backup"), assets: [{ id: "image", mime: "image/png", bytes: [1], name: "image.png", createdAt: 1 }] };
    vi.spyOn(storage, "saveAsset").mockResolvedValue(false);
    await expect(state.restoreBackup(backup)).rejects.toMatchObject({ code: "EZ_IMPORT_FAILED" });
    expect(state.workspaceId).toBe("original");
    expect(state.listNotes()[0]!.title).toBe("Original");
    expect(await storage.loadWorkspace("restored")).toBeNull();
    state.destroy();
  });

  it("reports temporary storage and shows a persistent backup action", async () => {
    const instance = editor("temporary-audit", new MemoryStorage(false));
    await instance.ready;
    await instance.workspace!.state.flush();
    const root = instance.target.closest<HTMLElement>(".ez-workspace-root")!;
    const notice = root.querySelector<HTMLElement>(".ez-workspace-storage-notice")!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain("Download workspace backup");
    expect(root.querySelector(".ez-status-text")!.textContent).toBe("Stored in this tab only");
    const storage = new IndexedDbStorage();
    vi.stubGlobal("indexedDB", undefined);
    await storage.init();
    expect(storage.persistent).toBe(false);
    await storage.close();
    vi.unstubAllGlobals();
  });

  it("installs Markdown shortcuts before ready resolves", async () => {
    const target = document.createElement("div"); document.body.append(target);
    const instance = new Ezynota({ target, mode: "embedded", data: { schemaVersion: "1.0.0", blocks: [{ id: "heading", type: "paragraph", data: { content: [{ type: "text", text: "#" }] } }] } });
    editors.push(instance); await instance.ready;
    const editable = instance.getEditableElement("heading")!; editable.focus();
    const range = document.createRange(); range.selectNodeContents(editable); range.collapse(false);
    instance.setSelectionFromRange(range);
    editable.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    expect(instance.getSnapshot().blocks[0]!.type).toBe("heading");
  });
});
