import { el, placePopover } from "../../ui/dom";

export interface NoteLinkSuggesterDeps {
  listNotes(): { id: string; title: string }[];
  openNote?(noteId: string): void;
  /** Active note id so the current note is excluded from suggestions. */
  getActiveNoteId?(): string | null;
}

/**
 * `[[` note suggestions: typing `[[` in any editable opens a note picker.
 * Accepting a suggestion replaces the `[[query` prefix with an internal
 * note link (`href="note:<id>"`) — links reference stable note IDs, so
 * renaming notes preserves them. Backlinks are derived from the same hrefs.
 */
export class WorkspaceLinkSuggester {
  private surface: HTMLElement;
  private deps: NoteLinkSuggesterDeps;
  private popover: HTMLElement | null = null;
  private query = "";
  private range: Range | null = null;
  private blockId = "";
  private disposers: (() => void)[] = [];
  private items: { id: string; title: string }[] = [];
  private focusedIndex = 0;

  constructor(surface: HTMLElement, deps: NoteLinkSuggesterDeps) {
    this.surface = surface;
    this.deps = deps;
    const onKeyDown = (event: Event): void => {
      const e = event as KeyboardEvent;
      if (e.isComposing) return;
      if (this.popover) this.handleKey(e);
    };
    const onInput = (event: Event): void => {
      const e = event as InputEvent;
      if (e.isComposing) return;
      this.checkCaret();
    };
    this.surface.addEventListener("keydown", onKeyDown, true);
    this.surface.addEventListener("input", onInput, true);
    // Internal note links navigate to their note.
    const onClick = (event: Event): void => {
      const anchor = (event.target as Element | null)?.closest?.("a[href^='note:']") as HTMLAnchorElement | null;
      if (!anchor) return;
      const noteId = anchor.getAttribute("data-ezn-note") ?? anchor.getAttribute("href")?.slice("note:".length);
      if (!noteId || !this.deps.openNote) return;
      event.preventDefault();
      this.deps.openNote(noteId);
    };
    this.surface.addEventListener("click", onClick, true);
    this.disposers.push(
      () => this.surface.removeEventListener("keydown", onKeyDown, true),
      () => this.surface.removeEventListener("input", onInput, true),
      () => this.surface.removeEventListener("click", onClick, true)
    );
  }

  destroy(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.closePopover();
  }

  private checkCaret(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      this.closePopover();
      return;
    }
    const range = selection.getRangeAt(0);
    const editable = (range.startContainer instanceof Element ? range.startContainer : range.startContainer?.parentElement)?.closest("[data-ez-editable]") as HTMLElement | null;
    if (!editable || !this.surface.contains(editable)) {
      this.closePopover();
      return;
    }
    // Read the text before the caret.
    const probe = editable.ownerDocument.createRange();
    probe.selectNodeContents(editable);
    try {
      probe.setEnd(range.startContainer, range.startOffset);
    } catch {
      this.closePopover();
      return;
    }
    const before = probe.toString();
    const match = /\[\[([^\][]*)$/.exec(before);
    if (!match) {
      this.closePopover();
      return;
    }
    this.query = match[1] ?? "";
    this.range = range.cloneRange();
    this.blockId = (editable.closest("[data-ez-block-id]") as HTMLElement | null)?.getAttribute("data-ez-block-id") ?? "";
    this.openPopover();
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.popover) return;
    switch (event.key) {
      case "ArrowDown":
        this.focusedIndex = (this.focusedIndex + 1) % this.items.length;
        this.highlightFocused();
        event.preventDefault();
        event.stopPropagation();
        break;
      case "ArrowUp":
        this.focusedIndex = (this.focusedIndex - 1 + this.items.length) % this.items.length;
        this.highlightFocused();
        event.preventDefault();
        event.stopPropagation();
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        if (this.items[this.focusedIndex]) this.accept(this.items[this.focusedIndex]!);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        this.closePopover();
        break;
      case "Backspace":
        // Let the edit happen; re-check afterwards via input event.
        break;
      default:
        break;
    }
  }

