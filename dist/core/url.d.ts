/**
 * Decide whether a URL is safe to store and render.
 * Blocks dangerous schemes (javascript:, data:, vbscript:) except for
 * image data URLs handled separately by image rendering code.
 */
export declare function isSafeUrl(input: unknown): boolean;
/** Image sources may use tightly-controlled data URLs. */
export declare function isSafeImageUrl(input: unknown): boolean;
/** Normalize and sanitize a link target; returns null if unsafe. */
export declare function sanitizeLinkTarget(input: unknown): string | null;
