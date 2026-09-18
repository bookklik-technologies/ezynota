import type { EditorSelection, InlineTool, InlineToolContext, InlineToolOptions } from "../types";
import { el, button, placePopover, svgButton } from "../ui/dom";
import { ICONS } from "../ui/icons";

/** --- DOM helpers for inline formatting in contenteditable blocks --- */

export function exec(target: { ownerDocument: Document | null }, command: string, value?: string): void {
  try {
    target.ownerDocument?.execCommand(command, false, value);
  } catch {
    /* unsupported command in some engines */
  }
}

export function queryState(target: { ownerDocument: Document | null }, command: string): boolean {
  try {
    return target.ownerDocument?.queryCommandState(command) ?? false;
  } catch {
    return false;
  }
}

/** Find ancestor element with a tag (or data-ez-mark) around selection. */
export function findAncestor(range: Range, editable: HTMLElement, predicate: (e: Element) => boolean): Element | null {
  let node: Node | null = range.startContainer;
  while (node && node !== editable) {
    if (node.nodeType === Node.ELEMENT_NODE && predicate(node as Element)) {
      return node as Element;
    }
    node = node.parentNode;
  }
  return null;
}

export function activeMarks(editable: HTMLElement): Set<string> {
  const sel = window.getSelection();
  const active = new Set<string>();
  if (!sel || sel.rangeCount === 0) return active;
  const range = sel.getRangeAt(0);
  if (!editable.contains(range.commonAncestorContainer)) return active;
  if (queryState(editable, "bold")) active.add("bold");
  if (queryState(editable, "italic")) active.add("italic");
  if (queryState(editable, "underline")) active.add("underline");
  let node: Node | null = range.startContainer;
  while (node && node !== editable) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tag === "CODE") active.add("code");
      if (tag === "MARK") active.add("mark");
      if (tag === "A") active.add("link");
      if (tag === "SPAN" && (node as Element).hasAttribute("data-ez-mark")) {
        active.add((node as Element).getAttribute("data-ez-mark") as string);
      }
    }
    node = node.parentNode;
  }
  return active;
}

