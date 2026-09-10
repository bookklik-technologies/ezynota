import type { BlockTool, ConversionConfig, BlockAPI, InlineContent } from "../types";
import { inlineToDom, domToInline, isEmptyInlineValue } from "../rich-text/dom";
import { normalizeInline } from "../rich-text/normalize";
import { TOOL_ICONS } from "../ui/icons";

export type ListItem = {
  content: InlineContent[];
  checked?: boolean;
};

export type ListData = {
  style?: string;
  items: ListItem[];
};

/**
 * List tool: one block, many items. The whole list container is editable so
 * the browser natively handles Enter (new item) and Backspace (merge items),
 * while save() serializes each <li> into portable inline JSON.
 */
export class ListTool implements BlockTool<ListData> {
  static toolbox = { icon: TOOL_ICONS.list, title: "List", category: "Basic blocks" };
  static shortcut = "CMD+SHIFT+L";
  static conversion: ConversionConfig = { to: ["paragraph", "quote", "heading"] };
  static enableInlineTools = true;

  private style: string = "unordered";
  private listEl!: HTMLElement;
  private editable!: HTMLElement;
  private api: BlockAPI;

  constructor(options: { api: BlockAPI; config: Record<string, unknown> }) {
    this.api = options.api;
    const cfgStyle = options.config?.["style"];
    if (cfgStyle === "ordered" || cfgStyle === "unordered" || cfgStyle === "task") this.style = cfgStyle;
    const data = options.api.getData() as unknown as ListData;
    if (data?.style === "ordered" || data?.style === "unordered" || data?.style === "task") this.style = data.style;
  }

  tag(): string {
    return this.style === "ordered" ? "ol" : "ul";
  }

  render(): HTMLElement {
    const doc = this.editable?.ownerDocument ?? document;
    const wrapper = doc.createElement("div");
    wrapper.classList.add("ez-text-input", "ez-list");
    wrapper.contentEditable = "true";
    wrapper.setAttribute("data-ez-editable", "true");
    wrapper.setAttribute("data-ez-multiline", "true");
    const list = doc.createElement(this.tag());
    const data = this.api.getData() as unknown as ListData;
    const items = Array.isArray(data?.items) && data.items.length > 0 ? data.items : [{ content: [] }];
    items.forEach((item, index) => {
      const li = doc.createElement("li");
      if (this.style === "task") {
        li.appendChild(this.createCheckbox(item?.checked === true, index, li));
        li.classList.toggle("ez-task-checked", item?.checked === true);
      }
      if (item?.content && !isEmptyInlineValue(item.content)) {
        li.appendChild(inlineToDom(item.content, doc));
      }
      list.appendChild(li);
    });
    wrapper.appendChild(list);
    // Browser-created <li> (Enter key) has no checkbox; inject one so
    // save() pairs items and checkboxes correctly in task lists.
    wrapper.addEventListener("input", () => this.ensureCheckboxes());
    this.editable = wrapper;
    this.listEl = list;
    return wrapper;
  }

  private createCheckbox(checked: boolean, index: number, li: HTMLElement): HTMLInputElement {
    const doc = li.ownerDocument;
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "ez-task-checkbox";
    checkbox.checked = checked;
    checkbox.setAttribute("aria-label", `Task ${index + 1}`);
    if (!this.api.readOnly) {
      checkbox.addEventListener("change", () => {
        checkbox.disabled = false;
        li.classList.toggle("ez-task-checked", checkbox.checked);
        this.api.update(this.save(this.editable) as never);
      });
    } else {
      checkbox.disabled = true;
    }
    return checkbox;
  }

  /** Inject a checkbox into every task <li> that is missing one. */
  private ensureCheckboxes(): void {
    if (this.style !== "task" || this.api.readOnly || !this.listEl) return;
    let index = 0;
    for (const li of Array.from(this.listEl.children)) {
      if (li.tagName !== "LI") continue;
      index++;
      if (li.querySelector(".ez-task-checkbox")) continue;
      (li as HTMLElement).prepend(this.createCheckbox(false, index - 1, li as HTMLElement));
      (li as HTMLElement).classList.remove("ez-task-checked");
    }
  }

