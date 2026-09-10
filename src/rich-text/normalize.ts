import type { InlineContent, InlineMark, TextNode } from "./types";
import { isLinkNode, isTextNode, textNode } from "./types";

const MARK_ORDER = ["bold", "italic", "underline", "code", "mark"];

function markKey(mark: InlineMark): string {
  return mark.attrs ? `${mark.type}:${JSON.stringify(mark.attrs)}` : mark.type;
}

/**
 * Normalize inline content: drop empty nodes, merge adjacent text nodes with
 * identical marks, unwrap empty links. Deterministic output for saving.
 */
export function normalizeInline(content: InlineContent[] | undefined | null): InlineContent[] {
  if (!content) return [];
  const out: InlineContent[] = [];
  for (const raw of content) {
    if (isLinkNode(raw)) {
      const inner = normalizeInline(raw.content) as TextNode[];
      if (inner.length === 0 || inner.every((n) => n.text === "")) continue;
      out.push({ type: "link", href: raw.href, content: inner });
      continue;
    }
    const node = raw as TextNode;
    if (typeof node.text !== "string") continue;
    if (node.text === "") continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      isTextNode(prev) &&
      isTextNode(node) &&
      sameMarks(prev.marks, node.marks)
    ) {
      prev.text += node.text;
    } else if (isTextNode(node)) {
      const normalized: TextNode = { type: "text", text: node.text };
      const marks = normalizeMarks(node.marks);
      if (marks) normalized.marks = marks;
      out.push(normalized);
    } else {
      out.push(node);
    }
  }
  // Text nodes with newline characters are preserved; block tools decide.
  return out;
}

function normalizeMarks(marks: InlineMark[] | undefined): InlineMark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  const seen = new Set<string>();
  const out: InlineMark[] = [];
  for (const mark of marks) {
    const key = markKey(mark);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(mark);
    }
  }
  out.sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
  return out;
}

function sameMarks(a: InlineMark[] | undefined, b: InlineMark[] | undefined): boolean {
  const ka = (a ?? []).map(markKey).sort().join(",");
  const kb = (b ?? []).map(markKey).sort().join(",");
  return ka === kb;
}

/**
 * Split inline content at a plain-text offset (used for splitting blocks,
 * merging and pasting into text). Returns [before, after].
 */
export function splitInlineAtOffset(
  content: InlineContent[],
  offset: number
): [InlineContent[], InlineContent[]] {
  if (offset <= 0) return [[], normalizeInline(content)];
  const before: InlineContent[] = [];
  const after: InlineContent[] = [];
  let consumed = 0;
  for (const node of content) {
    const text = isTextNode(node) ? node.text : node.content.map((n) => n.text).join("");
    if (consumed >= offset) {
      after.push(node);
      continue;
    }
    if (consumed + text.length <= offset) {
      before.push(node);
      consumed += text.length;
      continue;
    }
    const splitAt = offset - consumed;
    if (isTextNode(node)) {
      before.push(textNode(node.text.slice(0, splitAt), node.marks));
      after.push(textNode(node.text.slice(splitAt), node.marks));
    } else {
      const beforeText = node.content.map((n) => n.text).join("").slice(0, splitAt);
      const afterText = node.content.map((n) => n.text).join("").slice(splitAt);
      before.push({ type: "link", href: node.href, content: [textNode(beforeText, node.content[0]?.marks)] });
      after.push({ type: "link", href: node.href, content: [textNode(afterText, node.content[0]?.marks)] });
    }
    consumed += text.length;
  }
  return [normalizeInline(before), normalizeInline(after)];
}

/** Convert inline content to plain text with a soft-break marker. */
export function inlineToTextWithBreaks(content: InlineContent[]): string {
  let out = "";
  for (const node of content) {
    if (isTextNode(node)) out += node.text;
    else if (isLinkNode(node)) out += node.content.map((n) => n.text).join("");
  }
  return out;
}

export { textNode as makeText };