/** Wrap a range in a new element and keep the content selected. */
export function wrapRange(range: Range, wrapper: HTMLElement): void {
  const doc = range.startContainer.ownerDocument ?? wrapper.ownerDocument;
  const frag = range.extractContents();
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  const sel = window.getSelection();
  if (sel) {
    const after = doc.createRange();
    after.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

/** Unwrap the element (move its children out) and select the content. */
export function unwrapElement(elm: Element): void {
  const parent = elm.parentNode;
  if (!parent) return;
  const doc = elm.ownerDocument;
  const first = elm.firstChild;
  const last = elm.lastChild;
  const frag = doc.createDocumentFragment();
  while (elm.firstChild) frag.appendChild(elm.firstChild);
  parent.insertBefore(frag, elm);
  const sel = window.getSelection();
  if (sel && first && last) {
    const range = doc.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  parent.removeChild(elm);
}

/**
 * Unwrap a mark element for a selection that only PARTIALLY overlaps it:
 * the wrapper is split at the selection bounds so the outside parts keep
 * their formatting (a full unwrap removed the mark from the whole element).
 * Best effort — falls back to a full unwrap when the bounds are unclear.
 */
export function unwrapPartial(elm: Element, range: Range): void {
  const parent = elm.parentNode;
  if (!parent) return;
  const doc = elm.ownerDocument;
  const startInside = elm.contains(range.startContainer);
  const endInside = elm.contains(range.endContainer);
  const startNode = startInside ? range.startContainer : elm;
  const startOffset = startInside ? range.startOffset : 0;
  const endNode = endInside ? range.endContainer : elm;
  const endOffset = endInside ? range.endOffset : elm.childNodes.length;
  // Selection covers the whole element → plain unwrap.
  const startsAtEdge = !startInside || (startNode === elm && startOffset === 0);
  const endsAtEdge = !endInside || (endNode === elm && endOffset === elm.childNodes.length);
  if (startsAtEdge && endsAtEdge) {
    unwrapElement(elm);
    return;
  }
  try {
    const before = doc.createRange();
    before.setStart(elm, 0);
    before.setEnd(startNode, startOffset);
    const inner = doc.createRange();
    inner.setStart(startNode, startOffset);
    inner.setEnd(endNode, endOffset);
    const after = doc.createRange();
    after.setStart(endNode, endOffset);
    after.setEnd(elm, elm.childNodes.length);
    const beforeFrag = before.extractContents();
    const innerFrag = inner.extractContents();
    const afterFrag = after.extractContents();
    const beforeClone = beforeFrag.firstChild ? (elm.cloneNode(false) as Element) : null;
    const afterClone = afterFrag.firstChild ? (elm.cloneNode(false) as Element) : null;
    if (beforeClone) {
      beforeClone.appendChild(beforeFrag);
      parent.insertBefore(beforeClone, elm);
    }
    parent.insertBefore(innerFrag, elm);
    if (afterClone) {
      afterClone.appendChild(afterFrag);
      parent.insertBefore(afterClone, elm);
    }
    parent.removeChild(elm);
  } catch {
    unwrapElement(elm);
  }
}

/**
 * Simple accessible popover anchored to an element. Returns the popover and
 * a close function; Escape and outside click close it.
 */
export function openPopover(content: HTMLElement, anchor: Range | HTMLElement, onClose?: () => void, trigger?: HTMLElement): { close: () => void } {
  const source = anchor instanceof HTMLElement ? anchor : anchor.commonAncestorContainer;
  const doc = (source instanceof Element ? source : source.parentElement)?.ownerDocument ?? document;
  const pop = doc.createElement("div");
  pop.className = "ez-popover ez-inline-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", content.getAttribute("aria-label") ?? "Link");
  pop.setAttribute("data-ez-ui", "true");
  pop.appendChild(content);
  const parent = (source instanceof Element ? source : source.parentElement)?.closest(".ez-editor") ?? document.body;
  parent.appendChild(pop);
  const reposition = (): void => {
    const reference = trigger?.isConnected && trigger.getClientRects().length ? trigger : anchor;
    placePopover(pop, reference.getBoundingClientRect());
  };
  reposition();
  let closed = false;
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  const onOutside = (event: MouseEvent): void => {
    if (!pop.contains(event.target as Node)) close(false);
  };
  const onFocus = (event: FocusEvent): void => {
    if (!pop.contains(event.target as Node)) close(false);
  };
  function close(restore = true): void {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("focusin", onFocus);
    window.removeEventListener("resize", reposition);
    document.removeEventListener("scroll", reposition, true);
    parent.removeEventListener("ez-close-popovers", dismiss);
    pop.remove();
    if (restore) onClose?.();
  }
  const dismiss = (): void => close(false);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("focusin", onFocus);
  window.addEventListener("resize", reposition);
  document.addEventListener("scroll", reposition, true);
  parent.addEventListener("ez-close-popovers", dismiss);
  return { close };
}

/** Base class shared by simple mark-toggling inline tools. */
export abstract class MarkInlineTool implements InlineTool {
  abstract readonly markType: string;
  protected options: InlineToolOptions;
  protected node: HTMLElement | null = null;

  constructor(options: InlineToolOptions) {
    this.options = options;
  }

  render(): HTMLElement {
    const label = this.options.t(this.labelKey);
    const btn = this.icon
      ? svgButton("ez-inline-tool-btn", this.icon, label)
      : button("ez-inline-tool-btn", label, label);
    btn.querySelector("svg")?.setAttribute("aria-hidden", "true");
    btn.addEventListener("click", () => this.toggle());
    btn.title = label;
    btn.setAttribute("data-ez-inline-tool", this.markType);
    btn.setAttribute("aria-pressed", "false");
    this.node = btn;
    return btn;
  }

  protected abstract get labelKey(): string;

  /** Optional Lucide icon; a text label renders when undefined. */
  protected get icon(): string | undefined {
    return undefined;
  }

  abstract apply(range: Range, context: InlineToolContext): void;

  isActive(selection: EditorSelection): boolean {
    void selection;
    return false;
  }

  /** Toolbar uses this to sync the active visual state. */
  setActive(active: boolean): void {
    this.node?.classList.toggle("ez-active", active);
    this.node?.setAttribute("aria-pressed", String(active));
  }

  /** Toggle the mark on the current DOM selection; returns new state. */
  protected toggle(): void {
    this.options.onActivate?.();
  }

  destroy(): void {
    this.node = null;
  }
}

/** Generic mark toggle for code / mark / custom marks. */
export class ToggleMarkTool extends MarkInlineTool {
  readonly markType: string;
  private tag: string;

  constructor(options: InlineToolOptions, markType: string, tag: string) {
    super(options);
    this.markType = markType;
    this.tag = tag;
  }

  protected get labelKey(): string {
    return `inline.${this.markType}`;
  }

  apply(range: Range, context: InlineToolContext): void {
    const existing = findAncestor(
      range,
      context.blockElement,
      (e) => e.tagName === this.tag.toUpperCase() || e.getAttribute?.("data-ez-mark") === this.markType
    );
    if (existing) {
      unwrapPartial(existing, range);
    } else if (this.markType === "code" || this.markType === "mark") {
      const wrapper = context.blockElement.ownerDocument.createElement(this.tag);
      wrapRange(range, wrapper);
    } else {
      const wrapper = context.blockElement.ownerDocument.createElement("span");
      wrapper.setAttribute("data-ez-mark", this.markType);
      wrapRange(range, wrapper);
    }
    context.requestSave();
  }
}

export class BoldTool extends MarkInlineTool {
  readonly markType = "bold";

  protected get labelKey(): string {
    return "inline.bold";
  }

  protected get icon(): string {
    return ICONS.bold;
  }

  apply(_range: Range, context: InlineToolContext): void {
    exec(context.blockElement, "bold");
    context.requestSave();
  }

  isActive(): boolean {
    // Query state needs a document; the toolbar passes the editable's
    // document where possible. isActive has no element — use the global one.
    return queryState(document, "bold");
  }
}

export class ItalicTool extends MarkInlineTool {
  readonly markType = "italic";

  protected get labelKey(): string {
    return "inline.italic";
  }

  protected get icon(): string {
    return ICONS.italic;
  }

  apply(_range: Range, context: InlineToolContext): void {
    exec(context.blockElement, "italic");
    context.requestSave();
  }

  isActive(): boolean {
    return queryState(document, "italic");
  }
}

export class UnderlineTool extends MarkInlineTool {
  readonly markType = "underline";

  protected get labelKey(): string {
    return "inline.underline";
  }

  protected get icon(): string {
    return ICONS.underline;
  }

  apply(_range: Range, context: InlineToolContext): void {
    exec(context.blockElement, "underline");
    context.requestSave();
  }

  isActive(): boolean {
    return queryState(document, "underline");
  }
}

export class CodeInlineTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "code", "code");
  }

  protected get icon(): string {
    return ICONS.code;
  }
}

