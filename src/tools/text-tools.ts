import type { BlockTool, ConversionConfig, InlineContent, JsonValue } from "../types";
import { inlineToDom, domToInline, isEmptyInlineValue, splitDomEditableAtRange } from "../rich-text/dom";
import { normalizeInline } from "../rich-text/normalize";
import { TOOL_ICONS } from "../ui/icons";

export type TextToolData = {
  content: InlineContent[];
};

export type HeadingData = {
  level: number;
  content: InlineContent[];
};

export type CodeData = {
  code: string;
};

/**
 * Base for text-based blocks: one contenteditable element containing
 * inline content rendered from JSON.
 */
export abstract class TextBlockTool<TData extends JsonValue = TextToolData> implements BlockTool<TData> {
  protected editable!: HTMLElement;
  protected api: import("../types").BlockAPI;
  protected config: Record<string, unknown>;
  protected placeholder: string;
  protected multiline: boolean;

  constructor(
    options: { api: import("../types").BlockAPI; config: Record<string, unknown> },
    placeholder = "",
    multiline = false
  ) {
    this.api = options.api;
    this.config = options.config ?? {};
    this.placeholder = placeholder;
    this.multiline = multiline;
  }

  abstract tag(): string;

  render(): HTMLElement {
    const doc = this.editable?.ownerDocument ?? document;
    const el = doc.createElement(this.tag());
    el.classList.add("ez-text-input");
    el.contentEditable = "true";
    el.setAttribute("data-ez-editable", "true");
    if (this.placeholder) el.setAttribute("data-ez-placeholder", this.placeholder);
    if (this.multiline) el.setAttribute("data-ez-multiline", "true");
    const data = this.api.getData() as unknown as TextToolData;
    if (data?.content && !isEmptyInlineValue(data.content)) {
      el.appendChild(inlineToDom(data.content, doc));
    }
    this.editable = el;
    return el;
  }

  abstract save(element: HTMLElement): TData;

  validate(data: TData): boolean {
    return !!data;
  }

  merge(incoming: TData): TData {
    const current = (this.api.getData() as unknown as TextToolData)?.content ?? [];
    const incomingContent = (incoming as unknown as TextToolData)?.content ?? [];
    const merged = normalizeInline([...current, ...incomingContent]);
    const data = { content: merged } as unknown as TData;
    this.replaceEditableContent(this.editable, inlineToDom(merged, this.editable.ownerDocument));
    this.api.update(data as never);
    return data;
  }

  /** Sync the DOM after an external transaction updated this block. */
  updated(): void {
    const data = this.api.getData() as unknown as TextToolData;
    if (!this.editable) return;
    const current = domToInline(this.editable);
    if (JSON.stringify(normalizeInline(current)) !== JSON.stringify(normalizeInline(data?.content ?? []))) {
      this.replaceEditableContent(this.editable, inlineToDom(data?.content ?? [], this.editable.ownerDocument));
    }
  }

  protected replaceEditableContent(target: HTMLElement, frag: DocumentFragment): void {
    while (target.firstChild) target.removeChild(target.firstChild);
    if (frag.childNodes.length > 0) target.appendChild(frag);
  }

  focus(at?: "start" | "end"): void {
    if (!this.editable) return;
    this.editable.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = this.editable.ownerDocument.createRange();
    range.selectNodeContents(this.editable);
    range.collapse(at !== "end");
    sel.removeAllRanges();
    sel.addRange(range);
  }

  getEditable(): HTMLElement | undefined {
    return this.editable;
  }

  /**
   * Split this block's content at a DOM range (the caret). Returns the
   * [before, after] data shapes; the DOM is mutated in place (the prefix
   * stays in the editable, the remainder is extracted).
   */
  splitAtRange(range: Range): [TData, TData] | null {
    if (!this.editable) return null;
    const { before, after } = splitDomEditableAtRange(this.editable, range);
    const base = this.tagDataShape();
    const beforeData = { ...base, content: before } as unknown as TData;
    const afterData = { ...base, content: after } as unknown as TData;
    return [beforeData, afterData];
  }

  /** Extra fields kept on split (e.g. heading level). */
  protected tagDataShape(): Record<string, unknown> {
    return {};
  }

  destroy(): void {}
}

/** Paragraph tool — the default block. */
export class Paragraph extends TextBlockTool<TextToolData> {
  static toolbox = { icon: TOOL_ICONS.paragraph, title: "Paragraph", category: "Basic blocks" };
  static conversion: ConversionConfig = { to: ["heading", "list", "quote", "code", "delimiter"] };
  static enableInlineTools = true;

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    const placeholder = options.config?.["placeholder"];
    super(options, typeof placeholder === "string" ? placeholder : "", false);
  }

  tag(): string {
    return "p";
  }

  save(_element: HTMLElement): TextToolData {
    return { content: domToInline(this.editable) };
  }
}

/** Heading tool with configurable levels (default 1–3). */
export class Heading extends TextBlockTool<HeadingData> {
  static toolbox = { icon: TOOL_ICONS.heading, title: "Heading", category: "Basic blocks" };
  static shortcut = "CMD+SHIFT+2";
  static conversion: ConversionConfig = { to: ["paragraph", "list", "quote"] };
  static enableInlineTools = true;

