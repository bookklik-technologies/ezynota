import type { Host } from "../host";

const BLOCK_SELECTOR = "[data-ez-block-id], [data-ez-nested-id]";
type DropTarget = { element: HTMLElement; id: string; placement: "before" | "after" | "inside" };

/**
 * DragManager: HTML5 drag & drop reordering of blocks, plus a Pointer
 * Events fallback for touch devices, and a keyboard alternative
 * (Alt+ArrowUp/Down) handled by the keyboard manager.
 */
export class DragManager {
  private host: Host;
  private target: HTMLElement;
  private started = false;
  private disposers: (() => void)[] = [];
  private draggingId: string | null = null;
  private pointerDrag: { cleanup(): void } | null = null;

  constructor(host: Host, target: HTMLElement) {
    this.host = host;
    this.target = target;
  }

  start(): void {
    if (this.started || this.host.readOnly) return;
    this.started = true;

    const onDragOver = (e: DragEvent): void => {
      if (this.host.readOnly) return;
      if (!this.draggingId) return;
      const drop = this.dropTarget(this.blockFromEvent(e), e.clientY);
      this.highlight(drop);
      if (!drop) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    };

    const onDragLeave = (e: DragEvent): void => {
      const target = this.blockFromEvent(e);
      if (target && (!e.relatedTarget || !target.contains(e.relatedTarget as Node))) this.highlight(null);
    };

    const onDrop = (e: DragEvent): void => {
      if (this.host.readOnly) return;
      if (!this.draggingId) return;
      e.preventDefault();
      const drop = this.dropTarget(this.blockFromEvent(e), e.clientY);
      if (drop) this.moveTo(drop);
      onDragEnd();
    };

    const onDragEnd = (): void => {
      this.draggingId = null;
      this.highlight(null);
      for (const el of Array.from(this.target.querySelectorAll(".ez-drop-target, .ez-dragging"))) {
        el.classList.remove("ez-drop-target", "ez-below", "ez-drop-inside", "ez-dragging");
      }
    };

    this.target.addEventListener("dragover", onDragOver);
    this.target.addEventListener("dragleave", onDragLeave);
    this.target.addEventListener("drop", onDrop);
    this.target.addEventListener("dragend", onDragEnd);
    const onDragStart = (e: DragEvent): void => {
      if (this.host.readOnly) { e.preventDefault(); return; }
      const id = e.dataTransfer?.getData("text/x-ezynota-drag");
      const grip = (e.target as Element).closest(".ez-nested-drag");
      const target = id ? this.findBlock(id) : grip ? this.blockFromEvent(e) : null;
      if (target) {
        this.draggingId = this.blockId(target);
        e.dataTransfer?.setData("text/x-ezynota-drag", this.draggingId);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        target.classList.add("ez-dragging");
      }
    };
    this.target.addEventListener("dragstart", onDragStart);

    // Pointer Events fallback for touch devices, where HTML5 DnD never
    // starts. Pointerdown on the drag grip begins a drag for the active
    // block; the drop index uses the same math as the DnD path.
    const onPointerDown = (e: PointerEvent): void => {
      if (this.host.readOnly || e.pointerType === "mouse" || e.button !== 0) return;
      if (this.pointerDrag) return;
      const grip = (e.target as HTMLElement).closest?.(".ez-block-actions, .ez-nested-drag") as HTMLElement | null;
      if (!grip) return;
      const active = grip.closest<HTMLElement>("[data-ez-nested-id]") ?? this.target.querySelector<HTMLElement>(".ez-block.ez-active");
      const id = active ? this.blockId(active) : null;
      if (!id) return;
      this.pointerDrag = this.beginPointerDrag(id);
    };
    this.target.addEventListener("pointerdown", onPointerDown);

    this.disposers.push(() => {
      this.target.removeEventListener("dragover", onDragOver);
      this.target.removeEventListener("dragleave", onDragLeave);
      this.target.removeEventListener("drop", onDrop);
      this.target.removeEventListener("dragend", onDragEnd);
      this.target.removeEventListener("dragstart", onDragStart);
      this.target.removeEventListener("pointerdown", onPointerDown);
      this.pointerDrag?.cleanup();
      this.pointerDrag = null;
      onDragEnd();
    });
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.started = false;
  }

