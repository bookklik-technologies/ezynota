import { describe, it, expect, afterEach } from "vitest";
import { Ezynota } from "../src/editor";
import { EzynotaError } from "../src/core/errors";
import type { EzynotaConfig, EzynotaDocument, JsonValue } from "../src/types";

const editors: Ezynota[] = [];
const holders: HTMLElement[] = [];

function create(config: Partial<EzynotaConfig> = {}): { editor: Ezynota; holder: HTMLElement } {
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  holders.push(holder);
  const editor = new Ezynota({ holder, mode: "embedded", ...config });
  editors.push(editor);
  return { editor, holder };
}

function doc(blocks: Array<{ id?: string; type: string; data: JsonValue }>): EzynotaDocument {
  return {
    schemaVersion: "1.0.0",
    blocks: blocks.map((b, i) => ({ id: b.id ?? `blk_${i + 1}`, type: b.type, data: b.data }))
  };
}

function paragraph(text: string): { type: string; data: JsonValue } {
  return { type: "paragraph", data: { content: [{ type: "text", text }] } };
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const holder of holders.splice(0)) holder.remove();
});

describe("block move convention (final destination index)", () => {
  it("moveBlock(id, n) places the block at final index n in both state and DOM", () => {
    const { editor, holder } = create({ data: doc([
      paragraph("A"), paragraph("B"), paragraph("C")
    ]) });
    editor.moveBlock("blk_1", 2); // A down: final index 2 → [B, C, A]
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_2", "blk_3", "blk_1"]);
    const ids = () => Array.from(holder.querySelectorAll<HTMLElement>(".ez-block")).map((el) => el.dataset.ezBlockId);
    expect(ids()).toEqual(["blk_2", "blk_3", "blk_1"]);
    editor.destroy();
  });

  it("before/after targets resolve to the final index", () => {
    const { editor } = create({ data: doc([
      paragraph("A"), paragraph("B"), paragraph("C")
    ]) });
    editor.moveBlock("blk_1", { after: "blk_3" }); // A after C → [B, C, A]
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_2", "blk_3", "blk_1"]);
    editor.moveBlock("blk_1", { before: "blk_2" }); // A before B → [A, B, C]
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_1", "blk_2", "blk_3"]);
    editor.destroy();
  });

  it("move inversion restores the original order", () => {
    const { editor } = create({ data: doc([
      paragraph("A"), paragraph("B"), paragraph("C")
    ]) });
    editor.moveBlock("blk_1", 1); // A down one → [B, A, C]
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_2", "blk_1", "blk_3"]);
    editor.undo();
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_1", "blk_2", "blk_3"]);
    editor.destroy();
  });
});

describe("paste semantics", () => {
  it("pastes multiple blocks as ONE undo step at the caret", () => {
    const { editor } = create({ data: doc([paragraph("one")]) });
    editor.pasteBlocks(
      [
        { type: "paragraph", data: { content: [{ type: "text", text: "p1" }] } },
        { type: "heading", data: { level: 2, content: [{ type: "text", text: "h" }] } }
      ],
      "blk_1",
      "paste"
    );
    expect(editor.getSnapshot().blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "heading"]);
    expect(editor.canUndo()).toBe(true);
    editor.undo();
    expect(editor.getSnapshot().blocks.map((b) => b.type)).toEqual(["paragraph"]);
    expect((editor.getSnapshot().blocks[0]!.data as { content: { text: string }[] }).content[0]!.text).toBe("one");
    editor.destroy();
  });

  it("replaces an empty anchor block instead of leaving it behind", () => {
    const { editor } = create({ data: doc([paragraph("")]) });
    editor.pasteBlocks([{ type: "paragraph", data: { content: [{ type: "text", text: "filled" }] } }], "blk_1");
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    expect((editor.getSnapshot().blocks[0]!.data as { content: { text: string }[] }).content[0]!.text).toBe("filled");
    editor.destroy();
  });
});