  private levels: number[] = [1, 2, 3];
  private level = 2;

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    super(options, "", false);
    const rawLevels = options.config?.["levels"];
    if (Array.isArray(rawLevels)) {
      const parsed = rawLevels.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 6);
      if (parsed.length > 0) this.levels = parsed;
    }
    const data = this.api.getData() as unknown as { level?: unknown };
    const level = Number(data?.level);
    this.level = this.levels.includes(level) ? level : (this.levels[0] ?? 2);
  }

  tag(): string {
    return `h${this.level}`;
  }

  save(_element: HTMLElement): HeadingData {
    return { level: this.level, content: domToInline(this.editable) };
  }

  protected override tagDataShape(): Record<string, unknown> {
    return { level: this.level };
  }

  /** Level switcher rendered inside the block settings menu. */
  renderSettings(): HTMLElement | null {
    if (this.levels.length < 2) return null;
    const wrap = document.createElement("div");
    wrap.className = "ez-inline-group";
    for (const lvl of this.levels) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ez-inline-btn" + (lvl === this.level ? " ez-active" : "");
      btn.textContent = `H${lvl}`;
      btn.setAttribute("aria-label", `Heading level ${lvl}`);
      btn.setAttribute("aria-pressed", String(lvl === this.level));
      btn.addEventListener("click", () => {
        if (this.api.readOnly) return;
        this.level = lvl;
        this.api.update({ level: this.level, content: domToInline(this.editable) } as never);
        this.refreshElement();
        this.api.focus("end");
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  updated(): void {
    const data = this.api.getData() as unknown as { level?: unknown };
    const level = Number(data?.level);
    const next = this.levels.includes(level) ? level : this.level;
    if (next !== this.level || !this.editable || this.editable.tagName.toLowerCase() !== `h${next}`) {
      this.level = next;
      this.refreshElement();
      return;
    }
    super.updated();
  }

  private refreshElement(): void {
    if (!this.editable?.parentElement) return;
    const previous = this.editable;
    const newEl = this.render();
    previous.replaceWith(newEl);
    this.editable = newEl;
  }
}

/** Quote tool: blockquote with rich text content. */
export class Quote extends TextBlockTool<TextToolData> {
  static toolbox = { icon: TOOL_ICONS.quote, title: "Quote", category: "Basic blocks" };
  static conversion: ConversionConfig = { to: ["paragraph", "heading", "list"] };
  static enableInlineTools = true;

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    super(options, "", false);
  }

  tag(): string {
    return "blockquote";
  }

  save(_element: HTMLElement): TextToolData {
    return { content: domToInline(this.editable) };
  }
}

/** Code block — plain text only, no inline formatting, multiline. */
export class CodeTool extends TextBlockTool<CodeData> {
  static toolbox = { icon: TOOL_ICONS.code, title: "Code", category: "Basic blocks" };
  static shortcut = "CMD+SHIFT+C";
  static enterKey = "newline" as const;
  static conversion: ConversionConfig = { to: ["paragraph", "delimiter"] };

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    super(options, "Enter code...", true);
  }

  tag(): string {
    return "pre";
  }

  render(): HTMLElement {
    const doc = this.editable?.ownerDocument ?? document;
    const pre = doc.createElement("pre");
    pre.classList.add("ez-text-input", "ez-code");
    pre.contentEditable = "true";
    pre.setAttribute("data-ez-editable", "true");
    pre.setAttribute("data-ez-placeholder", this.placeholder);
    pre.setAttribute("data-ez-multiline", "true");
    pre.setAttribute("data-ez-plain", "true");
    pre.spellcheck = false;
    const data = this.api.getData() as unknown as CodeData;
    if (typeof data?.code === "string" && data.code !== "") {
      pre.textContent = data.code;
    }
    this.editable = pre;
    return pre;
  }

  save(_element: HTMLElement): CodeData {
    return { code: (this.editable.innerText ?? this.editable.textContent ?? "").replace(/\n$/, "") };
  }

  validate(data: CodeData): boolean {
    return typeof data?.code === "string";
  }

  updated(): void {
    if (!this.editable) return;
    const data = this.api.getData() as unknown as CodeData;
    if (this.editable.textContent !== data?.code) {
      this.editable.textContent = data?.code ?? "";
    }
  }
}

/** Horizontal rule — non-text block. */
export class Delimiter implements BlockTool {
  static toolbox = { icon: TOOL_ICONS.delimiter, title: "Divider", category: "Basic blocks" };
  static enterKey = "ignore" as const;
  static conversion: ConversionConfig = { to: ["paragraph"] };

  private api: import("../types").BlockAPI;

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    this.api = options.api;
  }

  render(): HTMLElement {
    const div = document.createElement("div");
    div.className = "ez-delimiter";
    div.setAttribute("role", "separator");
    void this.api;
    return div;
  }

  save(): Record<string, never> {
    return {};
  }

  validate(): boolean {
    return true;
  }

  focus(): void {
    // Delimiter is not focusable text; renderer skips to the next block.
  }

  destroy(): void {}
}
