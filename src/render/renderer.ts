import type { Host } from "../host";
import type { BlockTool, BlockTune, EzynotaBlock, ChangeOrigin, JsonValue } from "../types";
import type { TextBlockToolLike } from "../input/tool-interfaces";
import type { TextBlockTool as TextTool } from "../tools/text-tools";
import { UnknownBlockTool } from "../tools/unknown-tool";

export interface RenderedBlock {
  element: HTMLElement;
  host: HTMLElement;
  tool: TextTool | (BlockTool & Partial<TextBlockToolLike>);
  tunes: { name: string; instance: BlockTune }[];
}

/**
 * Renderer: the DOM is a view of document state. It renders each block
 * exactly once and re-renders only affected blocks after transactions.
 * MutationObserver exists purely as a fallback and is suppressed while
 * the renderer itself mutates the DOM.
 */
export class Renderer {
  private hostApi: Host;
  private holder: HTMLElement;
  private blocksRoot: HTMLElement;
  private rendered = new Map<string, RenderedBlock>();
  private suspended = 0;
  private observer: MutationObserver | null = null;
  private destroyed = false;

  constructor(hostApi: Host, holder: HTMLElement) {
    this.hostApi = hostApi;
    this.holder = holder;
    this.blocksRoot = hostApi.holder.ownerDocument.createElement("div");
    this.blocksRoot.className = "ez-blocks";
    this.blocksRoot.setAttribute("role", "presentation");
    holder.appendChild(this.blocksRoot);
  }

  /** Re-render (or re-render) the full document. */
  renderAll(blocks: EzynotaBlock[]): void {
    if (this.destroyed) return;
    this.suspend();
    for (const [id] of this.rendered) {
      this.destroyToolDom(id);
    }
    this.rendered.clear();
    while (this.blocksRoot.firstChild) this.blocksRoot.removeChild(this.blocksRoot.firstChild);
    for (const block of blocks) {
      this.renderBlockInto(block);
    }
    this.resume();
    this.updateEmptyHint(blocks.length === 0);
  }

