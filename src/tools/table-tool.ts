import type { BlockAPI, BlockTool, ConversionConfig, InlineContent, JsonValue } from "../types";
import { inlineToDom, domToInline, isEmptyInlineValue } from "../rich-text/dom";
import { ICONS, TOOL_ICONS } from "../ui/icons";
import { el, svgButton } from "../ui/dom";

export type TableCell = {
  content: InlineContent[];
};

export type TableData = {
  header: boolean;
  rows: TableCell[][];
};

/**
 * Table block: rich-text cells, an optional header row, row/column
 * insertion and deletion, and keyboard cell navigation (Tab / Shift+Tab).
 * Every cell is an editable region (`data-ez-region`) inside the compound
 * block; cell edits save through the normal input flow.
 */
export class TableTool implements BlockTool<TableData> {
  static toolbox = { icon: TOOL_ICONS.table, title: "Table", category: "Rich blocks" };
  static conversion: ConversionConfig = { to: ["paragraph"] };
  static enableInlineTools = true;

  private api: BlockAPI;
  private tableEl!: HTMLTableElement;
  private wrapper!: HTMLElement;

  constructor(options: { api: BlockAPI }) {
    this.api = options.api;
  }

  render(): HTMLElement {
    const doc = this.wrapper?.ownerDocument ?? this.api.element.ownerDocument ?? document;
    const data = this.api.getData() as unknown as TableData;
    const header = data?.header !== false;
    const rows = Array.isArray(data?.rows) && data.rows.length > 0 ? data.rows : [[{ content: [] }, { content: [] }], [{ content: [] }, { content: [] }]];
    this.wrapper = el("div", "ez-table-wrap");
    this.tableEl = doc.createElement("table");
    this.tableEl.className = "ez-table";
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]!;
      const tr = doc.createElement("tr");
      for (let c = 0; c < row.length; c++) {
        const cell = row[c] ?? { content: [] };
        const tag = header && r === 0 ? "th" : "td";
        const td = doc.createElement(tag);
        td.contentEditable = this.api.readOnly ? "false" : "true";
        td.setAttribute("data-ez-editable", "true");
        td.setAttribute("data-ez-region", `r${r}c${c}`);
        td.setAttribute("role", "textbox");
        td.setAttribute("aria-multiline", "true");
        if (cell?.content && !isEmptyInlineValue(cell.content)) {
          td.appendChild(inlineToDom(cell.content, doc));
        }
        tr.appendChild(td);
      }
      this.tableEl.appendChild(tr);
    }
    this.wrapper.appendChild(this.tableEl);
    this.wrapper.addEventListener("keydown", (event) => this.handleKeydown(event as KeyboardEvent));
    return this.wrapper;
  }

  save(_element: HTMLElement): TableData {
    const rows: TableCell[][] = [];
    const header = this.tableEl.querySelector("th") !== null;
    for (const tr of Array.from(this.tableEl.rows)) {
      const row: TableCell[] = [];
      for (const cell of Array.from(tr.cells)) {
        row.push({ content: domToInline(cell) });
      }
      rows.push(row);
    }
    return { header, rows: rows.length > 0 ? rows : [[{ content: [] }, { content: [] }]] };
  }

  validate(data: TableData): boolean {
    return !!data && Array.isArray(data.rows) && data.rows.length > 0;
  }

  /** Table settings: row/column operations and the header toggle. */
  renderSettings(): HTMLElement | null {
    const wrap = el("div", "ez-inline-group");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Table options");
    const items: { label: string; icon: string; run: () => void; toggle?: boolean }[] = [
      { label: "Add row", icon: ICONS.tableRowAdd, run: () => this.addRowAt(-1) },
      { label: "Add column", icon: ICONS.tableColumnAdd, run: () => this.addColumnAt(-1) },
      { label: "Delete row", icon: ICONS.tableRowDelete, run: () => this.deleteRow() },
      { label: "Delete column", icon: ICONS.tableColumnDelete, run: () => this.deleteColumn() },
      { label: "Toggle header", icon: ICONS.tableHeader, run: () => this.toggleHeader(), toggle: true }
    ];
    for (const item of items) {
      const btn = svgButton("ez-inline-btn", item.icon, item.label);
      btn.querySelector("svg")?.setAttribute("aria-hidden", "true");
      const syncToggle = (): void => {
        if (!item.toggle) return;
        const enabled = this.tableEl.querySelector("th") !== null;
        btn.classList.toggle("ez-active", enabled);
        btn.setAttribute("aria-pressed", String(enabled));
      };
      syncToggle();
      btn.addEventListener("click", () => {
        if (this.api.readOnly) return;
        item.run();
        syncToggle();
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  updated(): void {
    // External updates (undo/redo/paste) re-render the table.
    const data = this.api.getData() as unknown as TableData;
    if (!this.wrapper || !data?.rows) return;
    this.swapWrapper();
  }

  /** render() reassigns this.wrapper, so capture the old element first. */
  private swapWrapper(): HTMLElement {
    const previous = this.wrapper;
    const fresh = this.render();
    if (previous.parentElement) previous.replaceWith(fresh);
    this.wrapper = fresh as HTMLElement;
    return fresh;
  }

  focus(at?: "start" | "end"): void {
    if (!this.tableEl) return;
    const cells = Array.from(this.tableEl.querySelectorAll<HTMLElement>("[data-ez-editable]"));
    const target = (at === "end" ? cells[cells.length - 1] : cells[0]) ?? this.tableEl;
    target?.focus();
  }

  getEditable(): HTMLElement | undefined {
    return this.tableEl.querySelector<HTMLElement>("[data-ez-editable]") ?? undefined;
  }

  destroy(): void {}

  /* ---------- keyboard navigation ---------- */

  private handleKeydown(event: KeyboardEvent): void {
    if (this.api.readOnly) return;
    if (event.key === "Tab") {
      event.preventDefault();
      const doc = this.tableEl.ownerDocument;
      const cells = Array.from(this.tableEl.querySelectorAll<HTMLElement>("[data-ez-editable]"));
      const index = cells.indexOf(doc.activeElement as HTMLElement);
      const next = event.shiftKey ? index - 1 : index + 1;
      if (next >= 0 && next < cells.length) {
        cells[next]!.focus();
      } else if (!event.shiftKey) {
        // Tab past the last cell creates a new row and continues;
        // Shift+Tab before the first cell is a no-op.
        this.addRowAt(-1);
        const fresh = Array.from(this.tableEl.querySelectorAll<HTMLElement>("[data-ez-editable]"));
        fresh[fresh.length - 1]?.focus();
      }
    }
  }

  /* ---------- structural operations ---------- */

  private addRowAt(at: number): void {
    const data = this.save(this.wrapper);
    const columnCount = data.rows[0]?.length ?? 2;
    const newRow: TableCell[] = Array.from({ length: columnCount }, () => ({ content: [] }));
    const index = at < 0 ? data.rows.length : Math.max(1, at);
    data.rows.splice(index, 0, newRow);
    this.commit(data);
  }

  private addColumnAt(at: number): void {
    const data = this.save(this.wrapper);
    const index = at < 0 ? data.rows[0]!.length : at;
    for (const row of data.rows) row.splice(index, 0, { content: [] });
    this.commit(data);
  }

  private deleteRow(): void {
    const active = this.activeCell();
    if (!active) return;
    const data = this.save(this.wrapper);
    if (data.rows.length <= 1) return;
    const rowIndex = active.row;
    data.rows.splice(rowIndex, 1);
    if (rowIndex === 0 && data.header) data.header = false;
    this.commit(data);
  }

  private deleteColumn(): void {
    const active = this.activeCell();
    if (!active) return;
    const data = this.save(this.wrapper);
    if ((data.rows[0]?.length ?? 0) <= 1) return;
    const columnIndex = active.column;
    for (const row of data.rows) row.splice(columnIndex, 1);
    this.commit(data);
  }

  private toggleHeader(): void {
    const data = this.save(this.wrapper);
    data.header = !data.header;
    this.commit(data);
  }

  private activeCell(): { row: number; column: number } | null {
    const cell = document.activeElement?.closest("td, th") as HTMLElement | null;
    if (!cell || !this.tableEl.contains(cell)) return null;
    const tr = cell.parentElement as HTMLTableRowElement;
    return {
      row: Array.from(this.tableEl.rows).indexOf(tr),
      column: Array.from(tr.cells).indexOf(cell as HTMLTableCellElement)
    };
  }

  /** Persist structural changes through the editor's transaction stream. */
  private commit(data: TableData): void {
    // Keep the caret near the cell the user was working in when possible.
    const active = this.activeCell();
    this.api.update(data as never);
    const fresh = this.swapWrapper();
    if (active) {
      const rows = fresh.querySelectorAll("tr");
      const row = rows[Math.min(active.row, rows.length - 1)];
      const cells = row ? Array.from(row.querySelectorAll<HTMLElement>("[data-ez-editable]")) : [];
      const cell = cells[Math.min(active.column, cells.length - 1)];
      if (cell) {
        cell.focus();
        return;
      }
    }
    this.api.focus("start");
  }
}

/** Build table data from a 2D plain-text shape (used by import). */
export function tableDataFrom(rows: InlineContent[][][], header: boolean): JsonValue {
  return { header, rows } as unknown as JsonValue;
}
