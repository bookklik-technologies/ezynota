import { afterEach, describe, expect, it, vi } from "vitest";
import { Ezynota } from "../src/editor";
import { htmlToBlocks } from "../src/input/html-to-blocks";
import { setCaretAtTextOffset } from "../src/selection/selection-manager";
import { sanitizeClipboardBlocks } from "../src/input/clipboard";
import { inlineToDom, domToInline } from "../src/rich-text/dom";
import { inlineToPlainText, type InlineContent } from "../src/rich-text/types";
import type { EzynotaConfig, EzynotaDocument, JsonValue } from "../src/types";

const editors: Ezynota[] = [];

const EZ_JSON = "application/x-ezynota+json";

function create(config: Partial<EzynotaConfig> = {}): { editor: Ezynota; holder: HTMLElement } {
  const holder = document.createElement("div");
  document.body.appendChild(holder);
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

/** Flush dynamic imports (markdown shortcuts, find-replace) and async paste. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function caretAtEnd(editor: Ezynota, id: string): void {
  const editable = editor.getEditableElement(id)!;
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  let last: Node | null = null;
  while (walker.nextNode()) last = walker.currentNode;
  if (last) {
    const offset = (last as Text).data.length;
    range.setStart(last, offset);
    range.collapse(true);
  } else {
    range.collapse(false);
  }
  editor.setSelectionFromRange(range);
}

function caretAtStart(editor: Ezynota, id: string): void {
  const editable = editor.getEditableElement(id)!;
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (first) {
    range.setStart(first, 0);
    range.collapse(true);
  } else {
    range.collapse(true);
  }
  editor.setSelectionFromRange(range);
}

function textOf(block: { data: unknown }): string {
  return inlineToPlainText((block.data as { content?: InlineContent[] }).content ?? []);
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("markdown block shortcuts (fix 2)", () => {
  it("converts '# ' into a level-1 heading while typing the space", async () => {
    const { editor } = create({ data: doc([paragraph("#")]) });
    await flush();
    caretAtEnd(editor, "blk_1");
    editor.getEditableElement("blk_1")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    );
    const block = editor.getSnapshot().blocks[0]!;
    expect(block.type).toBe("heading");
    expect((block.data as { level?: number }).level).toBe(1);
  });

  it("converts '- ' into a bullet list item while typing the space", async () => {
    const { editor } = create({ data: doc([paragraph("-")]) });
    await flush();
    caretAtEnd(editor, "blk_1");
    editor.getEditableElement("blk_1")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    );
    const block = editor.getSnapshot().blocks[0]!;
    expect(block.type).toBe("list");
    expect((block.data as { style?: string; items?: unknown[] }).style).toBe("unordered");
    expect((block.data as { items?: unknown[] }).items).toHaveLength(1);
  });

  it("italic shortcut without regex lookbehind still applies bold markers", async () => {
    const { editor } = create({ data: doc([paragraph("**bold**")]) });
    await flush();
    caretAtEnd(editor, "blk_1");
    editor.getEditableElement("blk_1")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    );
    const content = (editor.getSnapshot().blocks[0]!.data as { content: InlineContent[] }).content;
    const marked = content.find((n) => n.type === "text" && (n as { text: string }).text === "bold") as
      | { marks?: { type: string }[] }
      | undefined;
    expect(marked?.marks).toEqual([{ type: "bold" }]);
  });
});

describe("clipboard sanitization (fix 1)", () => {
  it("paste of ezynota JSON with a javascript: link renders no live link", async () => {
    const { editor, holder } = create({ data: doc([paragraph("start")]) });
    await flush();
    const payload = JSON.stringify({
      blocks: [
        {
          type: "paragraph",
          data: {
            content: [
              { type: "text", text: "before " },
              { type: "link", href: "javascript:alert(1)", content: [{ type: "text", text: "evil" }] }
            ]
          }
        }
      ]
    });
    const dt = new DataTransfer();
    dt.setData(EZ_JSON, payload);
    caretAtEnd(editor, "blk_1");
    editor.getEditableElement("blk_1")!.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt })
    );
    await flush();
    expect(holder.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(holder.textContent).toContain("evil");
  });

  it("sanitizeClipboardBlocks keeps safe links and drops unsafe ones", () => {
    const sanitized = sanitizeClipboardBlocks([
      { type: "paragraph", data: { content: [{ type: "link", href: "https://ok.example", content: [{ type: "text", text: "ok" }] }] } },
      { type: "paragraph", data: { content: [{ type: "link", href: "javascript:x()", content: [{ type: "text", text: "bad" }] }] } }
    ]);
    const json = JSON.stringify(sanitized);
    expect(json).toContain("https://ok.example");
    expect(json).not.toContain("javascript");
    expect(JSON.stringify(sanitized)).toContain("bad");
  });
});

describe("keyboard behavior (fixes 5, 6, 11)", () => {
  it("Enter with a selection deletes the selection and splits once", () => {
    const { editor } = create({ data: doc([paragraph("hello world")]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    const text = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 5);
    range.setEnd(text, 11);
    editor.setSelectionFromRange(range);
    editable.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const blocks = editor.getSnapshot().blocks;
    expect(blocks).toHaveLength(2);
    expect(textOf(blocks[0]!)).toBe("hello");
  });

  it("Backspace on an empty block focuses the previous block", () => {
    const { editor } = create({
      data: doc([paragraph("A"), { type: "paragraph", data: { content: [] } }, paragraph("C")])
    });
    caretAtStart(editor, "blk_2");
    editor.getEditableElement("blk_2")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })
    );
    expect(editor.getSnapshot().blocks.map((b) => b.id)).toEqual(["blk_1", "blk_3"]);
    expect(document.activeElement).toBe(editor.getEditableElement("blk_1"));
  });

  it("Delete at the end of a block merges it with the next block", () => {
    const { editor } = create({ data: doc([paragraph("one"), paragraph("two")]) });
    caretAtEnd(editor, "blk_1");
    editor.getEditableElement("blk_1")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true })
    );
    const blocks = editor.getSnapshot().blocks;
    expect(blocks).toHaveLength(1);
    expect(textOf(blocks[0]!)).toBe("one\ntwo");
  });
});

describe("list merge semantics (fix 7)", () => {
  it("backspace-merging a list into a paragraph keeps only the first item's text", () => {
    const { editor } = create({
      data: doc([
        paragraph("P"),
        { type: "list", data: { style: "unordered", items: [{ content: [{ type: "text", text: "a" }] }, { content: [{ type: "text", text: "b" }] }] } }
      ])
    });
    caretAtStart(editor, "blk_2");
    editor.getEditableElement("blk_2")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })
    );
    const blocks = editor.getSnapshot().blocks;
    expect(blocks).toHaveLength(1);
    const merged = textOf(blocks[0]!);
    expect(merged).toContain("a");
    expect(merged).not.toContain("b");
  });
});

describe("html paste preserves links (fix 8)", () => {
  it("keeps http hrefs as anchors and drops javascript: hrefs", () => {
    const blocks = htmlToBlocks(
      `<p><a href="https://example.com">good</a> and <a href="javascript:alert(1)">bad</a></p>`
    );
    expect(blocks).toHaveLength(1);
    const content = (blocks[0]!.data as { content: InlineContent[] }).content;
    const link = content.find((n) => n.type === "link") as { href?: string } | undefined;
    expect(link?.href).toBe("https://example.com");
    expect(JSON.stringify(blocks)).not.toContain("javascript");
    expect(inlineToPlainText(content)).toContain("bad");
  });

  it("preserves internal note: hrefs through the DOM round-trip (fix 8/19)", () => {
    const content: InlineContent[] = [
      { type: "link", href: "note:abc-123", content: [{ type: "text", text: "linked" }] }
    ];
    const div = document.createElement("div");
    div.appendChild(inlineToDom(content));
    const anchor = div.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("note:abc-123");
    const restored = domToInline(div);
    expect(restored[0]).toMatchObject({ type: "link", href: "note:abc-123" });
  });

  it("lowercases data-ez mark attribute keys (fix 8)", () => {
    const content: InlineContent[] = [{ type: "text", text: "hi", marks: [{ type: "color", attrs: { color: "#ff0000" } }] }];
    const div = document.createElement("div");
    div.appendChild(inlineToDom(content));
    const restored = domToInline(div);
    const node = restored[0] as { marks?: { attrs?: Record<string, unknown> }[] };
    expect(node.marks?.[0]?.attrs).toEqual({ color: "#ff0000" });
  });
});

describe("find & replace (fix 9)", () => {
  it("replace-one replaces only the first match in document order", async () => {
    const { editor } = create({
      data: doc([paragraph("foo bar"), paragraph("foo"), paragraph("baz foo")])
    });
    await flush();
    editor.findReplace("foo", "X", false);
    const blocks = editor.getSnapshot().blocks;
    expect(textOf(blocks[0]!)).toBe("X bar");
    expect(textOf(blocks[1]!)).toBe("foo");
    expect(textOf(blocks[2]!)).toBe("baz foo");
  });

  it("replace-all commits as ONE undo step and does not expand $&", async () => {
    const { editor } = create({ data: doc([paragraph("foo bar foo"), paragraph("foo")]) });
    await flush();
    editor.findReplace("foo", "[$&]", true);
    const blocks = editor.getSnapshot().blocks;
    expect(textOf(blocks[0]!)).toBe("[$&] bar [$&]");
    expect(textOf(blocks[1]!)).toBe("[$&]");
    editor.undo();
    const restored = editor.getSnapshot().blocks;
    expect(textOf(restored[0]!)).toBe("foo bar foo");
    expect(textOf(restored[1]!)).toBe("foo");
    expect(editor.canUndo()).toBe(false);
  });

  it("searches list items and code blocks", async () => {
    const { editor } = create({
      data: doc([
        { type: "list", data: { style: "unordered", items: [{ content: [{ type: "text", text: "needle here" }] }] } },
        { type: "code", data: { code: "const needle = 1" } }
      ])
    });
    await flush();
    editor.findReplace("needle", "pin", true);
    const blocks = editor.getSnapshot().blocks;
    expect(JSON.stringify(blocks[0]!.data)).toContain("pin here");
    expect(JSON.stringify(blocks[1]!.data)).toContain("const pin = 1");
  });
});

describe("selection handling (fixes 3, 10)", () => {
  it("caret restore beyond the text length does not jump to the start", () => {
    const { editor } = create({ data: doc([paragraph("abc")]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    setCaretAtTextOffset(editable, 99);
    const sel = window.getSelection()!;
    expect(sel.isCollapsed).toBe(true);
    // The caret must sit at the END of the content (node boundary after all
    // children), never back at offset 0.
    expect(sel.anchorNode).toBe(editable);
    expect(sel.anchorOffset).toBe(editable.childNodes.length);
  });

  it("backward selections expose anchor/focus direction", () => {
    const { editor } = create({ data: doc([paragraph("abcdef")]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    const text = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    const fakeSelection = {
      rangeCount: 1,
      getRangeAt: () => range,
      isCollapsed: false,
      anchorNode: text,
      anchorOffset: 3,
      focusNode: text,
      focusOffset: 0,
      removeAllRanges: () => undefined,
      addRange: () => undefined
    } as unknown as Selection;
    vi.spyOn(window, "getSelection").mockReturnValue(fakeSelection);
    document.dispatchEvent(new Event("selectionchange"));
    const info = editor.getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.anchorOffset).toBe(3);
    expect(info!.focusOffset).toBe(0);
    expect(info!.anchorBlockId).toBe("blk_1");
    expect(info!.focusBlockId).toBe("blk_1");
  });

  it("whole-block copy is reachable for cross-block selections", async () => {
    const { editor } = create({ data: doc([paragraph("one"), paragraph("two")]) });
    await flush();
    const first = editor.getEditableElement("blk_1")!;
    const second = editor.getEditableElement("blk_2")!;
    first.focus();
    const range = document.createRange();
    const t1 = first.firstChild as Text;
    const t2 = second.firstChild as Text;
    // Cover both blocks entirely (from block start to block end).
    range.setStart(t1, 0);
    range.setEnd(t2, 3);
    editor.setSelectionFromRange(range);
    const dt = new DataTransfer();
    first.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: dt }));
    const json = dt.getData(EZ_JSON);
    expect(json).toContain("one");
    expect(json).toContain("two");
  });
});

describe("clipboard copy hardening (fixes 15, 16)", () => {
  it("a crafted heading level does not throw inside the copy handler", () => {
    const { editor } = create({
      data: doc([{ type: "heading", data: { level: "not-a-number" as unknown as number, content: [{ type: "text", text: "H" }] } }])
    });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    const range = document.createRange();
    range.selectNodeContents(editable);
    editor.setSelectionFromRange(range);
    const dt = new DataTransfer();
    expect(() =>
      editable.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: dt }))
    ).not.toThrow();
    expect(dt.getData("text/html")).toContain("H");
  });

  it("cut serializes the selection like copy", () => {
    const { editor } = create({ data: doc([paragraph("hello")]) });
    const editable = editor.getEditableElement("blk_1")!;
    editable.focus();
    const range = document.createRange();
    range.selectNodeContents(editable);
    editor.setSelectionFromRange(range);
    const dt = new DataTransfer();
    editable.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: dt }));
    expect(dt.getData("text/plain")).toBe("hello");
  });
});
