import type { EditorSelection } from "../types";
import type { Host } from "../host";
import { SimpleBus } from "../core/event-bus";

type Events = {
  selection: (selection: EditorSelection | null) => void;
  focus: () => void;
  blur: () => void;
};

/**
 * SelectionManager tracks DOM selection inside the editor holder and maps
 * it to block-scoped selection objects.
 */
export class SelectionManager {
  private bus = new SimpleBus<Events>();
  private host: Host;
  private holder: HTMLElement;
  private current: EditorSelection | null = null;
  private savedRange: Range | null = null;
  private started = false;
  private stopped = false;
  private disposers: (() => void)[] = [];

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const onSelectionChange = (): void => {
      this.refresh();
    };
    const onFocusIn = (): void => {
      this.refresh();
      this.bus.emit("focus");
    };
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null;
      if (!next || !this.holder.contains(next)) {
        this.bus.emit("blur");
        if (!this.holder.contains(next as Node | null)) {
          this.current = null;
          this.savedRange = null;
          this.bus.emit("selection", null);
        }
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    this.holder.addEventListener("focusin", onFocusIn);
    this.holder.addEventListener("focusout", onFocusOut);
    this.disposers.push(() => {
      document.removeEventListener("selectionchange", onSelectionChange);
      this.holder.removeEventListener("focusin", onFocusIn);
      this.holder.removeEventListener("focusout", onFocusOut);
    });
  }

  stop(): void {
    this.stopped = true;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.bus.destroy();
  }

  on<K extends keyof Events>(event: K, handler: Events[K]): () => void {
    return this.bus.on(event as never, handler as never);
  }

  getSelection(): EditorSelection | null {
    return this.current;
  }

  getRange(): Range | null {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) return this.uiRange();
    const range = sel.getRangeAt(0);
    // Any range contained in the holder is valid — including cross-block
    // selections (previously those returned null and handlers fell through
    // to browser defaults). Callers clamp to a block when they need one.
    if (this.holder.contains(range.commonAncestorContainer)) return range;
    return this.uiRange();
  }

  private uiRange(): Range | null {
    const active = document.activeElement as HTMLElement | null;
    return active && this.holder.contains(active) && active.closest("[data-ez-ui]")
      && this.savedRange?.startContainer.isConnected ? this.savedRange : null;
  }

  setRange(range: Range): void {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
    this.refresh();
  }

  /** Compute block-level selection from the DOM selection. */
  refresh(): EditorSelection | null {
    const range = this.getRange();
    if (!range) {
      this.current = null;
      this.bus.emit("selection", null);
      return null;
    }
    // The anchor block comes from the range's START boundary, clamped to
    // the holder — a multi-block selection's commonAncestorContainer is the
    // holder itself and has no block ancestor of its own.
    const blockEl = this.blockForBoundary(range.startContainer, range.startOffset);
    if (!blockEl) {
      this.current = null;
      this.bus.emit("selection", null);
      return null;
    }
    const id = blockEl.getAttribute("data-ez-block-id") ?? "";
    this.savedRange = range.cloneRange();
    const collapsed = range.collapsed;
    const text = range.toString();
    // Preserve the anchor/focus DIRECTION for backward selections by using
    // the DOM selection's anchor/focus boundaries when available.
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const anchorNode = sel && sel.anchorNode ? sel.anchorNode : range.startContainer;
    const anchorOff = sel && sel.anchorNode ? sel.anchorOffset : range.startOffset;
    const focusNode = sel && sel.focusNode ? sel.focusNode : range.endContainer;
    const focusOff = sel && sel.focusNode ? sel.focusOffset : range.endOffset;
    const anchorBlock = this.blockForBoundary(anchorNode, anchorOff);
    const focusBlock = this.blockForBoundary(focusNode, focusOff);
    const regionEl = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("[data-ez-region]");
    const selection: EditorSelection = {
      blockId: id,
      index: this.host.getBlockIndex(id),
      collapsed,
      anchorOffset: textOffsetAt(anchorBlock ?? blockEl, anchorNode, anchorOff),
      focusOffset: textOffsetAt(focusBlock ?? blockEl, focusNode, focusOff),
      text,
      anchorBlockId: anchorBlock?.getAttribute("data-ez-block-id") ?? id,
      focusBlockId: focusBlock?.getAttribute("data-ez-block-id") ?? id,
      regionId: regionEl?.getAttribute("data-ez-region") ?? undefined
    };
    const changed =
      !this.current ||
      this.current.blockId !== selection.blockId ||
      this.current.collapsed !== selection.collapsed ||
      this.current.anchorOffset !== selection.anchorOffset ||
      this.current.focusOffset !== selection.focusOffset;
    this.current = selection;
    if (changed) this.bus.emit("selection", selection);
    return selection;
  }

  private findBlockElement(node: Node): HTMLElement | null {
    let cursor: Node | null = node;
    if (cursor.nodeType === Node.TEXT_NODE) cursor = cursor.parentNode;
    while (cursor && cursor !== this.holder) {
      if (cursor.nodeType === Node.ELEMENT_NODE && (cursor as HTMLElement).hasAttribute?.("data-ez-block-id")) {
        return cursor as HTMLElement;
      }
      cursor = cursor.parentNode;
    }
    return null;
  }

  /**
   * Resolve the block element for a selection boundary point. A boundary on
   * the holder itself (whole-document selections) is clamped to the child
   * at the boundary offset.
   */
  private blockForBoundary(node: Node, offset: number): HTMLElement | null {
    if (node === this.holder || node === this.holder.parentNode) {
      const child = this.holder.childNodes[Math.min(offset, this.holder.childNodes.length - 1)];
      if (child) return this.findBlockElement(child);
      return null;
    }
    return this.findBlockElement(node);
  }
}

/** Approximate plain-text offset of a boundary point within its block. */
function textOffsetAt(block: HTMLElement, node: Node, offset: number): number {
  try {
    const doc = block.ownerDocument;
    const probe = doc.createRange();
    probe.selectNodeContents(block.querySelector("[data-ez-editable]") ?? block);
    probe.setEnd(node, offset);
    return probe.toString().length;
  } catch {
    return 0;
  }
}

/** Place the caret at a plain-text offset inside an editable element. */
export function setCaretAtTextOffset(editable: HTMLElement, offset: number): void {
  const doc = editable.ownerDocument;
  const sel = window.getSelection();
  if (!sel) return;
  const walker = doc.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = walker.nextNode();
  let target: Text | null = null;
  let targetOffset = 0;
  while (node) {
    const text = node as Text;
    const len = text.data?.length ?? 0;
    if (remaining <= len) {
      target = text;
      targetOffset = remaining;
      break;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  const range = doc.createRange();
  if (target) {
    range.setStart(target, targetOffset);
    range.collapse(true);
  } else {
    // Offset beyond the content: caret at the END (never jump to start).
    range.selectNodeContents(editable);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
