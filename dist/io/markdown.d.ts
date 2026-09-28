import type { EzynotaBlock, InlineContent } from "../types";
import type { ParsedBlock } from "../input/html-to-blocks";
export declare function blocksToMarkdown(blocks: EzynotaBlock[], options?: {
    noteLinkTitles?: Map<string, string>;
    indent?: string;
}): string;
/** Parse a single line of Markdown inline content into rich text. */
export declare function parseMarkdownInline(line: string, baseUrl?: string): InlineContent[];
/** Parse Markdown text into Ezynota block shapes. */
export declare function markdownToBlocks(markdown: string, baseUrl?: string): ParsedBlock[];
