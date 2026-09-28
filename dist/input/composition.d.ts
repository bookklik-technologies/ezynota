export declare function compositionStarted(): void;
export declare function compositionEnded(): void;
export declare function isComposing(): boolean;
export declare function justEndedComposition(withinMs?: number): boolean;
/** True when a key event must be ignored because of IME composition. */
export declare function isImeKeyEvent(e: KeyboardEvent): boolean;