  private destroyToolDom(id: string): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    try {
      entry.tool.destroy?.();
      for (const tune of entry.tunes) tune.instance.destroy?.();
    } catch {
      /* tool cleanup errors must not break rendering */
    }
    entry.element.remove();
    this.rendered.delete(id);
  }

  /** Create DOM for a single block at its state index. */
  insert(block: EzynotaBlock, index: number, origin: ChangeOrigin): void {
    if (this.destroyed) return;
    this.suspend();
    this.renderBlockInto(block, index);
    void origin;
    this.resume();
    this.updateEmptyHint(false);
  }

  remove(id: string): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    const tool = entry.tool as BlockTool;
    try {
      tool.removed?.();
      tool.destroy?.();
      for (const tune of entry.tunes) tune.instance.destroy?.();
    } catch {
      /* tool cleanup errors must not break rendering */
    }
    entry.element.remove();
    this.rendered.delete(id);
    this.updateEmptyHint(this.rendered.size === 0);
  }

  move(id: string, to: number): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    const siblings = Array.from(this.blocksRoot.children).filter((element) => element !== entry.element);
    const ref = siblings[to] ?? null;
    this.blocksRoot.insertBefore(entry.element, ref);
    const tool = entry.tool as BlockTool;
    try {
      tool.moved?.({ from: -1, to });
    } catch {
      /* optional hook */
    }
  }

  update(id: string, origin: ChangeOrigin): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    // User-origin text edits already live in the DOM; never re-render those.
    if (origin === "user") return;
    try {
      entry.tool.updated?.();
    } catch {
      /* optional hook */
    }
  }

  convert(id: string, block: EzynotaBlock): void {
    const entry = this.rendered.get(id);
    if (entry) {
      try {
        entry.tool.destroy?.();
        for (const tune of entry.tunes) tune.instance.destroy?.();
      } catch {
        /* ignore */
      }
      entry.element.remove();
      this.rendered.delete(id);
    }
    this.suspend();
    this.renderBlockInto(block, this.stateIndexOf(id));
    this.resume();
  }

  private stateIndexOf(id: string): number {
    return this.hostApi.getBlockIndex(id);
  }

  private renderBlockInto(block: EzynotaBlock, at?: number): void {
    const doc = this.holder.ownerDocument;
    // Blocks whose tool is unavailable render through a read-only fallback
    // so their data is never lost or dropped from saves.
    const supported = this.hostApi.registry.has(block.type);
    const reg = supported ? this.hostApi.registry.get(block.type) : undefined;
    const element = doc.createElement("div");
    element.className = "ez-block";
    element.setAttribute("data-ez-block-id", block.id);
    element.setAttribute("data-ez-block-type", block.type);
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", supported ? reg?.toolbox?.title ?? block.type : `Unsupported block (${block.type})`);

    const toolHost = toolHostElement(doc, block.type);
    element.appendChild(toolHost);

    const instance = supported ? this.createToolInstance(block, toolHost) : new UnknownBlockTool({ api: this.blockApiForTool(block.id, toolHost) });
    toolHost.appendChild(instance.render());
    const editables = Array.from(toolHost.querySelectorAll<HTMLElement>("[data-ez-editable]"));
    for (const editable of editables) {
      editable.contentEditable = this.hostApi.readOnly ? "false" : "true";
      editable.setAttribute("aria-label", supported ? reg?.toolbox?.title ?? block.type : `Unsupported block (${block.type})`);
      editable.setAttribute("role", "textbox");
      editable.setAttribute("aria-multiline", "true");
    }
    if (editables.length === 0) {
      element.tabIndex = 0;
      element.addEventListener("focus", () => {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(true);
        this.hostApi.setSelectionFromRange(range);
      });
    }
    try {
      (instance as BlockTool).rendered?.();
    } catch {
      /* optional hook */
    }

    const tunes: RenderedBlock["tunes"] = [];
    for (const tune of this.hostApi.registry.listTunes()) {
      try {
        const instanceTune = this.hostApi.registry.createTune(tune.name, {
          api: this.blockApiFor(block.id),
          config: {},
          value: (block.tunes?.[tune.name] ?? null) as JsonValue,
          onChange: (value) => this.hostApi.blocks.setTune(block.id, tune.name, value),
          t: (key) => this.hostApi.i18n.t(key)
        });
        instanceTune.wrap?.(toolHost);
        tunes.push({ name: tune.name, instance: instanceTune });
      } catch {
        /* skip broken tunes */
      }
    }

    this.rendered.set(block.id, { element, host: toolHost, tool: instance as RenderedBlock["tool"], tunes });
    if (typeof at === "number") {
      const ref = this.blocksRoot.children[at] ?? null;
      this.blocksRoot.insertBefore(element, ref);
    } else {
      const stateIndex = this.stateIndexOf(block.id);
      const ref = this.blocksRoot.children[stateIndex] ?? null;
      this.blocksRoot.insertBefore(element, ref);
    }
    this.refreshEditableFlags();
  }

  /** Instantiate the block tool. */
  private createToolInstance(block: EzynotaBlock, element: HTMLElement): BlockTool {
    return this.hostApi.registry.createBlockTool(block.type, {
      api: this.blockApiForTool(block.id, element),
      config: block.type === this.hostApi.defaultBlock ? { placeholder: this.hostApi.placeholder } : {},
      block,
      readOnly: this.hostApi.readOnly,
      locale: this.hostApi.i18n.getLocale()
    });
  }

  /** Instantiate a block tool for a nested child (collapsible sections). */
  createToolInstancePublic(block: EzynotaBlock, element: HTMLElement, parentId: string, api?: import("../types").BlockAPI): BlockTool {
    const nested = this.hostApi.nestedHost?.(parentId);
    return this.hostApi.registry.createBlockTool(block.type, {
      api: api ?? this.blockApiForTool(block.id, element),
      config: {},
      block,
      readOnly: this.hostApi.readOnly,
      locale: this.hostApi.i18n.getLocale(),
      nested
    });
  }

  private blockApiForTool(id: string, element: HTMLElement): import("../types").BlockAPI {
    const host = this.hostApi;
    return {
      id,
      type: host.getBlockType(id) ?? "",
      get readOnly() { return host.readOnly; },
      element,
      getData: () => host.getBlockData(id) as never,
      update: (data) => host.updateBlockData(id, data, "user"),
      patch: (data) => {
        const current = (host.getBlockData(id) as Record<string, unknown>) ?? {};
        const next = { ...current, ...(data as Record<string, unknown>) } as never;
        host.updateBlockData(id, next);
      },
      requestSave: () => host.requestSaveBlock(id),
      focus: (at) => this.focus(id, at),
      remove: () => host.removeBlock(id, "user"),
      move: (position) => host.moveBlock(id, position as { before: string }),
      duplicate: () => host.duplicateBlock(id),
      convert: (target) => host.convertBlock(id, target)
    };
  }

  private blockApiFor(id: string): import("../types").BlockAPI {
    return this.blockApiForTool(id, this.getToolHost(id) ?? this.holder);
  }

  private getToolHost(id: string): HTMLElement | null {
    return this.rendered.get(id)?.host ?? null;
  }

  /** Focus the tool's primary editable element. */
  focus(id: string, at?: "start" | "end"): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    const tool = entry.tool as TextTool & { focus?: (at?: "start" | "end") => void };
    if (typeof tool.focus === "function" && entry.host.querySelector("[data-ez-editable]")) {
      try {
        tool.focus(at);
        return;
      } catch {
        /* fall through */
      }
    }
    const editable = entry.host.querySelector("[data-ez-editable]") as HTMLElement | null;
    if (editable) {
      editable.focus();
    } else {
      entry.element.focus();
    }
  }

  getTool(id: string): BlockTool | undefined {
    return this.rendered.get(id)?.tool;
  }

  getEditableElement(id: string): HTMLElement | null {
    const entry = this.rendered.get(id);
    if (!entry) return null;
    return (entry.host.querySelector("[data-ez-editable]") as HTMLElement) ?? null;
  }

  getBlockElement(id: string): HTMLElement | null {
    return this.rendered.get(id)?.element ?? null;
  }

  setReadOnly(readOnly: boolean): void {
    for (const [, entry] of this.rendered) {
      for (const editable of Array.from(entry.host.querySelectorAll<HTMLElement>("[data-ez-editable]"))) {
        editable.contentEditable = readOnly ? "false" : "true";
      }
      entry.tool.updated?.();
    }
    this.updateEmptyHint(this.rendered.size === 0);
  }

  /** Fallback: catch DOM changes that bypass the input flow. */
  startObserver(onFallbackSave: (id: string) => void): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => {
      if (this.suspended > 0) return;
      for (const [id] of this.rendered) {
        onFallbackSave(id);
      }
    });
    this.observer.observe(this.blocksRoot, { childList: true, subtree: true, characterData: true });
  }

  stopObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopObserver();
    for (const [, entry] of this.rendered) {
      try {
        entry.tool.destroy?.();
        for (const tune of entry.tunes) tune.instance.destroy?.();
      } catch {
        /* ignore */
      }
    }
    this.rendered.clear();
    this.blocksRoot.remove();
  }

  private suspend(): void {
    this.suspended++;
  }

  private resume(): void {
    this.suspended = Math.max(0, this.suspended - 1);
  }

  private updateEmptyHint(empty: boolean): void {
    this.blocksRoot.querySelector(".ez-empty-input")?.remove();
    if (!empty) return;
    const input = document.createElement("p");
    input.className = "ez-text-input ez-empty-input";
    input.setAttribute("data-ez-placeholder", this.hostApi.placeholder);
    if (this.hostApi.readOnly) {
      input.textContent = this.hostApi.i18n.t("core.emptyDocument");
    } else {
      input.contentEditable = "true";
      input.setAttribute("role", "textbox");
      input.setAttribute("aria-label", this.hostApi.placeholder);
      input.addEventListener("focus", () => {
        if (!this.hostApi.readOnly && this.hostApi.blocks.length === 0) {
          const id = this.hostApi.insertBlock(this.hostApi.defaultBlock, undefined, { focus: false });
          this.hostApi.focusBlock(id, "start");
        }
      });
    }
    this.blocksRoot.appendChild(input);
  }

  private refreshEditableFlags(): void {
    this.blocksRoot.querySelectorAll<HTMLElement>("[data-ez-editable]").forEach((editable) => {
      const empty = (editable.textContent ?? "").replace(/\u200B/g, "").trim() === "";
      editable.setAttribute("data-ez-empty", empty ? "true" : "false");
    });
  }
}

function toolHostElement(doc: Document, type: string): HTMLElement {
  const host = doc.createElement("div");
  host.className = "ez-tool-host";
  host.setAttribute("data-ez-tool", type);
  return host;
}
