import type { InlineContent } from "./types";
import { textNode } from "./types";
/**
 * Normalize inline content: drop empty nodes, merge adjacent text nodes with
 * identical marks, unwrap empty links. Deterministic output for saving.
 */
export declare function normalizeInline(content: InlineContent[] | undefined | null): InlineContent[];
/**
 * Split inline content at a plain-text offset (used for splitting blocks,
 * merging and pasting into text). Returns [before, after].
 */
export declare function splitInlineAtOffset(content: InlineContent[], offset: number): [InlineContent[], InlineContent[]];
/** Convert inline content to plain text with a soft-break marker. */
export declare function inlineToTextWithBreaks(content: InlineContent[]): string;
export { textNode as makeText };
