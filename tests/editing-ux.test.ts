import { afterEach, describe, expect, it, vi } from "vitest";
import { Ezynota } from "../src/editor";
import { MemoryStorage } from "../src/workspace/storage";
import type { EzynotaConfig } from "../src/types";

const editors: Ezynota[] = [];
async function create(texts: string[], config: Partial<EzynotaConfig> = {}, width = 1200) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  let measuredWidth = width;
  vi.spyOn(target, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 0, measuredWidth, 700));
  const editor = new Ezynota({ target, mode: "workspace", storage: new MemoryStorage(false), ...config, data: {
    schemaVersion: "1.0.0", blocks: texts.map((text, index) => ({
      id: `p${index}`, type: "paragraph", data: { content: text ? [{ type: "text", text }] : [] }
    }))
  } });
  editors.push(editor);
  await editor.ready;
  return { editor, target, resize: (next: number) => { measuredWidth = next; window.dispatchEvent(new Event("resize")); } };
}
function button(target: HTMLElement, label: string): HTMLButtonElement {
  const control = Array.from(target.querySelectorAll<HTMLButtonElement>("button"))
    .find((control) => control.getAttribute("aria-label") === label || control.textContent?.trim() === label);
  if (!control) throw new Error(`Missing button: ${label}`);
  return control;
}
function find(target: HTMLElement, text: string): HTMLInputElement {
  button(target, "Find in document").click();
  const input = target.querySelector<HTMLInputElement>(".ez-find-input")!;
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("editing UX", () => {
  it("finds and navigates without changing content, then replaces the selected occurrence", async () => {
    const { editor, target } = await create(["review one", "review two"]);
    const original = editor.getSnapshot();
    const input = find(target, "review");
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("1 of 2");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("2 of 2");
    expect(editor.getSnapshot()).toEqual(original);
    const replacement = target.querySelector<HTMLInputElement>('[aria-label="Replace with"]')!;
    replacement.value = "check";
    button(target, "Replace").click();
    expect(editor.getEditableElement("p0")?.textContent).toBe("review one");
    expect(editor.getEditableElement("p1")?.textContent).toBe("check two");
    expect((await editor.save()).blocks[1]!.data).toEqual({ content: [{ type: "text", text: "check two" }] });
    editor.undo();
    expect(editor.getEditableElement("p1")?.textContent).toBe("review two");
    expect(editor.getSnapshot().blocks.map((block) => block.data)).toEqual(original.blocks.map((block) => block.data));
  });

  it("reports no matches and protects read-only content from replacement", async () => {
    const { editor, target } = await create(["review one"], { readOnly: true });
    find(target, "missing");
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("No matches");
    expect(button(target, "Replace").disabled).toBe(true);
    find(target, "review");
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("1 of 1");
    expect(button(target, "Replace").disabled).toBe(true);
    editor.findReplace("review", "removed", true);
    expect(editor.getEditableElement("p0")?.textContent).toBe("review one");
  });

  it("replaces all matches in one undo step and keeps the rendered document in sync", async () => {
    const { editor, target } = await create(["review review", "review"]);
    find(target, "review");
    target.querySelector<HTMLInputElement>('[aria-label="Replace with"]')!.value = "done";
    button(target, "Replace all").click();
    expect(editor.getEditableElement("p0")?.textContent).toBe("done done");
    expect(editor.getEditableElement("p1")?.textContent).toBe("done");
    await editor.save();
    editor.undo();
    expect(editor.getEditableElement("p0")?.textContent).toBe("review review");
    expect(editor.getEditableElement("p1")?.textContent).toBe("review");
  });

  it("restores the writing caret on Escape and leaves other editors' search markers intact", async () => {
    const first = await create(["review first"]);
    const second = await create(["review second"]);
    find(second.target, "review");
    const editable = first.editor.getEditableElement("p0")!;
    editable.focus();
    const range = document.createRange();
    range.setStart(editable.firstChild!, 3);
    range.collapse(true);
    first.editor.setSelectionFromRange(range);
    const input = find(first.target, "review");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(editable);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(3);
    expect(first.target.querySelector(".ez-find-hit")).toBeNull();
    expect(second.target.querySelector(".ez-find-hit")).not.toBeNull();
  });

  it("uses the container width for the notes drawer and retains desktop collapse preference", async () => {
    const { target, resize } = await create(["Keep writing"], {}, 450);
    const toggle = button(target, "Toggle notes sidebar");
    expect(target.classList.contains("ez-workspace-compact")).toBe(true);
    expect(target.classList.contains("ez-workspace-narrow")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(target.querySelector(".ez-sidebar")?.getAttribute("aria-modal")).toBe("true");
    expect(target.querySelector<HTMLElement>(".ez-main")?.inert).toBe(true);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(target.querySelector<HTMLElement>(".ez-main")?.inert).toBe(false);
    expect(document.activeElement).toBe(toggle);
    resize(1200);
    expect(target.classList.contains("ez-workspace-compact")).toBe(false);
    toggle.click();
    resize(450);
    resize(1200);
    expect(target.classList.contains("ez-sidebar-collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers searchable conversion without burying duplicate, move, and delete actions", async () => {
    const { editor, target } = await create(["Keep these words", "Next"]);
    editor.focusBlock("p0", "end");
    editor.setSelectionFromRange(window.getSelection()!.getRangeAt(0));
    button(target, "Block actions").click();
    const menu = target.querySelector<HTMLElement>(".ez-block-toolbar .ez-popover")!;
    expect(button(menu, "Turn into…")).toBeDefined();
    expect(button(menu, "Duplicate")).toBeDefined();
    expect(menu.querySelectorAll(".ez-menu-item").length).toBeLessThan(8);
    button(menu, "Turn into…").click();
    const search = target.querySelector<HTMLInputElement>(".ez-menu-search")!;
    search.value = "quote";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.getBlocks()[0]!.type).toBe("quote");
    expect(editor.getEditableElement("p0")?.textContent).toBe("Keep these words");
    editor.undo();
    expect(editor.getBlocks()[0]!.type).toBe("paragraph");
  });

  it("preserves literal slash-prefixed content when a block is converted explicitly", async () => {
    const { editor, target } = await create(["/release notes"]);
    editor.openBlockPicker("p0");
    const search = target.querySelector<HTMLInputElement>(".ez-menu-search")!;
    search.value = "quote";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.getEditableElement("p0")?.textContent).toBe("/release notes");
  });

  it("updates live matches after edits and disables replacement when editing is locked", async () => {
    const { editor, target } = await create(["review"]);
    find(target, "review");
    editor.updateBlock("p0", { content: [{ type: "text", text: "review review" }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("1 of 2");
    editor.setReadOnly(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button(target, "Replace").disabled).toBe(true);
  });

  it("hides the empty-block hint immediately when typing starts", async () => {
    const { editor } = await create(["Keep this", ""]);
    editor.focusBlock("p1", "end");
    const editable = editor.getEditableElement("p1")!;
    editor.setSelectionFromRange(window.getSelection()!.getRangeAt(0));
    expect(editable.getAttribute("data-ez-writing-hint")).toBe("Type / to choose a block");
    editable.textContent = "Ready to publish.";
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "." }));
    expect(editable.getAttribute("data-ez-empty")).toBe("false");
  });

  it("names the active document instead of a hidden workspace in document mode", async () => {
    const { editor, target } = await create(["Draft"], { mode: "document" });
    const title = target.querySelector<HTMLInputElement>('[aria-label="Document name"]')!;
    expect(title).not.toBeNull();
    title.value = "Release planning";
    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.currentTitle()).toBe("Release planning");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(target.querySelector<HTMLInputElement>(".ez-doc-title")?.value).toBe("Release planning");
  });

  it("closes a workspace link form before switching the writing surface to read-only", async () => {
    const { editor, target } = await create(["Keep this text"]);
    const editable = editor.getEditableElement("p0")!;
    editable.focus();
    const range = document.createRange();
    range.selectNodeContents(editable);
    editor.setSelectionFromRange(range);
    button(target, "Link").click();
    expect(target.querySelector(".ez-link-form")).not.toBeNull();
    editor.setReadOnly(true);
    expect(target.querySelector(".ez-link-form")).toBeNull();
    expect(editable.contentEditable).toBe("false");
    expect(editable.textContent).toBe("Keep this text");
  });

  it("keeps destructive undeclared conversions out of the picker and persistent toolbar", async () => {
    const { editor, target } = await create(["Keep this paragraph"], { ui: { documentToolbar: true } });
    editor.openBlockPicker("p0");
    const titles = Array.from(target.querySelectorAll(".ez-slash-menu .ez-menu-label")).map((label) => label.textContent);
    expect(titles).toContain("Quote");
    expect(titles).not.toContain("Image");
    expect(titles).not.toContain("Table");
    expect(titles).not.toContain("Divider");
    editor.closeMenus();
    editor.focusBlock("p0", "end");
    editor.setSelectionFromRange(window.getSelection()!.getRangeAt(0));
    expect(target.querySelector<HTMLOptionElement>('.ez-block-select option[value="image"]')?.disabled).toBe(true);
    editor.openBlockPicker("p0", true);
    expect(Array.from(target.querySelectorAll(".ez-slash-menu .ez-menu-label")).some((label) => label.textContent === "Image")).toBe(true);
    expect(editor.getEditableElement("p0")?.textContent).toBe("Keep this paragraph");
    const tableId = editor.insertBlock("table", { rows: [[{ content: [{ type: "text", text: "Keep cell" }] }]], headerRow: false });
    editor.openBlockPicker(tableId);
    expect(Array.from(target.querySelectorAll(".ez-slash-menu .ez-menu-label")).some((label) => label.textContent === "Paragraph")).toBe(false);
    expect(target.querySelector(`[data-ez-block-id="${tableId}"]`)?.textContent).toContain("Keep cell");
  });

  it("does not navigate Find or commit a title while an IME candidate is being confirmed", async () => {
    const { editor, target } = await create(["review review"], { mode: "document" });
    const originalTitle = editor.currentTitle();
    const title = target.querySelector<HTMLInputElement>('[aria-label="Document name"]')!;
    title.value = "候補";
    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    expect(editor.currentTitle()).toBe(originalTitle);
    const input = find(target, "review");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true }));
    expect(target.querySelector(".ez-find-counter")?.textContent).toBe("1 of 2");
    expect(editor.getEditableElement("p0")?.textContent).toBe("review review");
  });
});
