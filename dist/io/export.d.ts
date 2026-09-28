import type { EzynotaBlock, EzynotaDocument } from "../types";
import type { WorkspaceAsset } from "../workspace/types";
export type ExportFormat = "json" | "md" | "html" | "txt";
/**
 * Portable saves: local `asset:<id>` references are resolved into image
 * data URLs so a downloaded document renders outside the workspace.
 */
export declare function resolveDocumentAssets(document: EzynotaDocument, loadAsset: (assetId: string) => Promise<WorkspaceAsset | null>): Promise<EzynotaDocument>;
export declare function toDataUrl(asset: WorkspaceAsset): string;
/** Block content → HTML string (used for export and printing). */
export declare function blocksToHtml(blocks: EzynotaBlock[]): string;
/** Blocks → plain text projection. */
export declare function blocksToPlainText(blocks: EzynotaBlock[]): string;
/** Serialize a document into an export payload string. */
export declare function exportDocumentToString(document: EzynotaDocument, format: ExportFormat, loadAsset: (assetId: string) => Promise<WorkspaceAsset | null>): Promise<string>;
/** Trigger a browser download for a text payload. */
export declare function downloadTextFile(filename: string, content: string, mime: string): void;
export declare function safeFilename(title: string, fallback: string): string;
