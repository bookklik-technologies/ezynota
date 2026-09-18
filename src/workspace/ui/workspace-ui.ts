import type { WorkspaceState } from "../workspace";
import type { SaveStatus, SearchHit, WorkspaceEvent, WorkspaceTheme } from "../types";
import type { NoteRecord, FolderRecord } from "../types";
import { el, button, svgButton, clearChildren, navigateControls, placePopover } from "../../ui/dom";
import { ICONS, renderIcon } from "../../ui/icons";
import { BRAND_LOGO } from "../../ui/brand";
import { inlineToPlainText } from "../../rich-text/types";
import type { EzynotaBlock } from "../../types";
import { EzynotaError } from "../../core/errors";

export interface WorkspaceUIDeps {
  undo(): void;
  redo(): void;
  getHistoryState(): { canUndo: boolean; canRedo: boolean };
  createNote(title?: string, folderId?: string | null): string | null;
  createFolder(name?: string, parentId?: string | null): string | null;
  renameNote(id: string, title: string): void;
  renameFolder(id: string, name: string): void;
  moveNote(id: string, folderId: string | null): void;
  moveFolder(id: string, parentId: string | null): boolean;
  /** Returns a promise when the note load is asynchronous (used to queue goToBlock). */
  openNote(id: string): void | Promise<void>;
  openFolder(id: string | null): void;
  duplicateNote(id: string): void;
  trashNote(id: string): void;
  trashFolder(id: string): void;
  restoreNote(id: string): void;
  deleteNoteForever(id: string): void;
  restoreFolder(id: string): void;
  deleteFolderForever(id: string): void;
  emptyTrash(): void;
  retrySave(): void;
  searchWorkspace(query: string): SearchHit[];
  exportActiveNote(format: "json" | "md" | "html" | "txt"): void;
  printActiveNote(): void;
  importFiles(files: File[]): void;
  createBackup(): void;
  restoreBackupFile(file: File): void;
  setTheme(theme: WorkspaceTheme): void;
  toggleFullscreen(): void;
  retryLoad(): void;
  downloadOriginal(): void;
  findInDocument(query: string, replaceWith: string, replaceAll: boolean): void;
  goToBlock(blockId: string): void;
  getWordCount(): number;
  getLegacyDraft(): string | null;
  importLegacyDraft(data: string): void;
  dismissLegacyDraft(): void;
}

const THEME_LABELS: Record<WorkspaceTheme, string> = { light: "Light", dark: "Dark", system: "System" };

/** The controller reports runtime failures with an extra event kind (typed
 * via a structural read because WorkspaceEvent's union lives in types.ts). */
function importErrorMessage(event: WorkspaceEvent): string | null {
  const record = event as { type?: string; message?: string };
  return record.type === "importError" ? record.message ?? "Import failed" : null;
}

function statusLabel(status: SaveStatus, error?: unknown): string {
  switch (status) {
    case "saving": return "Saving…";
    case "saved": return "Saved";
    case "error": {
      const reason = error instanceof EzynotaError ? error.context?.reason : undefined;
      if (reason === "stale") return "Save conflict — export a backup before reloading";
      if (reason === "quota") return "Browser storage full — click to retry";
      return "Browser save failed — click to retry";
    }
    default: return "Ready";
  }
}

/**
 * WorkspaceUI renders the notes workspace shell around the document
 * surface: sidebar, header, outline, search and fullscreen. It is a view
 * of WorkspaceState and never mutates data directly — all actions go
 * through the controller-provided deps.
 */
export class WorkspaceUI {
  private root: HTMLElement;
  private state: WorkspaceState;
  private deps: WorkspaceUIDeps;
  private showSidebar: boolean;

  private sidebar: HTMLElement | null = null;
  private sidebarToggle: HTMLElement | null = null;
  private notesTree: HTMLElement | null = null;
  private noteCount: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchResults: HTMLElement | null = null;
  private titleInput: HTMLInputElement | null = null;
  private breadcrumbs: HTMLElement | null = null;
  private saveStatusEl: HTMLElement | null = null;
  private saveStatusDot: HTMLElement | null = null;
  private wordCountEl: HTMLElement | null = null;
  private outlinePanel: HTMLElement | null = null;
  private fullscreenBtn: HTMLButtonElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private themeMenu: HTMLDetailsElement | null = null;
  private docMenu: HTMLDetailsElement | null = null;
  private exportMenu: HTMLDetailsElement | null = null;
  private importInput: HTMLInputElement | null = null;
  private errorPanel: HTMLElement | null = null;
  private legacyPanel: HTMLElement | null = null;
  private noticeEl: HTMLElement | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private findDialog: HTMLElement | null = null;
  private findReturnFocus: HTMLElement | null = null;
  private findInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private disposers: (() => void)[] = [];
  private expandedFolders = new Set<string>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private treeDrag: { kind: "note" | "folder"; id: string } | null = null;
  private treeDropHighlight: HTMLElement | null = null;

  constructor(root: HTMLElement, state: WorkspaceState, deps: WorkspaceUIDeps, showSidebar = true) {
    this.root = root;
    this.state = state;
    this.deps = deps;
    this.showSidebar = showSidebar;
  }

  mount(): void {
    this.buildShell();
    this.refreshHistory();
    const offNotes = this.state.on((event) => this.handleEvent(event));
    this.disposers.push(offNotes);
    this.renderSidebar();
    this.updateHeader();
    this.maybeShowLegacyDraft();
  }

