import type { EzynotaDocument } from "../types";
import type { WorkspaceBackup } from "../workspace/types";
import { SCHEMA_VERSION, normalizeDocument } from "../core/schema";
import { createDefaultIdGenerator } from "../core/id";
import { htmlToBlocks, textToBlocks, type ParsedBlock } from "../input/html-to-blocks";
import { markdownToBlocks } from "./markdown";
import { EzynotaError } from "../core/errors";

export type ImportResult =
  | { kind: "document"; document: EzynotaDocument }
  | { kind: "blocks"; blocks: ParsedBlock[]; suggestedTitle?: string }
  | { kind: "backup"; backup: WorkspaceBackup };

export interface ParsedImportFile {
  /** detected content type */
  format: "json" | "md" | "html" | "txt";
  result: ImportResult;
}

/** Extension/content-type sniffing without trusting the payload. */
export function detectFormat(name: string, mime: string): ParsedImportFile["format"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json") || mime === "application/json") return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || mime === "text/html") return "html";
  return "txt";
}

/**
 * Parse an uploaded/imported file. Documents become new notes; workspace
 * backups are validated for restore. Malformed or newer-version payloads
 * throw with the original retained by the caller for recovery.
 */
export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const format = detectFormat(file.name, file.type);
  const text = await file.text();
  switch (format) {
    case "json": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new EzynotaError("EZ_IMPORT_FAILED", "File is not valid JSON", { original: text });
      }
      if (isWorkspaceBackup(parsed)) {
        const backup = parsed as WorkspaceBackup;
        if (typeof backup.workspaceSchemaVersion !== "string") {
          throw new EzynotaError("EZ_IMPORT_FAILED", "Backup is missing workspaceSchemaVersion", { original: parsed });
        }
        return { format, result: { kind: "backup", backup } };
      }
      if (isDocument(parsed)) {
        const document = parsed as EzynotaDocument;
        if (document.schemaVersion !== SCHEMA_VERSION) {
          // Newer or unknown document schemas are preserved for recovery,
          // never silently relabeled.
          throw new EzynotaError("EZ_IMPORT_FAILED", `Document schema "${document.schemaVersion}" is not supported`, { original: parsed });
        }
        const normalized = normalizeDocument(document, createDefaultIdGenerator());
        return { format, result: { kind: "document", document: normalized } };
      }
      throw new EzynotaError("EZ_IMPORT_FAILED", "JSON is not an Ezynota document or workspace backup", { original: parsed });
    }
    case "md":
      return { format, result: { kind: "blocks", blocks: markdownToBlocks(text), suggestedTitle: titleFromFilename(file.name) } };
    case "html":
      return { format, result: { kind: "blocks", blocks: htmlToBlocks(text), suggestedTitle: titleFromFilename(file.name) } };
    case "txt":
      return { format, result: { kind: "blocks", blocks: textToBlocks(text), suggestedTitle: titleFromFilename(file.name) } };
  }
}

/** Blocks → a standalone document (new note payload). */
export function blocksToDocument(blocks: ParsedBlock[], title?: string): EzynotaDocument {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    blocks: blocks.map((block) => ({ ...block, id: createDefaultIdGenerator()() })) as never,
    createdAt: now,
    updatedAt: now,
    meta: title ? { title } : undefined
  };
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function isWorkspaceBackup(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    "workspaceSchemaVersion" in (value as Record<string, unknown>) &&
    Array.isArray((value as Record<string, unknown>).notes)
  );
}

function isDocument(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).schemaVersion === "string" &&
    Array.isArray((value as Record<string, unknown>).blocks)
  );
}
