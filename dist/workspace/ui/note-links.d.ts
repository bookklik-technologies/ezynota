export interface NoteLinkSuggesterDeps {
    listNotes(): {
        id: string;
        title: string;
    }[];
    openNote?(noteId: string): void;
    /** Active note id so the current note is excluded from suggestions. */
    getActiveNoteId?(): string | null;
}
/**
 * `[[` note suggestions: typing `[[` in any editable opens a note picker.
 * Accepting a suggestion replaces the `[[query` prefix with an internal
 * note link (`href="note:<id>"`) — links reference stable note IDs, so
 * renaming notes preserves them. Backlinks are derived from the same hrefs.
 */
export declare class WorkspaceLinkSuggester {
    private surface;
    private deps;
    private popover;
    private query;
    private range;
    private blockId;
    private disposers;
    private items;
    private focusedIndex;
    constructor(surface: HTMLElement, deps: NoteLinkSuggesterDeps);
    destroy(): void;
    private checkCaret;
    private handleKey;
    private openPopover;
    private highlightFocused;
    private closePopover;
    private accept;
    /** Character offset of the "[[" token start within the caret text node. */
    private findTokenStart;
}
