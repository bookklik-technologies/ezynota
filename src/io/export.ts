import type { EzynotaBlock, EzynotaDocument } from "../types";
import type { WorkspaceAsset } from "../workspace/types";
import { blocksToMarkdown } from "./markdown";
import { isSafeImageUrl } from "../core/url";

export type ExportFormat = "json" | "md" | "html" | "txt";

/** Known callout variants (mirrors src/tools/callout-tool.ts). */
const CALLOUT_VARIANTS = new Set(["info", "warning", "success", "danger"]);

/**
 * Portable saves: local `asset:<id>` references are resolved into image
 * data URLs so a downloaded document renders outside the workspace.
 */
export async function resolveDocumentAssets(
  document: EzynotaDocument,
  loadAsset: (assetId: string) => Promise<WorkspaceAsset | null>
): Promise<EzynotaDocument> {
  const resolvedIds = new Map<string, string>();
  const blocks = document.blocks.map((block) => resolveBlockAssets(block, loadAsset, resolvedIds));
  const resolved = await Promise.all(blocks);
  const assetList = await Promise.all(
    Array.from(resolvedIds.keys()).map(async (id) => ({ id, asset: await loadAsset(id) }))
  );
  const next = { ...document, blocks: resolved } as EzynotaDocument & { assets?: unknown };
  const usable = assetList.filter((entry): entry is { id: string; asset: WorkspaceAsset } => !!entry.asset);
  if (usable.length > 0) {
    next.assets = usable.map(({ id, asset }) => ({
      id,
      mime: asset.mime,
      dataUrl: toDataUrl(asset)
    }));
  }
  return next;
}

async function resolveBlockAssets(
  block: EzynotaBlock,
  loadAsset: (assetId: string) => Promise<WorkspaceAsset | null>,
  resolvedIds: Map<string, string>
): Promise<EzynotaBlock> {
  const next: EzynotaBlock = { ...block, data: block.data };
  if (block.type === "image" && typeof (block.data as { src?: unknown }).src === "string") {
    const src = String((block.data as { src: string }).src);
    if (src.startsWith("asset:")) {
      const assetId = src.slice("asset:".length);
      const asset = await loadAsset(assetId);
      if (asset) {
        const dataUrl = toDataUrl(asset);
        resolvedIds.set(assetId, dataUrl);
        next.data = { ...(block.data as Record<string, unknown>), src: dataUrl } as typeof block.data;
      }
    }
  }
  if (Array.isArray(block.children)) {
    next.children = await Promise.all(block.children.map((child) => resolveBlockAssets(child, loadAsset, resolvedIds)));
  }
  return next;
}

