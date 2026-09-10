import type { BlockAPI, InlineContent } from "../types";
export type DataShape = Record<string, unknown> & { [key: string]: unknown };

/** Extract the "text payload" of common tool data shapes. */
function contentOf(data: unknown): InlineContent[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.content)) return d.content as InlineContent[];
  if (typeof d.code === "string") {
    const lines = d.code.split("\n");
    return lines.length > 0 ? [{ type: "text", text: d.code } as InlineContent] : [];
  }
  if (Array.isArray(d.items)) {
    const items = d.items as { content?: InlineContent[] }[];
    const out: InlineContent[] = [];
    for (const item of items) {
      if (out.length > 0) out.push({ type: "text", text: "\n" });
      out.push(...(item?.content ?? []));
    }
    return out;
  }
  return [];
}

function textOf(content: InlineContent[]): string {
  let out = "";
  for (const node of content) {
    if (node?.type === "text") out += (node as { text?: string }).text ?? "";
    else if (node?.type === "link") out += ((node as { content?: { text?: string }[] }).content ?? []).map((n) => n?.text ?? "").join("");
  }
  return out;
}

/**
 * Map data between block types during conversion. Covers the built-in
 * tools; custom tools provide their own `conversion.from` mappers.
 */
export function convertData(fromType: string, toType: string, data: unknown): Record<string, unknown> {
  void fromType;
  const content = contentOf(data);
  switch (toType) {
    case "paragraph":
      return { content };
    case "heading":
      return { level: 2, content };
    case "quote":
      return { content };
    case "list":
      return { style: "unordered", items: content.map((c) => ({ content: [c] })) };
    case "code":
      return { code: textOf(content) };
    case "delimiter":
      return {};
    default:
      return {};
  }
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
      return { code: content.map((n) => textOf([n])).join("") };
    case "delimiter":
      return {};
    default:
      return { content };
  }
}

export function dataIsEmpty(type: string, data: unknown): boolean {
  if (!data || typeof data !== "object") return true;
  const d = data as Record<string, unknown>;
  if (type === "delimiter") return false;
  if (typeof d.code === "string") return d.code.trim() === "";
  if (Array.isArray(d.items)) {
    const items = d.items as { content?: InlineContent[] }[];
    return items.every((item) => textOf(item?.content ?? []).trim() === "");
  }
  return textOf(contentOf(data)).trim() === "";
}

export function isTextualTool(type: string): boolean {
  return type === "paragraph" || type === "heading" || type === "quote" || type === "list" || type === "code";
}

/** The BlockAPI a converted tool receives — used by conversion mappers. */
export function blockApiOf(api: BlockAPI): BlockAPI {
  return api;
}