  private openPopover(): void {
    // Exclude the note currently being edited (fall back to the block id
    // when the host does not provide the active note id).
    const selfId = this.deps.getActiveNoteId?.() ?? this.blockId;
    const notes = this.deps.listNotes().filter((note) => note.id !== selfId);
    const query = this.query.toLowerCase();
    this.items = (query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes).slice(0, 8);
    this.focusedIndex = 0;
    if (!this.popover) {
      this.popover = el("div", "ez-popover ez-note-suggest");
      this.popover.setAttribute("role", "listbox");
      this.popover.setAttribute("aria-label", "Link to note");
      this.popover.setAttribute("data-ez-ui", "true");
      const outside = (event: Event): void => {
        if (this.popover && !this.popover.contains(event.target as Node)) this.closePopover();
      };
      document.addEventListener("mousedown", outside, true);
      this.disposers.push(() => document.removeEventListener("mousedown", outside, true));
      const closeOnSignal = (): void => this.closePopover();
      this.surface.addEventListener("ez-close-popovers", closeOnSignal);
      this.disposers.push(() => this.surface.removeEventListener("ez-close-popovers", closeOnSignal));
      this.surface.appendChild(this.popover);
    }
    for (const child of Array.from(this.popover.childNodes)) {
      this.popover.removeChild(child as Node);
    }
    if (this.items.length === 0) {
      this.popover.appendChild(el("div", "ez-menu-empty", "No notes to link"));
      return;
    }
    this.items.forEach((note) => {
      const item = el("button", "ez-menu-item");
      item.type = "button";
      item.setAttribute("role", "option");
      item.textContent = note.title || "Untitled";
      item.addEventListener("click", () => this.accept(note));
      this.popover?.appendChild(item);
    });
    this.highlightFocused();
    if (this.range) placePopover(this.popover, this.range.getBoundingClientRect());
  }

  private highlightFocused(): void {
    if (!this.popover) return;
    const items = Array.from(this.popover.querySelectorAll<HTMLElement>(".ez-menu-item"));
    items.forEach((item, index) => item.classList.toggle("ez-focused", index === this.focusedIndex));
  }

  private closePopover(): void {
    this.popover?.remove();
    this.popover = null;
    this.range = null;
    this.query = "";
  }

  private accept(note: { id: string; title: string }): void {
    if (!this.range) return;
    const range = this.range;
    this.closePopover();
    // Delete the "[[query" text before the caret.
    const before = range.startContainer.parentElement?.closest("[data-ez-editable]") as HTMLElement | null;
    const startOffset = this.findTokenStart(range, before);
    if (startOffset >= 0) {
      try {
        const doc = range.startContainer.ownerDocument ?? document;
        const deleteRange = doc.createRange();
        deleteRange.setStart(range.startContainer, Math.max(0, startOffset));
        deleteRange.setEnd(range.startContainer, range.startOffset);
        deleteRange.deleteContents();
      } catch {
        /* fallback: leave the [[ text */
      }
    }
    const anchor = (before?.ownerDocument ?? document).createElement("a");
    anchor.setAttribute("href", `note:${note.id}`);
    anchor.setAttribute("data-ezn-note", note.id);
    anchor.setAttribute("rel", "noopener noreferrer");
    anchor.textContent = note.title || "Untitled";
    range.insertNode(anchor);
    // Move the caret after the link.
    const selection = window.getSelection();
    if (selection) {
      const after = (anchor.ownerDocument ?? document).createRange();
      after.setStartAfter(anchor);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }
    // Programmatic DOM change → flush the block through the input flow.
    before?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** Character offset of the "[[" token start within the caret text node. */
  private findTokenStart(range: Range, editable: HTMLElement | null): number {
    if (!editable || !(range.startContainer.nodeType === Node.TEXT_NODE)) return -1;
    const text = range.startContainer.nodeValue ?? "";
    const upTo = text.slice(0, range.startOffset);
    const index = upTo.lastIndexOf("[[");
    return index >= 0 ? index : -1;
  }
}
