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
export declare class InputManager {
    private host;
    private target;
    private disposers;
    private lastInputAt;
    private composing;
    /** Cooldown state: the trailing `input` after compositionend must not double-emit. */
    private lastCompositionEndAt;
    private lastCompositionBlock;
    private onInputCallbacks;
    constructor(host: Host, target: HTMLElement);
    start(): void;
    stop(): void;
    private emitInput;
    onBlockInput(callback: (blockId: string) => void): () => void;
    private updateEmptyState;
    wasInputRecently(blockId: string, withinMs?: number): boolean;
}
