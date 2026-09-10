import type { Host } from "../host";

/**
 * DragManager: HTML5 drag & drop reordering of blocks, with a keyboard
 * alternative (Alt+ArrowUp/Down) handled by the keyboard manager.
 */
export class DragManager {
  private host: Host;
  private holder: HTMLElement;
  private started = false;
  private disposers: (() => void)[] = [];
  private draggingId: string | null = null;

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
    };

    const onDrop = (e: DragEvent): void => {
      if (this.host.readOnly) return;
      const target = this.blockFromEvent(e);
      if (!this.draggingId || !target) return;
      e.preventDefault();
      const dropId = target.getAttribute("data-ez-block-id") ?? "";
      const below = target.getAttribute("data-ez-drop-below") === "true";
      target.classList.remove("ez-drop-target", "ez-below");
      if (!dropId || dropId === this.draggingId) return;
      const from = this.host.getBlockIndex(this.draggingId);
      const toIndex = this.host.getBlockIndex(dropId);
      let to = below ? toIndex + 1 : toIndex;
      // Convert "insert before/after the target in the ORIGINAL order"
      // into the shared FINAL-index convention before moving.
      if (from >= 0 && from < to) to -= 1;
      if (from !== to && from >= 0) {
        this.host.moveBlock(this.draggingId, to);
        this.host.announce(`Block moved to position ${to + 1}`);
      }
      this.draggingId = null;
    };

    const onDragEnd = (): void => {
      this.draggingId = null;
      for (const el of Array.from(this.holder.querySelectorAll(".ez-drop-target, .ez-dragging"))) {
        el.classList.remove("ez-drop-target", "ez-below", "ez-dragging");
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

    this.disposers.push(() => {
      this.holder.removeEventListener("dragover", onDragOver);
      this.holder.removeEventListener("dragleave", onDragLeave);
      this.holder.removeEventListener("drop", onDrop);
      this.holder.removeEventListener("dragend", onDragEnd);
      this.holder.removeEventListener("dragstart", onDragStart);
    });
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.started = false;
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
}
