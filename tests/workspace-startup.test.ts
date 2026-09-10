import { afterEach, describe, expect, it } from "vitest";
import { Ezynota } from "../src/editor";
import { MemoryStorage, emptyWorkspace } from "../src/workspace/storage";
import type { EzynotaConfig, EzynotaDocument } from "../src/types";

const editors: Ezynota[] = [];
const holders: HTMLElement[] = [];

function create(storage: MemoryStorage, options: Partial<EzynotaConfig> = {}): Ezynota {
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  holders.push(holder);
  const editor = new Ezynota({
    holder,
    mode: "workspace",
    workspace: "startup-regression",
    storage,
    autofocus: false,
    ...options
  });
  editors.push(editor);
  return editor;
}

async function seed(storage: MemoryStorage, document: EzynotaDocument): Promise<void> {
  const envelope = emptyWorkspace("startup-regression");
  envelope.notes.push({
    id: "saved-note",
    title: "Saved note",
    folderId: null,
    document,
    createdAt: 1,
    updatedAt: 1,
    revision: 0
  });
  await storage.commit(envelope.id, envelope, 0);
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const holder of holders.splice(0)) holder.remove();
});

describe("workspace startup", () => {
  it("makes a fresh empty note editable immediately after ready", async () => {
    const editor = create(new MemoryStorage(false));
    await editor.ready;
    const input = editor.holder.querySelector<HTMLElement>(".ez-empty-input");
    expect(input?.contentEditable).toBe("true");
    input?.focus();
    expect(editor.getBlocks()).toHaveLength(1);
    expect(editor.holder.querySelector<HTMLElement>("[data-ez-editable]")?.contentEditable).toBe("true");
  });

  it("opens saved content for editing without replacing it with the startup document", async () => {
    const storage = new MemoryStorage(false);
    await seed(storage, {
      schemaVersion: "1.0.0",
      blocks: [{ id: "saved-paragraph", type: "paragraph", data: { content: [{ type: "text", text: "Keep my saved writing" }] } }]
    });
    const editor = create(storage);
    await editor.ready;
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    const input = editor.holder.querySelector<HTMLElement>("[data-ez-editable]");
    expect(input?.textContent).toBe("Keep my saved writing");
    expect(input?.contentEditable).toBe("true");
    expect((await storage.loadWorkspace("startup-regression"))?.notes[0]?.document.blocks).toHaveLength(1);
  });

  it("builds image editing controls on the initially loaded note", async () => {
    const storage = new MemoryStorage(false);
    await seed(storage, {
      schemaVersion: "1.0.0",
      blocks: [{ id: "saved-image", type: "image", data: { src: "https://example.com/photo.png", alt: "A photo", caption: "Saved caption" } }]
    });
    const editor = create(storage);
    await editor.ready;
    expect(editor.holder.querySelector(".ez-image-toolbar")).not.toBeNull();
    expect(editor.holder.querySelector<HTMLElement>(".ez-image-caption")?.contentEditable).toBe("true");
  });

  it("preserves explicit read-only mode after loading", async () => {
    const editor = create(new MemoryStorage(false), { readOnly: true });
    await editor.ready;
    expect(editor.readOnly).toBe(true);
    expect(editor.holder.querySelector("[contenteditable='true']")).toBeNull();
    expect(editor.holder.querySelector(".ez-empty-input")?.textContent).toBe("This document is empty.");
  });

  it("keeps explicitly supplied initial document content", async () => {
    const editor = create(new MemoryStorage(false), {
      data: {
        schemaVersion: "1.0.0",
        blocks: [{ id: "initial-paragraph", type: "paragraph", data: { content: [{ type: "text", text: "Initial writing" }] } }]
      }
    });
    await editor.ready;
    expect(editor.holder.querySelector("[data-ez-editable]")?.textContent).toBe("Initial writing");
  });
});
