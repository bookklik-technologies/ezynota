/** Minimal DOM helpers — all UI is built with createElement/textContent (Trusted Types friendly). */
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K];
export declare function button(className: string, label: string, ariaLabel?: string): HTMLButtonElement;
export declare function svgButton(className: string, svg: string, ariaLabel: string): HTMLButtonElement;
export declare function clearChildren(node: HTMLElement): void;
export declare function positionBelow(anchor: DOMRect | HTMLElement, target: HTMLElement): void;
export declare function clampToViewport(node: HTMLElement, margin?: number): void;
/** Dismiss a top-layer popup without moving it out of its editor's DOM. */
export declare function dismissPopover(node: HTMLElement): void;
/** Anchor a popup in the top layer, with a fixed-position fallback. */
export declare function placePopover(node: HTMLElement, anchor: DOMRect, placement?: "above" | "below"): void;
/** Arrow navigation for a popup containing ordinary buttons and selects. */
export declare function navigateControls(event: KeyboardEvent, root: HTMLElement): void;
