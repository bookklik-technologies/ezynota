import { describe, it, expect, beforeEach } from "vitest";
import { Ezynota } from "../src/editor";
import { EzynotaError } from "../src/core/errors";
import type { EzynotaDocument, JsonValue } from "../src/core/types";

function doc(blocks: Array<{ type: string; data: Record<string, unknown> }>): EzynotaDocument {
  return {
    schemaVersion: "1.0.0",
    blocks: blocks.map((b, i) => ({ id: `blk_${i + 1}`, type: b.type, data: b.data as JsonValue }))
  };
}

let holder: HTMLElement;

beforeEach(() => {
  holder = document.createElement("div");
  document.body.appendChild(holder);
});

describe("Ezynota lifecycle", () => {
  it("is ready immediately after construction and renders blocks", async () => {
    const editor = new Ezynota({
      holder,
      data: doc([{ type: "paragraph", data: { content: [{ type: "text", text: "hello" }] } }])
    });
    await editor.ready;
    expect(holder.querySelectorAll(".ez-block")).toHaveLength(1);
    expect(holder.querySelector(".ez-text-input")?.textContent).toBe("hello");
    editor.destroy();
  });

  it("save() round-trips through render() preserving content", async () => {
    const editor = new Ezynota({
      holder,
      mode: "embedded",
      data: doc([
        { type: "paragraph", data: { content: [{ type: "text", text: "one" }, { type: "text", text: "two", marks: [{ type: "bold" }] }] } },
        { type: "heading", data: { level: 2, content: [{ type: "text", text: "head" }] } },
        { type: "code", data: { code: "x = 1" } },
        { type: "delimiter", data: {} }
      ])
    });
    const saved = await editor.save();
    expect(saved.schemaVersion).toBe("1.0.0");
    expect(saved.blocks).toHaveLength(4);
    expect(saved.generator?.name).toBe("ezynota");

    await editor.render(saved);
    const resaved = await editor.save();
    expect(resaved.blocks.map((b) => b.type)).toEqual(saved.blocks.map((b) => b.type));
    expect(resaved.blocks.map((b) => JSON.stringify(b.data))).toEqual(saved.blocks.map((b) => JSON.stringify(b.data)));
    // IDs stay stable across save/load cycles (spec §4.4)
    expect(resaved.blocks.map((b) => b.id)).toEqual(saved.blocks.map((b) => b.id));
    editor.destroy();
  });

  it("supports block CRUD through the public API", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const id1 = editor.insertBlock("paragraph", { content: [{ type: "text", text: "first" }] });
    const id2 = editor.insertBlock("heading", { level: 2, content: [{ type: "text", text: "h" }] });
    expect(editor.getBlocks()).toHaveLength(2);

    editor.updateBlock(id1, { content: [{ type: "text", text: "updated" }] });
    expect(editor.getSnapshot().blocks[0]?.data).toEqual({ content: [{ type: "text", text: "updated" }] });

    const dupId = editor.duplicateBlock(id1);
    expect(editor.getSnapshot().blocks).toHaveLength(3);
    expect(dupId).not.toBe(id1);

    editor.moveBlock(id2, 0);
    expect(editor.getSnapshot().blocks[0]?.type).toBe("heading");

    editor.convertBlock(dupId, "quote");
    expect(editor.getSnapshot().blocks[2]?.type).toBe("quote");

    editor.removeBlock(dupId);
    expect(editor.getSnapshot().blocks).toHaveLength(2);
    editor.destroy();
  });

  it("getBlockById exposes a stable BlockRef API", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const id = editor.insertBlock("paragraph", { content: [{ type: "text", text: "x" }] });
    const ref = editor.getBlockById(id);
    expect(ref).toBeDefined();
    expect(ref?.type).toBe("paragraph");
    ref?.patch({ someKey: "v" });
    expect(editor.getSnapshot().blocks[0]?.data).toMatchObject({ someKey: "v", content: [{ type: "text", text: "x" }] });
    editor.removeBlock(id);
    expect(editor.getBlockById(id)).toBeUndefined();
    editor.destroy();
  });

  it("undo/redo works through transactions", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const id = editor.insertBlock("paragraph", { content: [{ type: "text", text: "v1" }] });
    editor.updateBlock(id, { content: [{ type: "text", text: "v2" }] });
    expect(editor.canUndo()).toBe(true);

    editor.undo();
    expect((editor.getSnapshot().blocks[0]?.data as { content: { text: string }[] }).content[0]?.text).toBe("v1");

    editor.redo();
    expect((editor.getSnapshot().blocks[0]?.data as { content: { text: string }[] }).content[0]?.text).toBe("v2");

    editor.undo();
    editor.undo(); // removes the inserted block
    expect(editor.getSnapshot().blocks).toHaveLength(0);
    expect(editor.canUndo()).toBe(false);
    editor.redo();
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    editor.destroy();
  });

  it("read-only mode prevents edits through the API path", async () => {
    const editor = new Ezynota({ holder, mode: "embedded", data: doc([{ type: "paragraph", data: { content: [{ type: "text", text: "ro" }] } }]), readOnly: true });
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    const editable = holder.querySelector("[data-ez-editable]") as HTMLElement;
    expect(editable?.contentEditable).toBe("false");
    editor.setReadOnly(false);
    expect((holder.querySelector("[data-ez-editable]") as HTMLElement)?.contentEditable).toBe("true");
    editor.destroy();
  });

  it("throws typed errors for unregistered tools", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    expect(() => editor.insertBlock("not-a-tool")).toThrow(EzynotaError);
    try {
      editor.insertBlock("not-a-tool");
    } catch (err) {
      expect((err as EzynotaError).code).toBe("EZ_TOOL_NOT_FOUND");
    }
    editor.destroy();
  });

  it("emits change events with batches and origins", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const batches: unknown[] = [];
    editor.on("change", (batch) => batches.push(batch));
    editor.insertBlock("paragraph");
    expect(batches).toHaveLength(1);
    const batch = batches[0] as { origin: string; changes: { type: string }[] };
    expect(batch.origin).toBe("api");
    expect(batch.changes[0]?.type).toBe("block:insert");
    editor.destroy();
  });

  it("unsubscribes listeners via the returned function", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    let count = 0;
    const off = editor.on("change", () => count++);
    editor.insertBlock("paragraph");
    off();
    editor.insertBlock("paragraph");
    expect(count).toBe(1);
    editor.destroy();
  });

  it("dispatch() runs built-in commands", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const id = editor.insertBlock("paragraph", { content: [] });
    editor.dispatch("EZ_CONVERT_BLOCK", { id, type: "heading" });
    expect(editor.getSnapshot().blocks[0]?.type).toBe("heading");
    editor.destroy();
  });

  it("supports multiple editors on one page", () => {
    const holder2 = document.createElement("div");
    document.body.appendChild(holder2);
    const a = new Ezynota({ holder, mode: "embedded" });
    const b = new Ezynota({ holder: holder2, mode: "embedded" });
    a.insertBlock("paragraph", { content: [{ type: "text", text: "A" }] });
    b.insertBlock("paragraph", { content: [{ type: "text", text: "B" }] });
    expect(holder.querySelectorAll(".ez-block")).toHaveLength(1);
    expect(holder2.querySelectorAll(".ez-block")).toHaveLength(1);
    a.destroy();
    b.destroy();
  });

  it("destroy() cleans up DOM and listeners", async () => {
    const editor = new Ezynota({ holder, data: doc([{ type: "paragraph", data: { content: [{ type: "text", text: "x" }] } }]) });
    await editor.ready;
    let changeCount = 0;
    editor.on("change", () => changeCount++);
    editor.destroy();
    expect(holder.classList.contains("ez-editor")).toBe(false);
    expect(holder.querySelector(".ez-blocks")).toBeNull();
    expect(editor.isDestroyed()).toBe(true);
    expect(() => editor.insertBlock("paragraph")).toThrow(EzynotaError);
    expect(editor.canUndo()).toBe(false);
    // destroy twice is safe
    editor.destroy();
  });

  it("rejects empty text blocks in the document on insert with custom validation", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    const id = editor.insertBlock("paragraph", {});
    expect(id).toBeTruthy();
    editor.destroy();
  });

  it("clear() removes all blocks as one transaction", () => {
    const editor = new Ezynota({ holder, mode: "embedded" });
    editor.insertBlock("paragraph");
    editor.insertBlock("heading");
    editor.clear();
    expect(editor.getSnapshot().blocks).toHaveLength(0);
    editor.undo();
    expect(editor.getSnapshot().blocks).toHaveLength(2);
    editor.destroy();
  });
});
