import type { Host } from "../host";
import type { JsonValue } from "../types";
/**
 * ClipboardManager:
 * - Copy exports the PRECISE selection: a whole-block payload when the
 *   selection covers entire blocks, otherwise the selected fragment
 *   (text/plain + text/html + Ezynota JSON).
 * - Paste inserts at the caret: Ezynota JSON → files → sanitized HTML →
 *   plain text; non-collapsed selections are replaced, block payloads
 *   commit as ONE transaction so undo removes the paste in a single step
 *   (spec §17).
 */
export declare class ClipboardManager {
    private host;
    private target;
    private disposers;
    constructor(host: Host, target: HTMLElement);
    start(): void;
    stop(): void;
    /**
     * Full blocks covered by the selection, in document order — or null when
     * the selection starts/ends mid-block (partial copy instead).
     */
    private wholeBlocksInSelection;
    private selectionCoversBlockStart;
    private selectionCoversBlockEnd;
    private closestBlock;
    /** Serialize the selection (whole blocks or fragment) into a DataTransfer. */
    private writeClipboard;
    /** Paste priority: Ezynota JSON → files → sanitized HTML → plain text. */
    private paste;
    /** Route files to tools that declare matching file paste rules. */
    private routeFiles;
    private insertParsed;
    /** Block-level paste: one transaction, one undo step. */
    private insertClipboardBlocks;
    /**
     * Inline paste at the caret (also replaces a same-block selection).
     * Falls back to a block-level paste when the caret is not in an editable.
     */
    private insertTextAtCaret;
}
/**
 * Untrusted clipboard JSON is validated through the document salvage path:
 * invalid blocks are dropped or converted, ids de-duplicated and unsafe
 * link payloads stripped by the normalizer's link sanitizer.
 */
export declare function sanitizeClipboardBlocks(blocks: unknown[]): {
    type: string;
    data: JsonValue;
}[];
