import type { EditorSelection } from "../types";
import type { Host } from "../host";
type Events = {
    selection: (selection: EditorSelection | null) => void;
    focus: () => void;
    blur: () => void;
};
/**
 * SelectionManager tracks DOM selection inside the editor target and maps
 * it to block-scoped selection objects.
 */
export declare class SelectionManager {
    private bus;
    private host;
    private target;
    private current;
    private savedRange;
    private started;
    private stopped;
    private disposers;
    constructor(host: Host, target: HTMLElement);
    start(): void;
    stop(): void;
    on<K extends keyof Events>(event: K, handler: Events[K]): () => void;
    getSelection(): EditorSelection | null;
    getRange(): Range | null;
    private uiRange;
    setRange(range: Range): void;
    /** Compute block-level selection from the DOM selection. */
    refresh(): EditorSelection | null;
    private findBlockElement;
    /**
     * Resolve the block element for a selection boundary point. A boundary on
     * the target itself (whole-document selections) is clamped to the child
     * at the boundary offset.
     */
    private blockForBoundary;
}
/** Place the caret at a plain-text offset inside an editable element. */
export declare function setCaretAtTextOffset(editable: HTMLElement, offset: number): void;
export {};
