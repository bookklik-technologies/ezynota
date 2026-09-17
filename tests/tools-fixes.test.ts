import { afterEach, describe, expect, it, vi } from "vitest";
import { Ezynota } from "../src/editor";
import type { BlockTool, BlockToolConstructor, EzynotaConfig, EzynotaDocument, InlineContent } from "../src/types";

const editors: Ezynota[] = [];
const targets: HTMLElement[] = [];

function create(config: Partial<EzynotaConfig> = {}): { editor: Ezynota; target: HTMLElement } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  targets.push(target);
  const editor = new Ezynota({ target, mode: "embedded", ...config });
  editors.push(editor);
  return { editor, target };
}

function text(value: string): InlineContent[] {
  return [{ type: "text", text: value }];
}

function doc(blocks: Array<{ id: string; type: string; data: unknown; children?: unknown[] }>): EzynotaDocument {
  return { schemaVersion: "1.0.0", blocks: blocks as EzynotaDocument["blocks"] };
}

function toggleBlock(id: string, heading: string, children: Array<{ id: string; text: string }>): { id: string; type: string; data: unknown; children: unknown[] } {
  return {
    id,
    type: "toggle",
    data: { open: true, heading: text(heading) },
    children: children.map((child) => ({ id: child.id, type: "paragraph", data: { content: text(child.text) } }))
  };
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const target of targets.splice(0)) target.remove();
  vi.restoreAllMocks();
});

describe("toggle blocks with children", () => {
  it("renders children of a top-level toggle and supports add-inside", async () => {
    const { editor, target } = create({
      data: doc([
        toggleBlock("t1", "Section", [
          { id: "c1", text: "child one" },
          { id: "c2", text: "child two" }
        ])
      ])
    });
    const nested = target.querySelectorAll<HTMLElement>('[data-ez-block-id="t1"] .ez-nested-block');
    expect(nested).toHaveLength(2);
    expect(target.querySelector('[data-ez-block-id="t1"]')?.textContent).toContain("child one");

    // "Add block inside" inserts a child without an undo round-trip.
    target.querySelector<HTMLButtonElement>('[data-ez-block-id="t1"] .ez-toggle-add')!.click();
    expect(target.querySelectorAll<HTMLElement>('[data-ez-block-id="t1"] .ez-nested-block')).toHaveLength(3);
    const saved = await editor.save();
    expect((saved.blocks[0] as { children?: EzynotaDocument["blocks"] }).children).toHaveLength(3);
  });

  it("reflects children:update commits live (no undo required)", () => {
    const { editor, target } = create({
      data: doc([toggleBlock("t1", "Section", [])])
    });
    expect(target.querySelectorAll<HTMLElement>('[data-ez-block-id="t1"] .ez-nested-block')).toHaveLength(0);
    const host = editor.nestedHost("t1");
    host.insert("paragraph", { content: text("inserted live") });
    expect(target.querySelectorAll<HTMLElement>('[data-ez-block-id="t1"] .ez-nested-block')).toHaveLength(1);
    expect(target.querySelector('[data-ez-block-id="t1"]')?.textContent).toContain("inserted live");
    // Undo restores the empty toggle through the history origin path.
    editor.undo();
    expect(target.querySelectorAll<HTMLElement>('[data-ez-block-id="t1"] .ez-nested-block')).toHaveLength(0);
  });
});

describe("slash menu conversion strips the typed query", () => {
  it("typing /head and choosing Heading yields a heading with empty content", () => {
    const { editor, target } = create({
      data: doc([{ id: "p0", type: "paragraph", data: { content: text("/head") } }])
    });
    editor.openBlockPicker("p0");
    const search = target.querySelector<HTMLInputElement>(".ez-menu-search")!;
    search.value = "head";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const block = editor.getSnapshot().blocks[0]!;
    expect(block.type).toBe("heading");
    expect(block.data).toEqual({ level: 2, content: [] });
  });

  it("a bare / converts to an empty block as before", () => {
    const { editor, target } = create({
      data: doc([{ id: "p0", type: "paragraph", data: { content: text("/") } }])
    });
    editor.openBlockPicker("p0");
    const search = target.querySelector<HTMLInputElement>(".ez-menu-search")!;
    search.value = "quote";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const block = editor.getSnapshot().blocks[0]!;
    expect(block.type).toBe("quote");
    expect(block.data).toEqual({ content: [] });
  });
});

