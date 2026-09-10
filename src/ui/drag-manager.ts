import type { Host } from "../host";

/**
 * DragManager: HTML5 drag & drop reordering of blocks, plus a Pointer
 * Events fallback for touch devices, and a keyboard alternative
 * (Alt+ArrowUp/Down) handled by the keyboard manager.
 */
export class DragManager {
  private host: Host;
  private holder: HTMLElement;
  private started = false;
  private disposers: (() => void)[] = [];
  private draggingId: string | null = null;
  private pointerDrag: { cleanup(): void } | null = null;

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    if (this.started || this.host.readOnly) return;
    this.started = true;

    const onDragOver = (e: DragEvent): void => {
      if (this.host.readOnly) return;
      const target = this.blockFromEvent(e);
      if (!this.draggingId || !target) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const id = target.getAttribute("data-ez-block-id") ?? "";
      if (id === this.draggingId) return;
      const rect = target.getBoundingClientRect();
      const below = e.clientY > rect.top + rect.height / 2;
      target.classList.add("ez-drop-target");
      target.classList.toggle("ez-below", below);
      target.setAttribute("data-ez-drop-below", below ? "true" : "false");
    };

    const onDragLeave = (e: DragEvent): void => {
      const target = this.blockFromEvent(e);
      target?.classList.remove("ez-drop-target", "ez-below");
      target?.removeAttribute("data-ez-drop-below");
    };

    const onDrop = (e: DragEvent): void => {
      if (this.host.readOnly) return;
      const target = this.blockFromEvent(e);
      if (!this.draggingId || !target) return;
      e.preventDefault();
      const dropId = target.getAttribute("data-ez-block-id") ?? "";
      const below = target.getAttribute("data-ez-drop-below") === "true";
      target.classList.remove("ez-drop-target", "ez-below");
      target.removeAttribute("data-ez-drop-below");
      if (!dropId || dropId === this.draggingId) return;
      this.moveTo(dropId, below);
      this.draggingId = null;
    };

    const onDragEnd = (): void => {
      this.draggingId = null;
      for (const el of Array.from(this.holder.querySelectorAll(".ez-drop-target, .ez-dragging"))) {
        el.classList.remove("ez-drop-target", "ez-below", "ez-dragging");
        el.removeAttribute("data-ez-drop-below");
      }
    };

    this.holder.addEventListener("dragover", onDragOver);
    this.holder.addEventListener("dragleave", onDragLeave);
    this.holder.addEventListener("drop", onDrop);
    this.holder.addEventListener("dragend", onDragEnd);
    const onDragStart = (e: DragEvent): void => {
      if (this.host.readOnly) { e.preventDefault(); return; }
      const id = e.dataTransfer?.getData("text/x-ezynota-drag");
      const target = id ? this.holder.querySelector<HTMLElement>(`[data-ez-block-id="${CSS.escape(id)}"]`) : this.blockFromEvent(e);
      if (target) {
        this.draggingId = target.getAttribute("data-ez-block-id") ?? null;
        target.classList.add("ez-dragging");
      }
    };
    this.holder.addEventListener("dragstart", onDragStart);

    // Pointer Events fallback for touch devices, where HTML5 DnD never
    // starts. Pointerdown on the drag grip begins a drag for the active
    // block; the drop index uses the same math as the DnD path.
    const onPointerDown = (e: PointerEvent): void => {
      if (this.host.readOnly || e.pointerType === "mouse" || e.button !== 0) return;
      if (this.pointerDrag) return;
      const grip = (e.target as HTMLElement).closest?.(".ez-block-actions") as HTMLElement | null;
      if (!grip) return;
      const active = this.holder.querySelector<HTMLElement>(".ez-block.ez-active");
      const id = active?.getAttribute("data-ez-block-id") ?? null;
      if (!id) return;
      this.pointerDrag = this.beginPointerDrag(id);
    };
    this.holder.addEventListener("pointerdown", onPointerDown);

    this.disposers.push(() => {
      this.holder.removeEventListener("dragover", onDragOver);
      this.holder.removeEventListener("dragleave", onDragLeave);
      this.holder.removeEventListener("drop", onDrop);
      this.holder.removeEventListener("dragend", onDragEnd);
      this.holder.removeEventListener("dragstart", onDragStart);
      this.holder.removeEventListener("pointerdown", onPointerDown);
      this.pointerDrag?.cleanup();
      this.pointerDrag = null;
    });
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.started = false;
  }

  /** Shared "insert at the target's edge" move (DnD drop and pointer drop). */
  private moveTo(dropId: string, below: boolean): void {
    const id = this.draggingId;
    if (!id) return;
    const from = this.host.getBlockIndex(id);
    const toIndex = this.host.getBlockIndex(dropId);
    let to = below ? toIndex + 1 : toIndex;
    // Convert "insert before/after the target in the ORIGINAL order"
    // into the shared FINAL-index convention before moving.
    if (from >= 0 && from < to) to -= 1;
    if (from !== to && from >= 0) {
      this.host.moveBlock(id, to);
      this.host.announce(`Block moved to position ${to + 1}`);
    }
  }

  /** Visual ghost + drop tracking driven by document-level pointer events. */
  private beginPointerDrag(id: string): { cleanup(): void } {
    const doc = this.holder.ownerDocument;
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
    const source = this.holder.querySelector<HTMLElement>(`[data-ez-block-id="${CSS.escape(id)}"]`);
    ghost.textContent = (source?.textContent ?? "").trim().slice(0, 80) || id;
    doc.body.appendChild(ghost);

    let highlighted: HTMLElement | null = null;
    const clearHighlight = (): void => {
      if (!highlighted) return;
      highlighted.classList.remove("ez-drop-target", "ez-below");
      highlighted.removeAttribute("data-ez-drop-below");
      highlighted = null;
    };

    const onMove = (e: PointerEvent): void => {
      if (this.host.readOnly) return;
      ghost.style.left = `${e.clientX + 12}px`;
      ghost.style.top = `${e.clientY + 12}px`;
      const target = this.blockFromPoint(e.clientX, e.clientY);
      const targetId = target?.getAttribute("data-ez-block-id") ?? "";
      if (!target || !targetId || targetId === id) {
        clearHighlight();
        return;
      }
      if (target !== highlighted) clearHighlight();
      const rect = target.getBoundingClientRect();
      const below = e.clientY > rect.top + rect.height / 2;
      target.classList.add("ez-drop-target");
      target.classList.toggle("ez-below", below);
      target.setAttribute("data-ez-drop-below", below ? "true" : "false");
      highlighted = target;
    };

    const finish = (): void => {
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerup", onUp);
      doc.removeEventListener("pointercancel", onCancel);
      ghost.remove();
      clearHighlight();
      this.draggingId = null;
      this.pointerDrag = null;
    };
    const onUp = (e: PointerEvent): void => {
      const target = this.blockFromPoint(e.clientX, e.clientY);
      const dropId = target?.getAttribute("data-ez-block-id") ?? "";
      const below = target?.getAttribute("data-ez-drop-below") === "true";
      finish();
      if (this.host.readOnly) return;
      if (!dropId || dropId === id) return;
      this.draggingId = id;
      this.moveTo(dropId, below);
      this.draggingId = null;
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
    while (node && node !== this.holder) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).hasAttribute?.("data-ez-block-id")) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  private blockFromPoint(x: number, y: number): HTMLElement | null {
    const doc = this.holder.ownerDocument;
    const element = doc.elementFromPoint(x, y);
    if (!element) return null;
    const block = element.closest<HTMLElement>("[data-ez-block-id]");
    return block && this.holder.contains(block) ? block : null;
  }
}
