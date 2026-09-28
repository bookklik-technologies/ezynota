import type { JsonObject } from "../core/json";
export type TextNode = {
    type: "text";
    text: string;
    marks?: InlineMark[];
};
export type LinkNode = {
    type: "link";
    href: string;
    content: TextNode[];
};
export type InlineContent = TextNode | LinkNode;
export type InlineMark = {
    type: string;
    attrs?: JsonObject;
};
export type InlineContentCollection = {
    content: InlineContent[];
};
export declare function textNode(text: string, marks?: InlineMark[]): TextNode;
export declare function isTextNode(node: InlineContent): node is TextNode;
export declare function isLinkNode(node: InlineContent): node is LinkNode;
/** Human-readable plain text of inline content (used for copy, search, menus). */
export declare function inlineToPlainText(content: InlineContent[] | undefined): string;
export declare function isEmptyInline(content: InlineContent[] | undefined): boolean;
