import type { BlockTune, BlockTuneOptions, JsonValue } from "../types";
/**
 * Alignment tune: stores {"alignment": "left"|"center"|"right"} per block
 * and wraps the rendered block element with the alignment class.
 */
export declare class AlignmentTune implements BlockTune {
    static title: string;
    private api;
    private value;
    private t;
    private onChange?;
    constructor(options: BlockTuneOptions);
    render(): HTMLElement;
    save(): JsonValue;
    wrap(element: HTMLElement): HTMLElement;
    /** Re-apply the current alignment to a wrap element (non-destructive update). */
    applyTo(element: HTMLElement): void;
    /** Accept an externally committed tune value (e.g. undo/redo) without a rebuild. */
    setValue(value: JsonValue): void;
    private applyWrap;
    destroy(): void;
}
