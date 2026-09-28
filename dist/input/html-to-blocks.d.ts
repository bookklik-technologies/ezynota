/**
 * HTML → blocks conversion for paste import. HTML is parsed with
 * DOMParser, dangerous nodes and attributes are removed, and inline
 * content is extracted as portable JSON. Parsed HTML never enters
 * document state directly and unsafe URLs are dropped during the
 * DOM→JSON walk.
 */
export interface ParsedBlock {
    type: string;
    data: Record<string, unknown>;
}
/** Sanitize in place: remove dangerous elements and non-allowlisted attributes. */
export declare function sanitizeParsedTree(root: Element): void;
/** Convert sanitized HTML into Ezynota block shapes. */
export declare function htmlToBlocks(html: string): ParsedBlock[];
/** Plain text → paragraph blocks (one per non-empty line). */
export declare function textToBlocks(text: string): ParsedBlock[];