describe("table keyboard navigation", () => {
  function tableConfig() {
    return {
      data: doc([
        { id: "tbl", type: "table", data: { header: false, rows: [[{ content: text("a") }, { content: [] }], [{ content: [] }, { content: [] }]] } }
      ])
    };
  }

  it("Shift+Tab from the first cell does not append a row", async () => {
    const { editor } = create(tableConfig());
    const first = editor.getEditableElement("tbl")!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    const saved = await editor.save();
    expect((saved.blocks[0]!.data as { rows: unknown[] }).rows).toHaveLength(2);
    expect(document.activeElement).toBe(first);
  });

  it("Tab past the last cell still appends a row", async () => {
    const { editor, target } = create(tableConfig());
    const cells = target.querySelectorAll<HTMLElement>('[data-ez-block-id="tbl"] [data-ez-editable]');
    cells[cells.length - 1]!.focus();
    cells[cells.length - 1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    const saved = await editor.save();
    expect((saved.blocks[0]!.data as { rows: unknown[] }).rows).toHaveLength(3);
  });

  it("undo of a structural table change re-renders the table DOM", () => {
    const { editor, target } = create(tableConfig());
    const cells = target.querySelectorAll<HTMLElement>('[data-ez-block-id="tbl"] [data-ez-editable]');
    cells[cells.length - 1]!.focus();
    cells[cells.length - 1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    editor.undo();
    expect(target.querySelectorAll<HTMLElement>('[data-ez-block-id="tbl"] [data-ez-editable]')).toHaveLength(4);
  });
});

describe("task list checkboxes", () => {
  it("pairs checkboxes per li after a browser-created li", async () => {
    const { editor, target } = create({
      data: doc([{ id: "l1", type: "list", data: { style: "task", items: [{ content: text("one"), checked: true }] } }])
    });
    const list = target.querySelector<HTMLElement>('[data-ez-block-id="l1"] ul')!;
    const editable = editor.getEditableElement("l1")!;
    // Simulate the browser creating a new li on Enter (no checkbox yet).
    const li = document.createElement("li");
    li.textContent = "two";
    list.appendChild(li);
    editable.dispatchEvent(new Event("input", { bubbles: true }));
    const saved = await editor.save();
    expect(saved.blocks[0]!.data).toEqual({
      style: "task",
      items: [
        { content: text("one"), checked: true },
        { content: text("two"), checked: false }
      ]
    });
  });

  it("saves checkbox state per item without positional mispairing", () => {
    const { editor, target } = create({
      data: doc([{ id: "l1", type: "list", data: { style: "task", items: [{ content: text("a") }, { content: text("b"), checked: true }] } }])
    });
    const checkboxes = target.querySelectorAll<HTMLInputElement>('[data-ez-block-id="l1"] .ez-task-checkbox');
    expect(checkboxes[0]!.checked).toBe(false);
    expect(checkboxes[1]!.checked).toBe(true);
    const tool = editor.getTool("l1") as unknown as { save: (el: HTMLElement) => unknown };
    const data = tool.save(target.querySelector<HTMLElement>('[data-ez-block-id="l1"]')!) as { items: Array<{ checked?: boolean }> };
    expect(data.items[0]!.checked).toBe(false);
    expect(data.items[1]!.checked).toBe(true);
  });
});

describe("lazy and broken tools fall back safely", () => {
  it("renders loader-only tools through the unknown fallback without crashing", async () => {
    const { editor, target } = create({});
    editor.registry.registerBlockToolLoader("lazytool", (async () => {
      return class implements BlockTool {
        render(): HTMLElement {
          return document.createElement("div");
        }
        save(): { keep?: boolean } {
          return {};
        }
      } as unknown as BlockToolConstructor;
    }) as () => Promise<BlockToolConstructor>);
    await editor.render(doc([{ id: "lz", type: "lazytool", data: { keep: true } }]));
    expect(target.querySelector(".ez-unknown-block")).not.toBeNull();
    const saved = await editor.save();
    expect(saved.blocks[0]!.data).toEqual({ keep: true });
  });

  it("falls back to the unknown tool when a registered tool throws", () => {
    class BadTool {
      constructor(_options: unknown) {}
      render(): HTMLElement {
        throw new Error("boom");
      }
      save(): unknown {
        return {};
      }
    }
    const { target } = create({
      data: doc([{ id: "b1", type: "bad", data: { keep: true } }]),
      tools: { bad: { class: BadTool } } as unknown as EzynotaConfig["tools"]
    });
    expect(target.querySelector(".ez-unknown-block")).not.toBeNull();
    expect(target.querySelector('[data-ez-block-id="b1"]')?.textContent).toContain("keep");
  });
});

describe("renderer housekeeping", () => {
  it("reports fallback saves only for the block that owns the mutation", async () => {
    const { editor } = create({
      data: doc([
        { id: "b1", type: "paragraph", data: { content: text("first") } },
        { id: "b2", type: "paragraph", data: { content: text("second") } }
      ])
    });
    const spy = vi.spyOn(editor, "requestSaveBlock");
    // A bypassing DOM change inside block b2 only.
    const editable = editor.getEditableElement("b2")!;
    editable.appendChild(editable.ownerDocument.createTextNode(" extra"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(spy).toHaveBeenCalledWith("b2", "user");
    expect(spy).not.toHaveBeenCalledWith("b1", "user");
  });

  it("applies alignment tune updates without a full rebuild", () => {
    const { editor, target } = create({
      data: doc([{ id: "b1", type: "paragraph", data: { content: text("centered") } }])
    });
    const editable = editor.getEditableElement("b1")!;
    editable.appendChild(editable.ownerDocument.createTextNode("marker"));
    editor.blocks.setTune("b1", "alignment", "center");
    expect(target.querySelector(".ez-align-center")).not.toBeNull();
    editor.undo();
    expect(target.querySelector(".ez-align-center")).toBeNull();
    // No rebuild happened: the marker text node added above is still there.
    expect(editor.getEditableElement("b1")!.textContent).toContain("marker");
  });
});
