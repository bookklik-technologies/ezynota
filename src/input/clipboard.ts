import type { Host } from "../host";
import type { EzynotaBlock, JsonValue } from "../types";
import { salvageDocument } from "../core/schema";
import { htmlToBlocks, textToBlocks, type ParsedBlock } from "./html-to-blocks";
import { inlineToDom } from "../rich-text/dom";

const EZYNOTA_JSON_TYPE = "application/x-ezynota+json";

interface EzynotaClipboardPayload {
  /** Whole blocks copied with block-level granularity. */
  blocks?: unknown[];
  /** Exact selected text fragment (partial-block copy). */
  text?: string;
}

/**
 * ClipboardManager:
 * - Copy exports the PRECISE selection: a whole-block payload when the
 *   selection covers entire blocks, otherwise the selected fragment
 *   (text/plain + text/html + Ezynota JSON).
 * - Paste inserts at the caret: Ezynota JSON → files → sanitized HTML →
 *   plain text; non-collapsed selections are replaced, block payloads
 *   commit as ONE transaction so undo removes the paste in a single step
 *   (spec §17).
 */
export class ClipboardManager {
  private host: Host;
  private holder: HTMLElement;
  private disposers: (() => void)[] = [];

  constructor(host: Host, holder: HTMLElement) {
    this.host = host;
    this.holder = holder;
  }

  start(): void {
    const targetInSurface = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      return !!el && this.holder.contains(el) && !el.closest?.("[data-ez-ui]");
    };

    const onCopy = (event: Event): void => {
      if (!targetInSurface(event.target)) return;
      const e = event as ClipboardEvent;
      const range = this.host.getRange();
      if (!range || range.collapsed) return;
      const data = e.clipboardData;
      if (!data) return;
      e.preventDefault();
      this.writeClipboard(data, range);
    };

    /**
     * Cut serializes the selection with full fidelity (same as copy) but
     * does NOT preventDefault, so the browser performs the default delete.
     */
    const onCut = (event: Event): void => {
      if (!targetInSurface(event.target)) return;
      const e = event as ClipboardEvent;
      const range = this.host.getRange();
      if (!range || range.collapsed) return;
      const data = e.clipboardData;
      if (!data) return;
      this.writeClipboard(data, range);
    };

    const onPaste = async (event: Event): Promise<void> => {
      const e = event as ClipboardEvent;
      const selection = this.host.getSelectionInfo();
      if (!selection || this.host.readOnly) return;
      e.preventDefault();
      const data = e.clipboardData;
      if (!data) return;
      await this.paste(data, selection.blockId);
    };

    const onDrop = async (event: Event): Promise<void> => {
      const e = event as DragEvent;
      if (this.host.readOnly) return;
      const transfer = e.dataTransfer;
      const files = transfer?.files;
      if (!files || files.length === 0) {
        // Text/HTML drops bypass the file router — route them through the
        // normal paste pipeline so sanitization applies.
        const text = transfer?.getData("text/plain") ?? "";
        const html = transfer?.getData("text/html") ?? "";
        if ((text === "" && html === "") || !transfer) return;
        const selection = this.host.getSelectionInfo();
        if (!selection) return;
        e.preventDefault();
        await this.paste(transfer as DataTransfer, selection.blockId);
        return;
      }
      const selection = this.host.getSelectionInfo();
      if (!selection) return;
      e.preventDefault();
      await this.routeFiles(Array.from(files), selection.blockId);
    };

    this.holder.addEventListener("copy", onCopy);
    this.holder.addEventListener("cut", onCut);
    this.holder.addEventListener("paste", onPaste as EventListener);
    this.holder.addEventListener("drop", onDrop);

    this.disposers.push(() => {
      this.holder.removeEventListener("copy", onCopy);
      this.holder.removeEventListener("cut", onCut);
      this.holder.removeEventListener("paste", onPaste as EventListener);
      this.holder.removeEventListener("drop", onDrop);
    });
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  /**
   * Full blocks covered by the selection, in document order — or null when
   * the selection starts/ends mid-block (partial copy instead).
   */
  private wholeBlocksInSelection(range: Range): EzynotaBlock[] | null {
    const startBlock = this.closestBlock(range.startContainer);
    const endBlock = this.closestBlock(range.endContainer);
    if (!startBlock) return null;
    const end = endBlock ?? startBlock;
    if (!this.selectionCoversBlockStart(startBlock, range)) return null;
    if (!this.selectionCoversBlockEnd(end, range)) return null;
    const all = Array.from(this.holder.querySelectorAll<HTMLElement>("[data-ez-block-id]"));
    const ids: string[] = [];
    let inRange = false;
    for (const el of all) {
      if (el === startBlock) inRange = true;
      if (inRange) ids.push(el.getAttribute("data-ez-block-id") ?? "");
      if (el === end) break;
    }
    const blocks: EzynotaBlock[] = [];
    for (const id of ids) {
      const block = this.host.blocks.getById(id);
      if (block) blocks.push(block);
    }
    return blocks.length > 0 ? blocks : null;
  }

