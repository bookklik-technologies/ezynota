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

export function textNode(text: string, marks?: InlineMark[]): TextNode {
  const node: TextNode = { type: "text", text };
  if (marks && marks.length > 0) node.marks = marks;
  return node;
}

export function isTextNode(node: InlineContent): node is TextNode {
  return node.type === "text";
}

export function isLinkNode(node: InlineContent): node is LinkNode {
  return (node as LinkNode).type === "link" && Array.isArray((node as LinkNode).content);
}

/** Human-readable plain text of inline content (used for copy, search, menus). */
export function inlineToPlainText(content: InlineContent[] | undefined): string {
  if (!content) return "";
  let out = "";
  for (const node of content) {
    if (isTextNode(node)) out += node.text;
    else if (isLinkNode(node)) out += node.content.map((n) => n.text).join("");
  }
  return out;
}

export function isEmptyInline(content: InlineContent[] | undefined): boolean {
  return inlineToPlainText(content).trim() === "";
}
