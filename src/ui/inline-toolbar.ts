import type { Host } from "../host";
import type { EditorSelection, InlineTool } from "../types";
import { activeMarks, findAncestor } from "../inline/inline-tools";
import { button, el, clearChildren, placePopover, navigateControls, svgButton } from "./dom";
import { ICONS } from "./icons";

/** Shared formatting controls for floating and persistent toolbars. */
export class InlineToolbar {
  private root: HTMLElement;
  private tools: { name: string; instance: InlineTool; element: HTMLElement }[] = [];
  private visible = false;
  private savedRange: Range | null = null;
  private undoButton?: HTMLButtonElement;
  private redoButton?: HTMLButtonElement;
  private blockType?: HTMLSelectElement;
  private settings?: HTMLElement;
  private settingsKey = "";
  private more?: HTMLDetailsElement;
  private morePanel?: HTMLElement;
  private alignmentButtons: HTMLButtonElement[] = [];
  private disposers: (() => void)[] = [];

  constructor(private host: Host, private documentMode = false) {
    this.root = el("div", documentMode ? "ez-document-toolbar" : "ez-inline-toolbar");
    this.root.setAttribute("role", "toolbar");
    this.root.setAttribute("data-ez-ui", "true");
    this.root.setAttribute("aria-label", host.i18n.t("toolbar.formatting"));
    this.root.addEventListener("mousedown", (event) => {
      if ((event.target as HTMLElement).closest("button")) event.preventDefault();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (this.more?.open) this.more.open = false;
        this.restoreSelection();
        if (!this.documentMode) this.hide();
      }
      navigateControls(event, (event.target as HTMLElement).closest<HTMLElement>(".ez-more-panel") ?? this.root);
      event.stopPropagation();
    });
    if (documentMode) this.buildDocumentControls();
    for (const reg of host.registry.listInlineTools()) {
      const instance = host.registry.createInlineTool(reg.name, {
        config: {},
        closeToolbar: () => { if (!this.documentMode) this.hide(); },
        onActivate: () => {
          if (!this.restoreSelection()) return;
          applyInlineTool(host, reg.name, instance);
          this.updateSelection(host.getSelectionInfo());
        },
        t: (key) => host.i18n.t(key)
      });
      const element = instance.render();
      this.tools.push({ name: reg.name, instance, element });
      const secondary = documentMode && !["bold", "italic", "underline", "link"].includes(reg.name);
      (secondary ? this.morePanel! : this.root).appendChild(element);
    }
    if (documentMode) {
      this.buildAlignment();
      this.root.appendChild(this.more!);
      this.refresh();
    } else this.root.style.display = "none";
    const reposition = (): void => {
      if (!this.documentMode && this.visible && this.savedRange?.startContainer.isConnected) placePopover(this.root, this.savedRange.getBoundingClientRect());
      if (this.more?.open && this.morePanel) placePopover(this.morePanel, this.more.getBoundingClientRect());
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    this.disposers.push(() => window.removeEventListener("resize", reposition), () => document.removeEventListener("scroll", reposition, true));
  }

  getElement(): HTMLElement { return this.root; }

