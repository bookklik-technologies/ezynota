import type { InlineContent, InlineMark, TextNode } from "./types";
import { isLinkNode, isTextNode, textNode } from "./types";
import { normalizeInline } from "./normalize";
import { isSafeUrl } from "../core/url";

/** Mark type → rendering element tag. */
export const MARK_TAGS: Record<string, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  code: "code",
  mark: "mark",
  strike: "s"
};

const TAG_TO_MARK: Record<string, string> = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
  CODE: "code",
  MARK: "mark",
  S: "strike",
  DEL: "strike"
};

const BLOCKISH_TAGS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE", "UL", "OL"]);

/**
 * Render-safe href check: mirrors io/print.ts — internal `note:` links are
 * allowed alongside the isSafeUrl protocol allowlist.
 */
export function isRenderableHref(href: unknown): boolean {
  return typeof href === "string" && (isSafeUrl(href) || href.startsWith("note:"));
}

/**
 * Defense-in-depth for rendering untrusted inline content (clipboard JSON,
 * imported documents): link nodes with unsafe hrefs are unwrapped to their
 * inner text and link marks carrying unsafe hrefs are stripped.
 */
function stripUnsafeLinks(content: InlineContent[] | undefined): InlineContent[] {
  if (!content) return [];
  const out: InlineContent[] = [];
  for (const node of content) {
    if (isLinkNode(node)) {
      if (!isRenderableHref(node.href)) {
        out.push(...stripUnsafeLinks(node.content));
      } else {
        out.push({ type: "link", href: node.href, content: stripUnsafeLinks(node.content) as TextNode[] });
      }
      continue;
    }
    if (isTextNode(node)) {
      const marks = node.marks?.filter((mark) => {
        if (mark.type !== "link") return true;
        const href = (mark.attrs as { href?: unknown } | undefined)?.href ?? (mark as { href?: unknown }).href;
        return isRenderableHref(href);
      });
      if (marks && marks.length !== (node.marks?.length ?? 0)) {
        const cleaned: TextNode = { type: "text", text: node.text };
        if (marks.length > 0) cleaned.marks = marks;
        out.push(cleaned);
        continue;
      }
    }
    out.push(node);
  }
  return out;
}

/** Render inline JSON content into a detached DOM tree. */
export function inlineToDom(content: InlineContent[] | undefined, doc: Document = document): DocumentFragment {
  const frag = doc.createDocumentFragment();
  if (!content) return frag;
  for (const node of normalizeInline(stripUnsafeLinks(content))) {
    if (isTextNode(node)) {
      frag.appendChild(buildMarked(node, node.marks ?? [], doc));
    } else if (isLinkNode(node)) {
      // Unsafe hrefs never reach the DOM: the text survives, the link does not.
      if (!isRenderableHref(node.href)) {
        for (const child of node.content) {
          frag.appendChild(buildMarked(child, child.marks ?? [], doc));
        }
        continue;
      }
      const a = doc.createElement("a");
      a.setAttribute("href", node.href);
      a.setAttribute("rel", "noopener noreferrer");
      for (const child of node.content) {
        a.appendChild(buildMarked(child, child.marks ?? [], doc));
      }
      frag.appendChild(a);
    }
  }
  return frag;
}

function buildMarked(node: TextNode, marks: InlineMark[], doc: Document): Node {
  if (marks.length === 0) {
    return doc.createTextNode(node.text);
  }
  const [first, ...rest] = marks;
  const tag = MARK_TAGS[first!.type] ?? "span";
  const el = doc.createElement(tag);
  if (!MARK_TAGS[first!.type]) {
    el.setAttribute("data-ez-mark", first!.type);
    const attrs = first!.attrs;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (typeof v === "string" || typeof v === "number") {
          el.setAttribute(`data-ez-${kebab(k)}`, String(v));
          if (first!.type === "color" && k === "color") el.style.color = String(v);
          if (first!.type === "background" && k === "color") el.style.backgroundColor = String(v);
        }
      }
    }
  }
  if (rest && rest.length > 0) {
    el.appendChild(buildMarked(node, rest, doc));
  } else {
    el.textContent = node.text;
  }
  return el;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Convert a contenteditable element (or subtree) into inline JSON content. */
export function domToInline(root: Node): InlineContent[] {
  const out: InlineContent[] = [];
  walkInline(root, [], out);
  return normalizeInline(groupLinks(out));
}

