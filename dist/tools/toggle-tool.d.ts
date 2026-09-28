import type { BlockTool, ConversionConfig, InlineContent, NestedBlockHost } from "../types";
export type ToggleData = {
    open: boolean;
    heading: InlineContent[];
};
/**
 * Collapsible section: an editable heading plus nested editable child
 * blocks stored in the block's `children` field. Child operations commit
 * through `children:update` transactions; the open/closed state is part
 * of the block data (undoable).
 */
export declare class ToggleTool implements BlockTool<ToggleData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static conversion: ConversionConfig;
    private api;
    private nested;
    private container;
    private headingEl;
    private childrenHost;
    private open;
    constructor(options: {
        api: import("../types").BlockAPI;
        nested?: NestedBlockHost;
    });
    render(): HTMLElement;
    save(_element: HTMLElement): ToggleData;
    validate(data: ToggleData): boolean;
    updated(): void;
    /** The header row is a direct child of the container (never a nested toggle's). */
    private findCaret;
    focus(at?: "start" | "end"): void;
    getEditable(): HTMLElement | undefined;
    destroy(): void;
    private childTools;
    private childSignatures;
    private renderChildren;
    private syncChildData;
    private nestedEditable;
    private saveChild;
    /**
     * Input flow entry point for nested children (routed from InputManager
     * via the host). Saves direct children; unknown ids delegate to nested
     * toggles among the children so deep grandchildren reach their owner.
     */
    requestSaveChild(childId: string): void;
    /** Nested child BlockAPI routed through the children:update transaction. */
    private childApi;
}
