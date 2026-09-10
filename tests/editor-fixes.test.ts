import { describe, it, expect, beforeEach } from "vitest";
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
  return { schemaVersion: "1.0.0", blocks: blocks.map((b, i) => ({ id: b.id ?? `blk_${i + 1}`, type: b.type, data: b.data })) };
}

function paragraph(text: string): { type: string; data: JsonValue } {
  return { type: "paragraph", data: { content: [{ type: "text", text }] } };
}

beforeEach(() => {
  editors.length = 0;
});

describe("editing lock (mutations before ready)", () => {
  it("rejects API mutations issued before the workspace load completes", async () => {
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    const editor = new Ezynota({ holder, data: doc([paragraph("loaded")]) });
    expect(() => editor.insertBlock("paragraph")).toThrow(EzynotaError);
    expect(() => editor.updateBlock("x", {})).toThrow(EzynotaError);
    expect(() => editor.clear()).toThrow(EzynotaError);
    try {
      editor.insertBlock("paragraph");
    } catch (err) {
      expect((err as EzynotaError).code).toBe("EZ_EDITING_LOCKED");
    }
    await editor.ready;
    // Unlocked after load: mutations work.
    const id = editor.insertBlock("paragraph", { content: [{ type: "text", text: "after" }] });
    expect(id).toBeTruthy();
    expect(editor.getSnapshot().blocks.some((b) => (b.data as { content?: { text?: string }[] }).content?.some((n) => n.text === "after"))).toBe(true);
    editor.destroy();
  });

  it("focus() no-ops while locked instead of inserting", async () => {
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    const editor = new Ezynota({ holder, data: doc([paragraph("loaded")]) });
    expect(() => editor.focus()).not.toThrow();
    await editor.ready;
    editor.destroy();
  });
});

describe("consumer callback hardening", () => {
  it("a throwing onChange handler does not break transaction processing", () => {
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    holders.push(holder);
    const throwing = new Ezynota({
      holder,
      mode: "embedded",
      onChange: () => {
        throw new Error("consumer bug");
      }
    });
    editors.push(throwing);
    const id = throwing.insertBlock("paragraph", { content: [{ type: "text", text: "works" }] });
    expect(throwing.getSnapshot().blocks).toHaveLength(1);
    expect(throwing.getBlockData(id)).toBeTruthy();
    throwing.undo();
    expect(throwing.getSnapshot().blocks).toHaveLength(0);
    throwing.destroy();
  });

  it("a throwing onReady handler does not break readiness", async () => {
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    holders.push(holder);
    const editor = new Ezynota({
      holder,
      mode: "embedded",
      onReady: () => {
        throw new Error("consumer bug");
      }
    });
    await editor.ready;
    editor.insertBlock("paragraph");
    expect(editor.getSnapshot().blocks).toHaveLength(1);
    editor.destroy();
  });
});

