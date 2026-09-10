import type { Host } from "../host";
import type { BlockTune } from "../types";
import { el, svgButton, clearChildren, placePopover, navigateControls } from "./dom";
import { ICONS, isSvgIcon, renderIcon } from "./icons";

/**
 * One horizontal group beside the active block: add and a combined drag/menu control.
 * The actions button opens a block menu with
 * convert / duplicate / move / delete and registered tunes.
 */
export class BlockToolbar {
  private root: HTMLElement;
  private host: Host;
  private settingsPopover: HTMLElement | null = null;
  private activeBlockId: string | null = null;
  private open = false;
  private settingsButton: HTMLButtonElement;
  private disposers: (() => void)[] = [];
  private menuTunes: BlockTune[] = [];
  private activeBlockElement: HTMLElement | null = null;

  constructor(host: Host) {
    this.host = host;
    this.root = el("div", "ez-block-toolbar");
    this.root.setAttribute("role", "toolbar");
    this.root.setAttribute("aria-label", host.i18n.t("toolbar.blockActions"));
    this.root.setAttribute("data-ez-ui", "true");
    this.root.hidden = true;
    this.root.addEventListener("mousedown", (event) => {
      if ((event.target as HTMLElement).closest("button:not([draggable=true])")) event.preventDefault();
    });

    const add = svgButton("ez-tool-btn ez-block-add", ICONS.plus, host.i18n.t("toolbar.add"));
    add.addEventListener("click", () => {
      const id = this.activeBlockId ?? this.host.blocks.blocks[this.host.blocks.length - 1]?.id;
      this.hide();
      this.host.openBlockPicker(id, true);
    });

    const grip = svgButton("ez-tool-btn ez-block-actions", ICONS.grip, host.i18n.t("toolbar.blockActions"));
    grip.title = `${host.i18n.t("toolbar.blockActions")} · ${host.i18n.t("toolbar.drag")}`;
    grip.draggable = true;
    grip.addEventListener("click", () => this.toggleSettings());
    grip.addEventListener("dragstart", (e) => {
      if (!this.activeBlockId) return;
      e.dataTransfer?.setData("text/x-ezynota-drag", this.activeBlockId);
      e.dataTransfer!.effectAllowed = "move";
    });

    this.settingsButton = grip;
    grip.setAttribute("aria-haspopup", "dialog");
    grip.setAttribute("aria-expanded", "false");

    this.root.append(add, grip);
    this.root.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    this.root.addEventListener("keydown", (event) => {
      if (!this.open && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        const controls = Array.from(this.root.querySelectorAll<HTMLButtonElement>(":scope > button"))
          .filter((button) => getComputedStyle(button).display !== "none");
        const direction = (event.key === "ArrowRight" ? 1 : -1) * (this.host.holder.getAttribute("dir") === "rtl" ? -1 : 1);
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        controls[(index + direction + controls.length) % controls.length]?.focus();
        event.preventDefault();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeSettings();
        if (this.activeBlockId) this.host.focusBlock(this.activeBlockId, "end");
      }
      navigateControls(event, this.settingsPopover ?? this.root);
      event.stopPropagation();
    });
    const outside = (event: Event): void => {
      if (!this.root.contains(event.target as Node)) this.closeSettings();
    };
    const reposition = (): void => {
      if (!this.root.hidden && this.activeBlockId) this.showFor(this.activeBlockId);
      if (this.settingsPopover) placePopover(this.settingsPopover, this.settingsButton.getBoundingClientRect());
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    this.disposers.push(() => document.removeEventListener("pointerdown", outside), () => document.removeEventListener("focusin", outside),
      () => window.removeEventListener("resize", reposition), () => document.removeEventListener("scroll", reposition, true));
  }

  getElement(): HTMLElement {
    return this.root;
  }

  showFor(blockId: string): void {
    if (this.host.readOnly) { this.hide(); return; }
    if (this.activeBlockId !== blockId) this.closeSettings();
    this.activeBlockId = blockId;
    const blockEl = this.host.holder.querySelector(`[data-ez-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
    if (!blockEl) {
      this.hide();
      return;
    }
    const holderRect = this.host.holder.getBoundingClientRect();
    const rect = blockEl.getBoundingClientRect();
    if (this.activeBlockElement !== blockEl) this.activeBlockElement?.classList.remove("ez-active");
    this.activeBlockElement = blockEl;
    blockEl.classList.add("ez-active");
    this.root.hidden = false;
    // Measure the visible controls (one on narrow screens, two on desktop)
    // and align their center with the block's first text line.
    const toolbarRect = this.root.getBoundingClientRect();
    const editable = this.host.getEditableElement(blockId);
    const firstLine = editable?.querySelector("li") ?? editable;
    const lineRect = firstLine?.getBoundingClientRect() ?? rect;
    const lineHeight = firstLine ? Number.parseFloat(getComputedStyle(firstLine).lineHeight) || 26 : rect.height;
    this.root.style.top = `${Math.round(lineRect.top - holderRect.top + this.host.holder.scrollTop + (Math.min(lineHeight, lineRect.height) - toolbarRect.height) / 2)}px`;
    const rtl = this.host.holder.getAttribute("dir") === "rtl";
    this.root.style.left = "";
    this.root.style.right = "";
    this.root.style[rtl ? "right" : "left"] = rtl
      ? `${Math.max(0, Math.round(holderRect.right - rect.right - toolbarRect.width - 10))}px`
      : `${Math.max(0, Math.round(rect.left - holderRect.left - toolbarRect.width - 10))}px`;
    this.root.classList.add("ez-visible");
  }

  hide(): void {
    this.closeSettings();
    this.root.hidden = true;
    this.root.classList.remove("ez-visible");
    this.activeBlockElement?.classList.remove("ez-active");
    this.activeBlockElement = null;
  }

  private toggleSettings(): void {
    if (this.open) {
      this.closeSettings();
      return;
    }
    this.openSettings();
  }

  private openSettings(): void {
    if (!this.activeBlockId || this.host.readOnly) return;
    this.host.focusBlock(this.activeBlockId, "end");
    this.settingsPopover = el("div", "ez-popover");
    this.settingsPopover.setAttribute("role", "dialog");
    this.settingsPopover.setAttribute("aria-label", this.host.i18n.t("toolbar.settings"));
    this.renderSettingsMenu(this.activeBlockId);
    const blockEl = this.host.holder.querySelector(`[data-ez-block-id="${CSS.escape(this.activeBlockId)}"]`) as HTMLElement | null;
    if (!blockEl) return;
    this.root.appendChild(this.settingsPopover);
    placePopover(this.settingsPopover, this.settingsButton.getBoundingClientRect());
    this.open = true;
    this.settingsButton.setAttribute("aria-expanded", "true");
    this.settingsPopover.querySelector<HTMLButtonElement>("button")?.focus();
  }

  private closeSettings(): void {
    const popover = this.settingsPopover;
    const tunes = this.menuTunes;
    // Removing a focused menu can synchronously emit blur/focusout and call
    // hide() again. Release ownership before touching the DOM so that the
    // nested close cannot attempt to remove the same node twice.
    this.settingsPopover = null;
    this.menuTunes = [];
    this.open = false;
    this.settingsButton.setAttribute("aria-expanded", "false");
    popover?.remove();
    for (const tune of tunes) tune.destroy?.();
  }

  private renderSettingsMenu(blockId: string): void {
    const menu = el("div", "ez-menu");
    const type = this.host.getBlockType(blockId) ?? "";
    menu.appendChild(this.menuButton(ICONS.plus, this.host.i18n.t("toolbar.addBelow"), () => {
      this.hide();
      this.host.openBlockPicker(blockId, true);
    }));
    const toolSettings = this.host.getTool(blockId)?.renderSettings?.();
    if (toolSettings) menu.appendChild(toolSettings);

    const convertibles = this.host.registry.listBlockTools().filter((t) => t.name !== type && t.name !== "delimiter");
    if (convertibles.length > 0) {
      menu.appendChild(el("div", "ez-menu-category", this.host.i18n.t("settings.convert")));
      for (const tool of convertibles) {
        if (!tool.toolbox) continue;
        const item = this.menuButton(tool.toolbox.icon ?? "•", tool.toolbox.title, () => {
          this.closeSettings();
          this.hide();
          this.host.convertBlock(blockId, tool.name);
          this.host.focusBlock(blockId, "end");
        });
        menu.appendChild(item);
      }    }

    menu.appendChild(el("div", "ez-menu-category", this.host.i18n.t("toolbar.settings")));

    const dup = this.menuButton(ICONS.copy, this.host.i18n.t("settings.duplicate"), () => {
      this.closeSettings();
      this.hide();
      const id = this.host.duplicateBlock(blockId);
      this.host.focusBlock(id, "end");
    });
    const up = this.menuButton(ICONS.up, this.host.i18n.t("settings.moveUp"), () => {
      this.closeSettings();
      this.hide();
      const index = this.host.getBlockIndex(blockId);
      if (index > 0) this.host.moveBlock(blockId, index - 1);
      this.host.focusBlock(blockId, "end");
    });
    const down = this.menuButton(ICONS.down, this.host.i18n.t("settings.moveDown"), () => {
      this.closeSettings();
      this.hide();
      const index = this.host.getBlockIndex(blockId);
      if (index >= 0 && index < this.host.blocks.length - 1) this.host.moveBlock(blockId, index + 1);
      this.host.focusBlock(blockId, "end");
    });
    const del = this.menuButton(ICONS.trash, this.host.i18n.t("settings.delete"), () => {
      this.closeSettings();
      this.hide();
      const index = this.host.getBlockIndex(blockId);
      this.host.removeBlock(blockId);
      const next = this.host.blocks.blocks[Math.min(index, this.host.blocks.length - 1)];
      if (next) this.host.focusBlock(next.id, "end");
      else this.host.holder.querySelector<HTMLElement>(".ez-empty-input")?.focus();
      this.host.announce(this.host.i18n.t("settings.deleted"));
    });
    del.classList.add("ez-danger");
    up.disabled = this.host.getBlockIndex(blockId) === 0;
    down.disabled = this.host.getBlockIndex(blockId) === this.host.blocks.length - 1;
    menu.append(dup, up, down, del);

    for (const tune of this.host.registry.listTunes()) {
      const tuneContent = this.renderTuneMenu(blockId, tune.name);
      if (tuneContent) {
        menu.appendChild(el("div", "ez-menu-category", this.host.i18n.t(`tune.${tune.name}`)));
        menu.appendChild(tuneContent);
      }
    }

    const pop = this.settingsPopover;
    if (pop) {
      clearChildren(pop);
      pop.appendChild(menu);
    }
  }

  private renderTuneMenu(blockId: string, tuneName: string): HTMLElement | null {
    try {
      const tune = this.host.registry.createTune(tuneName, {
        api: this.hostToolApi(blockId),
        config: {},
        value: this.host.blocks.getById(blockId)?.tunes?.[tuneName] ?? null,
        onChange: (value) => {
          this.host.blocks.setTune(blockId, tuneName, value);
          this.closeSettings();
          this.host.focusBlock(blockId, "end");
        },
        t: (key) => this.host.i18n.t(key)
      });
      const rendered = tune.render();
      this.menuTunes.push(tune);
      rendered.setAttribute("role", "group");
      return rendered;
    } catch {
      return null;
    }
  }

  private hostToolApi(blockId: string): import("../core/types").BlockAPI {
    // Minimal BlockAPI shim for tune option menus.
    const host = this.host;
    return {
      id: blockId,
      type: host.getBlockType(blockId) ?? "",
      readOnly: host.readOnly,
      element: (host.holder.querySelector(`[data-ez-block-id="${CSS.escape(blockId)}"] .ez-tool-host`) as HTMLElement) ?? document.createElement("div"),
      getData: () => host.getBlockData(blockId) ?? {},
      update: (data) => host.updateBlockData(blockId, data),
      patch: (data) => {
        const current = (host.getBlockData(blockId) as Record<string, unknown>) ?? {};
        const next = { ...current, ...(data as Record<string, unknown>) } as never;
        host.updateBlockData(blockId, next);
      },
      requestSave: () => host.requestSaveBlock(blockId),
      focus: (at) => host.focusBlock(blockId, at),
      remove: () => host.removeBlock(blockId),
      move: (position) => host.moveBlock(blockId, position as never),
      duplicate: () => host.duplicateBlock(blockId),
      convert: (target) => host.convertBlock(blockId, target)
    };
  }

  private menuButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = el("button", "ez-menu-item");
    btn.type = "button";
    if (isSvgIcon(icon)) {
      btn.appendChild(renderIcon(icon));
    } else {
      const iconEl = el("span", "ez-menu-icon", icon);
      btn.appendChild(iconEl);
    }
    const label = el("span", "ez-menu-label", title);
    btn.appendChild(label);
    btn.addEventListener("click", onClick);
    return btn;
  }

  destroy(): void {
    this.hide();
    for (const dispose of this.disposers) dispose();
    this.root.remove();
  }
}
