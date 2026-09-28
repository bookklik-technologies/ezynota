import type { Host } from "../host";
import type { EditorSelection, InlineTool } from "../types";
import { clearChildren } from "./dom";
/** Shared formatting controls for floating and persistent toolbars. */
export declare class InlineToolbar {
    private host;
    private documentMode;
    private root;
    private tools;
    private visible;
    private savedRange;
    private undoButton?;
    private redoButton?;
    private blockType?;
    private settings?;
    private settingsKey;
    private more?;
    private morePanel?;
    private alignmentButtons;
    private disposers;
    constructor(host: Host, documentMode?: boolean);
    getElement(): HTMLElement;
    private buildDocumentControls;
    private buildAlignment;
    updateSelection(selection: EditorSelection | null): void;
    refresh(): void;
    private inlineEnabled;
    private restoreSelection;
    hide(): void;
    isVisible(): boolean;
    withSavedRange<T>(fn: (range: Range) => T): T | undefined;
    destroy(): void;
}
export declare function applyInlineTool(host: Host, toolName: string, instance?: InlineTool): void;
export { clearChildren };