export class MarkTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "mark", "mark");
  }

  protected get icon(): string {
    return ICONS.highlighter;
  }
}

/** Strikethrough mark: `<s>` DOM, `strike` mark in JSON. */
export class StrikethroughTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "strike", "s");
  }

  protected get icon(): string {
    return ICONS.strikethrough;
  }

  apply(range: Range, context: InlineToolContext): void {
    const existing = findAncestor(range, context.blockElement, (e) => e.tagName === "S" || e.getAttribute?.("data-ez-mark") === "strike");
    if (existing) {
      unwrapPartial(existing, range);
    } else {
      const wrapper = context.blockElement.ownerDocument.createElement("s");
      wrapRange(range, wrapper);
    }
    context.requestSave();
  }
}

/** Shared palette for text and background color pickers. */
export const COLOR_PALETTE = [
  "var(--ez-text)",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#ec4899",
  "#7c3aed",
  "transparent"
] as const;

/**
 * Color inline tool: applies a `color`/`background` mark with attrs to the
 * selection. The DOM renders via inline style; `data-ez-mark` keeps the
 * value portable in JSON.
 */
export abstract class ColorInlineToolBase extends MarkInlineTool {
  abstract readonly markType: string;

  protected get labelKey(): string {
    return `inline.${this.markType}`;
  }

  apply(range: Range, context: InlineToolContext): void {
    if (range.collapsed) return;
    this.promptForColor(range, context);
  }

  private promptForColor(range: Range, context: InlineToolContext): void {
    const form = el("div", "ez-color-form");
    form.setAttribute("aria-label", this.options.t(this.labelKey));
    const restore = (): void => {
      if (!range.startContainer.isConnected || context.blockElement.contentEditable === "false") return;
      context.blockElement.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    for (const color of COLOR_PALETTE) {
      const swatch = el("button", "ez-color-swatch");
      swatch.type = "button";
      swatch.setAttribute("aria-label", color === "transparent" ? "Remove color" : `Set ${this.markType} color ${color}`);
      swatch.style.background = color;
      swatch.title = color;
      swatch.addEventListener("click", () => {
        restore();
        const existing = findColorSpan(range, context.blockElement, this.markType);
        if (existing) {
          unwrapPartial(existing, range);
        }
        if (color !== "transparent") {
          const wrapper = context.blockElement.ownerDocument.createElement("span");
          wrapper.setAttribute("data-ez-mark", this.markType);
          wrapper.setAttribute(`data-ez-${this.markType}`, color);
          wrapper.style.setProperty(this.markType === "color" ? "color" : "background-color", color);
          wrapRange(range, wrapper);
        }
        context.requestSave();
        close();
        context.closeToolbar();
      });
      form.appendChild(swatch);
    }
    const { close } = openPopover(form, range.cloneRange(), restore, this.node ?? undefined);
  }
}

function findColorSpan(range: Range, editable: HTMLElement, markType: string): Element | null {
  let node: Node | null = range.startContainer;
  while (node && node !== editable) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.getAttribute?.("data-ez-mark") === markType) return el;
    }
    node = node.parentNode;
  }
  return null;
}