  private selectionCoversBlockStart(block: HTMLElement, range: Range): boolean {
    const probe = this.holder.ownerDocument.createRange();
    probe.selectNodeContents(block);
    try {
      probe.setEnd(range.startContainer, range.startOffset);
    } catch {
      return false;
    }
    return probe.toString().replace(/\u200B/g, "").length === 0;
  }

  private selectionCoversBlockEnd(block: HTMLElement, range: Range): boolean {
    const probe = this.holder.ownerDocument.createRange();
    probe.selectNodeContents(block);
    try {
      probe.setStart(range.endContainer, range.endOffset);
    } catch {
      return false;
    }
    return probe.toString().replace(/\u200B/g, "").length === 0;
  }

  private closestBlock(node: Node): HTMLElement | null {
    let cursor: Node | null = node;
    while (cursor && cursor !== this.holder) {
      if (cursor.nodeType === Node.ELEMENT_NODE && (cursor as HTMLElement).hasAttribute?.("data-ez-block-id")) {
        return cursor as HTMLElement;
      }
      cursor = cursor.parentNode;
    }
    return null;
  }

  /** Serialize the selection (whole blocks or fragment) into a DataTransfer. */
  private writeClipboard(data: DataTransfer, range: Range): void {
    const blocks = this.wholeBlocksInSelection(range);
    if (blocks && blocks.length > 0) {
      const text = blocks.map((b) => textOf(b)).join("\n\n");
      data.setData("text/plain", text);
      data.setData("text/html", blocks.map((b) => htmlOf(b)).join(""));
      try {
        data.setData(EZYNOTA_JSON_TYPE, JSON.stringify({ blocks } satisfies EzynotaClipboardPayload));
      } catch {
        /* custom mime types are unsupported in some engines */
      }
      return;
    }
    // Precise selection copy: export exactly what is highlighted.
    const text = range.toString().replace(/\u200B/g, "");
    data.setData("text/plain", text);
    try {
      const fragment = range.cloneContents();
      data.setData("text/html", fragmentToHtml(fragment));
    } catch {
      /* html serialization is best-effort */
    }
    try {
      data.setData(EZYNOTA_JSON_TYPE, JSON.stringify({ text } satisfies EzynotaClipboardPayload));
    } catch {
      /* custom mime types are unsupported in some engines */
    }
  }

  /** Paste priority: Ezynota JSON → files → sanitized HTML → plain text. */
  private async paste(data: DataTransfer, currentBlockId: string): Promise<void> {
    const json = data.getData(EZYNOTA_JSON_TYPE);
    if (json) {
      try {
        const parsed = JSON.parse(json) as EzynotaClipboardPayload;
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
          // Untrusted clipboard JSON: schema-validate and salvage before
          // inserting so invalid/unsafe content (e.g. javascript: links)
          // can never reach the document.
          const sanitized = sanitizeClipboardBlocks(parsed.blocks);
          if (sanitized.length > 0) {
            this.insertClipboardBlocks(sanitized, currentBlockId);
            return;
          }
        }
        if (typeof parsed.text === "string" && parsed.text !== "") {
          this.insertTextAtCaret(parsed.text, currentBlockId);
          return;
        }
      } catch {
        /* fall through to other formats */
      }
    }

    if (data.files && data.files.length > 0) {
      const handled = await this.routeFiles(Array.from(data.files), currentBlockId);
      if (handled) return;
    }

    const html = data.getData("text/html");
    if (html && html.trim() !== "") {
      const blocks = htmlToBlocks(html);
      if (blocks.length > 0) {
        this.insertParsed(blocks, currentBlockId);
        return;
      }
    }

