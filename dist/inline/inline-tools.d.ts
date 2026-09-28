import type { EditorSelection, InlineTool, InlineToolContext, InlineToolOptions } from "../types";
/** --- DOM helpers for inline formatting in contenteditable blocks --- */
export declare function exec(target: {
    ownerDocument: Document | null;
}, command: string, value?: string): void;
export declare function queryState(target: {
    ownerDocument: Document | null;
}, command: string): boolean;
/** Find ancestor element with a tag (or data-ez-mark) around selection. */
export declare function findAncestor(range: Range, editable: HTMLElement, predicate: (e: Element) => boolean): Element | null;
export declare function activeMarks(editable: HTMLElement): Set<string>;
/** Wrap a range in a new element and keep the content selected. */
export declare function wrapRange(range: Range, wrapper: HTMLElement): void;
/** Unwrap the element (move its children out) and select the content. */
export declare function unwrapElement(elm: Element): void;
/**
 * Unwrap a mark element for a selection that only PARTIALLY overlaps it:
 * the wrapper is split at the selection bounds so the outside parts keep
 * their formatting (a full unwrap removed the mark from the whole element).
 * Best effort — falls back to a full unwrap when the bounds are unclear.
 */
export declare function unwrapPartial(elm: Element, range: Range): void;
/**
 * Simple accessible popover anchored to an element. Returns the popover and
 * a close function; Escape and outside click close it.
 */
export declare function openPopover(content: HTMLElement, anchor: Range | HTMLElement, onClose?: () => void, trigger?: HTMLElement): {
    close: () => void;
};
/** Base class shared by simple mark-toggling inline tools. */
export declare abstract class MarkInlineTool implements InlineTool {
    abstract readonly markType: string;
    protected options: InlineToolOptions;
    protected node: HTMLElement | null;
    constructor(options: InlineToolOptions);
    render(): HTMLElement;
    protected abstract get labelKey(): string;
    /** Optional Lucide icon; a text label renders when undefined. */
    protected get icon(): string | undefined;
    abstract apply(range: Range, context: InlineToolContext): void;
    isActive(selection: EditorSelection): boolean;
    /** Toolbar uses this to sync the active visual state. */
    setActive(active: boolean): void;
    /** Toggle the mark on the current DOM selection; returns new state. */
    protected toggle(): void;
    destroy(): void;
}
/** Generic mark toggle for code / mark / custom marks. */
export declare class ToggleMarkTool extends MarkInlineTool {
    readonly markType: string;
    private tag;
    constructor(options: InlineToolOptions, markType: string, tag: string);
    protected get labelKey(): string;
    apply(range: Range, context: InlineToolContext): void;
}
export declare class BoldTool extends MarkInlineTool {
    readonly markType = "bold";
    protected get labelKey(): string;
    protected get icon(): string;
    apply(_range: Range, context: InlineToolContext): void;
    isActive(): boolean;
}
export declare class ItalicTool extends MarkInlineTool {
    readonly markType = "italic";
    protected get labelKey(): string;
    protected get icon(): string;
    apply(_range: Range, context: InlineToolContext): void;
    isActive(): boolean;
}
export declare class UnderlineTool extends MarkInlineTool {
    readonly markType = "underline";
    protected get labelKey(): string;
    protected get icon(): string;
    apply(_range: Range, context: InlineToolContext): void;
    isActive(): boolean;
}
export declare class CodeInlineTool extends ToggleMarkTool {
    constructor(options: InlineToolOptions);
    protected get icon(): string;
}
export declare class MarkTool extends ToggleMarkTool {
    constructor(options: InlineToolOptions);
    protected get icon(): string;
}
/** Strikethrough mark: `<s>` DOM, `strike` mark in JSON. */
export declare class StrikethroughTool extends ToggleMarkTool {
    constructor(options: InlineToolOptions);
    protected get icon(): string;
    apply(range: Range, context: InlineToolContext): void;
}
/** Shared palette for text and background color pickers. */
export declare const COLOR_PALETTE: readonly ["var(--ez-text)", "#ef4444", "#f97316", "#eab308", "#22c55e", "#ec4899", "#7c3aed", "transparent"];
/**
 * Color inline tool: applies a `color`/`background` mark with attrs to the
 * selection. The DOM renders via inline style; `data-ez-mark` keeps the
 * value portable in JSON.
 */
export declare abstract class ColorInlineToolBase extends MarkInlineTool {
    abstract readonly markType: string;
    protected get labelKey(): string;
    apply(range: Range, context: InlineToolContext): void;
    private promptForColor;
}
export declare class ColorTool extends ColorInlineToolBase {
    readonly markType: "color";
    protected get icon(): string;
}
export declare class BackgroundColorTool extends ColorInlineToolBase {
    readonly markType: "background";
    protected get icon(): string;
}
/** Link inline tool: popover with URL input; toggling removes existing links. */
export declare class LinkTool extends MarkInlineTool {
    readonly markType = "link";
    protected get labelKey(): string;
    protected get icon(): string;
    apply(range: Range, context: InlineToolContext): void;
    isActive(selection: EditorSelection): boolean;
    private promptForUrl;
}
export declare const BUILTIN_INLINE_TOOLS: {
    readonly bold: typeof BoldTool;
    readonly italic: typeof ItalicTool;
    readonly underline: typeof UnderlineTool;
    readonly strike: typeof StrikethroughTool;
    readonly code: typeof CodeInlineTool;
    readonly mark: typeof MarkTool;
    readonly color: typeof ColorTool;
    readonly background: typeof BackgroundColorTool;
    readonly link: typeof LinkTool;
};
