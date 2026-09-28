import type { Host } from "../host";
import type { BlockTool, BlockTune, EzynotaBlock, ChangeOrigin } from "../types";
import type { TextBlockToolLike } from "../input/tool-interfaces";
import type { TextBlockTool as TextTool } from "../tools/text-tools";
export interface RenderedBlock {
    element: HTMLElement;
    host: HTMLElement;
    tool: TextTool | (BlockTool & Partial<TextBlockToolLike>);
    tunes: {
        name: string;
        instance: BlockTune;
    }[];
}
/**
 * Renderer: the DOM is a view of document state. It renders each block
 * exactly once and re-renders only affected blocks after transactions.
 * MutationObserver exists purely as a fallback and is suppressed while
 * the renderer itself mutates the DOM.
 */
export declare class Renderer {
    private hostApi;
    private target;
    private blocksRoot;
    private rendered;
    /** Cached JSON of each block's children, compared on updates to detect child changes. */
    private childrenSignatures;
    /** Cached block type + data signature, used to apply tune updates without a rebuild. */
    private blockSignatures;
    private tuneSignatures;
    private suspended;
    private observer;
    private destroyed;
    constructor(hostApi: Host, target: HTMLElement);
    /** Re-render (or re-render) the full document. */
    renderAll(blocks: EzynotaBlock[]): void;
    private destroyToolDom;
    /** Create DOM for a single block at its state index. */
    insert(block: EzynotaBlock, index: number, origin: ChangeOrigin): void;
    remove(id: string): void;
    move(id: string, to: number): void;
    update(id: string, origin: ChangeOrigin): void;
    private callUpdated;
    convert(id: string, block: EzynotaBlock): void;
    /**
     * Non-destructive tune update: when only the tunes changed (the block
     * type and data are unchanged), apply the tune values to the existing
     * wrap element instead of destroying and rebuilding the tool. Used by
     * editor.applyToDom for tune:update (e.g. alignment clicks and undo/redo).
     */
    private applyTuneUpdate;
    private stateIndexOf;
    private renderBlockInto;
    /** Instantiate the block tool. */
    private createToolInstance;
    /** Instantiate a block tool for a nested child (collapsible sections). */
    createToolInstancePublic(block: EzynotaBlock, element: HTMLElement, _parentId: string, api?: import("../types").BlockAPI): BlockTool;
    private blockApiForTool;
    private blockApiFor;
    private getToolHost;
    /** Focus the tool's primary editable element. */
    focus(id: string, at?: "start" | "end"): void;
    getTool(id: string): BlockTool | undefined;
    getEditableElement(id: string): HTMLElement | null;
    getBlockElement(id: string): HTMLElement | null;
    setReadOnly(readOnly: boolean): void;
    /** Fallback: catch DOM changes that bypass the input flow. Only the
     * block(s) that own the mutated DOM nodes are reported. */
    startObserver(onFallbackSave: (id: string) => void): void;
    stopObserver(): void;
    destroy(): void;
    private suspend;
    private resume;
    private updateEmptyHint;
    private refreshEditableFlags;
    /**
     * The note placeholder is only meaningful on a fresh note: when the
     * document contains exactly one block, its primary editable carries
     * `data-ez-note-placeholder` (shown by CSS while empty). In any other
     * situation empty blocks render as plain empty space.
     */
    private refreshPlaceholderScope;
}