    const text = data.getData("text/plain") ?? "";
    if (text.trim() !== "") {
      if (text.includes("\n")) {
        this.insertParsed(textToBlocks(text), currentBlockId);
      } else {
        this.insertTextAtCaret(text, currentBlockId);
      }
    }
  }

  /** Route files to tools that declare matching file paste rules. */
  private async routeFiles(files: File[], blockId: string): Promise<boolean> {
    for (const entry of this.host.registry.listBlockTools()) {
      const cfg = entry.toolClass.paste?.files;
      if (!cfg) continue;
      const matchers = cfg.mimeTypes ?? [];
      const matched = files.filter((file) =>
        matchers.some((pattern) =>
          pattern.endsWith("/*") ? file.type.startsWith(pattern.slice(0, -1)) : file.type === pattern
        )
      );
      if (matched.length === 0) continue;
      const activeTool = this.host.getTool(blockId);
      // The active tool handles the files when it is the declaring tool
      // (e.g. the caret is inside an image block).
      if (activeTool?.onPaste && this.host.getBlockType(blockId) === entry.name) {
        activeTool.onPaste({ files: matched });
        return true;
      }
      // Otherwise a matching tool may convert the files into NEW blocks
      // (e.g. pasting an image while the caret is in a paragraph).
      const converter = (entry.toolClass as unknown as {
        filesToBlockDataAsync?: (files: File[]) => Promise<{ type: string; data: JsonValue }[]>;
      }).filesToBlockDataAsync;
      if (typeof converter === "function") {
        const data = await converter(matched);
        if (data.length > 0) {
          this.host.pasteBlocks(data, blockId, "paste");
          return true;
        }
      }
    }
    return false;
  }

  private insertParsed(blocks: ParsedBlock[], currentBlockId: string): void {
    const shaped = blocks.map((b) => ({ type: b.type, data: b.data as JsonValue }));
    this.insertClipboardBlocks(shaped, currentBlockId);
  }

  /** Block-level paste: one transaction, one undo step. */
  private insertClipboardBlocks(blocks: { type?: unknown; data?: unknown }[], currentBlockId: string): void {
    const entries = blocks.map((block) => ({
      type: typeof block.type === "string" && block.type !== "" ? block.type : this.host.defaultBlock,
      data: (block.data ?? {}) as JsonValue
    }));
    if (entries.length === 0) return;
    this.host.pasteBlocks(entries, currentBlockId, "paste");
  }

  /**
   * Inline paste at the caret (also replaces a same-block selection).
   * Falls back to a block-level paste when the caret is not in an editable.
   */
  private insertTextAtCaret(text: string, blockId: string): void {
    const editable = this.host.getEditableElement(blockId);
    const range = this.host.getRange();
    const caretBlock = range ? this.closestBlock(range.startContainer) : null;
    const caretInBlock = caretBlock?.getAttribute("data-ez-block-id") === blockId;
    if (!editable || !range || !caretInBlock) {
      this.insertClipboardBlocks([{ type: this.host.defaultBlock, data: { content: [{ type: "text", text }] } }], blockId);
      return;
    }
    range.deleteContents();
    const node = this.holder.ownerDocument.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // Single block update → paste undoes in one step.
    this.host.requestSaveBlock(blockId, "user");
    this.host.announce("Pasted content inserted");
  }
}

/**
 * Untrusted clipboard JSON is validated through the document salvage path:
 * invalid blocks are dropped or converted, ids de-duplicated and unsafe
 * link payloads stripped by the normalizer's link sanitizer.
 */
export function sanitizeClipboardBlocks(blocks: unknown[]): { type: string; data: JsonValue }[] {
  const result = salvageDocument({ blocks });
  const document = result.document ?? { schemaVersion: "1.0.0", blocks: [] };
  return document.blocks.map((block) => ({ type: block.type, data: block.data }));
}

function textOf(block: EzynotaBlock): string {
  const data = block.data as Record<string, unknown>;
  if (typeof data.code === "string") return data.code;
  if (Array.isArray(data.items)) {
    return (data.items as { content?: unknown[] }[]).map((item) => inlineText(item?.content ?? [])).join("\n");
  }
  return inlineText(Array.isArray(data.content) ? data.content : []);
}

function inlineText(content: unknown[]): string {
  let out = "";
  for (const node of content as Record<string, unknown>[]) {
    if (node?.type === "text") out += (node as { text?: string }).text ?? "";
    else if (node?.type === "link") {
      out += ((node as { content?: { text?: string }[] }).content ?? []).map((n) => n?.text ?? "").join("");
    }
  }
  return out;
}

function htmlOf(block: EzynotaBlock): string {
  const doc = document.implementation.createHTMLDocument("copy");
  const div = doc.createElement("div");
  div.setAttribute("data-ez-block-type", block.type);
  const data = block.data as Record<string, unknown>;
  if (typeof data.code === "string") {
    const pre = doc.createElement("pre");
    pre.textContent = data.code;
    div.appendChild(pre);
  } else if (Array.isArray(data.items)) {
    const list = doc.createElement((data.style as string) === "ordered" ? "ol" : "ul");
    for (const item of data.items as { content?: unknown[] }[]) {
      const li = doc.createElement("li");
      li.appendChild(renderInlineNodes(item?.content ?? [], doc));
      list.appendChild(li);
    }
    div.appendChild(list);
  } else if (Array.isArray(data.content)) {
    // A crafted payload with a non-numeric level must not throw inside the
    // copy handler — clamp to a valid heading tag.
    let tag = "p";
    if (block.type === "heading") {
      const level = Number(data.level ?? 2);
      tag = Number.isInteger(level) && level >= 1 && level <= 6 ? `h${level}` : "p";
    } else if (block.type === "quote") {
      tag = "blockquote";
    }
    const node = doc.createElement(tag);
    node.appendChild(renderInlineNodes(data.content as unknown[], doc));
    div.appendChild(node);
  } else if (block.type === "delimiter") {
    div.appendChild(doc.createElement("hr"));
  }
  return div.innerHTML;
}

function fragmentToHtml(fragment: DocumentFragment): string {
  const doc = document.implementation.createHTMLDocument("copy");
  const div = doc.createElement("div");
  div.appendChild(doc.importNode(fragment, true));
  return div.innerHTML;
}

function renderInlineNodes(content: unknown[], doc: Document): DocumentFragment {
  return inlineToDom(content as never, doc);
}
