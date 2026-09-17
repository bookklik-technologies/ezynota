import { afterEach, describe, expect, it } from "vitest";
import { Ezynota } from "../src/editor";
import { MemoryStorage, emptyWorkspace } from "../src/workspace/storage";
import type { EzynotaDocument } from "../src/types";
import type { NoteRecord as EzynotaNoteRecord, FolderRecord as EzynotaFolderRecord } from "../src/workspace/types";

const editors: Ezynota[] = [];
const targets: HTMLElement[] = [];

const DOC: EzynotaDocument = {
  schemaVersion: "1.0.0",
  blocks: [{ id: "p1", type: "paragraph", data: { content: [{ type: "text", text: "Hello" }] } }]
};

async function seed(storage: MemoryStorage, notes: EzynotaNoteRecord[], folders: EzynotaFolderRecord[]): Promise<void> {
  const envelope = emptyWorkspace("dnd-regression");
  envelope.notes.push(...notes);
  envelope.folders.push(...folders);
  await storage.commit(envelope.id, envelope, 0);
}

function note(id: string, title: string, folderId: string | null): EzynotaNoteRecord {
  return { id, title, folderId, document: DOC, createdAt: 1, updatedAt: 1, revision: 0 };
}

function folder(id: string, name: string, parentId: string | null): EzynotaFolderRecord {
  return { id, name, parentId, createdAt: 1, updatedAt: 1 };
}

function fakeDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (type: string, value: string) => void store.set(type, value),
    getData: (type: string) => store.get(type) ?? ""
  } as unknown as DataTransfer;
}

function fire(type: string, target: EventTarget): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: fakeDataTransfer() });
  target.dispatchEvent(event);
}

function treeRow(target: HTMLElement, dataAttr: string, id: string): HTMLElement {
  const row = target.querySelector<HTMLElement>(`[${dataAttr}="${id}"]`)?.closest<HTMLElement>(".ez-tree-row");
  if (!row) throw new Error(`missing tree row for ${id}`);
  return row;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const target of targets.splice(0)) target.remove();
});

describe("workspace sidebar drag & drop", () => {
  it("moves a note into a folder when dropped on the folder row", async () => {
    const storage = new MemoryStorage(false);
    await seed(storage, [note("n1", "Ideas", null)], [folder("f1", "Projects", null)]);
    const target = document.createElement("div");
    document.body.appendChild(target);
    targets.push(target);
    const editor = new Ezynota({ target, mode: "workspace", workspace: "dnd-regression", storage, autofocus: false });
    editors.push(editor);
    await editor.ready;

    const noteRow = treeRow(target, "data-note-id", "n1");
    const folderRow = treeRow(target, "data-folder-id", "f1");
    expect(noteRow.draggable).toBe(true);

    fire("dragstart", noteRow);
    fire("dragover", folderRow);
    expect(folderRow.classList.contains("ez-drop-target")).toBe(true);

    const dragover = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(dragover, "dataTransfer", { value: fakeDataTransfer() });
    folderRow.dispatchEvent(dragover);
    expect(dragover.defaultPrevented).toBe(true);

    fire("drop", folderRow);
    expect(editor.workspace?.listNotes()[0]?.folderId).toBe("f1");

    await new Promise((resolve) => setTimeout(resolve, 100));
    const noteLabel = target.querySelector<HTMLElement>(`[data-note-id="n1"]`);
    expect(noteLabel?.closest(".ez-tree-row")?.previousElementSibling?.getAttribute("data-folder-id")).toBe("f1");
  });

  it("moves a note back to the workspace root when dropped on the tree background", async () => {
    const storage = new MemoryStorage(false);
    await seed(storage, [note("n1", "Ideas", "f1")], [folder("f1", "Projects", null)]);
    const target = document.createElement("div");
    document.body.appendChild(target);
    targets.push(target);
    const editor = new Ezynota({ target, mode: "workspace", workspace: "dnd-regression", storage, autofocus: false });
    editors.push(editor);
    await editor.ready;

    const tree = target.querySelector<HTMLElement>(".ez-notes-tree");
    expect(tree).not.toBeNull();

    // The note lives inside a collapsed folder — expand it first.
    const caret = target.querySelector<HTMLButtonElement>(".ez-tree-folder .ez-tree-caret");
    caret?.click();
    const noteRow = treeRow(target, "data-note-id", "n1");

    fire("dragstart", noteRow);
    fire("drop", tree!);
    expect(editor.workspace?.listNotes()[0]?.folderId).toBeNull();
  });

  it("moves a folder into another folder and refuses cyclic drops", async () => {
    const storage = new MemoryStorage(false);
    await seed(storage, [], [folder("f1", "Work", null), folder("f2", "Personal", null)]);
    const target = document.createElement("div");
    document.body.appendChild(target);
    targets.push(target);
    const editor = new Ezynota({ target, mode: "workspace", workspace: "dnd-regression", storage, autofocus: false });
    editors.push(editor);
    await editor.ready;

    const workRow = treeRow(target, "data-folder-id", "f1");
    const personalRow = treeRow(target, "data-folder-id", "f2");
    fire("dragstart", workRow);
    fire("drop", personalRow);
    expect(editor.workspace?.listFolders().find((f) => f.id === "f1")?.parentId).toBe("f2");

    // Refresh the sidebar, then try to drag the parent into its own child.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const refreshedWorkRow = treeRow(target, "data-folder-id", "f1");
    const refreshedPersonalRow = treeRow(target, "data-folder-id", "f2");
    fire("dragstart", refreshedPersonalRow);
    const dragover = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(dragover, "dataTransfer", { value: fakeDataTransfer() });
    refreshedWorkRow.dispatchEvent(dragover);
    expect(dragover.defaultPrevented).toBe(false);
    fire("drop", refreshedWorkRow);
    // The cyclic drop must be refused: f1 stays inside f2.
    expect(editor.workspace?.listFolders().find((f) => f.id === "f1")?.parentId).toBe("f2");
  });
});