export function toDataUrl(asset: WorkspaceAsset): string {
  const base64 = bytesToBase64(asset.bytes);
  return `data:${asset.mime};base64,${base64}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Block content → HTML string (used for export and printing). */
export function blocksToHtml(blocks: EzynotaBlock[]): string {
  const parts: string[] = [];
  renderBlocksInto(blocks, parts);
  return parts.join("\n");
}

function renderBlocksInto(blocks: EzynotaBlock[], parts: string[]): void {
  for (const block of blocks) {
    const data = block.data as Record<string, unknown>;
    switch (block.type) {
      case "heading": {
        const level = Math.min(6, Math.max(1, Number(data.level) || 1));
        parts.push(`<h${level}>${inlineToHtml(data.content as never)}</h${level}>`);
        break;
      }
      case "paragraph":
        parts.push(`<p>${inlineToHtml(data.content as never)}</p>`);
        break;
      case "quote":
        parts.push(`<blockquote>${inlineToHtml(data.content as never)}</blockquote>`);
        break;
      case "code": {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = String(data.code ?? "");
        pre.appendChild(code);
        parts.push(pre.outerHTML);
        break;
      }
      case "delimiter":
        parts.push("<hr>");
        break;
      case "list": {
        const style = data.style === "ordered" ? "ordered" : (data as { style?: string }).style === "task" ? "task" : "unordered";
        const rawItems: unknown = data.items;
        const items = Array.isArray(rawItems) ? (rawItems as { content?: never; checked?: boolean }[]) : [];
        const listTag = style === "ordered" ? "ol" : "ul";
        const lis = items
          .map((item) => {
            const text = inlineToHtml(item.content as never);
            if (style === "task") {
              return `<li class="ez-md-task${item.checked ? " checked" : ""}"><input type="checkbox" disabled${item.checked ? " checked" : ""}/> ${text}</li>`;
            }
            return `<li>${text}</li>`;
          })
          .join("\n");
        parts.push(`<${listTag}>${lis}</${listTag}>`);
        break;
      }
      case "table": {
        const rawRows: unknown = (data as { rows?: unknown }).rows;
        const rows = Array.isArray(rawRows) ? (rawRows as { content?: unknown }[][]) : [];
        const header = (data as { header?: boolean }).header !== false;
        const trs = rows
          .map((row, index) => {
            const tag = header && index === 0 ? "th" : "td";
            return `<tr>${row.map((cell) => `<${tag}>${inlineToHtml(cell.content as never)}</${tag}>`).join("")}</tr>`;
          })
          .join("\n");
        parts.push(`<table class="ez-md-table">${trs}</table>`);
        break;
      }
      case "image": {
        const src = String(data.src ?? "");
        const alt = String(data.alt ?? "");
        const img = document.createElement("img");
        img.alt = alt;
        if (isSafeImageUrl(src) || src.startsWith("asset:")) img.setAttribute("src", src);
        parts.push(img.outerHTML);
        if (typeof data.caption === "string" && data.caption !== "") parts.push(`<figcaption>${escapeHtml(data.caption)}</figcaption>`);
        break;
      }
      case "callout": {
        const rawVariant = String(data.variant ?? "info");
        // Malformed/hostile docs (e.g. via .json import) may carry an
        // arbitrary variant — normalize it and escape the attribute value.
        const variant = CALLOUT_VARIANTS.has(rawVariant) ? rawVariant : "info";
        parts.push(`<div class="ez-md-callout" data-ezn-variant="${escapeHtml(variant)}">${inlineToHtml(data.content as never)}</div>`);
        break;
      }
      case "toggle": {
        const heading = inlineToHtml(data.heading as never);
        const body: string[] = [];
        if (Array.isArray(block.children)) renderBlocksInto(block.children, body);
        // Collapsible sections export as <details> (HTML supports toggles).
        parts.push(`<details class="ez-md-toggle"${(data as { open?: boolean }).open !== false ? " open" : ""}><summary>${heading}</summary>${body.join("\n")}</details>`);
        break;
      }
      default:
        break;
    }
  }
}

function inlineToHtml(content: never): string {
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const node of content as { type?: string; text?: string; marks?: { type: string; attrs?: Record<string, string> }[]; href?: string; content?: never }[]) {
    if (node.type === "text") {
      out += renderMarked(node.text ?? "", node.marks ?? []);
    } else if (node.type === "link") {
      out += `<a href="${escapeHtml(node.href ?? "")}" rel="noopener noreferrer">${inlineToHtml(node.content as never)}</a>`;
    }
  }
  return out;
}

function renderMarked(text: string, marks: { type: string; attrs?: Record<string, string> }[]): string {
  let out = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold": out = `<strong>${out}</strong>`; break;
      case "italic": out = `<em>${out}</em>`; break;
      case "underline": out = `<u>${out}</u>`; break;
      case "code": out = `<code>${out}</code>`; break;
      case "mark": out = `<mark>${out}</mark>`; break;
      case "strike": out = `<s>${out}</s>`; break;
      case "link": out = `<a href="${escapeHtml(mark.attrs?.href ?? "")}" rel="noopener noreferrer">${out}</a>`; break;
      case "color": out = `<span style="color:${escapeHtml(mark.attrs?.color ?? "")}">${out}</span>`; break;
      case "background": out = `<span style="background:${escapeHtml(mark.attrs?.color ?? "")}">${out}</span>`; break;
      default: break;
    }
  }
  return out;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

/** Blocks → plain text projection. */
export function blocksToPlainText(blocks: EzynotaBlock[]): string {
  return blocksToMarkdown(blocks).replace(/([*_~`=]{1,3}|==)/g, "");
}

/** Serialize a document into an export payload string. */
export async function exportDocumentToString(
  document: EzynotaDocument,
  format: ExportFormat,
  loadAsset: (assetId: string) => Promise<WorkspaceAsset | null>
): Promise<string> {
  switch (format) {
    case "json": {
      const portable = await resolveDocumentAssets(document, loadAsset);
      return JSON.stringify(portable, null, 2);
    }
    case "md":
      return blocksToMarkdown(document.blocks);
    case "html": {
      const title = String((document.meta as { title?: string } | undefined)?.title ?? "Document");
      const body = blocksToHtml(document.blocks);
      return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n<h1>${escapeHtml(title)}</h1>\n${body}\n</body>\n</html>`;
    }
    case "txt":
      return blocksToPlainText(document.blocks);
  }
}

/** Trigger a browser download for a text payload. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(title: string, fallback: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
  return cleaned || fallback;
}
