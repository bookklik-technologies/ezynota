import type { Host } from "../host";
/**
 * KeyboardManager implements the default keyboard behavior (spec §16):
 * Enter splits blocks, Shift+Enter inserts soft breaks, Backspace/Delete
 * merge compatible blocks, Ctrl/Cmd shortcuts dispatch commands, Alt+Arrows
 * move blocks (keyboard drag alternative), Escape closes menus. Every
 * behavior routes through commands and transactions — never direct DOM edits.
 */
export declare class KeyboardManager {
    private host;
    private target;
    private disposers;
    constructor(host: Host, target: HTMLElement);
    start(): void;
    stop(): void;
    /** Returns true when the event was handled and default must be prevented. */
    private handle;
    private inline;
    /**
     * Ctrl/Cmd+K: activate the link tool directly (preserving the selection)
     * so a collapsed caret outside a link still opens the link popover
     * instead of being swallowed as a no-op.
     */
    private handleLinkShortcut;
    /** True when a menu/popover is currently visible inside the surface. */
    private somethingOpen;
    /** Enter: split the block, or create a new one below for empty blocks. */
    private handleEnter;
    /** Shift+Enter: soft line break inside the editable. */
    private handleSoftBreak;
    /**
     * Split the current text block at the caret into two blocks — committed
     * as ONE transaction so a single undo restores the original block with
     * all of its text.
     */
    private splitAtSelection;
    private handleBackspace;
    /**
     * Delete mirrors Backspace at the caret's END: an empty block is removed
     * (focusing the next block) and a non-empty caret-at-end block merges
     * with the next block.
     */
    private handleDelete;
    /**
     * Tab inside a code block inserts spaces. Shift+Tab is the keyboard exit:
     * it moves focus out of the code block (creating a paragraph below when
     * the code block is last) so the editor never traps the keyboard.
     */
    private handleTab;
    private handleMoveBlock;
}
/** True when the caret sits at the logical start of the editable content. */
export declare function caretAtStart(editable: HTMLElement, range: Range | null): boolean;
/** True when the caret sits at the logical end of the editable content. */
export declare function caretAtEnd(editable: HTMLElement, range: Range | null): boolean;
