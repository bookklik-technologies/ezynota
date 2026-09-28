import type { BlockTool, ConversionConfig, BlockAPI, InlineContent } from "../types";
export type ListItem = {
    content: InlineContent[];
    checked?: boolean;
};
export type ListData = {
    style?: string;
    items: ListItem[];
};
/**
 * List tool: one block, many items. The whole list container is editable so
 * the browser natively handles Enter (new item) and Backspace (merge items),
 * while save() serializes each <li> into portable inline JSON.
 */
export declare class ListTool implements BlockTool<ListData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static shortcut: string;
    static conversion: ConversionConfig;
    static enableInlineTools: boolean;
    private style;
    private listEl;
    private editable;
    private api;
    constructor(options: {
        api: BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    render(): HTMLElement;
    private createCheckbox;
    /** Inject a checkbox into every task <li> that is missing one. */
    private ensureCheckboxes;
    save(_element: HTMLElement): ListData;
    validate(data: ListData): boolean;
    merge(incoming: ListData): ListData;
    /** Toggle between ordered and unordered (block settings entry). */
    renderSettings(): HTMLElement | null;
    updated(): void;
    /** List items split natively by the browser; no custom split. */
    splitAtRange(): null;
    focus(at?: "start" | "end"): void;
    getEditable(): HTMLElement | undefined;
    destroy(): void;
    private refreshElement;
}
