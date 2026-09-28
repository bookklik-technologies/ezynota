import type { BlockAPI, BlockTool, ConversionConfig, InlineContent, JsonValue } from "../types";
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
export declare class TableTool implements BlockTool<TableData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static conversion: ConversionConfig;
    static enableInlineTools: boolean;
    private api;
    private tableEl;
    private wrapper;
    constructor(options: {
        api: BlockAPI;
    });
    render(): HTMLElement;
    save(_element: HTMLElement): TableData;
    validate(data: TableData): boolean;
    /** Table settings: row/column operations and the header toggle. */
    renderSettings(): HTMLElement | null;
    updated(): void;
    /** render() reassigns this.wrapper, so capture the old element first. */
    private swapWrapper;
    focus(at?: "start" | "end"): void;
    getEditable(): HTMLElement | undefined;
    destroy(): void;
    private handleKeydown;
    private addRowAt;
    private addColumnAt;
    private deleteRow;
    private deleteColumn;
    private toggleHeader;
    private activeCell;
    /** Persist structural changes through the editor's transaction stream. */
    private commit;
}
/** Build table data from a 2D plain-text shape (used by import). */
export declare function tableDataFrom(rows: InlineContent[][][], header: boolean): JsonValue;
