import type { BlockTool, ConversionConfig, EzynotaBlock, InlineContent, JsonValue, NestedBlockHost } from "../types";
import { inlineToDom, domToInline, isEmptyInlineValue } from "../rich-text/dom";
import { TOOL_ICONS } from "../ui/icons";
import { el, svgButton } from "../ui/dom";
import { ICONS } from "../ui/icons";

export type ToggleData = {
  open: boolean;
  heading: InlineContent[];
};

/**
 * Collapsible section: an editable heading plus nested editable child
 * blocks stored in the block's `children` field. Child operations commit
 * through `children:update` transactions; the open/closed state is part
 * of the block data (undoable).
 */
export class ToggleTool implements BlockTool<ToggleData> {
  static toolbox = { icon: TOOL_ICONS.toggle, title: "Toggle section", category: "Rich blocks" };
  static conversion: ConversionConfig = { to: ["paragraph", "heading"] };

  private api: import("../types").BlockAPI;
  private nested: NestedBlockHost | undefined;
  private container!: HTMLElement;
  private headingEl!: HTMLElement;
  private childrenHost!: HTMLElement;
  private open = true;

  constructor(options: { api: import("../types").BlockAPI; nested?: NestedBlockHost }) {
    this.api = options.api;
    this.nested = options.nested;
    const data = options.api.getData() as unknown as ToggleData;
    this.open = data?.open !== false;
  }

  render(): HTMLElement {
    const doc = document;
    const data = this.api.getData() as unknown as ToggleData;
    this.open = data?.open !== false;
    this.container = el("div", "ez-toggle");
    this.container.setAttribute("data-ez-toggle-open", String(this.open));

    const headerRow = el("div", "ez-toggle-header");
    const caret = svgButton("ez-icon-btn ez-toggle-caret", this.open ? ICONS.caretDown : ICONS.caretRight, this.open ? "Collapse section" : "Expand section");
    caret.setAttribute("aria-expanded", String(this.open));
    caret.addEventListener("click", () => {
      if (this.api.readOnly) return;
      this.open = !this.open;
      this.api.update({ ...this.save(this.container), open: this.open } as never);
      this.container.setAttribute("data-ez-toggle-open", String(this.open));
      caret.innerHTML = this.open ? ICONS.caretDown : ICONS.caretRight;
      caret.setAttribute("aria-expanded", String(this.open));
    });

    const heading = doc.createElement("div");
    heading.classList.add("ez-text-input", "ez-toggle-heading");
    heading.contentEditable = "true";
    heading.setAttribute("data-ez-editable", "true");
    heading.setAttribute("data-ez-region", "toggle-heading");
    heading.setAttribute("data-ez-placeholder", "Section title");
    if (data?.heading && !isEmptyInlineValue(data.heading)) {
      heading.appendChild(inlineToDom(data.heading, doc));
    }
    this.headingEl = heading;

    headerRow.append(caret, heading);
    this.childrenHost = el("div", "ez-toggle-children");
    this.renderChildren();

    const addRow = el("div", "ez-toggle-add-row");
    const add = el("button", "ez-btn ez-toggle-add", "Add block inside");
    add.type = "button";
    add.addEventListener("click", () => {
      if (!this.nested || this.nested.readOnly) return;
      this.nested.insert("paragraph", undefined);
    });
    addRow.appendChild(add);

    this.container.append(headerRow, this.childrenHost, addRow);
    return this.container;
  }

  save(_element: HTMLElement): ToggleData {
    return { open: this.open, heading: domToInline(this.headingEl) };
  }

  validate(data: ToggleData): boolean {
    return !!data;
  }

  updated(): void {
    const data = this.api.getData() as unknown as ToggleData;
    if (!this.container || !data) return;
    const open = data.open !== false;
    if (open !== this.open) {
      this.open = open;
      this.container.setAttribute("data-ez-toggle-open", String(open));
    }
    // Heading content: only re-render when it differs from the DOM.
    if (this.headingEl && document.activeElement !== this.headingEl) {
      const current = domToInline(this.headingEl);
      if (JSON.stringify(current) !== JSON.stringify(data.heading ?? [])) {
        while (this.headingEl.firstChild) this.headingEl.removeChild(this.headingEl.firstChild);
        this.headingEl.appendChild(inlineToDom(data.heading ?? [], this.headingEl.ownerDocument));
      }
    }
    this.renderChildren();
  }

