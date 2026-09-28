import type { Host } from "../host";
/**
 * Document find/replace. Matches are located across block text — including
 * list items, table cells, toggle headings and image captions — and every
 * replacement commits as ONE transaction (one undo entry).
 *
 * LIMITATION (best effort): matching operates per text node, so a query
 * that SPANS an inline boundary (e.g. across "</strong><em>") is not
 * found. A per-block plain-text scan with offset mapping is required to
 * fix that and is intentionally out of scope here.
 *
 * Replacements use literal string splicing (split/join), so `$&`, `$\``
 * etc. in the replacement text are never expanded.
 */
export declare function createFindReplace(host: Host, target: HTMLElement): (query: string, replaceWith: string, replaceAll: boolean) => void;
