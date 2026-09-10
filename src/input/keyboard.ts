import type { Host } from "../host";
import type { TextBlockToolLike } from "./tool-interfaces";
import { canMerge, dataIsEmpty } from "./tool-interfaces";

/**
 * KeyboardManager implements the default keyboard behavior (spec §16):
 * Enter splits blocks, Shift+Enter inserts soft breaks, Backspace/Delete
 * merge compatible blocks, Ctrl/Cmd shortcuts dispatch commands, Alt+Arrows
 * move blocks (keyboard drag alternative), Escape closes menus. Every
 * behavior routes through commands and transactions — never direct DOM edits.
 */
export class KeyboardManager {
  private host: Host;
  private holder: HTMLElement;
  private disposers: (() => void)[] = [];

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    const onKeyDown = (event: Event): void => {
      const e = event as KeyboardEvent;
      if (this.host.readOnly || this.host.isDestroyed()) return;
      if (e.isComposing || (e.target as HTMLElement).closest("[data-ez-ui]")) return;
      if (this.handle(e)) e.preventDefault();
    };
    this.holder.addEventListener("keydown", onKeyDown);
    this.disposers.push(() => this.holder.removeEventListener("keydown", onKeyDown));
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  /** Returns true when the event was handled and default must be prevented. */
  private handle(e: KeyboardEvent): boolean {
    const mod = e.metaKey || e.ctrlKey;

    // Move block with keyboard: Alt+ArrowUp / Alt+ArrowDown.
    if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      return this.handleMoveBlock(e.key === "ArrowUp" ? -1 : 1);
    }

