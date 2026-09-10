import type { Host } from "../host";
import { compositionEnded, compositionStarted } from "./composition";

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
  /** Cooldown state: the trailing `input` after compositionend must not double-emit. */
  private lastCompositionEndAt = 0;
  private lastCompositionBlock = "";
  private onInputCallbacks: ((blockId: string) => void)[] = [];

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    const blockOf = (target: EventTarget | null): { id: string; nestedId: string | null; editable: HTMLElement } | null => {
      let node = target as Node | null;
      while (node && node !== this.holder) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute?.("data-ez-editable")) {
            const block = el.closest("[data-ez-block-id]") as HTMLElement | null;
            if (block) {
              // Nested children (toggle sections) live inside the parent
              // block's DOM; their input must save the CHILD tool, not the
              // parent data (which does not contain child content).
              const nested = el.closest("[data-ez-nested-id]") as HTMLElement | null;
              const nestedId = nested && block.contains(nested) ? nested.getAttribute("data-ez-nested-id") : null;
              return { id: block.getAttribute("data-ez-block-id") ?? "", nestedId, editable: el };
            }
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
      if (target.nestedId) this.lastInputAt.set(target.nestedId, Date.now());
      this.updateEmptyState(target.editable);
      if (this.composing) return; // Deferred until compositionend.
      // Some engines fire a trailing `input` AFTER compositionend carrying
      // the same text — the compositionend emit already saved it.
      if (
        this.lastCompositionEndAt !== 0 &&
        Date.now() - this.lastCompositionEndAt < 50 &&
        (target.nestedId ?? target.id) === this.lastCompositionBlock
      ) {
        return;
      }
      this.emitInput(target.id, target.nestedId);
    };

    const onCompositionStart = (): void => {
      this.composing = true;
      compositionStarted();
    };

    const onCompositionEnd = (event: Event): void => {
      this.composing = false;
      compositionEnded();
      this.lastCompositionEndAt = Date.now();
      const target = blockOf(event.target);
      this.lastCompositionBlock = target ? target.nestedId ?? target.id : "";
      if (target) {
        this.updateEmptyState(target.editable);
        this.emitInput(target.id, target.nestedId);
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

  private emitInput(blockId: string, nestedId: string | null = null): void {
    if (nestedId) this.host.requestSaveNestedChild(blockId, nestedId);
    else this.host.requestSaveBlock(blockId, "user");
    for (const cb of Array.from(this.onInputCallbacks)) cb(nestedId ?? blockId);
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
    if (editable.hasAttribute("data-ez-placeholder") || editable.hasAttribute("data-ez-note-placeholder")) {
      editable.setAttribute("data-ez-empty", empty ? "true" : "false");
    }
  }

  wasInputRecently(blockId: string, withinMs = 250): boolean {
    const at = this.lastInputAt.get(blockId);
    return at !== undefined && Date.now() - at < withinMs;
  }
}
