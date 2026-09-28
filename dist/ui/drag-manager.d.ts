import type { Host } from "../host";
/**
 * DragManager: HTML5 drag & drop reordering of blocks, plus a Pointer
 * Events fallback for touch devices, and a keyboard alternative
 * (Alt+ArrowUp/Down) handled by the keyboard manager.
 */
export declare class DragManager {
    private host;
    private target;
    private started;
    private disposers;
    private draggingId;
    private pointerDrag;
    constructor(host: Host, target: HTMLElement);
    start(): void;
    stop(): void;
    /** Shared destination and transaction path for mouse and touch dragging. */
    private moveTo;
    private blockId;
    private findBlock;
    private dropTarget;
    private highlight;
    /** Visual ghost + drop tracking driven by document-level pointer events. */
    private beginPointerDrag;
    private blockFromEvent;
    private blockFromPoint;
}