  focus(at?: "start" | "end"): void {
    if (!this.nested || this.nested.getBlocks().length === 0 || at === "start") {
      this.headingEl?.focus();
      if (this.headingEl) {
        const sel = window.getSelection();
        if (sel) {
          const range = this.headingEl.ownerDocument.createRange();
          range.selectNodeContents(this.headingEl);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      return;
    }
    const last = this.nested.getBlocks()[this.nested.getBlocks().length - 1];
    if (last) this.nested.focusBlock(last.id, "end");
  }

  getEditable(): HTMLElement | undefined {
    return this.headingEl;
  }

  destroy(): void {
    for (const tool of this.childTools.values()) {
      try {
        tool.destroy?.();
      } catch {
        /* child cleanup errors must not break destruction */
      }
    }
    this.childTools.clear();
  }

  /* ---------- children rendering ---------- */

  private childTools = new Map<string, BlockTool>();

  private renderChildren(): void {
    if (!this.nested || !this.childrenHost) return;
    const children = this.nested.getBlocks();
    const domChildren = Array.from(this.childrenHost.querySelectorAll<HTMLElement>("[data-ez-nested-id]"));
    // Fast path: same ids and types — only update changed child content.
    if (domChildren.length === children.length) {
      let identical = true;
      for (let i = 0; i < children.length; i++) {
        if (domChildren[i]?.getAttribute("data-ez-nested-id") !== children[i]!.id) {
          identical = false;
          break;
        }
      }
      if (identical) {
        this.syncChildData();
        return;
      }
    }
    // Structural change: rebuild, destroying the tools of removed children.
    for (const child of Array.from(this.childrenHost.childNodes)) {
      this.childrenHost.removeChild(child);
    }
    for (const tool of this.childTools.values()) {
      try {
        tool.destroy?.();
      } catch {
        /* child cleanup errors must not break rendering */
      }
    }
    this.childTools.clear();
    children.forEach((child, index) => {
      const wrapper = el("div", "ez-nested-block");
      wrapper.setAttribute("data-ez-nested-id", child.id);
      wrapper.setAttribute("data-ez-region", `child-${index}`);
      const tool = this.nested!.createToolInstance(child, wrapper, this.childApi(child, wrapper));
      wrapper.appendChild(tool.render());
      try {
        tool.rendered?.();
      } catch {
        /* optional hook */
      }
      this.childTools.set(child.id, tool);
      this.childrenHost.appendChild(wrapper);
    });
  }

  private syncChildData(): void {
    const children = this.nested?.getBlocks() ?? [];
    for (const child of children) {
      const tool = this.childTools.get(child.id);
      if (!tool) continue;
      const editable = this.nestedEditable(child.id, tool);
      if (!editable) continue;
      const current = domToInline(editable);
      const state = (child.data as { content?: InlineContent[] }).content ?? [];
      if (JSON.stringify(current) !== JSON.stringify(state)) {
        // State differs from the DOM (e.g. undo): re-render the child.
        const fresh = tool.render();
        editable.replaceWith(fresh);
      }
    }
  }

  private nestedEditable(childId: string, tool: BlockTool): HTMLElement | null {
    const editable = (tool as unknown as { getEditable?: () => HTMLElement | undefined }).getEditable?.();
    if (editable) return editable;
    return this.childrenHost.querySelector<HTMLElement>(`[data-ez-nested-id="${CSS.escape(childId)}"] [data-ez-editable]`) ?? null;
  }

  private saveChild(child: EzynotaBlock): void {
    const tool = this.childTools.get(child.id);
    if (!tool) return;
    const editable = this.nestedEditable(child.id, tool);
    if (!editable) return;
    const data = tool.save(editable);
    this.nested?.update(child.id, data as JsonValue);
  }

  /**
   * Input flow entry point for nested children (routed from InputManager
   * via the host). Saves direct children; unknown ids delegate to nested
   * toggles among the children so deep grandchildren reach their owner.
   */
  requestSaveChild(childId: string): void {
    if (this.childTools.has(childId)) {
      const child = this.nested?.getBlocks().find((b) => b.id === childId);
      if (child) this.saveChild(child);
      return;
    }
    for (const tool of this.childTools.values()) {
      const delegate = (tool as unknown as { requestSaveChild?: (id: string) => void }).requestSaveChild;
      if (typeof delegate === "function") delegate.call(tool, childId);
    }
  }

  /** Nested child BlockAPI routed through the children:update transaction. */
  private childApi(child: EzynotaBlock, element: HTMLElement): import("../types").BlockAPI {
    const host = this.nested!;
    return {
      id: child.id,
      type: child.type,
      get readOnly() {
        return host.readOnly;
      },
      element,
      getData: () => (host.getBlocks().find((b) => b.id === child.id)?.data ?? {}) as never,
      update: (data) => host.update(child.id, data as JsonValue),
      patch: (data) => {
        const current = (host.getBlocks().find((b) => b.id === child.id)?.data ?? {}) as Record<string, unknown>;
        host.update(child.id, { ...current, ...(data as Record<string, unknown>) } as JsonValue);
      },
      requestSave: () => this.saveChild(child),
      focus: (at) => host.focusBlock(child.id, at),
      remove: () => host.remove(child.id),
      move: (position) => {
        const index = typeof position === "number" ? position : -1;
        host.move(child.id, index);
      },
      duplicate: () => {
        const childrenNow = host.getBlocks();
        const index = childrenNow.findIndex((b) => b.id === child.id);
        if (index < 0) return "";
        const copy = JSON.parse(JSON.stringify(childrenNow[index]!)) as EzynotaBlock;
        const newId = host.insert(copy.type, copy.data, index + 1);
        return newId;
      },
      convert: (target) => {
        const childCurrent = host.getBlocks().find((b) => b.id === child.id);
        if (!childCurrent) return;
        host.update(child.id, { ...(childCurrent.data as Record<string, unknown>) } as JsonValue);
        void target;
      }
    } as import("../types").BlockAPI;
  }
}
