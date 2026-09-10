import type { Host } from "../host";
import { el, clearChildren, placePopover } from "./dom";
import { isSvgIcon, renderIcon } from "./icons";

export interface SlashEntry {
  name: string;
  title: string;
  icon: string;
  category?: string;
}

/** Subsequence fuzzy match — returns a score or -1. */
export function fuzzyScore(query: string, text: string): number {
  if (query === "") return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak++;
      score += 1 + streak;
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : -1;
}

/**
 * Slash menu: typing "/" in an empty text block opens a searchable command
 * palette of block tools with keyboard navigation.
 */
export class SlashMenu {
  private root: HTMLElement;
  private host: Host;
  private input!: HTMLInputElement;
  private list!: HTMLElement;
  private entries: SlashEntry[] = [];
  private filtered: SlashEntry[] = [];
  private focusedIndex = 0;
  private isOpen = false;
  private blockId: string | null = null;
  private unsubOutside: (() => void) | null = null;
  private insertMode = false;
  private prefix = `ez-slash-${++slashMenuId}`;

  constructor(host: Host) {
    this.host = host;
    this.root = el("div", "ez-popover ez-slash-menu");
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", host.i18n.t("toolbar.add"));
    this.root.setAttribute("data-ez-ui", "true");
    this.root.style.display = "none";
    this.root.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest("button")) e.preventDefault();
    });
    this.root.addEventListener("keydown", (event) => {
      if (!event.isComposing && this.handleKey(event)) event.preventDefault();
      event.stopPropagation();
    });
  }

  getElement(): HTMLElement {
    return this.root;
  }

  open(blockId: string, insert = false): void {
    if (this.host.readOnly) return;
    this.close();
    this.blockId = blockId;
    this.insertMode = insert;
    this.entries = this.host.registry
      .listBlockTools()
      .filter((t) => !!t.toolbox)
      .map((t) => ({ name: t.name, title: t.toolbox!.title, icon: t.toolbox!.icon ?? "•", category: t.toolbox!.category }));
    this.isOpen = true;
    this.buildDom();
    this.root.style.display = "block";
    this.filter("");
    this.focusedIndex = 0;
    this.renderList();
    this.position();
    this.input.focus();
  }

  isOpenMenu(): boolean {
    return this.isOpen;
  }

  /** Update the query while the user keeps typing after "/". */
  setQuery(query: string): void {
    if (!this.isOpen) return;
    this.filter(query);
    this.focusedIndex = 0;
    this.renderList();
  }

  handleKey(event: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    switch (event.key) {
      case "ArrowDown":
        this.focusedIndex = Math.min(this.focusedIndex + 1, this.filtered.length - 1);
        this.renderList();
        return true;
      case "ArrowUp":
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
        this.renderList();
        return true;
      case "Home":
        this.focusedIndex = 0;
        this.renderList();
        return true;
      case "End":
        this.focusedIndex = this.filtered.length - 1;
        this.renderList();
        return true;
      case "Enter":
        if (this.filtered[this.focusedIndex]) {
          event.preventDefault();
          this.select(this.filtered[this.focusedIndex]!);
          return true;
        }
        return false;
      case "Escape":
        event.preventDefault();
        this.close(true);
        return true;
      case "Tab":
        this.close(true);
        return true;
      default:
        return false;
    }
  }

  close(restore = false): void {
    if (!this.isOpen) return;
    const id = this.blockId;
    this.isOpen = false;
    this.blockId = null;
    this.root.style.display = "none";
    this.unsubOutside?.();
    this.input.setAttribute("aria-expanded", "false");
    this.unsubOutside = null;
    if (restore && id && !this.host.readOnly) this.host.focusBlock(id, "end");
  }

  private buildDom(): void {
    clearChildren(this.root);
    this.input = el("input", "ez-menu-search");
    this.input.type = "text";
    this.input.placeholder = this.host.i18n.t("slash.placeholder");
    this.input.setAttribute("aria-label", this.host.i18n.t("slash.placeholder"));
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-expanded", "true");
    this.input.setAttribute("aria-autocomplete", "list");
    this.input.setAttribute("aria-controls", `${this.prefix}-list`);
    this.input.addEventListener("input", () => this.setQuery(this.input.value));
    this.list = el("div", "ez-menu");
    this.list.setAttribute("role", "listbox");
    this.list.id = `${this.prefix}-list`;
    this.list.setAttribute("aria-label", this.host.i18n.t("toolbar.blockType"));
    this.root.append(this.input, this.list);
    const onOutside = (e: MouseEvent): void => {
      if (!this.root.contains(e.target as Node)) this.close();
    };
    document.addEventListener("mousedown", onOutside, true);
    const reposition = (): void => this.position();
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    this.unsubOutside = () => {
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }

  private filter(query: string): void {
    if (query === "") {
      this.filtered = this.entries.slice();
      return;
    }
    this.filtered = this.entries
      .map((entry) => ({ entry, score: Math.max(fuzzyScore(query, entry.title), fuzzyScore(query, entry.name)) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.entry);
  }

  private renderList(): void {
    clearChildren(this.list);
    if (this.filtered.length === 0) {
      const empty = el("div", "ez-menu-empty", this.host.i18n.t("slash.empty"));
      empty.setAttribute("role", "status");
      this.input.removeAttribute("aria-activedescendant");
      this.list.appendChild(empty);
      return;
    }
    let lastCategory: string | undefined;
    this.filtered.forEach((entry, i) => {
      if (entry.category && entry.category !== lastCategory) {
        this.list.appendChild(el("div", "ez-menu-category", entry.category));
        lastCategory = entry.category;
      }
      const item = el("button", "ez-menu-item" + (i === this.focusedIndex ? " ez-focused" : ""));
      item.type = "button";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", i === this.focusedIndex ? "true" : "false");
      item.id = `${this.prefix}-option-${i}`;
      item.tabIndex = -1;
      if (isSvgIcon(entry.icon)) {
        item.appendChild(renderIcon(entry.icon));
      } else {
        item.appendChild(el("span", "ez-menu-icon", entry.icon));
      }
      const label = el("span", "ez-menu-label", entry.title);
      item.appendChild(label);
      item.addEventListener("click", () => this.select(entry));
      this.list.appendChild(item);
    });
    this.input.setAttribute("aria-activedescendant", `${this.prefix}-option-${this.focusedIndex}`);
    const focused = this.list.querySelector<HTMLElement>(".ez-focused");
    focused?.scrollIntoView({ block: "nearest" });
  }

  private select(entry: SlashEntry): void {
    const blockId = this.blockId;
    const insert = this.insertMode;
    this.close();
    if (!blockId || this.host.readOnly) return;
    const data = this.host.getBlockData(blockId) as Record<string, unknown> | undefined;
    const text = this.host.getEditableElement(blockId)?.textContent ?? "";
    // The typed slash query ("/head", "/") lives in the block's saved
    // content; strip it so it never leaks into the converted block.
    if (text.trim().startsWith("/") && Array.isArray(data?.content)) {
      this.host.updateBlockData(blockId, { ...data, content: [] } as never);
    }
    if (insert && !(this.host.getBlockType(blockId) === "paragraph" && text.trim() === "")) {
      this.host.insertBlock(entry.name, undefined, { after: blockId, focus: true });
      this.host.announce(`${entry.title} added`);
      return;
    }
    this.host.convertBlock(blockId, entry.name);
    this.host.focusBlock(blockId, "end");
    this.host.announce(`Converted to ${entry.title}`);
  }

  private position(): void {
    if (!this.isOpen || !this.blockId) return;
    const anchor = this.host.holder.querySelector(`[data-ez-block-id="${CSS.escape(this.blockId)}"]`);
    placePopover(this.root, (anchor ?? this.host.holder).getBoundingClientRect());
  }

  destroy(): void { this.close(); this.root.remove(); }
}

let slashMenuId = 0;
