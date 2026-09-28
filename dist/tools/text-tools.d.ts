import type { BlockTool, ConversionConfig, InlineContent, JsonValue } from "../types";
export type TextToolData = {
    content: InlineContent[];
};
export type HeadingData = {
    level: number;
    content: InlineContent[];
};
export type CodeData = {
    code: string;
};
/**
 * Base for text-based blocks: one contenteditable element containing
 * inline content rendered from JSON.
 */
export declare abstract class TextBlockTool<TData extends JsonValue = TextToolData> implements BlockTool<TData> {
    protected editable: HTMLElement;
    protected api: import("../types").BlockAPI;
    protected config: Record<string, unknown>;
    protected placeholder: string;
    protected multiline: boolean;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    }, placeholder?: string, multiline?: boolean);
    abstract tag(): string;
    render(): HTMLElement;
    abstract save(element: HTMLElement): TData;
    validate(data: TData): boolean;
    merge(incoming: TData): TData;
    /** Sync the DOM after an external transaction updated this block. */
    updated(): void;
    protected replaceEditableContent(target: HTMLElement, frag: DocumentFragment): void;
    focus(at?: "start" | "end"): void;
    getEditable(): HTMLElement | undefined;
    /**
     * Split this block's content at a DOM range (the caret). Returns the
     * [before, after] data shapes; the DOM is mutated in place (the prefix
     * stays in the editable, the remainder is extracted).
     */
    splitAtRange(range: Range): [TData, TData] | null;
    /** Extra fields kept on split (e.g. heading level). */
    protected tagDataShape(): Record<string, unknown>;
    destroy(): void;
}
/** Paragraph tool — the default block. */
export declare class Paragraph extends TextBlockTool<TextToolData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static conversion: ConversionConfig;
    static enableInlineTools: boolean;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    save(_element: HTMLElement): TextToolData;
}
/** Heading tool with configurable levels (default 1–3). */
export declare class Heading extends TextBlockTool<HeadingData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static shortcut: string;
    static conversion: ConversionConfig;
    static enableInlineTools: boolean;
    private levels;
    private level;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    save(_element: HTMLElement): HeadingData;
    protected tagDataShape(): Record<string, unknown>;
    /** Level switcher rendered inside the block settings menu. */
    renderSettings(): HTMLElement | null;
    updated(): void;
    private refreshElement;
}
/** Quote tool: blockquote with rich text content. */
export declare class Quote extends TextBlockTool<TextToolData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static conversion: ConversionConfig;
    static enableInlineTools: boolean;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    save(_element: HTMLElement): TextToolData;
}
/** Code block — plain text only, no inline formatting, multiline. */
export declare class CodeTool extends TextBlockTool<CodeData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static shortcut: string;
    static enterKey: "newline";
    static conversion: ConversionConfig;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    render(): HTMLElement;
    save(_element: HTMLElement): CodeData;
    validate(data: CodeData): boolean;
    updated(): void;
}
/** Horizontal rule — non-text block. */
export declare class Delimiter implements BlockTool {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static enterKey: "ignore";
    static conversion: ConversionConfig;
    private api;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    render(): HTMLElement;
    save(): Record<string, never>;
    validate(): boolean;
    focus(): void;
    destroy(): void;
}
