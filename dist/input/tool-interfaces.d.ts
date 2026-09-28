import type { InlineContent } from "../rich-text/types";
/**
 * Structural helpers shared by the keyboard manager and editor for
 * splitting, merging and converting block data shapes.
 */
export interface TextBlockToolLike {
    splitAtRange?(range: Range): [unknown, unknown] | null;
}
/** Extract the plain text carried by any built-in tool data shape. */
export declare function textContentOf(data: unknown): string;
/** Data shape a fresh block of a given type starts with. */
export declare function initialDataFor(type: string, content?: InlineContent[]): Record<string, unknown>;
/** True when a block carries no user-visible content. */
export declare function dataIsEmpty(type: string, data: unknown): boolean;
/** Convert data from one tool type into another built-in tool's shape. */
export declare function convertData(toType: string, data: unknown): Record<string, unknown>;
/** Flatten any built-in data shape into inline content. */
export declare function toInlineContent(data: unknown): InlineContent[];
/**
 * Merge `current` block data into `prev` block data (state-level), used by
 * Backspace/Delete merges committed as a single transaction.
 */
export declare function mergeData(prevType: string, prevData: unknown, curType: string, curData: unknown): Record<string, unknown>;
/** Types that can merge into each other on Backspace/Delete. */
export declare function canMerge(prevType: string, curType: string): boolean;
