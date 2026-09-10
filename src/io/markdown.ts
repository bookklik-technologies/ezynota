import type { EzynotaBlock, InlineContent, JsonValue } from "../types";
import { isLinkNode, isTextNode, textNode } from "../rich-text/types";
import type { InlineMark } from "../rich-text/types";
import type { ParsedBlock } from "../input/html-to-blocks";
import { isSafeUrl, isSafeImageUrl } from "../core/url";

/**
 * Markdown interchange. Export covers headings, nested lists (including
 * tasks), quotes, code fences, dividers, tables, images, callouts and
 * internal note links (`note:<id>`). Import is a line-based parser that
 * reuses the same block shapes, so round trips stay editable.
 */

/* ---------- inline serialization ---------- */

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

/**
 * Escape an href for Markdown link/image destinations. A ")" or newline
 * truncates `[text](href)`, so percent-encode parens, whitespace and
 * angle brackets (plain percent-encoded destinations still round trip
 * through the import parser).
 */
function escapeMarkdownHref(href: string): string {
  if (!/[\s()<>]/.test(href)) return href;
  return href.replace(/%/g, "%25").replace(/[\s()<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/** Known callout variants (mirrors src/tools/callout-tool.ts). */
const CALLOUT_VARIANTS = new Set(["info", "warning", "success", "danger"]);

function marksToString(marks: InlineMark[], text: string): string {
  let out = escapeText(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold": out = `**${out}**`; break;
      case "italic": out = `*${out}*`; break;
      case "code": out = `\`${out}\``; break;
      case "strike": out = `~~${out}~~`; break;
      case "mark": out = `==${out}==`; break;
      case "link": {
        const href = String((mark.attrs as { href?: string } | undefined)?.href ?? "");
        out = `[${out}](${escapeMarkdownHref(href)})`;
        break;
      }
      case "color": {
        const color = String((mark.attrs as { color?: string } | undefined)?.color ?? "");
        out = `{${color}|${out}}`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function inlineToMarkdown(content: InlineContent[] | undefined, noteLinkTitles?: Map<string, string>): string {
  if (!content) return "";
  let out = "";
  for (const node of content) {
    if (isTextNode(node)) {
      out += node.text.split("\n").map((line) => marksToString(node.marks ?? [], line)).join("\n");
    } else if (isLinkNode(node)) {
      const href = node.href;
      const text = node.content.map((n) => n.text).join("");
      if (href.startsWith("note:")) {
        const noteId = href.slice("note:".length);
        const label = noteLinkTitles?.get(noteId) ?? text;
        out += `[${label}](${escapeMarkdownHref(`note:${noteId}`)})`;
      } else if (isSafeUrl(href)) {
        out += `[${escapeText(text)}](${escapeMarkdownHref(href)})`;
      } else {
        out += escapeText(text);
      }
    }
  }
  return out;
}

/* ---------- block serialization ---------- */

export function blocksToMarkdown(
  blocks: EzynotaBlock[],
  options?: { noteLinkTitles?: Map<string, string>; indent?: string }
): string {
  const indent = options?.indent ?? "";
  const lines: string[] = [];
  for (const block of blocks) {
    const data = block.data as Record<string, unknown>;
    switch (block.type) {
      case "heading": {
        const level = Math.min(6, Math.max(1, Number(data.level) || 1));
        lines.push(`${indent}${"#".repeat(level)} ${inlineToMarkdown(data.content as InlineContent[], options?.noteLinkTitles)}`);
        break;
      }
      case "paragraph":
        lines.push(...inlineToMarkdown(data.content as InlineContent[], options?.noteLinkTitles).split("\n").map((l) => `${indent}${l}`));
        break;
      case "quote":
        for (const line of inlineToMarkdown(data.content as InlineContent[], options?.noteLinkTitles).split("\n")) {
          lines.push(`${indent}> ${line}`);
        }
        break;
      case "code":
        lines.push(`${indent}\`\`\``);
        for (const line of String(data.code ?? "").split("\n")) lines.push(`${indent}${line}`);
        lines.push(`${indent}\`\`\``);
        break;
      case "delimiter":
        lines.push(`${indent}---`);
        break;
      case "list": {
        const style = data.style === "ordered" ? "ordered" : (data as { style?: string }).style === "task" ? "task" : "unordered";
        const rawItems: unknown = data.items;
        const items = Array.isArray(rawItems) ? (rawItems as { content: InlineContent[]; checked?: boolean }[]) : [];
        items.forEach((item, i) => {
          const marker = style === "ordered" ? `${i + 1}. ` : style === "task" ? (item.checked ? "- [x] " : "- [ ] ") : "- ";
          lines.push(`${indent}${marker}${inlineToMarkdown(item.content, options?.noteLinkTitles)}`);
        });
        break;
      }
      case "table": {
        const table = data as { rows?: JsonValue; header?: boolean };
        const rawRows: unknown = table.rows;
        const rows = Array.isArray(rawRows) ? (rawRows as InlineContent[][][]) : [];
        if (rows.length > 0) {
          rows.forEach((row, rowIndex) => {
            const cells = (row as { content?: InlineContent[] }[]).map((cell) => inlineToMarkdown(cell.content as InlineContent[], options?.noteLinkTitles));
            lines.push(`${indent}| ${cells.join(" | ")} |`);
            if (rowIndex === 0 && table.header !== false) {
              lines.push(`${indent}|${cells.map(() => " --- ").join("|")}|`);
            }
          });
        }
        break;
      }
      case "image": {
        const src = String(data.src ?? "");
        const alt = String(data.alt ?? "");
        if (isSafeImageUrl(src) || src.startsWith("asset:")) {
          lines.push(`${indent}![${escapeText(alt)}](${escapeMarkdownHref(src)})`);
        }
        if (typeof data.caption === "string" && data.caption !== "") lines.push(`${indent}*${escapeText(data.caption)}*`);
        break;
      }
      case "callout": {
        const rawVariant = String(data.variant ?? "info");
        const variant = CALLOUT_VARIANTS.has(rawVariant) ? rawVariant : "info";
        lines.push(`${indent}> [!${variant.toUpperCase()}]`);
        for (const line of inlineToMarkdown(data.content as InlineContent[], options?.noteLinkTitles).split("\n")) {
          lines.push(`${indent}> ${line}`);
        }
        break;
      }
      case "toggle": {
        lines.push(`${indent}### ${inlineToMarkdown(data.heading as InlineContent[], options?.noteLinkTitles)}`);
        if (Array.isArray(block.children)) {
          const inner = blocksToMarkdown(block.children, { ...options, indent: `${indent}  ` });
          if (inner !== "") lines.push(inner);
        }
        break;
      }
      default:
        break;
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------- inline parsing ---------- */

interface ParsedInline {
  text: string;
  marks: InlineMark[];
}

/** Parse a single line of Markdown inline content into rich text. */
export function parseMarkdownInline(line: string, baseUrl?: string): InlineContent[] {
  const tokens: ParsedInline[] = parseInlineTokens(line);
  const out: InlineContent[] = [];
  for (const token of tokens) {
    if (token.marks.some((m) => m.type === "link")) {
      const link = token.marks.find((m) => m.type === "link")!;
      const href = String((link.attrs as { href?: string } | undefined)?.href ?? "");
      const rest = token.marks.filter((m) => m !== link);
      const inner: InlineContent = { type: "text", text: token.text };
      if (rest.length > 0) (inner as { marks?: InlineMark[] }).marks = rest;
      if (isSafeUrl(resolveHref(href, baseUrl))) {
        out.push({ type: "link", href: resolveHref(href, baseUrl), content: [inner as { type: "text"; text: string }] });
      } else {
        out.push(textNode(token.text, rest.length > 0 ? rest : undefined));
      }
    } else {
      out.push(textNode(token.text, token.marks.length > 0 ? token.marks : undefined));
    }
  }
  return out;
}

function resolveHref(href: string, baseUrl?: string): string {
  if (href.startsWith("note:") || !baseUrl) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseInlineTokens(line: string): ParsedInline[] {
  const out: ParsedInline[] = [];
  let text = "";
  let marks: InlineMark[] = [];
  const flush = (): void => {
    if (text !== "") {
      out.push({ text, marks });
      text = "";
      marks = [];
    }
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest.startsWith("**")) {
      const end = line.indexOf("**", i + 2);
      if (end > i) {
        flush();
        out.push({ text: line.slice(i + 2, end), marks: [{ type: "bold" }] });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "*" && !rest.startsWith("* ")) {
      const end = line.indexOf("*", i + 1);
      if (end > i) {
        flush();
        out.push({ text: line.slice(i + 1, end), marks: [{ type: "italic" }] });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith("~~")) {
      const end = line.indexOf("~~", i + 2);
      if (end > i) {
        flush();
        out.push({ text: line.slice(i + 2, end), marks: [{ type: "strike" }] });
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith("==")) {
      const end = line.indexOf("==", i + 2);
      if (end > i) {
        flush();
        out.push({ text: line.slice(i + 2, end), marks: [{ type: "mark" }] });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ text: line.slice(i + 1, end), marks: [{ type: "code" }] });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith("[!")) {
      // Callout markers are handled at block level; skip literal.
      text += line[i]!;
      i++;
      continue;
    }
    if (line[i] === "[") {
      const close = line.indexOf("]", i + 1);
      if (close > i && line[close + 1] === "(") {
        const end = line.indexOf(")", close + 2);
        if (end > close) {
          const label = line.slice(i + 1, close);
          const href = line.slice(close + 2, end);
          if (label.startsWith("!")) {
            // image inside text — render as text reference
            flush();
            out.push({ text: label.slice(1), marks: [] });
          } else {
            flush();
            out.push({ text: label, marks: [{ type: "link", attrs: { href } }] });
          }
          i = end + 1;
          continue;
        }
      }
    }
    if (rest.startsWith("\\[")) {
      text += "[";
      i += 2;
      continue;
    }
    text += line[i]!;
    i++;
  }
  flush();
  return out;
}

/* ---------- block parsing ---------- */

/** Parse Markdown text into Ezynota block shapes. */
export function markdownToBlocks(markdown: string, baseUrl?: string): ParsedBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Fenced code
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "code", data: { code: codeLines.join("\n") } });
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({ type: "heading", data: { level: headingMatch[1]!.length, content: parseMarkdownInline(headingMatch[2]!, baseUrl) } });
      i++;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "delimiter", data: {} });
      i++;
      continue;
    }

    // Blockquote / callout
    if (trimmed.startsWith(">")) {
      const calloutMatch = /^>\s*\[!(\w+)\]/.exec(trimmed);
      const quoteLines: string[] = [];
      if (calloutMatch) {
        i++;
        while (i < lines.length && lines[i]!.trim().startsWith(">")) {
          quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
          i++;
        }
        blocks.push({ type: "callout", data: { variant: calloutMatch[1]!.toLowerCase(), content: quoteLines.flatMap((l) => parseMarkdownInline(l, baseUrl)) } });
        continue;
      }
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", data: { content: parseMarkdownInline(quoteLines.join(" "), baseUrl) } });
      continue;
    }

    // Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        tableLines.push(lines[i]!.trim());
        i++;
      }
      const parsed = parseTable(tableLines, baseUrl);
      if (parsed) blocks.push(parsed);
      continue;
    }

    // Lists (with simple nesting by indentation)
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line) || /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const indentOf = (l: string): number => l.length - l.trimStart().length;
      const baseIndent = indentOf(line);
      const items: { content: never[]; checked?: boolean }[] = [];
      let ordered = false;
      let task = false;
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!) && indentOf(lines[i]!) >= baseIndent) {
        const l = lines[i]!;
        const taskMatch = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(l);
        if (taskMatch) {
          task = true;
          items.push({ content: parseMarkdownInline(taskMatch[2]!, baseUrl) as never, checked: taskMatch[1] !== " " });
          i++;
          continue;
        }
        const itemMatch = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(l)!;
        if (/\d/.test(itemMatch[1]!)) ordered = true;
        items.push({ content: parseMarkdownInline(itemMatch[2]!, baseUrl) as never });
        i++;
      }
      if (items.length > 0) {
        blocks.push({ type: "list", data: { style: task ? "task" : ordered ? "ordered" : "unordered", items } });
      }
      continue;
    }

    // Image
    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (imageMatch) {
      blocks.push({ type: "image", data: { alt: imageMatch[1]!, src: imageMatch[2]! } });
      i++;
      continue;
    }

    // Paragraph (consume until blank line)
    if (trimmed === "") {
      i++;
      continue;
    }
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^\s*([-*+]|\d+[.)]|>|#{1,6}\s|```|\|)/.test(lines[i]!)) {
      paragraphLines.push(lines[i]!.trim());
      i++;
    }
    if (paragraphLines.length === 0) {
      // The line matched a rejection pattern but no specialized branch
      // consumed it (e.g. "*", "-", "1.", "*a", "| x"). Consume it
      // unconditionally as plain text — otherwise `i` never advances and
      // the parser hangs forever.
      paragraphLines.push(trimmed);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", data: { content: parseMarkdownInline(paragraphLines.join(" "), baseUrl) } });
    }
  }
  return blocks;
}

function parseTable(tableLines: string[], baseUrl?: string): ParsedBlock | null {
  if (tableLines.length === 0) return null;
  const cellsOf = (row: string): string[] =>
    row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const headerCells = cellsOf(tableLines[0]!);
  const hasSeparator = tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1] ?? "");
  const bodyLines = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);
  const rows: { content: InlineContent[] }[][] = [];
  const headerRow = headerCells.map((cell) => ({ content: parseMarkdownInline(cell, baseUrl) }));
  // With a separator the first row is a real header; without one the first
  // line is still content — emit it as a body row instead of dropping it.
  rows.push(headerRow);
  for (const line of bodyLines) {
    rows.push(cellsOf(line).map((cell) => ({ content: parseMarkdownInline(cell, baseUrl) })));
  }
  return { type: "table", data: { header: hasSeparator, rows } };
}