  destroy(): void {
    this.root.dispatchEvent(new Event("ez-close-popovers"));
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  /** Public event entry point used by the controller. */
  notifyEvent(event: import("../types").WorkspaceEvent): void {
    this.handleEvent(event);
  }

  refreshHistory(): void {
    const { canUndo, canRedo } = this.deps.getHistoryState();
    if (this.undoButton) this.undoButton.disabled = !canUndo;
    if (this.redoButton) this.redoButton.disabled = !canRedo;
  }

  /** Highlight and expand a folder in the sidebar tree. */
  highlightFolder(folderId: string): void {
    this.expandedFolders.add(folderId);
    this.renderSidebar();
  }

  private handleEvent(event: WorkspaceEvent): void {
    const importError = importErrorMessage(event);
    if (importError !== null) {
      this.showNotice(importError);
      return;
    }
    if (event.type === "loadFailed") {
      this.showErrorPanel();
      return;
    }
    if (event.type === "loaded") {
      this.hideErrorPanel();
    }
    if (event.type === "saveStatus") {
      this.updateSaveStatus(event.status, event.error);
      return;
    }
    if (event.type === "remoteChange") {
      // Another tab wrote to this workspace: re-render from the fresh state.
      this.renderSidebar();
      this.updateHeader();
      return;
    }
    if (event.type === "noteRenamed") {
      this.scheduleHeaderRefresh();
      return;
    }
    // Notes/folders/trash/active changed → re-render lists (debounced).
    this.scheduleSidebarRefresh();
    this.scheduleHeaderRefresh();
  }

  private scheduleSidebarRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.renderSidebar();
      this.updateHeader();
    }, 50);
  }

  private scheduleHeaderRefresh(): void {
    this.scheduleSidebarRefresh();
  }

  /* ---------- shell ---------- */

  private buildShell(): void {
    this.root.classList.add("ez-workspace-root");
    if (!this.showSidebar) this.root.classList.add("ez-mode-document");
    const topbar = this.buildTopbar();
    const app = el("div", "ez-workspace");
    app.setAttribute("data-ez-workspace", "true");

    this.sidebar = el("aside", "ez-sidebar");
    this.sidebar.setAttribute("aria-label", "Notes");
    this.buildSidebarContent();

    const main = el("div", "ez-main");
    main.appendChild(this.buildSidebarToggle());
    const header = this.buildHeader();
    this.errorPanel = this.buildErrorPanel();
    this.legacyPanel = this.buildLegacyPanel();
    this.noticeEl = el("p", "ez-workspace-notice");
    this.noticeEl.setAttribute("role", "status");
    this.noticeEl.setAttribute("aria-live", "polite");
    this.noticeEl.hidden = true;
    const docWrap = el("div", "ez-doc-wrap");
    // The document surface (already mounted by the editor) moves into the shell.
    const surface = this.root.querySelector<HTMLElement>(".ez-editor");
    const backdrop = button("ez-sidebar-backdrop", "", "Close notes sidebar");
    backdrop.tabIndex = -1;
    backdrop.addEventListener("click", () => this.closeMobileSidebar());
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && this.root.classList.contains("ez-sidebar-open")) {
        event.preventDefault();
        event.stopPropagation();
        this.closeMobileSidebar();
      }
      if (event.key === "Tab" && this.root.classList.contains("ez-sidebar-open")) {
        const controls = Array.from(this.sidebar?.querySelectorAll<HTMLElement>("button, input, summary") ?? [])
          .filter((control) => control.getClientRects().length > 0 && !control.hasAttribute("disabled"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    this.root.addEventListener("keydown", onKey);
    this.disposers.push(() => this.root.removeEventListener("keydown", onKey));
    const headerRow = el("div", "ez-header-row");
    headerRow.append(header);
    const documentColumn = el("div", "ez-document-column");
    documentColumn.append(headerRow, this.noticeEl, this.errorPanel, this.legacyPanel, docWrap);
    main.appendChild(documentColumn);
    if (surface) {
      docWrap.appendChild(surface);
    } else {
      docWrap.appendChild(el("div", "ez-editor"));
    }

    app.append(backdrop, this.sidebar, main);
    this.root.append(topbar, app, this.buildStatusbar());
    this.applyTheme(this.state ? (this.root.getAttribute("data-ez-theme") as WorkspaceTheme | null) ?? "system" : "system");
    this.outlinePanel = this.buildOutline();
    main.appendChild(this.outlinePanel);
    this.findDialog = this.buildFindDialog();
    main.insertBefore(this.findDialog, documentColumn);
    this.buildHiddenImportInput();
  }

  private buildSidebarToggle(): HTMLElement {
    this.sidebarToggle = svgButton("ez-icon-btn ez-sidebar-toggle", ICONS.panelLeft, "Toggle notes sidebar");
    this.sidebarToggle.setAttribute("aria-expanded", String(!window.matchMedia("(max-width: 900px)").matches));
    this.sidebarToggle.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        this.root.classList.remove("ez-sidebar-collapsed");
        const open = this.root.classList.toggle("ez-sidebar-open");
        this.sidebarToggle?.setAttribute("aria-expanded", String(open));
        if (open) this.searchInput?.focus();
      } else {
        const collapsed = this.root.classList.toggle("ez-sidebar-collapsed");
        this.sidebarToggle?.setAttribute("aria-expanded", String(!collapsed));
      }
    });
    return this.sidebarToggle;
  }

  /** Suite-standard topbar: brand + document actions, shared with the shell. */
  private buildTopbar(): HTMLElement {
    const topbar = el("header", "ez-topbar");
    const brand = el("div", "ez-brand");
    const brandMark = el("span", "ez-brand-mark");
    brandMark.innerHTML = BRAND_LOGO; // static, code-owned brand asset (mirrors icon.svg)
    brand.append(brandMark, el("span", "ez-brand-name", "Ezynota"));

    const actions = el("div", "ez-topbar-actions");
    const historyActions = el("div", "ez-topbar-group ez-history-actions");
    historyActions.setAttribute("role", "group");
    historyActions.setAttribute("aria-label", "Edit history");
    historyActions.setAttribute("data-ez-ui", "true");
    this.undoButton = svgButton("ez-icon-btn", ICONS.undo, "Undo");
    this.redoButton = svgButton("ez-icon-btn", ICONS.redo, "Redo");
    for (const control of [this.undoButton, this.redoButton]) {
      control.querySelector("svg")?.setAttribute("aria-hidden", "true");
      control.addEventListener("mousedown", (event) => event.preventDefault());
    }
    this.undoButton.addEventListener("click", () => { this.deps.undo(); this.refreshHistory(); });
    this.redoButton.addEventListener("click", () => { this.deps.redo(); this.refreshHistory(); });
    historyActions.append(this.undoButton, this.redoButton);
    const documentActions = el("div", "ez-topbar-group ez-document-actions");
    const outlineBtn = svgButton("ez-icon-btn", ICONS.outline, "Toggle heading outline");
    outlineBtn.setAttribute("aria-expanded", "false");
    const toggleOutline = (): void => {
      const open = this.root.classList.toggle("ez-outline-open");
      outlineBtn.setAttribute("aria-expanded", String(open));
      mobileOutline.setAttribute("aria-expanded", String(open));
    };
    outlineBtn.addEventListener("click", toggleOutline);
    const findBtn = svgButton("ez-icon-btn", ICONS.search, "Find in document");
    findBtn.addEventListener("click", () => this.openFindDialog());
    documentActions.append(outlineBtn, findBtn);

    this.fullscreenBtn = svgButton("ez-icon-btn", ICONS.maximize, "Enter fullscreen");
    this.fullscreenBtn.addEventListener("click", () => this.deps.toggleFullscreen());

    this.docMenu = el("details", "ez-doc-menu") as HTMLDetailsElement;
    const menuSummary = el("summary", "ez-icon-btn ez-doc-menu-btn");
    menuSummary.appendChild(renderIcon(ICONS.ellipsis));
    menuSummary.setAttribute("aria-label", "Document menu");
    const panel = el("div", "ez-doc-menu-panel");
    panel.setAttribute("data-ez-ui", "true");
    const makeItem = (label: string, run: () => void, menu: HTMLDetailsElement = this.docMenu!): HTMLElement => {
      const item = button("ez-doc-menu-item", label);
      item.addEventListener("click", () => {
        if (menu.contains(document.activeElement)) menu.querySelector("summary")?.focus();
        menu.open = false;
        run();
      });
      return item;
    };
    const mobileOutline = makeItem("Toggle heading outline", toggleOutline);
    mobileOutline.classList.add("ez-mobile-action");
    mobileOutline.setAttribute("aria-expanded", "false");
    const mobileFind = makeItem("Find in document", () => this.openFindDialog());
    mobileFind.classList.add("ez-mobile-action");
    panel.append(
      mobileOutline,
      mobileFind,
      makeItem("Print document", () => this.deps.printActiveNote()),
      makeItem("Import file…", () => this.importInput?.click()),
      makeItem("Download workspace backup", () => this.deps.createBackup()),
      makeItem("Restore workspace backup…", () => this.pickBackupFile())
    );
    this.docMenu.append(menuSummary, panel);

    this.exportMenu = el("details", "ez-doc-menu ez-export-menu") as HTMLDetailsElement;
    const exportSummary = el("summary", "ez-export-btn");
    exportSummary.setAttribute("aria-label", "Export document");
    exportSummary.append(renderIcon(ICONS.download), el("span", "", "Export"), renderIcon(ICONS.down));
    const exportPanel = el("div", "ez-doc-menu-panel");
    exportPanel.setAttribute("data-ez-ui", "true");
    exportPanel.append(
      makeItem("Download JSON", () => this.deps.exportActiveNote("json"), this.exportMenu),
      makeItem("Export Markdown", () => this.deps.exportActiveNote("md"), this.exportMenu),
      makeItem("Export HTML", () => this.deps.exportActiveNote("html"), this.exportMenu),
      makeItem("Export plain text", () => this.deps.exportActiveNote("txt"), this.exportMenu)
    );
    this.exportMenu.append(exportSummary, exportPanel);

    this.themeMenu = el("details", "ez-theme-menu") as HTMLDetailsElement;
    const themeSummary = el("summary", "ez-icon-btn");
    themeSummary.appendChild(renderIcon(ICONS.sun));
    themeSummary.setAttribute("aria-label", "Theme");
    const themePanel = el("div", "ez-theme-panel");
    themePanel.setAttribute("data-ez-ui", "true");
    for (const theme of ["light", "dark", "system"] as WorkspaceTheme[]) {
      const item = button("ez-theme-item", THEME_LABELS[theme]);
      item.setAttribute("data-ez-theme-choice", theme);
      item.addEventListener("click", () => {
        if (this.themeMenu?.contains(document.activeElement)) themeSummary.focus();
        this.deps.setTheme(theme);
        if (this.themeMenu) this.themeMenu.open = false;
      });
      themePanel.appendChild(item);
    }
    this.themeMenu.append(themeSummary, themePanel);

    const viewActions = el("div", "ez-topbar-group");
    viewActions.append(this.themeMenu, this.fullscreenBtn, this.docMenu);
    actions.append(historyActions, documentActions, viewActions, this.exportMenu);
    topbar.append(brand, el("div", "ez-topbar-spacer"), actions);
    const menus = [this.docMenu, this.themeMenu, this.exportMenu];
    const positionMenus = (): void => {
      for (const menu of menus) {
        if (!menu.open) continue;
        const popup = menu.querySelector<HTMLElement>("[data-ez-ui]");
        const summary = menu.querySelector("summary");
        if (!popup || !summary) continue;
        popup.style.insetInlineEnd = "auto";
        placePopover(popup, summary.getBoundingClientRect());
      }
    };
    for (const menu of menus) {
      menu.addEventListener("toggle", () => {
        if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
        positionMenus();
      });
      menu.addEventListener("keydown", (event) => {
        if (!menu.open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
          .filter((item) => item.getClientRects().length > 0);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : index < 0 ? (event.key === "ArrowUp" ? items.length - 1 : 0)
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
        event.preventDefault();
        event.stopPropagation();
      });
    }
    const closeMenus = (event: Event): void => {
      for (const menu of menus) {
        if (!menu?.open) continue;
        if (event instanceof KeyboardEvent && event.key === "Escape") {
          menu.open = false;
          menu.querySelector("summary")?.focus();
          event.stopPropagation();
        } else if (event.type === "pointerdown" && !menu.contains(event.target as Node)) {
          menu.open = false;
        }
      }
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("scroll", positionMenus, true);
    window.addEventListener("resize", positionMenus);
    this.root.addEventListener("keydown", closeMenus);
    this.disposers.push(() => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("scroll", positionMenus, true);
      window.removeEventListener("resize", positionMenus);
      this.root.removeEventListener("keydown", closeMenus);
    });
    return topbar;
  }

  private buildSidebarContent(): void {
    if (!this.sidebar) return;
    clearChildren(this.sidebar);
    const searchRow = el("div", "ez-sidebar-search-row");
    const searchWrap = el("div", "ez-sidebar-search");
    this.searchInput = el("input", "ez-sidebar-search-input");
    this.searchInput.type = "search";
    this.searchInput.placeholder = "Search notes…";
    this.searchInput.setAttribute("aria-label", "Search workspace");
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    this.disposers.push(() => { if (searchTimer) clearTimeout(searchTimer); });
    this.searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.renderSearchResults(this.searchInput?.value ?? ""), 200);
    });
    const searchIcon = el("span", "ez-sidebar-search-icon");
    searchIcon.innerHTML = ICONS.search;
    searchIcon.setAttribute("aria-hidden", "true");
    searchWrap.append(searchIcon, this.searchInput);
    const closeSidebar = svgButton("ez-icon-btn ez-sidebar-close", ICONS.x, "Close notes sidebar");
    closeSidebar.addEventListener("click", () => this.closeMobileSidebar());
    searchRow.append(searchWrap, closeSidebar);
    this.searchResults = el("div", "ez-search-results");
    this.searchResults.setAttribute("role", "listbox");
    this.searchResults.setAttribute("aria-label", "Search results");

    const actions = el("div", "ez-sidebar-actions");
    const newNote = button("ez-sidebar-btn ez-new-note", "New note");
    newNote.prepend(renderIcon(ICONS.plus));
    newNote.addEventListener("click", () => {
      this.deps.createNote();
      this.closeMobileSidebar(false);
    });
    const newFolder = svgButton("ez-sidebar-btn ez-new-folder", ICONS.folderPlus, "New folder");
    newFolder.addEventListener("click", () => this.deps.createFolder());
    actions.append(newNote, newFolder);

    this.notesTree = el("nav", "ez-notes-tree");
    this.notesTree.setAttribute("aria-label", "Folders and notes");

    const trash = this.buildTrashSection();
    const sectionLabel = el("div", "ez-sidebar-section-label");
    this.noteCount = el("span", "ez-note-count", "0");
    sectionLabel.append(el("span", "", "Your notes"), this.noteCount);
    this.setupTreeDragAndDrop(this.notesTree, sectionLabel);
    // const storage = el("div", "ez-storage-note");
    // storage.appendChild(renderIcon(ICONS.monitor));
    // storage.appendChild(el("span", "", "Stored in this browser"));
    // storage.title = "Download a workspace backup from the document menu to keep a copy.";
    this.sidebar.append(searchRow, this.searchResults, actions, sectionLabel, this.notesTree, trash);
  }

  private closeMobileSidebar(restoreFocus = true): void {
    this.root.classList.remove("ez-sidebar-open");
    if (window.matchMedia("(max-width: 900px)").matches) {
      this.sidebarToggle?.setAttribute("aria-expanded", "false");
      if (restoreFocus) this.sidebarToggle?.focus();
    }
  }

  /* ---------- sidebar rendering ---------- */

  private renderSidebar(): void {
    if (!this.notesTree) return;
    clearChildren(this.notesTree);
    const folders = this.state.listFolders();
    const notes = this.state.listNotes();
    if (this.noteCount) this.noteCount.textContent = String(notes.length);
    const roots = folders.filter((f) => !f.parentId);
    for (const folder of roots) this.renderFolder(folder, folders, notes, 0);
    const rootNotes = notes.filter((n) => !n.folderId);
    for (const note of rootNotes) this.renderNote(note, 0);
    if (folders.length === 0 && notes.length === 0) {
      const empty = el("div", "ez-notes-empty");
      empty.textContent = "No notes yet — create one to start writing.";
      this.notesTree.appendChild(empty);
    }
  }

  /**
   * Native drag & drop inside the sidebar tree: notes and folders can be
   * dragged onto a folder row (moved into it) or onto the tree background /
   * the "Your notes" section label (moved back to the workspace root).
   */
  private setupTreeDragAndDrop(tree: HTMLElement, rootZone: HTMLElement): void {
    const DRAG_MIME = "text/x-ezynota-tree";

    const clearHighlight = (): void => {
      this.treeDropHighlight?.classList.remove("ez-drop-target");
      this.treeDropHighlight = null;
    };
    const endDrag = (): void => {
      this.treeDrag = null;
      clearHighlight();
    };

    const onDragStart = (event: Event): void => {
      const dragEvent = event as DragEvent;
      const row = (dragEvent.target as HTMLElement | null)?.closest<HTMLElement>(".ez-tree-row");
      if (!row || !dragEvent.dataTransfer) return;
      const id = row.dataset.noteId ?? row.dataset.folderId;
      if (!id) return;
      this.treeDrag = { kind: row.dataset.noteId ? "note" : "folder", id };
      row.classList.add("ez-dragging");
      dragEvent.dataTransfer.effectAllowed = "move";
      dragEvent.dataTransfer.setData(DRAG_MIME, JSON.stringify(this.treeDrag));
      dragEvent.dataTransfer.setData("text/plain", id);
    };
    const onDragEnd = (event: Event): void => {
      const dragEvent = event as DragEvent;
      (dragEvent.target as HTMLElement | null)?.closest?.(".ez-tree-row")?.classList.remove("ez-dragging");
      endDrag();
    };
    const onDragOver = (event: Event): void => {
      const dragEvent = event as DragEvent;
      if (!this.treeDrag || !dragEvent.dataTransfer) return;
      const row = (dragEvent.target as HTMLElement | null)?.closest?.<HTMLElement>(".ez-tree-row");
      if (!row) {
        if (rootZone.contains(dragEvent.target as Node)) {
          if (this.treeDropHighlight !== rootZone) {
            clearHighlight();
            rootZone.classList.add("ez-drop-target");
            this.treeDropHighlight = rootZone;
          }
        } else {
          clearHighlight();
        }
      } else if (!row.dataset.folderId) {
        return; // note rows are not drop targets
      } else if (this.treeDrag.kind === "folder" &&
        (row.dataset.folderId === this.treeDrag.id || this.isFolderDescendant(row.dataset.folderId, this.treeDrag.id))) {
        return; // a folder cannot be dropped into itself or its own subtree
      } else if (this.treeDropHighlight !== row) {
        clearHighlight();
        row.classList.add("ez-drop-target");
        this.treeDropHighlight = row;
      }
      dragEvent.preventDefault();
      dragEvent.dataTransfer.dropEffect = "move";
    };
    const onDrop = (event: Event): void => {
      const dragEvent = event as DragEvent;
      if (!this.treeDrag) return;
      const drag = this.treeDrag;
      endDrag();
      dragEvent.preventDefault();
      const row = (dragEvent.target as HTMLElement | null)?.closest?.<HTMLElement>(".ez-tree-row");
      if (row && !row.dataset.folderId) return;
      const targetFolderId = row?.dataset.folderId ?? null;
      if (drag.kind === "note") {
        this.deps.moveNote(drag.id, targetFolderId);
        if (targetFolderId) this.expandedFolders.add(targetFolderId);
      } else if (this.deps.moveFolder(drag.id, targetFolderId) && targetFolderId) {
        this.expandedFolders.add(targetFolderId);
      }
    };

    const onDragLeave = (event: Event): void => {
      if ((event as DragEvent).target === tree) clearHighlight();
    };

    for (const zone of [tree, rootZone]) {
      zone.addEventListener("dragstart", onDragStart);
      zone.addEventListener("dragend", onDragEnd);
      zone.addEventListener("dragover", onDragOver);
      zone.addEventListener("drop", onDrop);
      zone.addEventListener("dragleave", onDragLeave);
    }
    this.disposers.push(() => {
      for (const zone of [tree, rootZone]) {
        zone.removeEventListener("dragstart", onDragStart);
        zone.removeEventListener("dragend", onDragEnd);
        zone.removeEventListener("dragover", onDragOver);
        zone.removeEventListener("drop", onDrop);
        zone.removeEventListener("dragleave", onDragLeave);
      }
    });
  }

  /** True when `folderId` sits anywhere inside `ancestorId`'s subtree. */
  private isFolderDescendant(folderId: string, ancestorId: string): boolean {
    let folder = this.state.getFolder(folderId);
    while (folder?.parentId) {
      if (folder.parentId === ancestorId) return true;
      folder = this.state.getFolder(folder.parentId);
    }
    return false;
  }

  private renderFolder(folder: FolderRecord, folders: FolderRecord[], notes: NoteRecord[], depth: number): void {
    if (!this.notesTree) return;
    const expanded = this.expandedFolders.has(folder.id);
    const row = el("div", "ez-tree-row ez-tree-folder");
    row.style.paddingInlineStart = `${depth * 14}px`;
    row.dataset.folderId = folder.id;
    row.draggable = true;
    const caret = svgButton("ez-tree-caret", expanded ? ICONS.caretDown : ICONS.caretRight, `Expand ${folder.name}`);
    caret.setAttribute("aria-expanded", String(expanded));
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.expandedFolders.has(folder.id)) this.expandedFolders.delete(folder.id);
      else this.expandedFolders.add(folder.id);
      this.renderSidebar();
    });
    const label = button("ez-tree-label", folder.name);
    label.prepend(renderIcon(expanded ? ICONS.folderOpen : ICONS.folder));
    label.setAttribute("data-folder-id", folder.id);
    label.addEventListener("click", () => {
      this.expandedFolders.add(folder.id);
      this.deps.openFolder(folder.id);
      this.renderSidebar();
    });
    const rename = svgButton("ez-tree-action", ICONS.ellipsis, `Folder actions for ${folder.name}`);
    rename.addEventListener("click", (e) => {
      e.stopPropagation();
      this.folderActions(folder, rename);
    });
    row.append(caret, label, rename);
    if (this.state.activeFolderId === folder.id) row.classList.add("ez-active");
    this.notesTree.appendChild(row);
    if (!expanded) return;
    for (const child of folders.filter((f) => f.parentId === folder.id)) {
      this.renderFolder(child, folders, notes, depth + 1);
    }
    for (const note of notes.filter((n) => n.folderId === folder.id)) {
      this.renderNote(note, depth + 1);
    }
  }

  private renderNote(note: NoteRecord, depth: number): void {
    if (!this.notesTree) return;
    const row = el("div", "ez-tree-row ez-tree-note");
    row.style.paddingInlineStart = `${depth * 14 + 4}px`;
    row.dataset.noteId = note.id;
    row.draggable = true;
    const label = button("ez-tree-label", note.title || "Untitled");
    label.setAttribute("data-note-id", note.id);
    label.title = note.title || "Untitled";
    label.prepend(renderIcon(ICONS.file));
    if (this.state.activeNoteId === note.id) label.setAttribute("aria-current", "page");
    label.addEventListener("click", () => {
      this.deps.openNote(note.id);
      this.closeMobileSidebar(false);
    });
    const actions = svgButton("ez-tree-action", ICONS.ellipsis, `Note actions for ${note.title || "Untitled"}`);
    actions.addEventListener("click", (e) => {
      e.stopPropagation();
      this.noteActions(note, actions);
    });
    row.append(label, actions);
    if (this.state.activeNoteId === note.id) row.classList.add("ez-active");
    this.notesTree.appendChild(row);
  }

  private noteActions(note: NoteRecord, anchor?: HTMLElement): void {
    openSidebarMenu([
      { label: "Rename…", run: () => {
        const name = prompt("Rename note", note.title || "Untitled");
        if (name !== null) this.deps.renameNote(note.id, name.trim());
      } },
      { label: "Duplicate", run: () => this.deps.duplicateNote(note.id) },
      { label: "New note in folder", run: () => this.deps.createNote(undefined, note.folderId) },
      { label: "New folder inside", run: () => this.deps.createFolder(undefined, note.folderId) },
      { label: "Move to trash", danger: true, run: () => this.deps.trashNote(note.id) }
    ], anchor);
  }

  private folderActions(folder: FolderRecord, anchor?: HTMLElement): void {
    openSidebarMenu([
      { label: "Rename…", run: () => {
        const name = prompt("Rename folder", folder.name);
        if (name !== null) this.deps.renameFolder(folder.id, name.trim());
      } },
      { label: "New folder inside", run: () => this.deps.createFolder(undefined, folder.id) },
      { label: "Move to trash", danger: true, run: () => this.deps.trashFolder(folder.id) }
    ], anchor);
  }

  private renderSearchResults(query: string): void {
    if (!this.searchResults) return;
    clearChildren(this.searchResults);
    const trimmed = query.trim();
    if (!trimmed) return;
    const hits = this.deps.searchWorkspace(trimmed);
    if (hits.length === 0) {
      const empty = el("div", "ez-search-empty");
      empty.textContent = "No matches";
      this.searchResults.appendChild(empty);
      return;
    }
    for (const hit of hits.slice(0, 40)) {
      const item = el("button", "ez-search-hit");
      item.type = "button";
      item.setAttribute("role", "option");
      const title = el("span", "ez-search-hit-title");
      title.textContent = hit.title || "Untitled";
      const excerpt = el("span", "ez-search-hit-excerpt");
      excerpt.textContent = hit.excerpt;
      item.append(title, excerpt);
      item.addEventListener("click", () => {
        const opened = this.deps.openNote(hit.noteId);
        this.closeMobileSidebar(false);
        // Queue the block jump until the note has actually loaded: the
        // fire-and-forget openNote used to focus the old document.
        void Promise.resolve(opened).then(() => {
          if (hit.blockId) this.deps.goToBlock(hit.blockId);
        });
        if (this.searchInput) this.searchInput.value = "";
        if (this.searchResults) clearChildren(this.searchResults);
      });
      this.searchResults.appendChild(item);
    }
  }

  private buildTrashSection(): HTMLElement {
    const details = el("details", "ez-trash-section");
    const summary = el("summary", "ez-trash-summary");
    summary.appendChild(renderIcon(ICONS.trash));
    const summaryLabel = el("span");
    summaryLabel.textContent = "Trash";
    summary.appendChild(summaryLabel);
    const list = el("div", "ez-trash-list");
    const renderTrash = (): void => {
      clearChildren(list);
      const notes = this.state.listTrashedNotes();
      const folders = this.state.listTrashedFolders();
      if (notes.length === 0 && folders.length === 0) {
        list.appendChild(el("div", "ez-trash-empty", "Trash is empty"));
        return;
      }
      for (const folder of folders) {
        const row = el("div", "ez-trash-row");
        const label = el("span", "ez-trash-label");
        label.textContent = `${folder.name} (folder)`;
        const restore = svgButton("ez-icon-btn", ICONS.restore, `Restore ${folder.name}`);
        restore.addEventListener("click", () => this.deps.restoreFolder(folder.id));
        const del = svgButton("ez-icon-btn", ICONS.x, `Delete ${folder.name} forever`);
        del.addEventListener("click", () => this.deps.deleteFolderForever(folder.id));
        row.append(label, restore, del);
        list.appendChild(row);
      }
      for (const note of notes) {
        const row = el("div", "ez-trash-row");
        const label = el("span", "ez-trash-label");
        label.textContent = note.title || "Untitled";
        const restore = svgButton("ez-icon-btn", ICONS.restore, `Restore ${note.title}`);
        restore.addEventListener("click", () => this.deps.restoreNote(note.id));
        const del = svgButton("ez-icon-btn", ICONS.x, `Delete ${note.title} forever`);
        del.addEventListener("click", () => this.deps.deleteNoteForever(note.id));
        row.append(label, restore, del);
        list.appendChild(row);
      }
      if (notes.length + folders.length > 1) {
        const emptyTrash = button("ez-trash-empty-btn", "Empty trash");
        emptyTrash.addEventListener("click", () => {
          if (confirm("Permanently delete everything in the trash?")) this.deps.emptyTrash();
        });
        list.appendChild(emptyTrash);
      }
    };
    details.addEventListener("toggle", () => {
      if ((details as HTMLDetailsElement).open) renderTrash();
    });
    details.append(summary, list);
    return details;
  }

  /* ---------- header ---------- */

  private buildHeader(): HTMLElement {
    const header = el("header", "ez-doc-header");
    this.breadcrumbs = el("nav", "ez-breadcrumbs");
    this.breadcrumbs.setAttribute("aria-label", "Folder path");

    const titleRow = el("div", "ez-title-row");
    this.titleInput = el("input", "ez-doc-title");
    this.titleInput.type = "text";
    this.titleInput.placeholder = "Untitled";
    this.titleInput.setAttribute("aria-label", "Note title");
    this.titleInput.addEventListener("input", () => {
      const note = this.state.activeNoteId;
      if (note) this.deps.renameNote(note, this.titleInput?.value ?? "");
    });
    titleRow.appendChild(this.titleInput);

    const navigation = el("div", "ez-document-navigation");
    navigation.append(this.breadcrumbs);
    header.append(navigation, titleRow);
    return header;
  }

  private buildStatusbar(): HTMLElement {
    const statusbar = el("footer", "ez-statusbar");
    statusbar.setAttribute("aria-label", "Document status");
    this.saveStatusDot = el("span", "ez-status-dot");
    this.saveStatusEl = el("span", "ez-status-text");
    this.saveStatusEl.setAttribute("role", "status");
    this.saveStatusEl.setAttribute("aria-live", "polite");
    this.saveStatusEl.textContent = "Ready";
    const statusBtn = el("button", "ez-save-state");
    statusBtn.type = "button";
    statusBtn.append(this.saveStatusDot, this.saveStatusEl);
    statusBtn.addEventListener("click", () => this.deps.retrySave());
    this.wordCountEl = el("span", "ez-word-count");
    this.wordCountEl.textContent = "0 words";

    statusbar.append(statusBtn, this.wordCountEl);
    return statusbar;
  }

  private updateHeader(): void {
    const note = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null;
    if (this.titleInput) {
      if (document.activeElement !== this.titleInput) {
        this.titleInput.value = note?.title ?? "";
      }
      this.titleInput.disabled = !note;
    }
    if (this.breadcrumbs) {
      clearChildren(this.breadcrumbs);
      if (note) {
        const path = this.state.folderPath(note.folderId);
        if (path.length > 0) {
          for (const folder of path) {
            const sep = el("span", "ez-crumb-sep", "/");
            sep.setAttribute("aria-hidden", "true");
            const crumb = button("ez-crumb", folder.name);
            crumb.addEventListener("click", () => this.deps.openFolder(folder.id));
            this.breadcrumbs.append(sep, crumb);
          }
        }
      }
      const rootCrumb = button("ez-crumb ez-crumb-root", "Notes");
      rootCrumb.addEventListener("click", () => this.deps.openFolder(null));
      this.breadcrumbs.prepend(rootCrumb);
    }
    if (this.wordCountEl) {
      const count = this.deps.getWordCount();
      this.wordCountEl.textContent = `${count} ${count === 1 ? "word" : "words"}`;
    }
    this.refreshThemeIcons();
  }

  private refreshThemeIcons(): void {
    if (!this.themeMenu) return;
    const current = this.root.getAttribute("data-ez-theme") as WorkspaceTheme | null;
    const icon = current === "dark" ? ICONS.moon : current === "light" ? ICONS.sun : ICONS.monitor;
    const summary = this.themeMenu.querySelector<HTMLElement>(".ez-icon-btn");
    if (summary) {
      clearChildren(summary);
      summary.appendChild(renderIcon(icon));
      summary.appendChild(el("span", "ez-visually-hidden", "Theme"));
    }
    for (const item of Array.from(this.themeMenu.querySelectorAll<HTMLButtonElement>(".ez-theme-item"))) {
      item.setAttribute("aria-pressed", String(item.getAttribute("data-ez-theme-choice") === current));
    }
  }

  private updateSaveStatus(status: SaveStatus, error?: unknown): void {
    if (!this.saveStatusEl || !this.saveStatusDot) return;
    this.saveStatusEl.textContent = statusLabel(status, error);
    const saveState = this.saveStatusEl.closest(".ez-save-state") as HTMLElement | null;
    if (saveState) saveState.setAttribute("data-ez-save-status", status);
  }

  applyTheme(theme: WorkspaceTheme): void {
    this.root.setAttribute("data-ez-theme", theme);
    const resolved = resolveTheme(theme);
    this.root.setAttribute("data-ez-resolved-theme", resolved);
    this.root.querySelector(".ez-editor")?.setAttribute("data-ez-theme", resolved);
    this.refreshThemeIcons();
  }

  setFullscreen(on: boolean): void {
    this.root.classList.toggle("ez-fullscreen", on);
    if (this.fullscreenBtn) {
      clearChildren(this.fullscreenBtn);
      this.fullscreenBtn.appendChild(renderIcon(on ? ICONS.minimize : ICONS.maximize));
      this.fullscreenBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
    }
  }

  /* ---------- outline ---------- */

  private buildOutline(): HTMLElement {
    const panel = el("aside", "ez-outline");
    panel.setAttribute("aria-label", "Heading outline");
    const title = el("h2", "ez-outline-title", "Outline");
    const list = el("nav", "ez-outline-list");
    list.id = `ez-outline-${++outlineId}`;
    panel.append(title, list);
    const refresh = (): void => {
      clearChildren(list);
      const headings = this.collectHeadings();
      if (headings.length === 0) {
        list.appendChild(el("div", "ez-outline-empty", "No headings yet"));
        return;
      }
      for (const heading of headings) {
        const item = button("ez-outline-item", heading.text || "Empty heading");
        item.style.paddingInlineStart = `${(heading.level - 1) * 12 + 8}px`;
        item.addEventListener("click", () => this.deps.goToBlock(heading.blockId));
        list.appendChild(item);
      }
    };
    const observer = new MutationObserver(() => refresh());
    observer.observe(this.root.querySelector(".ez-editor") ?? this.root, { childList: true, subtree: true, characterData: true });
    this.disposers.push(() => observer.disconnect());
    refresh();
    return panel;
  }

  private collectHeadings(): { blockId: string; level: number; text: string }[] {
    const out: { blockId: string; level: number; text: string }[] = [];
    this.root.querySelectorAll<HTMLElement>(".ez-blocks > .ez-block[data-ez-block-type='heading']").forEach((blockEl) => {
      const blockId = blockEl.getAttribute("data-ez-block-id") ?? "";
      const heading = blockEl.querySelector("h1, h2, h3, h4, h5, h6");
      if (!heading || !blockId) return;
      const level = Number(heading.tagName.slice(1)) || 1;
      out.push({ blockId, level, text: heading.textContent ?? "" });
    });
    return out;
  }

  /* ---------- find & replace ---------- */

  private buildFindDialog(): HTMLElement {
    const dialog = el("div", "ez-find-bar");
    dialog.setAttribute("role", "search");
    dialog.setAttribute("aria-label", "Find and replace");
    this.findInput = el("input", "ez-find-input");
    this.findInput.type = "search";
    this.findInput.placeholder = "Find";
    this.findInput.setAttribute("aria-label", "Find");
    this.replaceInput = el("input", "ez-find-input");
    this.replaceInput.type = "text";
    this.replaceInput.placeholder = "Replace with";
    this.replaceInput.setAttribute("aria-label", "Replace with");
    const replaceBtn = button("ez-btn", "Replace");
    replaceBtn.addEventListener("click", () => this.runReplace(false));
    const replaceAllBtn = button("ez-btn", "Replace all");
    replaceAllBtn.addEventListener("click", () => this.runReplace(true));
    const close = svgButton("ez-icon-btn", ICONS.x, "Close find and replace");
    close.addEventListener("click", () => this.closeFindDialog());
    dialog.append(this.findInput, this.replaceInput, replaceBtn, replaceAllBtn, close);
    dialog.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        event.stopPropagation();
        this.closeFindDialog();
      }
      if ((event as KeyboardEvent).key === "Enter" && event.target === this.findInput) {
        this.runReplace(false);
      }
      navigateControls(event as KeyboardEvent, dialog);
    });
    dialog.hidden = true;
    return dialog;
  }

  openFindDialog(): void {
    if (!this.findDialog) return;
    if (this.findDialog.hidden) this.findReturnFocus = document.activeElement as HTMLElement | null;
    this.findDialog.hidden = false;
    this.findInput?.focus();
  }

  closeFindDialog(): void {
    if (!this.findDialog) return;
    const restoreFocus = this.findDialog.contains(document.activeElement);
    this.findDialog.hidden = true;
    if (restoreFocus) {
      const target = this.findReturnFocus?.getClientRects().length ? this.findReturnFocus : this.docMenu?.querySelector("summary");
      target?.focus();
    }
    this.findReturnFocus = null;
    this.root.querySelectorAll<HTMLElement>(".ez-find-hit").forEach((el) => {
      el.classList.remove("ez-find-hit");
      el.removeAttribute("data-ez-find");
    });
  }

  private runReplace(all: boolean): void {
    this.deps.findInDocument(this.findInput?.value ?? "", this.replaceInput?.value ?? "", all);
  }

  /* ---------- recovery & legacy draft ---------- */

  private buildErrorPanel(): HTMLElement {
    const panel = el("section", "ez-recovery-panel");
    panel.setAttribute("role", "alert");
    const title = el("h2", "ez-recovery-title", "Your workspace needs attention");
    const message = el("p", "ez-recovery-message");
    message.textContent = "Notes could not be loaded from this browser. Your content stays safe — retry loading or download the stored data.";
    const actions = el("div", "ez-recovery-actions");
    const retry = button("ez-btn ez-btn-primary", "Retry loading");
    retry.addEventListener("click", () => this.deps.retryLoad());
    const download = button("ez-btn", "Download stored data");
    download.addEventListener("click", () => this.deps.downloadOriginal());
    actions.append(retry, download);
    panel.append(title, message, actions);
    panel.hidden = true;
    return panel;
  }

  private showErrorPanel(): void {
    if (this.errorPanel) this.errorPanel.hidden = false;
  }

  /** Public entry point used when a load fails before the UI listener exists. */
  showLoadError(): void {
    this.showErrorPanel();
  }

  /** Transient status/banner message (e.g. import failures). */
  showNotice(message: string): void {
    if (!this.noticeEl) return;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeEl.textContent = message;
    this.noticeEl.hidden = !message;
    if (message) {
      this.noticeTimer = setTimeout(() => {
        this.noticeTimer = null;
        if (this.noticeEl) this.noticeEl.hidden = true;
      }, 6000);
    }
  }

  private hideErrorPanel(): void {
    if (this.errorPanel) this.errorPanel.hidden = true;
  }

  private buildLegacyPanel(): HTMLElement {
    const panel = el("section", "ez-legacy-panel");
    const text = el("p", "ez-legacy-text");
    text.textContent = "A draft saved by an older version of Ezynota was found in this browser. Import it as a new note?";
    const importBtn = button("ez-btn ez-btn-primary", "Import draft");
    importBtn.addEventListener("click", () => {
      const data = this.deps.getLegacyDraft();
      if (data) this.deps.importLegacyDraft(data);
      this.deps.dismissLegacyDraft();
      if (this.legacyPanel) this.legacyPanel.hidden = true;
    });
    const dismiss = button("ez-btn", "Not now");
    dismiss.addEventListener("click", () => {
      this.deps.dismissLegacyDraft();
      if (this.legacyPanel) this.legacyPanel.hidden = true;
    });
    const actions = el("div", "ez-legacy-actions");
    actions.append(importBtn, dismiss);
    panel.append(text, actions);
    panel.hidden = true;
    return panel;
  }

  private maybeShowLegacyDraft(): void {
    const data = this.deps.getLegacyDraft();
    if (data && this.legacyPanel) this.legacyPanel.hidden = false;
  }

  private buildHiddenImportInput(): void {
    this.importInput = el("input", "ez-visually-hidden") as HTMLInputElement;
    this.importInput.type = "file";
    this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json";
    this.importInput.setAttribute("aria-hidden", "true");
    this.importInput.tabIndex = -1;
    this.importInput.addEventListener("change", () => {
      const files = Array.from(this.importInput?.files ?? []);
      if (files.length > 0) this.deps.importFiles(files);
      if (this.importInput) this.importInput.value = "";
    });
    this.root.appendChild(this.importInput);
  }

  private pickBackupFile(): void {
    if (!this.importInput) return;
    this.importInput.accept = ".json,application/json";
    this.importInput.dataset.eznPurpose = "backup";
    this.importInput.click();
    // Reset to the general accept list afterwards.
    this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json";
    delete this.importInput.dataset.eznPurpose;
  }
}