export class ColorTool extends ColorInlineToolBase {
  readonly markType = "color" as const;

  protected get icon(): string {
    return ICONS.textColor;
  }
}

export class BackgroundColorTool extends ColorInlineToolBase {
  readonly markType = "background" as const;

  protected get icon(): string {
    return ICONS.backgroundColor;
  }
}

/** Link inline tool: popover with URL input; toggling removes existing links. */
export class LinkTool extends MarkInlineTool {
  readonly markType = "link";

  protected get labelKey(): string {
    return "inline.link";
  }

  protected get icon(): string {
    return ICONS.link;
  }

  apply(range: Range, context: InlineToolContext): void {
    const existing = findAncestor(range, context.blockElement, (e) => e.tagName === "A");
    // A collapsed caret outside a link still opens the popover (Ctrl+K
    // preserved-selection activation); the popover restores the caret.
    this.promptForUrl(range.cloneRange(), context, existing);
  }

  isActive(selection: EditorSelection): boolean {
    void selection;
    return false;
  }

  private promptForUrl(range: Range, context: InlineToolContext, existing: Element | null): void {
    const form = el("form", "ez-link-form");
    form.setAttribute("aria-label", this.options.t("inline.link"));
    const input = el("input", "ez-link-input");
    input.type = "text";
    input.inputMode = "url";
    input.placeholder = "https://";
    input.value = existing?.getAttribute("href") ?? "";
    input.setAttribute("aria-label", this.options.t("inline.linkUrl"));
    const applyBtn = button("ez-btn ez-btn-primary", this.options.t("inline.linkApply"));
    const removeBtn = button("ez-btn", this.options.t("inline.linkRemove"));
    removeBtn.disabled = !existing;
    const cancelBtn = button("ez-btn", this.options.t("inline.linkCancel"));
    const error = el("div", "ez-field-error");
    error.id = `ez-link-error-${++linkFormId}`;
    error.setAttribute("role", "alert");
    input.setAttribute("aria-describedby", error.id);
    const actions = el("div", "ez-link-actions");
    actions.append(applyBtn, removeBtn, cancelBtn);
    form.append(input, error, actions);

    const restore = (): void => {
      if (!range.startContainer.isConnected || context.blockElement.contentEditable === "false") return;
      context.blockElement.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    const { close } = openPopover(form, range, restore, this.node ?? undefined);
    const submit = (): void => {
      const url = input.value.trim();
      if (!url || !isSafe(url)) {
        input.setAttribute("aria-invalid", "true");
        error.textContent = this.options.t("inline.linkInvalid");
        input.focus();
        return;
      }
      restore();
      if (existing) {
        existing.setAttribute("href", url);
      } else {
        const a = context.blockElement.ownerDocument.createElement("a");
        a.setAttribute("href", url);
        a.setAttribute("rel", "noopener noreferrer");
        if (range.collapsed) {
          // No selection to wrap: insert the link with the URL as its text.
          const doc = context.blockElement.ownerDocument;
          a.textContent = url;
          range.insertNode(a);
          const sel = window.getSelection();
          if (sel) {
            const after = doc.createRange();
            after.setStartAfter(a);
            after.collapse(true);
            sel.removeAllRanges();
            sel.addRange(after);
          }
        } else {
          wrapRange(range, a);
        }
      }
      context.requestSave();
      close();
      context.closeToolbar();
    };
    applyBtn.addEventListener("click", submit);
    removeBtn.addEventListener("click", () => {
      if (existing) {
        restore();
        unwrapElement(existing);
        context.requestSave();
      }
      close();
      context.closeToolbar();
    });
    cancelBtn.addEventListener("click", () => close());
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      error.textContent = "";
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit();
    });
    input.focus();
  }
}

let linkFormId = 0;

function isSafe(url: string): boolean {
  try {
    const parsed = new URL(url, "https://ezynota.invalid");
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export const BUILTIN_INLINE_TOOLS = {
  bold: BoldTool,
  italic: ItalicTool,
  underline: UnderlineTool,
  strike: StrikethroughTool,
  code: CodeInlineTool,
  mark: MarkTool,
  color: ColorTool,
  background: BackgroundColorTool,
  link: LinkTool
} as const;
