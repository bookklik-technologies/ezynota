import type { Host } from "../host";

/**
 * Markdown typing shortcuts (spec §Experience): headings, lists, tasks,
 * quotes, code fences, dividers and inline formatting are typed directly.
 *
 * Rules honored by the spec:
 * - Conversions are undoable — block-level changes commit as one
 *   transaction; inline replacements mutate the DOM and dispatch an
 *   `input` event so the normal input → save → transaction flow runs.
 * - IME composition is respected: shortcuts are skipped while composing.
 */

type InlinePattern = { pattern: RegExp; mark: string };

const INLINE_PATTERNS: InlinePattern[] = [
  { pattern: /\*\*([^*]+)\*\*$/, mark: "bold" },
  { pattern: /__([^_]+)__$/, mark: "bold" },
  { pattern: /(?<!\*)\*([^*\s][^*]*)\*$/, mark: "italic" },
  { pattern: /~~([^~]+)~~$/, mark: "strike" },
  { pattern: /`([^`]+)`$/, mark: "code" },
  { pattern: /==([^=]+)==$/, mark: "mark" }
];

const MARK_TAGS: Record<string, string> = { bold: "strong", italic: "em", code: "code", mark: "mark", strike: "span" };

export class MarkdownShortcuts {
  private host: Host;
  private surface: HTMLElement;
  private disposers: (() => void)[] = [];

  constructor(host: Host, surface: HTMLElement) {
    this.host = host;
    this.surface = surface;
  }

  start(): void {
    const onKeyDown = (event: Event): void => {
      const e = event as KeyboardEvent;
      if (this.host.readOnly || this.host.isDestroyed()) return;
      // IME composition must never be interrupted.
      if (e.isComposing || (e.target as HTMLElement).closest("[data-ez-ui]")) return;
      if (e.key !== " " && e.key !== "Enter") return;
      const handled = e.key === " " ? this.handleSpace() : this.handleEnter();
      if (handled) e.preventDefault();
    };
    this.surface.addEventListener("keydown", onKeyDown, true);
    this.disposers.push(() => this.surface.removeEventListener("keydown", onKeyDown, true));
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  private currentBlock(): { id: string; type: string; editable: HTMLElement } | null {
    const selection = this.host.getSelectionInfo();
    if (!selection) return null;
    const editable = this.host.getEditableElement(selection.blockId);
    if (!editable) return null;
    const type = this.host.getBlockType(selection.blockId);
    if (!type) return null;
    return { id: selection.blockId, type, editable };
  }

  private handleSpace(): boolean {
    const current = this.currentBlock();
    if (!current) return false;
    if (current.type === "code") return false;
    const range = this.host.getRange();
    if (!range || !range.collapsed) return false;

    const textBefore = textBeforeCaret(current.editable, range);
    const blockText = current.editable.textContent ?? "";

    // Inline marks: "**bold** " applies bold and strips the markers.
    for (const pattern of INLINE_PATTERNS) {
      const match = pattern.pattern.exec(textBefore);
      if (match && match[1] !== undefined) {
        return this.applyInlinePattern(current.editable, range, pattern);
      }
    }

    // Block-level shortcuts require the marker to be all text so far.
    const markerMatch = /^(#{1,6}|>|[-*+]|\d+[.)]|\[\]|\[x\]) $/.exec(textBefore);
    if (!markerMatch || blockText !== textBefore) return false;
    const marker = markerMatch[1]!;
    if (marker.startsWith("#")) return this.convert(current.id, "heading", { level: marker.length, content: [] });
    if (marker === ">") return this.convert(current.id, "quote", { content: [] });
    if (marker === "-" || marker === "*") return this.convert(current.id, "list", { style: "unordered", items: [{ content: [] }] });
    if (marker === "[]") return this.convert(current.id, "list", { style: "task", items: [{ content: [], checked: false }] });
    if (marker === "[x]") return this.convert(current.id, "list", { style: "task", items: [{ content: [], checked: true }] });
    if (/^\d/.test(marker)) return this.convert(current.id, "list", { style: "ordered", items: [{ content: [] }] });
    return false;
  }

  private handleEnter(): boolean {
    const current = this.currentBlock();
    if (!current) return false;
    if (current.type === "code") return false;
    const range = this.host.getRange();
    if (!range || !range.collapsed) return false;
    const before = textBeforeCaret(current.editable, range);
    // Dividers: a full line of dashes/asterisks/underscores at line end.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(before) && textAfterCaret(current.editable, range).trim() === "") {
      this.host.convertBlock(current.id, "delimiter");
      const newId = this.host.insertBlock(this.host.defaultBlock, undefined, { after: current.id, focus: true });
      this.host.focusBlock(newId, "start");
      this.host.announce("Divider created");
      return true;
    }
    // Code fence: three backticks on their own line opens a code block.
    if (/^```$/.test(before) && textAfterCaret(current.editable, range).trim() === "") {
      this.host.convertBlock(current.id, "code");
      this.host.focusBlock(current.id, "start");
      this.host.announce("Code block created");
      return true;
    }
    return false;
  }

  /** Convert a block in ONE transaction (undoable via history). */
  private convert(id: string, targetType: string, data: Record<string, unknown>): boolean {
    const block = this.host.blocks.getById(id);
    if (!block) return false;
    this.host.commitChanges("user", [
      { type: "block:update", id, previous: cloneJson(block.data as never), current: data as never },
      { type: "block:convert", id, fromType: block.type, toType: targetType }
    ]);
    // The block's DOM was not edited by the user — handleCommit re-renders
    // via the renderer's convert path. Restore the caret.
    this.host.focusBlock(id, "end");
    this.host.announce(`Converted to ${targetType}`);
    return true;
  }

  /** Strip inline markers from the DOM and wrap the inner text in the mark. */
  private applyInlinePattern(editable: HTMLElement, range: Range, pattern: InlinePattern): boolean {
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const text = node as Text;
    const caret = range.startOffset;
    const before = text.data.slice(0, caret);
    const match = pattern.pattern.exec(before);
    if (!match || match[1] === undefined) return false;
    const start = before.length - match[0].length;
    const inner = match[1];
    const doc = text.ownerDocument;
    try {
      const deleteRange = doc.createRange();
      deleteRange.setStart(text, start);
      deleteRange.setEnd(text, caret);
      deleteRange.deleteContents();
    } catch {
      return false;
    }
    const tag = MARK_TAGS[pattern.mark] ?? "span";
    const wrapper = doc.createElement(tag);
    if (pattern.mark === "strike" || pattern.mark === "mark") {
      wrapper.setAttribute("data-ez-mark", pattern.mark);
    }
    wrapper.textContent = inner;
    range.insertNode(wrapper);
    const selection = window.getSelection();
    if (selection) {
      const after = doc.createRange();
      after.setStartAfter(wrapper);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }
    // Programmatic DOM change → flush the block through the input flow.
    editable.dispatchEvent(new Event("input", { bubbles: true }));
    this.host.announce(`Formatted as ${pattern.mark}`);
    return true;
  }
}

function textBeforeCaret(editable: HTMLElement, range: Range): string {
  try {
    const probe = (editable.ownerDocument ?? document).createRange();
    probe.selectNodeContents(editable);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString();
  } catch {
    return "";
  }
}

function textAfterCaret(editable: HTMLElement, range: Range): string {
  try {
    const probe = (editable.ownerDocument ?? document).createRange();
    probe.selectNodeContents(editable);
    probe.setStart(range.endContainer, range.endOffset);
    return probe.toString();
  } catch {
    return "";
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
