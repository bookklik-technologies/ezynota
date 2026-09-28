import type { InlineContent } from "../types";
import { TextBlockTool } from "./text-tools";
import type { ConversionConfig } from "../types";
export type CalloutVariant = "info" | "warning" | "success" | "danger";
export type CalloutData = {
    variant: CalloutVariant;
    content: InlineContent[];
};
/**
 * Callout block: rich-text content inside a colored container with an
 * emoji/variant selector. Rendering and typing behave like a text block;
 * the container styling communicates the variant.
 */
export declare class CalloutTool extends TextBlockTool<CalloutData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static enableInlineTools: boolean;
    static conversion: ConversionConfig;
    private variant;
    private containerEl;
    constructor(options: {
        api: import("../types").BlockAPI;
        config: Record<string, unknown>;
    });
    tag(): string;
    render(): HTMLElement;
    save(_element: HTMLElement): CalloutData;
    updated(): void;
    renderSettings(): HTMLElement | null;
    private refreshElement;
}
