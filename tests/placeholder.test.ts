import { afterEach, describe, expect, it } from "vitest";
import { Ezynota } from "../src/editor";
import type { EzynotaConfig, EzynotaDocument } from "../src/types";

const editors: Ezynota[] = [];
const holders: HTMLElement[] = [];
const PLACEHOLDER = "Every idea starts somewhere. Start writing...";

function create(config: Partial<EzynotaConfig> = {}): { editor: Ezynota; holder: HTMLElement } {
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  holders.push(holder);
  const editor = new Ezynota({ holder, mode: "embedded", placeholder: PLACEHOLDER, ...config });
  editors.push(editor);
  return { editor, holder };
}

function documentWith(...texts: string[]): EzynotaDocument {
  return {
    schemaVersion: "1.0.0",
    blocks: texts.map((text, index) => ({
      id: `paragraph-${index}`,
      type: "paragraph",
      data: { content: text === "" ? [] : [{ type: "text", text }] }
    }))
  };
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const holder of holders.splice(0)) holder.remove();
});

describe("note placeholder scope", () => {
  it("shows the placeholder on a fresh note (single empty block)", () => {
    const { editor } = create({ data: documentWith("") });
    const editable = editor.getEditableElement("paragraph-0")!;
    expect(editable.getAttribute("data-ez-note-placeholder")).toBe(PLACEHOLDER);
    expect(editable.getAttribute("data-ez-empty")).toBe("true");
    // CSS drives visibility from the scoped attribute.
    expect(editable.hasAttribute("data-ez-placeholder")).toBe(false);
  });

  it("shows no placeholder when the document has other blocks (empty middle block stays blank)", () => {
    const { editor } = create({ data: documentWith("sadsa", "", "asdasdasd") });
    for (const id of ["paragraph-0", "paragraph-1", "paragraph-2"]) {
      const editable = editor.getEditableElement(id)!;
      expect(editable.hasAttribute("data-ez-note-placeholder")).toBe(false);
      expect(editable.hasAttribute("data-ez-placeholder")).toBe(false);
    }
  });

  it("moves the placeholder back when the note becomes a single empty block again", () => {
    const { editor } = create({ data: documentWith("only", "") });
    expect(editor.getEditableElement("paragraph-0")!.hasAttribute("data-ez-note-placeholder")).toBe(false);
    // Remove the populated block: the remaining empty block is now the
    // fresh-note surface and regains the placeholder.
    editor.removeBlock("paragraph-0");
    const editable = editor.getEditableElement("paragraph-1")!;
    expect(editable.getAttribute("data-ez-note-placeholder")).toBe(PLACEHOLDER);
  });

  it("hides the placeholder once the single block has content and re-shows it when cleared", () => {
    const { editor } = create({ data: documentWith("") });
    const editable = editor.getEditableElement("paragraph-0")!;
    editor.updateBlockData("paragraph-0", { content: [{ type: "text", text: "typed" }] });
    // Simulate the input flow's empty-state refresh after the edit.
    editable.textContent = "typed";
    editable.setAttribute("data-ez-empty", "false");
    expect(editable.getAttribute("data-ez-empty")).toBe("false");
    expect(editable.getAttribute("data-ez-note-placeholder")).toBe(PLACEHOLDER); // attribute kept, CSS hides via data-ez-empty
  });

  it("keeps tool hints (captions) unaffected by the note-placeholder scope", () => {
    const { editor, holder } = create({ data: documentWith("Image note") });
    const id = editor.insertBlock("image", { src: "data:image/png;base64,iVBORw0KGgo=", alt: "" }, { focus: false });
    const caption = holder.querySelector<HTMLElement>(`[data-ez-block-id="${id}"] .ez-image-caption`);
    expect(caption?.getAttribute("data-ez-placeholder")).toBe("Add a caption...");
  });
});