  private buildDocumentControls(): void {
    const t = (key: string): string => this.host.i18n.t(key);
    this.undoButton = button("ez-btn", t("toolbar.undo"));
    this.redoButton = button("ez-btn", t("toolbar.redo"));
    this.undoButton.addEventListener("click", () => { this.host.undo(); this.refresh(); });
    this.redoButton.addEventListener("click", () => { this.host.redo(); this.refresh(); });
    this.blockType = el("select", "ez-block-select");
    this.blockType.setAttribute("aria-label", t("toolbar.blockType"));
    for (const tool of this.host.registry.listBlockTools()) {
      if (!tool.toolbox) continue;
      const option = el("option", undefined, tool.toolbox.title);
      option.value = tool.name;
      option.disabled = tool.name === "delimiter";
      this.blockType.appendChild(option);
    }
    this.blockType.addEventListener("change", () => {
      const target = this.blockType!.value;
      if (!this.restoreSelection()) return;
      const id = this.host.getSelectionInfo()?.blockId;
      if (id) {
        this.host.convertBlock(id, target);
        this.host.focusBlock(id, "end");
        this.refresh();
      }
    });
    this.settings = el("div", "ez-inline-group ez-type-settings");
    this.more = el("details", "ez-more-formatting");
    const summary = el("summary", "ez-btn", t("toolbar.more"));
    this.morePanel = el("div", "ez-popover ez-more-panel");
    this.morePanel.setAttribute("role", "group");
    this.morePanel.setAttribute("aria-label", t("toolbar.more"));
    this.more.append(summary, this.morePanel);
    this.more.addEventListener("toggle", () => {
      if (this.more!.open) placePopover(this.morePanel!, summary.getBoundingClientRect());
    });
    const outside = (event: Event): void => {
      if (!this.more!.contains(event.target as Node)) this.more!.open = false;
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    this.disposers.push(() => document.removeEventListener("pointerdown", outside), () => document.removeEventListener("focusin", outside));
    this.root.append(this.undoButton, this.redoButton, this.blockType, this.settings);
  }

  private buildAlignment(): void {
    if (!this.host.registry.listTunes().some((tune) => tune.name === "alignment")) return;
    const icons: Record<string, string> = { left: ICONS.alignLeft, center: ICONS.alignCenter, right: ICONS.alignRight };
    const group = el("div", "ez-inline-group");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", this.host.i18n.t("tune.alignment"));
    for (const value of ["left", "center", "right"]) {
      const control = svgButton("ez-inline-btn", icons[value] ?? "", this.host.i18n.t(`tune.alignment.${value}`));
      control.dataset.alignment = value;
      control.addEventListener("click", () => {
        if (!this.restoreSelection()) return;
        const id = this.host.getSelectionInfo()?.blockId;
        if (id) {
          this.host.blocks.setTune(id, "alignment", value);
          this.host.focusBlock(id, "end");
          this.refresh();
        }
      });
      this.alignmentButtons.push(control);
      group.appendChild(control);
    }
    this.morePanel!.append(el("div", "ez-menu-category", this.host.i18n.t("tune.alignment")), group);
  }

  updateSelection(selection: EditorSelection | null): void {
    const range = this.host.getRange();
    if (selection && range) this.savedRange = range.cloneRange();
    else if (!this.root.contains(document.activeElement)) this.savedRange = null;
    if (!this.documentMode) {
      if (!selection || selection.collapsed || this.host.readOnly || !this.inlineEnabled(selection) || !range) {
        this.hide();
        return;
      }
      this.visible = true;
      this.root.style.display = "flex";
      placePopover(this.root, range.getBoundingClientRect());
    }
    this.refresh();
  }

  refresh(): void {
    const selection = this.host.getSelectionInfo();
    const editable = selection ? this.host.getEditableElement(selection.blockId) : null;
    const enabled = !!selection && !this.host.readOnly && this.inlineEnabled(selection);
    const marks = editable ? activeMarks(editable) : new Set<string>();
    for (const { name, instance, element } of this.tools) {
      let active = marks.has(name);
      if (selection && !active) {
        try { active = instance.isActive(selection); } catch { /* Optional custom tool state. */ }
      }
      (instance as InlineTool & { setActive?(active: boolean): void }).setActive?.(active);
      const needsSelection = ["mark", "code"].includes(name) || (name === "link" && !marks.has("link"));
      const disabled = !enabled || (needsSelection && !!selection?.collapsed);
      const controls = element.matches("button") ? [element] : Array.from(element.querySelectorAll("button"));
      for (const control of controls) (control as HTMLButtonElement).disabled = disabled;
    }
    if (!this.documentMode) return;
    this.undoButton!.disabled = this.host.readOnly || !this.host.canUndo();
    this.redoButton!.disabled = this.host.readOnly || !this.host.canRedo();
    this.blockType!.disabled = !selection || this.host.readOnly;
    const block = selection ? this.host.blocks.getById(selection.blockId) : undefined;
    if (block) this.blockType!.value = block.type;
    const data = block?.data as { level?: number; style?: string } | undefined;
    const key = `${block?.id}:${block?.type}:${data?.level}:${data?.style}:${this.host.readOnly}`;
    if (key !== this.settingsKey) {
      this.settingsKey = key;
      clearChildren(this.settings!);
      if (block && !this.host.readOnly) {
        const settings = this.host.getTool(block.id)?.renderSettings?.();
        if (settings) this.settings!.appendChild(settings);
      }
    }
    for (const control of this.alignmentButtons) {
      control.disabled = !block || this.host.readOnly;
      control.setAttribute("aria-pressed", String((block?.tunes?.alignment ?? "left") === control.dataset.alignment));
    }
    if (this.host.readOnly && this.more) this.more.open = false;
  }

  private inlineEnabled(selection: EditorSelection): boolean {
    const type = this.host.getBlockType(selection.blockId);
    return !!type && !!this.host.getEditableElement(selection.blockId)
      && this.host.registry.get(type).toolClass.enableInlineTools !== false && type !== "code";
  }

  private restoreSelection(): boolean {
    if (this.host.readOnly || !this.savedRange?.startContainer.isConnected) return false;
    const range = this.savedRange.cloneRange();
    const source = range.startContainer;
    (source instanceof Element ? source : source.parentElement)?.closest<HTMLElement>("[data-ez-editable]")?.focus();
    this.host.setSelectionFromRange(range);
    return true;
  }

  hide(): void {
    if (this.more) this.more.open = false;
    if (this.documentMode) return;
    this.visible = false;
    this.root.style.display = "none";
  }

  isVisible(): boolean { return this.documentMode || this.visible; }
  withSavedRange<T>(fn: (range: Range) => T): T | undefined { return this.savedRange ? fn(this.savedRange) : undefined; }

  destroy(): void {
    for (const dispose of this.disposers) dispose();
    for (const { instance } of this.tools) instance.destroy?.();
    this.root.remove();
  }
}

export function applyInlineTool(host: Host, toolName: string, instance?: InlineTool): void {
  const selection = host.getSelectionInfo();
  if (!selection || host.readOnly) return;
  const editable = host.getEditableElement(selection.blockId);
  const range = host.getRange()?.cloneRange();
  const type = host.getBlockType(selection.blockId);
  if (!editable || !range || !type || type === "code" || host.registry.get(type).toolClass.enableInlineTools === false) return;
  if (!host.registry.listInlineTools().some((tool) => tool.name === toolName)) return;
  if (range.collapsed && ["mark", "code"].includes(toolName)) return;
  if (range.collapsed && toolName === "link" && !findAncestor(range, editable, (element) => element.tagName === "A")) return;
  editable.focus();
  host.setSelectionFromRange(range);
  const tool = instance ?? host.registry.createInlineTool(toolName, {
    config: {}, closeToolbar: () => undefined, t: (key) => host.i18n.t(key)
  });
  tool.apply(range, {
    blockId: selection.blockId, blockElement: editable, range,
    requestSave: () => host.requestSaveBlock(selection.blockId, "user"),
    closeToolbar: () => undefined
  });
}

export { clearChildren };