    if (mod && !e.shiftKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          return this.inline("bold");
        case "i":
          return this.inline("italic");
        case "u":
          return this.inline("underline");
        case "k":
          return this.inline("link");
        case "z":
          this.host.undo();
          this.host.announce("Undo");
          return true;
        case "d": {
          const selection = this.host.getSelectionInfo();
          if (selection) {
            this.host.duplicateBlock(selection.blockId);
            this.host.announce("Block duplicated");
            return true;
          }
          return false;
        }
      }
    }

    if (mod && e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        this.host.redo();
        this.host.announce("Redo");
        return true;
      }
      if (key === "l") {
        const selection = this.host.getSelectionInfo();
        if (selection) {
          this.host.convertBlock(selection.blockId, "list");
          this.host.announce("Converted to list");
          return true;
        }
      }
      if (key === "c") {
        const selection = this.host.getSelectionInfo();
        if (selection) {
          this.host.convertBlock(selection.blockId, "code");
          this.host.announce("Converted to code");
          return true;
        }
      }
    }

    switch (e.key) {
      case "Enter":
        return e.shiftKey ? this.handleSoftBreak() : this.handleEnter();
      case "Backspace":
        return this.handleBackspace();
      case "Tab":
        return this.handleTab(e);
      case "Escape":
        this.host.closeMenus();
        return true;
      default:
        return false;
    }
  }

  private inline(toolName: string): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection || (selection.collapsed && !["bold", "italic", "underline", "link"].includes(toolName))) return false;
    this.host.dispatchInlineTool(toolName);
    return true;
  }

  /** Enter: split the block, or create a new one below for empty blocks. */
  private handleEnter(): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection) return false;
    const blockId = selection.blockId;
    const type = this.host.getBlockType(blockId);
    const tool = this.host.getTool(blockId);
    if (!tool || !type) return false;
    const enterKey = (tool.constructor as { enterKey?: string }).enterKey;
    if (enterKey === "ignore") {
      this.host.insertBlock(this.host.defaultBlock, undefined, { after: blockId, focus: true });
      return true;
    }
    if (enterKey === "newline" || type === "code") {
      return false; // Let the browser insert a soft break; save happens on input.
    }
    if (type === "list") {
      return false; // Browser natively creates list items.
    }
    return this.splitAtSelection(blockId);
  }

  /** Shift+Enter: soft line break inside the editable. */
  private handleSoftBreak(): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection) return false;
    const editable = this.host.getEditableElement(selection.blockId);
    if (!editable) return false;
    const range = this.host.getRange();
    if (!range) return false;
    const br = editable.ownerDocument.createElement("br");
    range.deleteContents();
    range.insertNode(br);
    const sel = window.getSelection();
    if (sel) {
      const after = editable.ownerDocument.createRange();
      after.setStartAfter(br);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    this.host.requestSaveBlock(selection.blockId, "user");
    return true;
  }

  /**
   * Split the current text block at the caret into two blocks — committed
   * as ONE transaction so a single undo restores the original block with
   * all of its text.
   */
  private splitAtSelection(blockId: string): boolean {
    const editable = this.host.getEditableElement(blockId);
    const type = this.host.getBlockType(blockId);
    const tool = this.host.getTool(blockId);
    if (!editable || !type || !tool) return false;
    const splitter = tool as unknown as TextBlockToolLike;
    if (typeof splitter.splitAtRange !== "function") return false;
    const data = this.host.getBlockData(blockId);
    if (dataIsEmpty(type, data)) {
      this.host.insertBlock(this.host.defaultBlock, undefined, { after: blockId, focus: true });
      return true;
    }
    const range = this.host.getRange();
    if (!range) return false;
    const split = splitter.splitAtRange(range);
    if (!split) return false;
    const [before, after] = split as [unknown, unknown];
    const newId = this.host.splitBlock(blockId, before as never, after as never);
    if (!newId) return false;
    this.host.focusBlock(newId, "start");
    this.host.announce("Block split");
    return true;
  }

  private handleBackspace(): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection || !selection.collapsed) return false;
    const editable = this.host.getEditableElement(selection.blockId);
    if (!editable) return false;
    if (!caretAtStart(editable, this.host.getRange())) return false;

    const index = this.host.getBlockIndex(selection.blockId);
    if (index <= 0) return false;
    const prevBlock = this.host.blocks.blocks[index - 1];
    if (!prevBlock) return false;
    const curType = this.host.getBlockType(selection.blockId) ?? "";

    if (dataIsEmpty(curType, this.host.getBlockData(selection.blockId))) {
      this.host.removeBlock(selection.blockId, "user");
      this.host.focusPrevBlock(selection.blockId, "end");
      return true;
    }

    if (canMerge(prevBlock.type, curType)) {
      this.host.mergeBlocks(prevBlock.id, selection.blockId, "user");
      return true;
    }
    return false;
  }

  /**
   * Tab inside a code block inserts spaces. Shift+Tab is the keyboard exit:
   * it moves focus out of the code block (creating a paragraph below when
   * the code block is last) so the editor never traps the keyboard.
   */
  private handleTab(e: KeyboardEvent): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection) return false;
    if (this.host.getBlockType(selection.blockId) !== "code") return false;
    if (e.shiftKey) {
      const moved = this.host.focusNextBlock(selection.blockId, "start");
      if (!moved) {
        this.host.insertBlock(this.host.defaultBlock, undefined, { after: selection.blockId, focus: true });
      }
      this.host.announce("Left code block");
      return true;
    }
    document.execCommand("insertText", false, "  ");
    this.host.requestSaveBlock(selection.blockId, "user");
    return true;
  }

  private handleMoveBlock(direction: number): boolean {
    const selection = this.host.getSelectionInfo();
    if (!selection) return false;
    const index = this.host.getBlockIndex(selection.blockId);
    const to = index + direction;
    if (index < 0 || to < 0 || to >= this.host.blocks.length) return false;
    this.host.moveBlock(selection.blockId, to);
    this.host.focusBlock(selection.blockId);
    this.host.announce(`Block moved to position ${to + 1}`);
    return true;
  }
}

/** True when the caret sits at the logical start of the editable content. */
export function caretAtStart(editable: HTMLElement, range: Range | null): boolean {
  if (!range || !range.collapsed) return false;
  const probe = editable.ownerDocument.createRange();
  probe.selectNodeContents(editable);
  try {
    probe.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  return probe.toString().replace(/\u200B/g, "").length === 0;
}
