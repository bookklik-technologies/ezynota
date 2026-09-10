import type { EditorSelection, InlineTool, InlineToolContext, InlineToolOptions } from "../types";
import { el, button, placePopover } from "../ui/dom";

/** --- DOM helpers for inline formatting in contenteditable blocks --- */

export function exec(command: string, value?: string): void {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* unsupported command in some engines */
  }
}

export function queryState(command: string): boolean {
  try {
    return document.queryCommandState(command);
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
  if (queryState("bold")) active.add("bold");
  if (queryState("italic")) active.add("italic");
  if (queryState("underline")) active.add("underline");
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
  const frag = range.extractContents();
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  const sel = window.getSelection();
  if (sel) {
    const after = document.createRange();
    after.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

/** Unwrap the element (move its children out) and select the content. */
export function unwrapElement(elm: Element): void {
  const parent = elm.parentNode;
  if (!parent) return;
  const first = elm.firstChild;
  const last = elm.lastChild;
  const frag = document.createDocumentFragment();
  while (elm.firstChild) frag.appendChild(elm.firstChild);
  parent.insertBefore(frag, elm);
  const sel = window.getSelection();
  if (sel && first && last) {
    const range = document.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  parent.removeChild(elm);
}

/**
 * Simple accessible popover anchored to an element. Returns the popover and
 * a close function; Escape and outside click close it.
 */
export function openPopover(content: HTMLElement, anchor: Range | HTMLElement, onClose?: () => void): { close: () => void } {
  const pop = el("div", "ez-popover");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", content.getAttribute("aria-label") ?? "Link");
  pop.setAttribute("data-ez-ui", "true");
  pop.appendChild(content);
  const source = anchor instanceof HTMLElement ? anchor : anchor.commonAncestorContainer;
  const parent = (source instanceof Element ? source : source.parentElement)?.closest(".ez-editor") ?? document.body;
  parent.appendChild(pop);
  const reposition = (): void => placePopover(pop, anchor.getBoundingClientRect());
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
    const btn = button("ez-inline-tool-btn", this.options.t(this.labelKey), this.options.t(this.labelKey));
    btn.addEventListener("click", () => this.toggle());
    btn.title = this.options.t(this.labelKey);
    btn.setAttribute("data-ez-inline-tool", this.markType);
    btn.setAttribute("aria-pressed", "false");
    this.node = btn;
    return btn;
  }

  protected abstract get labelKey(): string;

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
      unwrapElement(existing);
    } else if (this.markType === "code" || this.markType === "mark") {
      const wrapper = document.createElement(this.tag);
      wrapRange(range, wrapper);
    } else {
      const wrapper = document.createElement("span");
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

  apply(_range: Range, context: InlineToolContext): void {
    exec("bold");
    context.requestSave();
  }

  isActive(): boolean {
    return queryState("bold");
  }
}

export class ItalicTool extends MarkInlineTool {
  readonly markType = "italic";

  protected get labelKey(): string {
    return "inline.italic";
  }

  apply(_range: Range, context: InlineToolContext): void {
    exec("italic");
    context.requestSave();
  }

  isActive(): boolean {
    return queryState("italic");
  }
}

export class UnderlineTool extends MarkInlineTool {
  readonly markType = "underline";

  protected get labelKey(): string {
    return "inline.underline";
  }

  apply(_range: Range, context: InlineToolContext): void {
    exec("underline");
    context.requestSave();
  }

  isActive(): boolean {
    return queryState("underline");
  }
}

export class CodeInlineTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "code", "code");
  }
}

export class MarkTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "mark", "mark");
  }
}

/** Strikethrough mark: `<s>` DOM, `strike` mark in JSON. */
export class StrikethroughTool extends ToggleMarkTool {
  constructor(options: InlineToolOptions) {
    super(options, "strike", "s");
  }

  apply(range: Range, context: InlineToolContext): void {
    const existing = findAncestor(range, context.blockElement, (e) => e.tagName === "S" || e.getAttribute?.("data-ez-mark") === "strike");
    if (existing) {
      unwrapElement(existing);
    } else {
      const wrapper = document.createElement("s");
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
    const restore = (): void => {
      if (!range.startContainer.isConnected || context.blockElement.contentEditable === "false") return;
      context.blockElement.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    const { close } = openPopover(form, range.cloneRange(), restore);
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
          unwrapElement(existing);
        }
        if (color !== "transparent") {
          const wrapper = document.createElement("span");
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
}

export class BackgroundColorTool extends ColorInlineToolBase {
  readonly markType = "background" as const;
}

/** Link inline tool: popover with URL input; toggling removes existing links. */
export class LinkTool extends MarkInlineTool {
  readonly markType = "link";

  protected get labelKey(): string {
    return "inline.link";
  }

  apply(range: Range, context: InlineToolContext): void {
    const existing = findAncestor(range, context.blockElement, (e) => e.tagName === "A");
    if (range.collapsed && !existing) return;
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
    const { close } = openPopover(form, range, restore);
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
        const a = document.createElement("a");
        a.setAttribute("href", url);
        a.setAttribute("rel", "noopener noreferrer");
        wrapRange(range, a);
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
