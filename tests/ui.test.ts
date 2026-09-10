import { afterEach, describe, expect, it, vi } from "vitest";
import { Ezynota } from "../src/editor";
import { BoldTool } from "../src/inline/inline-tools";
import { TOOL_ICONS, isSvgIcon } from "../src/ui/icons";
import type { EzynotaConfig, EzynotaDocument } from "../src/types";

const editors: Ezynota[] = [];
function create(config: Partial<EzynotaConfig> = {}): { editor: Ezynota; holder: HTMLElement } {
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  const editor = new Ezynota({ holder, ui: { documentToolbar: true, inlineToolbar: false }, ...config });
  editors.push(editor);
  return { editor, holder };
}
function documentWith(...texts: string[]): EzynotaDocument {
  return { schemaVersion: "1.0.0", blocks: texts.map((text, index) => ({
    id: `paragraph-${index}`, type: "paragraph", data: { content: [{ type: "text", text }] }
  })) };
}
function select(editor: Ezynota, id: string, collapsed = false): HTMLElement {
  const editable = editor.getEditableElement(id)!;
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  if (collapsed) range.collapse(false);
  editor.setSelectionFromRange(range);
  return editable;
}
function control(holder: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(holder.querySelectorAll<HTMLButtonElement>("button"))
    .find((button) => button.getAttribute("aria-label") === label || button.textContent?.trim() === label);
  if (!found) throw new Error(`Control not found: ${label}`);
  return found;
}
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("writing controls", () => {
  it("renders the shipped Lucide assets as SVG in both block menus", () => {
    expect(isSvgIcon(TOOL_ICONS.heading)).toBe(true);
    expect(isSvgIcon("H1")).toBe(false);
    const { editor, holder } = create({ data: documentWith("Text") });
    select(editor, "paragraph-0", true);
    control(holder, "Block actions").click();
    const settings = holder.querySelector<HTMLElement>(".ez-block-toolbar .ez-popover")!;
    expect(settings.querySelector(".ez-menu-item svg")).not.toBeNull();
    expect(settings.textContent).not.toContain("<svg");
    editor.openBlockPicker("paragraph-0", true);
    const options = holder.querySelectorAll<HTMLElement>(".ez-slash-menu [role=option]");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.querySelector("svg")).not.toBeNull();
      expect(option.textContent).not.toContain("<svg");
      expect(option.textContent).not.toContain("@license");
    }
  });

  it("closes settings only once if removing the focused menu reenters the close handler", () => {
    const { editor, holder } = create({ data: documentWith("Text") });
    select(editor, "paragraph-0", true);
    control(holder, "Block actions").click();
    const popover = holder.querySelector<HTMLElement>(".ez-block-toolbar .ez-popover")!;
    const nativeRemove = popover.remove.bind(popover);
    const remove = vi.spyOn(popover, "remove").mockImplementation(() => {
      // Model Chromium's synchronous focusout while removal is in progress.
      editor.closeMenus();
      nativeRemove();
    });
    expect(() => editor.closeMenus()).not.toThrow();
    expect(remove).toHaveBeenCalledOnce();
    expect(popover.isConnected).toBe(false);
    select(editor, "paragraph-0", true);
    control(holder, "Block actions").click();
    expect(holder.querySelector(".ez-block-toolbar .ez-popover")).not.toBeNull();
    control(holder, "Add block").click();
    expect(holder.querySelector<HTMLElement>(".ez-slash-menu")!.style.display).toBe("block");
  });

  it("turns an empty writing surface into an editable block on focus", () => {
    const { editor, holder } = create();
    holder.querySelector<HTMLElement>(".ez-empty-input")!.focus();
    expect(editor.getBlocks()).toHaveLength(1);
    expect(document.activeElement).toBe(editor.getEditableElement(editor.getBlocks()[0]!.id));
    expect(holder.querySelector(".ez-empty-input")).toBeNull();
  });

  it("keeps the document toolbar opt-in and honors disabled UI", () => {
    const legacy = create({ ui: true });
    expect(legacy.holder.querySelector(".ez-document-toolbar")).toBeNull();
    const headless = create({ ui: false });
    expect(headless.holder.querySelector("[data-ez-ui]")).toBeNull();
  });

  it("applies highlight through a toolbar click after keyboard focus moves into controls", async () => {
    const { editor, holder } = create({ data: documentWith("A useful idea") });
    select(editor, "paragraph-0");
    const more = holder.querySelector<HTMLDetailsElement>(".ez-more-formatting")!;
    more.open = true;
    const highlight = control(holder, "Highlight");
    highlight.focus();
    highlight.click();
    const data = (await editor.save()).blocks[0]!.data;
    expect(data).toEqual({ content: [{ type: "text", text: "A useful idea", marks: [{ type: "mark" }] }] });
    editor.undo();
    expect((await editor.save()).blocks[0]!.data).toEqual({ content: [{ type: "text", text: "A useful idea" }] });
  });

  it("routes collapsed bold activation to the registered tool and disables selection-only tools", () => {
    const apply = vi.spyOn(BoldTool.prototype, "apply").mockImplementation(() => undefined);
    const { editor, holder } = create({ data: documentWith("Text") });
    select(editor, "paragraph-0", true);
    control(holder, "Bold").click();
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0]![0].collapsed).toBe(true);
    expect(control(holder, "Highlight").disabled).toBe(true);
    expect(control(holder, "Link").disabled).toBe(true);
  });

  it("searches and chooses a block with Enter without splitting the document", () => {
    const { editor, holder } = create({ data: documentWith("") });
    editor.openBlockPicker("paragraph-0", true);
    const search = holder.querySelector<HTMLInputElement>(".ez-menu-search")!;
    search.value = "quote";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.getBlocks().map((block) => block.type)).toEqual(["quote"]);
    expect(holder.querySelector<HTMLElement>(".ez-slash-menu")!.style.display).toBe("none");
  });

  it("inserts after populated content and uses unique menu option IDs per editor", () => {
    const first = create({ data: documentWith("Keep this") });
    const second = create({ data: documentWith("Other document") });
    first.editor.openBlockPicker("paragraph-0", true);
    const firstId = first.holder.querySelector("[role=option]")!.id;
    second.editor.openBlockPicker("paragraph-0", true);
    expect(second.holder.querySelector("[role=option]")!.id).not.toBe(firstId);
    first.editor.openBlockPicker("paragraph-0", true);
    control(first.holder.querySelector<HTMLElement>(".ez-slash-menu")!, "Heading").click();
    expect(first.editor.getBlocks().map((block) => block.type)).toEqual(["paragraph", "heading"]);
    expect(first.editor.getSnapshot().blocks[0]!.data).toEqual({ content: [{ type: "text", text: "Keep this" }] });
  });

  it("persists alignment as a tune, then restores it through undo and redo", async () => {
    const { editor, holder } = create({ data: documentWith("Centered") });
    select(editor, "paragraph-0", true);
    control(holder, "Center").click();
    expect((await editor.save()).blocks[0]!.tunes?.alignment).toBe("center");
    expect(holder.querySelector(".ez-align-center")).not.toBeNull();
    expect(editor.getSnapshot().blocks[0]!.data).not.toHaveProperty("alignment");
    editor.undo();
    expect(holder.querySelector(".ez-align-center")).toBeNull();
    editor.redo();
    expect(holder.querySelector(".ez-align-center")).not.toBeNull();
  });

  it("exposes heading and list settings without losing text when the element is replaced", async () => {
    const { editor, holder } = create({ data: documentWith("Keep these words") });
    editor.convertBlock("paragraph-0", "heading");
    select(editor, "paragraph-0", true);
    control(holder, "Heading level 3").click();
    expect(holder.querySelector("h3")?.textContent).toBe("Keep these words");
    editor.convertBlock("paragraph-0", "list");
    select(editor, "paragraph-0", true);
    control(holder, "Numbered").click();
    expect(holder.querySelector("ol li")?.textContent).toBe("Keep these words");
    expect((await editor.save()).blocks[0]!.data).toMatchObject({ style: "ordered" });
  });

  it("restores the original block order after clear and keeps move order consistent", () => {
    const { editor, holder } = create({ data: documentWith("First", "Second", "Third") });
    editor.clear();
    editor.undo();
    const ids = () => Array.from(holder.querySelectorAll<HTMLElement>(".ez-block")).map((node) => node.dataset.ezBlockId);
    expect(ids()).toEqual(["paragraph-0", "paragraph-1", "paragraph-2"]);
    editor.moveBlock("paragraph-0", 2);
    expect(ids()).toEqual(editor.getBlocks().map((block) => block.id));
    editor.undo();
    expect(ids()).toEqual(["paragraph-0", "paragraph-1", "paragraph-2"]);
  });

  it("allows editing and removing an existing link and reports invalid URLs", async () => {
    const { editor, holder } = create({ data: {
      schemaVersion: "1.0.0", blocks: [{ id: "link", type: "paragraph", data: {
        content: [{ type: "link", href: "https://example.com", content: [{ type: "text", text: "Example" }] }]
      } }]
    } });
    const editable = editor.getEditableElement("link")!;
    editable.focus();
    const range = document.createRange();
    range.setStart(editable.querySelector("a")!.firstChild!, 2);
    range.collapse(true);
    editor.setSelectionFromRange(range);
    control(holder, "Link").click();
    const input = holder.querySelector<HTMLInputElement>(".ez-link-input")!;
    expect(input.value).toBe("https://example.com");
    input.value = "javascript:alert(1)";
    control(holder, "Apply").click();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    input.value = "https://example.org";
    control(holder, "Apply").click();
    expect(editable.querySelector("a")?.getAttribute("href")).toBe("https://example.org");
    editor.setSelectionFromRange(range);
    control(holder, "Link").click();
    control(holder, "Remove").click();
    expect((await editor.save()).blocks[0]!.data).toEqual({ content: [{ type: "text", text: "Example" }] });
  });

  it("closes editing popovers in preview and restores controls when editing resumes", () => {
    const { editor, holder } = create({ data: documentWith("Read me") });
    editor.openBlockPicker("paragraph-0", true);
    editor.setReadOnly(true);
    expect(holder.querySelector<HTMLElement>(".ez-slash-menu")!.style.display).toBe("none");
    expect(editor.getEditableElement("paragraph-0")!.contentEditable).toBe("false");
    editor.setReadOnly(false);
    select(editor, "paragraph-0");
    expect(control(holder, "Bold").disabled).toBe(false);
  });
});