  save(_element: HTMLElement): ListData {
    const items: ListItem[] = [];
    for (const li of Array.from(this.listEl.children)) {
      if (li.tagName !== "LI") continue;
      const item: ListItem = { content: domToInline(li) };
      if (this.style === "task") {
        // Per-li lookup: a browser-created li may lack its own checkbox,
        // so positional pairing with a shared checkbox list misassigns.
        const checkbox = li.querySelector<HTMLInputElement>(".ez-task-checkbox");
        item.checked = checkbox?.checked === true;
      }
      items.push(item);
    }
    if (items.length === 0) items.push({ content: [] });
    return { style: this.style, items: normalizeItems(items) };
  }

  validate(data: ListData): boolean {
    return !!data && Array.isArray(data.items);
  }

  merge(incoming: ListData): ListData {
    const current = (this.api.getData() as unknown as ListData)?.items ?? [];
    const items = normalizeItems([...current, ...(incoming?.items ?? [])]);
    const data: ListData = { style: this.style, items };
    this.api.update(data as never);
    return data;
  }

  /** Toggle between ordered and unordered (block settings entry). */
  renderSettings(): HTMLElement | null {
    const doc = this.editable?.ownerDocument ?? document;
    const wrap = doc.createElement("div");
    wrap.className = "ez-inline-group";
    for (const style of ["unordered", "ordered", "task"]) {
      const toggle = doc.createElement("button");
      toggle.type = "button";
      toggle.className = "ez-inline-btn";
      toggle.textContent = style === "ordered" ? "Numbered" : style === "task" ? "Tasks" : "Bulleted";
      toggle.setAttribute("aria-pressed", String(this.style === style));
      toggle.addEventListener("click", () => {
        if (this.api.readOnly) return;
        this.style = style;
        this.api.update(this.save(this.editable) as never);
        this.refreshElement();
        this.api.focus("end");
      });
      wrap.appendChild(toggle);
    }
    return wrap;
  }

  updated(): void {
    const data = this.api.getData() as unknown as ListData;
    const style = data?.style === "ordered" ? "ordered" : data?.style === "unordered" ? "unordered" : data?.style === "task" ? "task" : this.style;
    if (!this.editable || !this.listEl || style !== this.style) {
      this.style = style;
      this.refreshElement();
      return;
    }
    const domItems = Array.from(this.listEl.children).filter((el) => el.tagName === "LI");
    const stateItems = data?.items ?? [];
    if (domItems.length !== stateItems.length) {
      this.refreshElement();
      return;
    }
    // Update item contents only when they differ (avoids caret jumps).
    for (let i = 0; i < domItems.length; i++) {
      const li = domItems[i] as Element;
      const content = stateItems[i]?.content ?? [];
      const current = domToInline(li);
      if (JSON.stringify(normalizeInline(current)) !== JSON.stringify(normalizeInline(content))) {
        while (li.firstChild) li.removeChild(li.firstChild);
        li.appendChild(inlineToDom(content, li.ownerDocument));
      }
      if (this.style === "task") {
        const checkbox = li.querySelector<HTMLInputElement>(".ez-task-checkbox");
        if (checkbox) {
          const checked = stateItems[i]?.checked === true;
          if (checkbox.checked !== checked) {
            checkbox.checked = checked;
            li.classList.toggle("ez-task-checked", checked);
          }
        }
      }
    }
  }

  /** List items split natively by the browser; no custom split. */
  splitAtRange(): null {
    return null;
  }

  focus(at?: "start" | "end"): void {
    if (!this.editable) return;
    this.editable.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const items = Array.from(this.listEl.children).filter((el) => el.tagName === "LI");
    const target = (at === "end" ? items[items.length - 1] : items[0]) as HTMLElement | undefined;
    if (!target) return;
    const range = this.editable.ownerDocument.createRange();
    range.selectNodeContents(target);
    range.collapse(at !== "end");
    sel.removeAllRanges();
    sel.addRange(range);
  }

  getEditable(): HTMLElement | undefined {
    return this.editable;
  }

  destroy(): void {}

  private refreshElement(): void {
    if (!this.editable?.parentElement) return;
    const previous = this.editable;
    const newEl = this.render();
    previous.replaceWith(newEl);
    this.editable = newEl;
    this.listEl = (newEl.firstElementChild as HTMLElement) ?? newEl;
  }
}

function normalizeItems(items: ListItem[]): ListItem[] {
  return items.map((item) => {
    const normalized: ListItem = { content: normalizeInline(item?.content ?? []) };
    if (item?.checked !== undefined) normalized.checked = item.checked;
    return normalized;
  });
}