describe("undo matches complete user actions", () => {
  it("one undo reverses a block split completely", () => {
    const { editor } = create({ data: doc([paragraph("hello world")]) });
    const before = editor.getSnapshot().blocks[0]!.data;
    const newId = editor.splitBlock("blk_1",
      { content: [{ type: "text", text: "hello" }] } as JsonValue,
      { content: [{ type: "text", text: "world" }] } as JsonValue
    );
    expect(newId).toBeTruthy();
    expect(editor.getSnapshot().blocks).toHaveLength(2);
    editor.undo();
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    expect(editor.getSnapshot().blocks[0]!.data).toEqual(before);
    editor.redo();
    expect(editor.getSnapshot().blocks).toHaveLength(2);
    editor.destroy();
  });

  it("render() resets the undo stack instead of recording an irreversible batch", async () => {
    const { editor } = create({ data: doc([paragraph("first")]) });
    editor.insertBlock("paragraph", { content: [{ type: "text", text: "second" }] });
    expect(editor.canUndo()).toBe(true);
    await editor.render(doc([paragraph("loaded")]));
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);
    editor.undo(); // must not cross document boundaries
    expect(editor.getSnapshot().blocks.map((b) => (b.data as { content: { text: string }[] }).content[0]?.text)).toEqual(["loaded"]);
    editor.destroy();
  });
});

describe("save() reliability", () => {
  it("rejects (and emits errors) when a block fails validation instead of resolving with a lossy document", async () => {
    const { editor } = create();
    const id = editor.insertBlock("paragraph", { content: [{ type: "text", text: "ok" }] });
    const renderer = (editor as unknown as { renderer: { getTool(id: string): { save: () => unknown; validate: (data: unknown) => boolean } } }).renderer;
    renderer.getTool = () => ({
      save: () => ({ bad: true }),
      validate: () => false
    });
    const errors: EzynotaError[] = [];
    editor.on("error", (err) => errors.push(err));
    await expect(editor.save()).rejects.toThrow(EzynotaError);
    expect(errors.length).toBeGreaterThan(0);
    // The editor state is untouched — recovery data still available.
    expect(editor.getSnapshot().blocks[0]!.id).toBe(id);
    editor.destroy();
  });

  it("applies async tool saves exactly once, guarding stale results", async () => {
    const { editor } = create({ data: doc([paragraph("async")]) });
    const container = editor as unknown as { renderer: { getTool(id: string): unknown } };
    let resolveSave: ((data: JsonValue) => void) | undefined;
    container.renderer.getTool = () => ({
      save: () => new Promise<JsonValue>((resolve) => { resolveSave = resolve; })
    });
    editor.requestSaveBlock("blk_1", "user");
    // Simulate a newer user edit while the async save is in flight.
    editor.updateBlockData("blk_1", { content: [{ type: "text", text: "newer edit" }] });
    resolveSave?.({ content: [{ type: "text", text: "stale save" }] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((editor.getSnapshot().blocks[0]!.data as { content: { text: string }[] }).content[0]!.text).toBe("newer edit");
    editor.destroy();
  });
});

describe("recovery mode for unsupported documents", () => {
  it("opens newer-schema documents read-only and preserves the original payload on save", async () => {
    const future: EzynotaDocument = {
      schemaVersion: "9.0.0",
      blocks: [{ id: "f1", type: "futurething", data: { secret: true } }]
    };
    const { editor, holder } = create({ data: future });
    expect(editor.isRecoveryMode()).toBe(true);
    expect(holder.classList.contains("ez-readonly")).toBe(true);
    // Unknown tool falls back to a read-only representation, data intact.
    expect(holder.querySelector(".ez-unknown-block")).not.toBeNull();
    const saved = await editor.save();
    expect(saved.schemaVersion).toBe("9.0.0");
    expect(saved.blocks[0]!.type).toBe("futurething");
    expect(saved.blocks[0]!.data).toEqual({ secret: true });
    editor.destroy();
  });
});

describe("keyboard", () => {
  it("Shift+Tab leaves a code block", () => {
    const { editor } = create({ data: doc([
      { type: "code", data: { code: "const x = 1" } }, paragraph("after")
    ]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    editor.setSelectionFromRange((() => {
      const r = document.createRange();
      r.selectNodeContents(editable);
      r.collapse(false);
      return r;
    })());
    editable.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(editor.getEditableElement("blk_2"));
    editor.destroy();
  });
});
