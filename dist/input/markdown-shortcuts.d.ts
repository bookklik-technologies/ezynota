import type { Host } from "../host";
export declare class MarkdownShortcuts {
    private host;
    private surface;
    private disposers;
    constructor(host: Host, surface: HTMLElement);
    start(): void;
    stop(): void;
    private currentBlock;
    private handleSpace;
    private handleEnter;
    /** Convert a block in ONE transaction (undoable via history). */
    private convert;
    /** Strip inline markers from the DOM and wrap the inner text in the mark. */
    private applyInlinePattern;
}
