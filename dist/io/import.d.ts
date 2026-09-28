import type { EzynotaDocument } from "../types";
import type { WorkspaceBackup } from "../workspace/types";
import { type ParsedBlock } from "../input/html-to-blocks";
export type ImportResult = {
    kind: "document";
    document: EzynotaDocument;
} | {
    kind: "blocks";
    blocks: ParsedBlock[];
    suggestedTitle?: string;
} | {
    kind: "backup";
    backup: WorkspaceBackup;
};
export interface ParsedImportFile {
    /** detected content type */
    format: "json" | "md" | "html" | "txt";
    result: ImportResult;
}
/** Extension/content-type sniffing without trusting the payload. */
export declare function detectFormat(name: string, mime: string): ParsedImportFile["format"];
/**
 * Parse an uploaded/imported file. Documents become new notes; workspace
 * backups are validated for restore. Malformed or newer-version payloads
 * throw with the original retained by the caller for recovery.
 */
export declare function parseImportFile(file: File): Promise<ParsedImportFile>;
/** Blocks → a standalone document (new note payload). */
export declare function blocksToDocument(blocks: ParsedBlock[], title?: string): EzynotaDocument;
