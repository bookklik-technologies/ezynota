import type { BlockAPI, BlockTool, ConversionConfig, JsonValue } from "../types";
export type ImageData = {
    src: string;
    alt: string;
    caption?: string;
    width?: number;
};
/**
 * Image block: upload, clipboard paste, drag & drop, external URLs,
 * resizing, captions and alt text. Uploaded files persist as workspace
 * assets when storage is configured; temporary object URLs are used for
 * rendering only, and portable saves resolve assets to data URLs.
 */
export declare class ImageTool implements BlockTool<ImageData> {
    static toolbox: {
        icon: string;
        title: string;
        category: string;
    };
    static conversion: ConversionConfig;
    static paste: {
        files: {
            mimeTypes: string[];
        };
    };
    /** Files → image block data (used by the clipboard router for new blocks). */
    static readonly filesToBlockDataAsync: (files: File[]) => Promise<{
        type: string;
        data: JsonValue;
    }[]>;
    private api;
    private figure;
    private img;
    private resizeInput;
    private resizeValue;
    private editPanel;
    private panelTrigger;
    private uploadButton;
    private feedback;
    constructor(options: {
        api: BlockAPI;
    });
    render(): HTMLElement;
    save(_element: HTMLElement): ImageData;
    validate(data: ImageData): boolean;
    /** Files pasted into this block replace the image. */
    onPaste(event: {
        files?: File[];
    }): void;
    updated(): void;
    focus(): void;
    getEditable(): HTMLElement | undefined;
    destroy(): void;
    private applySrcToImg;
    private showBrokenImage;
    private clearBrokenImageState;
    private buildToolbar;
    private updateWidthLabel;
    private currentWidth;
    private pickFile;
    private storeFile;
    private applyImage;
    private showFeedback;
    private closeEditPanel;
    private openEditPanel;
}
export declare function fileToDataUrl(file: File): Promise<string>;
