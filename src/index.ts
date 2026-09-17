import "./styles/ezynota.css";

/**
 * Ezynota — a free, block-style editor with portable JSON output.
 *
 * Main entry: importing this module enables declarative initialization —
 * every element with `data-ezn-editor` mounts a workspace editor after DOM
 * readiness, and elements inserted later are picked up automatically.
 * For an entry without the automatic scanning side effect use `ezynota/core`.
 *
 * @example
 * import { Ezynota } from "ezynota";
 * import "ezynota/dist/ezynota.css";
 *
 * const editor = new Ezynota({ target: "#editor" });
 * const auto = Ezynota.initAll(); // or rely on the automatic scan
 */
import { setupDeclarativeScanning } from "./init/declarative";
setupDeclarativeScanning();

export { Ezynota } from "./editor";
export type { EzynotaConfig, EzynotaMode } from "./types";
export { EzynotaError } from "./core/errors";
export { EZ } from "./core/command-manager";
export type { CommandDescriptor } from "./core/command-manager";
export { EventBus } from "./core/event-bus";
export { SCHEMA_VERSION, GENERATOR_VERSION, MAX_JSON_DEPTH, normalizeDocument, normalizeBlock, salvageDocument } from "./core/schema";
export type { SalvageResult } from "./core/schema";
export { isSafeUrl, isSafeImageUrl, sanitizeLinkTarget } from "./core/url";
export { MigrationManager } from "./core/migration-manager";
export type { Migration } from "./core/migration-manager";
export { ToolRegistry } from "./core/tool-registry";
export { I18n } from "./i18n/i18n";
export { inlineToDom, domToInline, inlineToHtmlString, domToInline as htmlToInlineContent, inlineToDom as inlineContentToHTML } from "./rich-text/dom";
export { normalizeInline, splitInlineAtOffset } from "./rich-text/normalize";
export type { InlineContent, InlineMark, TextNode, LinkNode } from "./rich-text/types";
export { textNode } from "./rich-text/types";
export { htmlToBlocks, textToBlocks } from "./input/html-to-blocks";

/* Workspace */
export { WorkspaceState } from "./workspace/workspace";
export { IndexedDbStorage, MemoryStorage, emptyWorkspace } from "./workspace/storage";
export { WORKSPACE_SCHEMA_VERSION } from "./workspace/types";
export type {
  StorageAdapter,
  WorkspaceEnvelope,
  WorkspaceBackup,
  WorkspaceAsset,
  NoteRecord,
  FolderRecord,
  SearchHit,
  WorkspaceEvent,
  SaveStatus,
  WorkspaceTheme,
  CommitResult
} from "./workspace/types";
export { blocksToMarkdown, markdownToBlocks, parseMarkdownInline } from "./io/markdown";
export { exportDocumentToString, downloadTextFile, blocksToHtml, resolveDocumentAssets } from "./io/export";
export type { ExportFormat } from "./io/export";
export { parseImportFile, blocksToDocument, detectFormat } from "./io/import";
export { printDocument } from "./io/print";

/* Block tools */
export { Paragraph, Heading, Quote, CodeTool, Delimiter, TextBlockTool } from "./tools/text-tools";
export { ListTool } from "./tools/list-tool";
export type { ListData, ListItem } from "./tools/list-tool";
export { TableTool } from "./tools/table-tool";
export type { TableData } from "./tools/table-tool";
export { ImageTool } from "./tools/image-tool";
export type { ImageData } from "./tools/image-tool";
export { CalloutTool } from "./tools/callout-tool";
export type { CalloutData } from "./tools/callout-tool";
export { ToggleTool } from "./tools/toggle-tool";
export type { ToggleData } from "./tools/toggle-tool";

/* Inline tools */
export {
  BUILTIN_INLINE_TOOLS,
  BoldTool,
  ItalicTool,
  UnderlineTool,
  StrikethroughTool,
  CodeInlineTool,
  MarkTool,
  ColorTool,
  BackgroundColorTool,
  LinkTool
} from "./inline/inline-tools";

/* Tunes */
export { AlignmentTune } from "./tunes/alignment";