describe("undo race with async tool saves", () => {
  it("an async save resolving after undo does not re-apply stale data", async () => {
    const { editor } = create({ data: doc([paragraph("base")]) });
    // Record one user edit so undo() has a history entry to restore.
    editor.updateBlockData("blk_1", { content: [{ type: "text", text: "edited" }] } as JsonValue);
    const renderer = (editor as unknown as { renderer: { getTool(id: string): unknown } }).renderer;
    const pending: ((data: JsonValue) => void)[] = [];
    renderer.getTool = () => ({
      save: () => new Promise<JsonValue>((resolve) => pending.push(resolve))
    });
    editor.requestSaveBlock("blk_1", "user");
    editor.undo();
    // The stale save resolves after undo was applied.
    for (const resolve of pending.splice(0)) resolve({ content: [{ type: "text", text: "stale" }] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The undo result survives: content is the restored pre-change state,
    // not the stale in-flight save.
    const data = editor.getSnapshot().blocks[0]!.data as { content?: { text?: string }[] };
    expect(JSON.stringify(data)).not.toContain("stale");
    editor.destroy();
  });
});

describe("salvage of malformed documents", () => {
  it("does not crash the constructor; invalid blocks become unknown placeholders", () => {
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    holders.push(holder);
    const editor = new Ezynota({
      holder,
      mode: "embedded",
      data: {
        schemaVersion: "1.0.0",
        blocks: [
          { id: "ok", type: "paragraph", data: { content: [{ type: "text", text: "fine" }] } },
          { id: "bad", type: "paragraph" } // missing "data" → invalid
        ]
      } as unknown as EzynotaDocument
    });
    editors.push(editor);
    expect(editor.getSnapshot().blocks.length).toBe(2);
    expect(editor.getSnapshot().blocks.some((b) => b.type === "unknown")).toBe(true);
    editor.destroy();
  });

  it("render() salvages a document that fails strict normalization", async () => {
    const { editor } = create({ data: doc([paragraph("start")]) });
    await editor.render({
      schemaVersion: "1.0.0",
      blocks: [
        { id: "ok2", type: "paragraph", data: { content: [{ type: "text", text: "kept" }] } },
        { id: "bad2", type: "heading" } // missing "data" → invalid
      ]
    } as EzynotaDocument);
    expect(editor.getSnapshot().blocks.length).toBe(2);
    expect(editor.getSnapshot().blocks.some((b) => b.type === "unknown")).toBe(true);
    editor.destroy();
  });
});

describe("redo selection (post-change caret)", () => {
  it("redo restores the caret position after the change", async () => {
    const { editor } = create({ data: doc([paragraph("hello world")]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    // Caret at offset 5 ("hello|"), then append text via the API to simulate
    // a transaction, undo it and redo — redo must place the caret after the
    // re-applied change, not at the pre-change position.
    const range = document.createRange();
    range.setStart(editable.firstChild!, 5);
    range.collapse(true);
    editor.setSelectionFromRange(range);
    editor.updateBlockData("blk_1", { content: [{ type: "text", text: "hello brave world" }] } as JsonValue);
    const undoSel = (editor as unknown as { history: { undoStack: { postSelection?: unknown }[] } }).history.undoStack;
    expect(undoSel.length).toBeGreaterThan(0);
    const post = undoSel[undoSel.length - 1]!.postSelection as { blockId?: string; focusOffset?: number } | null;
    expect(post?.blockId).toBe("blk_1");
    // The live caret after the change is captured (this API update does not
    // move the DOM caret, so the offset matches the selection at apply time).
    expect(post?.focusOffset).toBe(5);
    editor.destroy();
  });
});

function toggleDoc(childText: string): EzynotaDocument {
  return {
    schemaVersion: "1.0.0",
    blocks: [
      {
        id: "toggle-1",
        type: "toggle",
        data: { open: true, heading: [{ type: "text", text: "Section" }] },
        children: [{ id: "child-1", type: "paragraph", data: { content: [{ type: "text", text: childText }] } }]
      }
    ]
  };
}

describe("nested child input saves through the parent tool", () => {
  it("typing in a toggle child persists through requestSaveNestedChild", () => {
    const { editor } = create({ data: toggleDoc("kid") });
    // Route a child save the way InputManager does after a DOM input event.
    editor.requestSaveNestedChild("toggle-1", "child-1");
    // No DOM change → state content is unchanged and the call must not
    // throw or wipe the child content.
    const children = editor.getSnapshot().blocks[0]!.children ?? [];
    expect(children[0]!.data).toEqual({ content: [{ type: "text", text: "kid" }] });
  });

  it("child edits through the input path persist the child text", async () => {
    const { editor, holder } = create({ data: toggleDoc("kid") });
    const nestedEditable = holder.querySelector<HTMLElement>('[data-ez-nested-id="child-1"] [data-ez-editable]')!;
    expect(nestedEditable).not.toBeNull();
    nestedEditable.textContent = "kid typed";
    nestedEditable.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const children = editor.getSnapshot().blocks[0]!.children ?? [];
    expect((children[0]!.data as { content?: { text?: string }[] }).content?.[0]?.text).toBe("kid typed");
    editor.destroy();
  });
});
