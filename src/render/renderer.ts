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
  private target: HTMLElement;
  private blocksRoot: HTMLElement;
  private rendered = new Map<string, RenderedBlock>();
  /** Cached JSON of each block's children, compared on updates to detect child changes. */
  private childrenSignatures = new Map<string, string>();
  /** Cached block type + data signature, used to apply tune updates without a rebuild. */
  private blockSignatures = new Map<string, string>();
  private tuneSignatures = new Map<string, string>();
  private suspended = 0;
  private observer: MutationObserver | null = null;
  private destroyed = false;

  constructor(hostApi: Host, target: HTMLElement) {
    this.hostApi = hostApi;
    this.target = target;
    this.blocksRoot = hostApi.target.ownerDocument.createElement("div");
    this.blocksRoot.className = "ez-blocks";
    this.blocksRoot.setAttribute("role", "presentation");
    target.appendChild(this.blocksRoot);
  }

  /** Re-render (or re-render) the full document. */
  renderAll(blocks: EzynotaBlock[]): void {
    if (this.destroyed) return;
    this.suspend();
    for (const [id] of this.rendered) {
      this.destroyToolDom(id);
    }
    this.rendered.clear();
    this.childrenSignatures.clear();
    this.blockSignatures.clear();
    this.tuneSignatures.clear();
    while (this.blocksRoot.firstChild) this.blocksRoot.removeChild(this.blocksRoot.firstChild);
    for (const block of blocks) {
      this.renderBlockInto(block);
    }
    this.resume();
    this.updateEmptyHint(blocks.length === 0);
    this.refreshPlaceholderScope();
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
    this.refreshPlaceholderScope();
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
    this.childrenSignatures.delete(id);
    this.blockSignatures.delete(id);
    this.tuneSignatures.delete(id);
    this.updateEmptyHint(this.rendered.size === 0);
    this.refreshPlaceholderScope();
  }

  move(id: string, to: number): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    const from = Array.from(this.blocksRoot.children).indexOf(entry.element);
    const siblings = Array.from(this.blocksRoot.children).filter((element) => element !== entry.element);
    const ref = siblings[to] ?? null;
    this.blocksRoot.insertBefore(entry.element, ref);
    const tool = entry.tool as BlockTool;
    try {
      tool.moved?.({ from, to });
    } catch {
      /* optional hook */
    }
  }

  update(id: string, origin: ChangeOrigin): void {
    const entry = this.rendered.get(id);
    if (!entry) return;
    const block = this.hostApi.blocks.getById(id);
    if (origin === "user") {
      // User-origin text edits already live in the DOM; never re-render those.
      // Structural child commits (children:update) also arrive with origin
      // "user": detect them by comparing the block's children against the
      // signature cached at render time and refresh the hosting tool.
      if (block) {
        const signature = JSON.stringify(block.children ?? []);
        if (this.childrenSignatures.get(id) !== signature) {
          this.childrenSignatures.set(id, signature);
          this.callUpdated(entry);
        }
      }
      return;
    }
    if (block) {
      this.childrenSignatures.set(id, JSON.stringify(block.children ?? []));
    }
    this.callUpdated(entry);
  }

  private callUpdated(entry: RenderedBlock): void {
    try {
      entry.tool.updated?.();
    } catch {
      /* optional hook */
    }
  }

  convert(id: string, block: EzynotaBlock): void {
    const entry = this.rendered.get(id);
    if (entry && this.applyTuneUpdate(id, entry, block)) return;
    if (entry) {
      try {
        entry.tool.destroy?.();
        for (const tune of entry.tunes) tune.instance.destroy?.();
      } catch {
        /* ignore */
      }
      entry.element.remove();
      this.rendered.delete(id);
      this.childrenSignatures.delete(id);
      this.blockSignatures.delete(id);
      this.tuneSignatures.delete(id);
    }
    this.suspend();
    this.renderBlockInto(block, this.stateIndexOf(id));
    this.resume();
    this.refreshPlaceholderScope();
  }

  /**
   * Non-destructive tune update: when only the tunes changed (the block
   * type and data are unchanged), apply the tune values to the existing
   * wrap element instead of destroying and rebuilding the tool. Used by
   * editor.applyToDom for tune:update (e.g. alignment clicks and undo/redo).
   */
  private applyTuneUpdate(id: string, entry: RenderedBlock, block: EzynotaBlock): boolean {
    const previousType = this.blockSignatures.get(id);
    if (previousType !== blockSignature(block)) return false;
    const updaters: { tune: RenderedBlock["tunes"][number]; setValue: (value: JsonValue) => void; applyTo: (element: HTMLElement) => void }[] = [];
    for (const tune of entry.tunes) {
      const instance = tune.instance as BlockTune & {
        setValue?: (value: JsonValue) => void;
        applyTo?: (element: HTMLElement) => void;
      };
      if (typeof instance.setValue !== "function" || typeof instance.applyTo !== "function") {
        return false;
      }
      updaters.push({ tune, setValue: instance.setValue, applyTo: instance.applyTo });
    }
    for (const updater of updaters) {
      updater.setValue(block.tunes?.[updater.tune.name] ?? null);
      updater.applyTo(entry.host);
    }
    this.tuneSignatures.set(id, JSON.stringify(block.tunes ?? {}));
    return true;
  }

  private stateIndexOf(id: string): number {
    return this.hostApi.getBlockIndex(id);
  }

  private renderBlockInto(block: EzynotaBlock, at?: number): void {
    const doc = this.target.ownerDocument;
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

    let instance: BlockTool;
    try {
      instance = supported
        ? this.createToolInstance(block, toolHost)
        : new UnknownBlockTool({ api: this.blockApiForTool(block.id, toolHost) });
      toolHost.appendChild(instance.render());
    } catch {
      // A broken or lazily-unavailable tool must never break rendering:
      // fall back to the read-only unknown tool so data is preserved.
      while (toolHost.firstChild) toolHost.removeChild(toolHost.firstChild);
      instance = new UnknownBlockTool({ api: this.blockApiForTool(block.id, toolHost) });
      toolHost.appendChild(instance.render());
    }
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
        const range = element.ownerDocument.createRange();
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
    this.childrenSignatures.set(block.id, JSON.stringify(block.children ?? []));
    this.blockSignatures.set(block.id, blockSignature(block));
    this.tuneSignatures.set(block.id, JSON.stringify(block.tunes ?? {}));
    if (typeof at === "number") {
      const ref = this.blocksRoot.children[at] ?? null;
      this.blocksRoot.insertBefore(element, ref);
    } else {
      const stateIndex = this.stateIndexOf(block.id);
      const ref = this.blocksRoot.children[stateIndex] ?? null;
      this.blocksRoot.insertBefore(element, ref);
    }
    this.refreshEditableFlags(element);
  }

  /** Instantiate the block tool. */
  private createToolInstance(block: EzynotaBlock, element: HTMLElement): BlockTool {
    return this.hostApi.registry.createBlockTool(block.type, {
      api: this.blockApiForTool(block.id, element),
      // The note placeholder is managed by refreshPlaceholderScope(): it
      // only applies to a fresh note (exactly one block), not to every
      // empty block in the document.
      config: {},
      block,
      readOnly: this.hostApi.readOnly,
      locale: this.hostApi.i18n.getLocale(),
      // Tools that host nested child blocks (e.g. toggles) receive the
      // host for their own children; other tools ignore the option.
      nested: this.hostApi.nestedHost?.(block.id)
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
    return this.blockApiForTool(id, this.getToolHost(id) ?? this.target);
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

  /** Fallback: catch DOM changes that bypass the input flow. Only the
   * block(s) that own the mutated DOM nodes are reported. */
  startObserver(onFallbackSave: (id: string) => void): void {
    if (this.observer) return;
    this.observer = new MutationObserver((mutations) => {
      if (this.suspended > 0) return;
      const ids = new Set<string>();
      const collect = (node: Node | null): void => {
        const element = node instanceof Element ? node : node?.parentElement ?? null;
        const owner = element?.closest?.("[data-ez-block-id]");
        const id = owner?.getAttribute("data-ez-block-id");
        if (id) ids.add(id);
      };
      for (const mutation of mutations) {
        collect(mutation.target);
        if (mutation.type === "childList") {
          for (const node of Array.from(mutation.addedNodes)) collect(node);
        }
      }
      for (const id of ids) onFallbackSave(id);
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
    this.childrenSignatures.clear();
    this.blockSignatures.clear();
    this.tuneSignatures.clear();
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
    const doc = this.blocksRoot.ownerDocument;
    const input = doc.createElement("p");
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

  private refreshEditableFlags(scope?: HTMLElement): void {
    (scope ?? this.blocksRoot).querySelectorAll<HTMLElement>("[data-ez-editable]").forEach((editable) => {
      const empty = (editable.textContent ?? "").replace(/\u200B/g, "").trim() === "";
      editable.setAttribute("data-ez-empty", empty ? "true" : "false");
    });
  }

  /**
   * The note placeholder is only meaningful on a fresh note: when the
   * document contains exactly one block, its primary editable carries
   * `data-ez-note-placeholder` (shown by CSS while empty). In any other
   * situation empty blocks render as plain empty space.
   */
  private refreshPlaceholderScope(): void {
    if (this.destroyed) return;
    for (const stale of Array.from(this.blocksRoot.querySelectorAll<HTMLElement>("[data-ez-note-placeholder]"))) {
      stale.removeAttribute("data-ez-note-placeholder");
    }
    if (this.hostApi.readOnly) return;
    const children = this.blocksRoot.children;
    if (children.length !== 1) return;
    const single = children[0] as HTMLElement;
    const editable = single.querySelector<HTMLElement>("[data-ez-editable]");
    if (editable) editable.setAttribute("data-ez-note-placeholder", this.hostApi.placeholder);
  }
}

function blockSignature(block: EzynotaBlock): string {
  return JSON.stringify({ type: block.type, data: block.data });
}

function toolHostElement(doc: Document, type: string): HTMLElement {
  const host = doc.createElement("div");
  host.className = "ez-tool-host";
  host.setAttribute("data-ez-tool", type);
  return host;
}