/** Rebuild LinkNode structures from link marks gathered during the walk. */
function groupLinks(nodes: InlineContent[]): InlineContent[] {
  const out: InlineContent[] = [];
  let currentLink: { type: "link"; href: string; content: TextNode[] } | null = null;
  for (const node of nodes) {
    if (isTextNode(node) && node.marks?.some((m) => m.type === "link")) {
      const linkMark = node.marks.find((m) => m.type === "link")!;
      const href = String((linkMark.attrs as { href?: unknown } | undefined)?.href ?? "");
      const restMarks = node.marks.filter((m) => m !== linkMark);
      const inner: TextNode = { type: "text", text: node.text };
      if (restMarks.length > 0) inner.marks = restMarks;
      if (!currentLink || currentLink.href !== href) {
        currentLink = { type: "link", href, content: [] };
        out.push(currentLink);
      }
      currentLink.content.push(inner);
      continue;
    }
    currentLink = null;
    out.push(node);
  }
  return out;
}

function walkInline(node: Node, marks: InlineMark[], out: InlineContent[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (text !== "") out.push(textNode(text, marks.length ? marks : undefined));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName;
  if (tag === "BR") {
    out.push(textNode("\n", marks.length ? marks : undefined));
    return;
  }
  if (BLOCKISH_TAGS.has(tag)) {
    // Block boundaries inside an editable act as soft breaks.
    if ((el.textContent ?? "").trim() !== "" && out.length > 0) {
      out.push(textNode("\n", undefined));
    }
  }
  const childMarks = marksForElement(el, marks);
  for (const child of Array.from(el.childNodes)) {
    walkInline(child, childMarks, out);
  }
}

function marksForElement(el: Element, marks: InlineMark[]): InlineMark[] {
  const tag = el.tagName;
  let next = marks;
  const markType = TAG_TO_MARK[tag];
  if (markType) {
    next = [...next, { type: markType }];
  }
  if (tag === "A") {
    const href = el.getAttribute("href") ?? "";
    if (isRenderableHref(href)) {
      next = [...next, { type: "link", attrs: { href } }];
    }
    // Unsafe hrefs are dropped; text content is preserved.
  }
  const custom = el.getAttribute("data-ez-mark");
  if (custom) {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-ez-") && attr.name !== "data-ez-mark") {
        // "data-ez-" is 8 characters — slice(8) avoids a leading dash that
        // camel() would capitalize ("data-ez-href" → "Href").
        attrs[camel(attr.name.slice(8))] = attr.value;
      }
    }
    next = [...next, { type: custom, attrs: Object.keys(attrs).length > 0 ? attrs : undefined } as InlineMark];
  }
  return next;
}

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert inline content into an HTML string for clipboard export.
 * The DOM is built with createElement (never innerHTML with untrusted
 * data), so serialization is safe.
 */
export function inlineToHtmlString(content: InlineContent[] | undefined): string {
  if (typeof document === "undefined" || !content) return "";
  const div = document.createElement("div");
  div.appendChild(inlineToDom(content, document));
  return div.innerHTML;
}

/**
 * Extract the inline JSON after a caret range and leave the prefix in the
 * editable element, preserving marks. Used for block splitting.
 */
export function splitDomEditableAtRange(
  editable: HTMLElement,
  range: Range
): { before: InlineContent[]; after: InlineContent[] } {
  const doc = editable.ownerDocument ?? document;
  const afterRange = doc.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEndAfter(editable);

  const afterFrag = afterRange.extractContents();
  const afterDiv = doc.createElement("div");
  afterDiv.appendChild(afterFrag);
  const after = domToInline(afterDiv);

  const before = domToInline(editable);
  return { before, after };
}

/** Find the enclosing safe link element for the current selection. */
export function findLinkAtSelection(editable: HTMLElement): { href: string; element: Element } | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  while (node && node !== editable) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "A") {
      const href = (node as Element).getAttribute("href") ?? "";
      if (isRenderableHref(href)) return { href, element: node as Element };
    }
    node = node.parentNode;
  }
  return null;
}

export function isEmptyInlineValue(content: InlineContent[] | undefined): boolean {
  if (!content) return true;
  const text = content
    .map((n) => (isTextNode(n) ? n.text : isLinkNode(n) ? n.content.map((c) => c.text).join("") : ""))
    .join("");
  return text.replace(/\u200B/g, "").trim() === "";
}
