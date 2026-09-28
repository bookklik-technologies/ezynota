import type { InlineContent } from "./types";
/** Mark type → rendering element tag. */
export declare const MARK_TAGS: Record<string, string>;
/**
 * Render-safe href check: mirrors io/print.ts — internal `note:` links are
 * allowed alongside the isSafeUrl protocol allowlist.
 */
export declare function isRenderableHref(href: unknown): boolean;
/** Render inline JSON content into a detached DOM tree. */
export declare function inlineToDom(content: InlineContent[] | undefined, doc?: Document): DocumentFragment;
/** Convert a contenteditable element (or subtree) into inline JSON content. */
export declare function domToInline(root: Node): InlineContent[];
/**
 * Convert inline content into an HTML string for clipboard export.
 * The DOM is built with createElement (never innerHTML with untrusted
 * data), so serialization is safe.
 */
export declare function inlineToHtmlString(content: InlineContent[] | undefined): string;
/**
 * Extract the inline JSON after a caret range and leave the prefix in the
 * editable element, preserving marks. Used for block splitting.
 */
export declare function splitDomEditableAtRange(editable: HTMLElement, range: Range): {
    before: InlineContent[];
    after: InlineContent[];
};
/** Find the enclosing safe link element for the current selection. */
export declare function findLinkAtSelection(editable: HTMLElement): {
    href: string;
    element: Element;
} | null;
export declare function isEmptyInlineValue(content: InlineContent[] | undefined): boolean;
