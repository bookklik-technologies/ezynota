import type { InlineContent } from "../rich-text/types";

/**
 * Structural helpers shared by the keyboard manager and editor for
 * splitting, merging and converting block data shapes.
 */

export interface TextBlockToolLike {
  splitAtRange?(range: Range): [unknown, unknown] | null;
}

/** Extract the plain text carried by any built-in tool data shape. */
export function textContentOf(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.code === "string") return d.code;
  if (Array.isArray(d.items)) {
    return (d.items as { content?: InlineContent[] }[])
      .map((item) => textOfContent(item?.content ?? []))
      .join("\n");
  }
  if (Array.isArray(d.content)) return textOfContent(d.content as InlineContent[]);
  return "";
}

function textOfContent(content: InlineContent[]): string {
  let out = "";
  for (const node of content) {
    if (node?.type === "text") out += (node as { text?: string }).text ?? "";
    else if (node?.type === "link") {
      out += ((node as { content?: { text?: string }[] }).content ?? []).map((n) => n?.text ?? "").join("");
    }
  }
  return out;
}

/** Data shape a fresh block of a given type starts with. */
export function initialDataFor(type: string, content: InlineContent[] = []): Record<string, unknown> {
  switch (type) {
    case "paragraph":
    case "quote":
      return { content };
    case "heading":
      return { level: 2, content };
    case "list":
      return { style: "unordered", items: [{ content }] };
    case "code":
      return { code: textOfContent(content) };
    case "delimiter":
      return {};
    default:
      return { content };
  }
}

/** True when a block carries no user-visible content. */
export function dataIsEmpty(type: string, data: unknown): boolean {
  if (!data || typeof data !== "object") return true;
  if (type === "delimiter") return false;
  return textContentOf(data).trim() === "";
}

/** Convert data from one tool type into another built-in tool's shape. */
export function convertData(toType: string, data: unknown): Record<string, unknown> {
  const content = toInlineContent(data);
  switch (toType) {
    case "paragraph":
      return { content };
    case "heading":
      return { level: 2, content };
    case "quote":
      return { content };
    case "list":
      return { style: "unordered", items: content.length > 0 ? content.map((c) => ({ content: [c] })) : [{ content: [] }] };
    case "code":
      return { code: textOfContent(content) };
    case "delimiter":
      return {};
    default:
      return {};
  }
}

/** Flatten any built-in data shape into inline content. */
export function toInlineContent(data: unknown): InlineContent[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.content)) return d.content as InlineContent[];
  if (typeof d.code === "string") return d.code === "" ? [] : [{ type: "text", text: d.code }];
  if (Array.isArray(d.items)) {
    const out: InlineContent[] = [];
    for (const item of d.items as { content?: InlineContent[] }[]) {
      if (out.length > 0) out.push({ type: "text", text: "\n" });
      out.push(...(item?.content ?? []));
    }
    return out;
  }
  return [];
}

/** First list item's inline content (Notion-style merge: never flatten all items). */
function firstItemContent(data: unknown): InlineContent[] {
  const items = (data as { items?: { content?: InlineContent[] }[] })?.items;
  return items?.[0]?.content ?? [];
}

/**
 * Merge `current` block data into `prev` block data (state-level), used by
 * Backspace/Delete merges committed as a single transaction.
 */
export function mergeData(prevType: string, prevData: unknown, curType: string, curData: unknown): Record<string, unknown> {
  switch (prevType) {
    case "paragraph":
    case "heading":
    case "quote": {
      const content = toInlineContent(prevData);
      // Merging a list INTO a textual block keeps only the first item's
      // content — flattening every item destroyed the list structure.
      const incoming = curType === "list" ? firstItemContent(curData) : toInlineContent(curData);
      const needsBreak = content.length > 0 && incoming.length > 0;
      const merged = needsBreak ? [...content, { type: "text", text: "\n" }, ...incoming] : [...content, ...incoming];
      const result: Record<string, unknown> = { content: merged };
      if (prevType === "heading") result.level = (prevData as { level?: number }).level ?? 2;
      return result;
    }
    case "list": {
      const curContent = toInlineContent(curData);
      let items: { content: InlineContent[] }[];
      if (curType === "list") {
        items = [...prevItemsOf(prevData), ...prevItemsOf(curData)];
      } else {
        items = [...prevItemsOf(prevData), ...curContent.map((c) => ({ content: [c] }))];
      }
      return { style: (prevData as { style?: string }).style ?? "unordered", items };
    }
    case "code": {
      const prevCode = (prevData as { code?: string }).code ?? "";
      const curCode = textContentOf(curData);
      return { code: `${prevCode}\n${curCode}` };
    }
    default:
      return {};
  }
}

function prevItemsOf(data: unknown): { content: InlineContent[] }[] {
  const items = (data as { items?: { content?: InlineContent[] }[] })?.items ?? [];
  return items.map((item) => ({ content: item?.content ?? [] }));
}

/** Types that can merge into each other on Backspace/Delete. */
export function canMerge(prevType: string, curType: string): boolean {
  const textual = ["paragraph", "heading", "quote"];
  if (prevType === "list") return curType === "list" || textual.includes(curType);
  if (prevType === "code") return ["paragraph", "heading", "quote", "code"].includes(curType);
  if (textual.includes(prevType)) return [...textual, "list", "code"].includes(curType);
  return false;
}
