import type { Host } from "../host";
export interface SlashEntry {
    name: string;
    title: string;
    icon: string;
    category?: string;
}
/** Subsequence fuzzy match — returns a score or -1. */
export declare function fuzzyScore(query: string, text: string): number;
/**
 * Slash menu: typing "/" in an empty text block opens a searchable command
 * palette of block tools with keyboard navigation.
 */
export declare class SlashMenu {
    private root;
    private host;
    private input;
    private list;
    private entries;
    private filtered;
    private focusedIndex;
    private isOpen;
    private blockId;
    private unsubOutside;
    private insertMode;
    private prefix;
    constructor(host: Host);
    getElement(): HTMLElement;
    open(blockId: string, insert?: boolean): void;
    isOpenMenu(): boolean;
    /** Update the query while the user keeps typing after "/". */
    setQuery(query: string): void;
    handleKey(event: KeyboardEvent): boolean;
    close(restore?: boolean): void;
    private buildDom;
    private filter;
    private renderList;
    private select;
    private position;
    destroy(): void;
}
