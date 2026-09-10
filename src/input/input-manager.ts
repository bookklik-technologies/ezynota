import type { Host } from "../host";

/**
 * InputManager observes DOM input events inside contenteditable blocks and
 * drives the save-to-transaction flow:
 *   input -> tool.save() -> normalize -> validate -> transaction -> change
 * IME composition must never be interrupted — saves are deferred until
 * compositionend (spec §15). The DOM is not the source of truth; each input
 * flushes tool state into a transaction and the renderer decides whether
 * the DOM needs re-rendering (user edits do not).
 */
export class InputManager {
  private host: Host;
  private holder: HTMLElement;
  private disposers: (() => void)[] = [];
  private lastInputAt = new Map<string, number>();
  private composing = false;
  private onInputCallbacks: ((blockId: string) => void)[] = [];

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    const blockOf = (target: EventTarget | null): { id: string; editable: HTMLElement } | null => {
      let node = target as Node | null;
      while (node && node !== this.holder) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute?.("data-ez-editable")) {
            const block = el.closest("[data-ez-block-id]") as HTMLElement | null;
            if (block) return { id: block.getAttribute("data-ez-block-id") ?? "", editable: el };
          }
        }
        node = node.parentNode;
      }
      return null;
    };

    const onInput = (event: Event): void => {
      if (this.host.readOnly) return;
      const target = blockOf(event.target);
      if (!target) return;
      this.lastInputAt.set(target.id, Date.now());
      this.updateEmptyState(target.editable);
      if (this.composing) return; // Deferred until compositionend.
      this.emitInput(target.id);
    };

    const onCompositionStart = (): void => {
      this.composing = true;
    };

    const onCompositionEnd = (event: Event): void => {
      this.composing = false;
      const target = blockOf(event.target);
      if (target) {
        this.updateEmptyState(target.editable);
        this.emitInput(target.id);
      }
    };

    this.holder.addEventListener("input", onInput, true);
    this.holder.addEventListener("compositionstart", onCompositionStart, true);
    this.holder.addEventListener("compositionend", onCompositionEnd, true);

    this.disposers.push(() => {
      this.holder.removeEventListener("input", onInput, true);
      this.holder.removeEventListener("compositionstart", onCompositionStart, true);
      this.holder.removeEventListener("compositionend", onCompositionEnd, true);
    });
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.onInputCallbacks.length = 0;
  }

  private emitInput(blockId: string): void {
    this.host.requestSaveBlock(blockId, "user");
    for (const cb of Array.from(this.onInputCallbacks)) cb(blockId);
  }

  onBlockInput(callback: (blockId: string) => void): () => void {
    this.onInputCallbacks.push(callback);
    return () => {
      this.onInputCallbacks = this.onInputCallbacks.filter((cb) => cb !== callback);
    };
  }

  private updateEmptyState(editable: HTMLElement): void {
    const text = editable.textContent ?? "";
    const empty = text.replace(/\u200B/g, "").trim() === "";
    if (editable.hasAttribute("data-ez-placeholder")) {
      editable.setAttribute("data-ez-empty", empty ? "true" : "false");
    }
  }

  wasInputRecently(blockId: string, withinMs = 250): boolean {
    const at = this.lastInputAt.get(blockId);
    return at !== undefined && Date.now() - at < withinMs;
  }
}
