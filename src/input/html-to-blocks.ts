import { domToInline } from "../rich-text/dom";
import type { InlineContent } from "../rich-text/types";

/**
 * HTML → blocks conversion for paste import. HTML is parsed with
 * DOMParser, dangerous nodes and attributes are removed, and inline
 * content is extracted as portable JSON. Parsed HTML never enters
 * document state directly and unsafe URLs are dropped during the
 * DOM→JSON walk.
 */

export interface ParsedBlock {
  type: string;
  data: Record<string, unknown>;
}

const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT",
  "TEMPLATE", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "OPTION",
  "SVG", "MATH", "CANVAS", "AUDIO", "VIDEO", "SOURCE", "TRACK", "MAP",
  "AREA", "APPLET", "DIALOG", "NAV", "ASIDE", "HEADER", "FOOTER"
]);

const INLINE_TAGS = new Set([
  "SPAN", "SMALL", "S", "SUB", "SUP", "BIG", "ABBR", "CITE", "Q", "TIME",
  "VAR", "SAMP", "KBD", "BDO", "FONT", "B", "STRONG", "I", "EM", "U",
  "CODE", "MARK", "A", "BR"
]);

const HEADINGS: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };

/** Sanitize in place: remove dangerous elements and all attributes. */
export function sanitizeParsedTree(root: Element): void {
  for (const node of Array.from(root.querySelectorAll("*"))) {
    if (DROP_TAGS.has(node.tagName)) {
      const parent = node.parentNode;
      if (parent) parent.removeChild(node);
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      node.removeAttribute(attr.name);
    }
  }
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment;
    if (comment.parentNode) comment.parentNode.removeChild(comment);
  }
}

/** Convert sanitized HTML into Ezynota block shapes. */
export function htmlToBlocks(html: string): ParsedBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeParsedTree(doc.body);
  return collectBlocks(doc.body);
}

function collectBlocks(body: Element): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let buffer: Node[] = [];

  const flushInline = (): void => {
    if (buffer.length === 0) return;
    const wrapper = body.ownerDocument.createElement("div");
    for (const node of buffer) wrapper.appendChild(node);
    const content = domToInline(wrapper);
    if (content.length > 0) {
      blocks.push({ type: "paragraph", data: { content } });
    }
    buffer = [];
  };

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim() !== "") buffer.push(node);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const elm = node as Element;
    const tag = elm.tagName;

    if (INLINE_TAGS.has(tag)) {
      buffer.push(node);
      continue;
    }
    flushInline();

    if (tag in HEADINGS) {
      const level = HEADINGS[tag] as number;
      const content = domToInline(elm);
      if (content.length > 0) blocks.push({ type: "heading", data: { level, content } });
    } else if (tag === "UL" || tag === "OL") {
      const items = Array.from(elm.children)
        .filter((c) => c.tagName === "LI")
        .map((li) => ({ content: domToInline(li) }));
      if (items.length > 0) {
        blocks.push({ type: "list", data: { style: tag === "OL" ? "ordered" : "unordered", items } });
      }
    } else if (tag === "BLOCKQUOTE") {
      const content = domToInline(elm);
      if (content.length > 0) blocks.push({ type: "quote", data: { content } });
    } else if (tag === "PRE") {
      const code = (elm.textContent ?? "").replace(/\n$/, "");
      blocks.push({ type: "code", data: { code } });
    } else if (tag === "HR") {
      blocks.push({ type: "delimiter", data: {} });
    } else if (tag === "TABLE") {
      for (const row of Array.from(elm.querySelectorAll("tr"))) {
        for (const cell of Array.from(row.querySelectorAll("th,td"))) {
          const content = domToInline(cell);
          if (content.length > 0) blocks.push({ type: "paragraph", data: { content } });
        }
      }
    } else if (tag === "IMG" || tag === "PICTURE") {
      continue;
    } else {
      const content = domToInline(elm);
      if (content.length > 0) blocks.push({ type: "paragraph", data: { content } });
    }
  }
  flushInline();
  return blocks;
}

/** Plain text → paragraph blocks (one per non-empty line). */
export function textToBlocks(text: string): ParsedBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const content: InlineContent[] = [{ type: "text", text: line }];
    blocks.push({ type: "paragraph", data: { content } });
  }
  return blocks;
}