  /** Shared destination and transaction path for mouse and touch dragging. */
  private moveTo(drop: DropTarget): void {
    const id = this.draggingId;
    if (!id || this.host.readOnly) return;
    this.host.blocks.relocate(id, drop.id, drop.placement);
    this.host.focusBlock(id, "start");
    this.host.announce(drop.placement === "inside" ? "Block moved inside section" : "Block moved");
  }

  private blockId(element: HTMLElement): string {
    return element.getAttribute("data-ez-nested-id") ?? element.getAttribute("data-ez-block-id") ?? "";
  }

  private findBlock(id: string): HTMLElement | null {
    return this.target.querySelector<HTMLElement>(`[data-ez-block-id="${CSS.escape(id)}"], [data-ez-nested-id="${CSS.escape(id)}"]`);
  }

  private dropTarget(element: HTMLElement | null, y: number): DropTarget | null {
    if (!element || !this.draggingId) return null;
    const id = this.blockId(element);
    const source = this.findBlock(this.draggingId);
    if (!id || source?.contains(element)) return null;
    const rect = element.getBoundingClientRect();
    let placement: DropTarget["placement"] = y > rect.top + rect.height / 2 ? "after" : "before";
    if (this.host.blocks.getByIdRecursive(id)?.type === "toggle") {
      // Thin outer edges reorder the whole section; its body accepts children.
      const edge = Math.min(8, rect.height / 4);
      if (y >= rect.top + edge && y <= rect.bottom - edge) placement = "inside";
    }
    return { element, id, placement };
  }

  private highlight(drop: DropTarget | null): void {
    for (const element of this.target.querySelectorAll(".ez-drop-target")) {
      element.classList.remove("ez-drop-target", "ez-below", "ez-drop-inside");
    }
    if (!drop) return;
    drop.element.classList.add("ez-drop-target");
    drop.element.classList.toggle("ez-below", drop.placement === "after");
    drop.element.classList.toggle("ez-drop-inside", drop.placement === "inside");
  }

  /** Visual ghost + drop tracking driven by document-level pointer events. */
  private beginPointerDrag(id: string): { cleanup(): void } {
    const doc = this.target.ownerDocument;
    const ghost = doc.createElement("div");
    ghost.className = "ez-drag-ghost";
    ghost.setAttribute("data-ez-ui", "true");
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "1000";
    ghost.style.padding = "4px 10px";
    ghost.style.maxWidth = "240px";
    ghost.style.overflow = "hidden";
    ghost.style.whiteSpace = "nowrap";
    ghost.style.textOverflow = "ellipsis";
    const source = this.findBlock(id);
    ghost.textContent = (source?.textContent ?? "").trim().slice(0, 80) || id;
    doc.body.appendChild(ghost);

    const onMove = (e: PointerEvent): void => {
      if (this.host.readOnly) return;
      ghost.style.left = `${e.clientX + 12}px`;
      ghost.style.top = `${e.clientY + 12}px`;
      this.highlight(this.dropTarget(this.blockFromPoint(e.clientX, e.clientY), e.clientY));
    };

    const finish = (): void => {
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerup", onUp);
      doc.removeEventListener("pointercancel", onCancel);
      ghost.remove();
      this.highlight(null);
      this.draggingId = null;
      this.pointerDrag = null;
    };
    const onUp = (e: PointerEvent): void => {
      const drop = this.dropTarget(this.blockFromPoint(e.clientX, e.clientY), e.clientY);
      if (drop) this.moveTo(drop);
      finish();
    };
    const onCancel = (): void => {
      finish();
    };

    this.draggingId = id;
    doc.addEventListener("pointermove", onMove);
    doc.addEventListener("pointerup", onUp);
    doc.addEventListener("pointercancel", onCancel);
    return { cleanup: finish };
  }

  private blockFromEvent(e: Event): HTMLElement | null {
    let node = e.target as Node | null;
    while (node && node !== this.target) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches(BLOCK_SELECTOR)) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  private blockFromPoint(x: number, y: number): HTMLElement | null {
    const doc = this.target.ownerDocument;
    const element = doc.elementFromPoint(x, y);
    if (!element) return null;
    const block = element.closest<HTMLElement>(BLOCK_SELECTOR);
    return block && this.target.contains(block) ? block : null;
  }
}