let outlineId = 0;

export function resolveTheme(theme: WorkspaceTheme): "light" | "dark" {
  if (theme === "system") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  return theme;
}

interface MenuEntry {
  label: string;
  run: () => void;
  danger?: boolean;
}

/** Small context menu anchored to the pointer; Escape/outside click closes. */
let closeActiveSidebarMenu: (() => void) | null = null;

export function openSidebarMenu(entries: MenuEntry[], anchor?: HTMLElement): void {
  closeActiveSidebarMenu?.();
  const menu = el("div", "ez-popover ez-sidebar-menu");
  menu.setAttribute("role", "menu");
  menu.setAttribute("data-ez-ui", "true");
  for (const entry of entries) {
    const item = button("ez-menu-item", entry.label);
    item.setAttribute("role", "menuitem");
    if (entry.danger) item.classList.add("ez-danger");
    item.addEventListener("click", () => {
      close();
      entry.run();
    });
    menu.appendChild(item);
  }
  const owner = anchor?.closest<HTMLElement>(".ez-workspace-root");
  (owner ?? document.body).appendChild(menu);
  anchor?.setAttribute("aria-expanded", "true");
  anchor?.setAttribute("aria-haspopup", "menu");
  if (anchor) {
    placePopover(menu, anchor.getBoundingClientRect());
  }
  const close = (): void => {
    if (menu.contains(document.activeElement)) anchor?.focus();
    menu.remove();
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onOutside, true);
    owner?.removeEventListener("ez-close-popovers", close);
    window.removeEventListener("resize", close);
    anchor?.setAttribute("aria-expanded", "false");
    closeActiveSidebarMenu = null;
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      anchor?.focus();
      return;
    }
    if (event.key === "Tab") close();
    navigateControls(event, menu);
  };
  const onOutside = (event: MouseEvent): void => {
    if (!menu.contains(event.target as Node)) close();
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("mousedown", onOutside, true);
  owner?.addEventListener("ez-close-popovers", close);
  window.addEventListener("resize", close);
  closeActiveSidebarMenu = close;
  menu.querySelector<HTMLButtonElement>("button")?.focus();
}

/** Plain-text projection of a document used for word counts and search. */
export function documentPlainText(blocks: EzynotaBlock[]): string {
  let out = "";
  walkDocumentBlocks(blocks, (block) => {
    out += `${inlineToPlainText((block.data as { content?: never[] }).content as never)}\n`;
  });
  return out;
}

function walkDocumentBlocks(blocks: EzynotaBlock[], visit: (block: EzynotaBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    if (Array.isArray(block.children)) walkDocumentBlocks(block.children, visit);
  }
}
