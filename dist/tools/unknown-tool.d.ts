import type { BlockTool, JsonValue } from "../types";
import type { BlockAPI } from "../core/types";
/**
 * UnknownBlockTool: read-only fallback for blocks whose tool is not
 * available (missing plugin, newer schema, recovery mode). It renders the
 * raw data so nothing is lost and `save()` returns the data untouched.
 */
export declare class UnknownBlockTool implements BlockTool {
    private api;
    constructor(options: {
        api: BlockAPI;
    });
    render(): HTMLElement;
    /** Preserve the original data verbatim. */
    save(): JsonValue;
}
