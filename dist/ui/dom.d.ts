/** Minimal DOM helpers — all UI is built with createElement/textContent (Trusted Types friendly). */
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K];
export declare function button(className: string, label: string, ariaLabel?: string): HTMLButtonElement;
export declare function svgButton(className: string, svg: string, ariaLabel: string): HTMLButtonElement;
export declare function clearChildren(node: HTMLElement): void;
export declare function positionBelow(anchor: DOMRect | HTMLElement, target: HTMLElement): void;
export declare function clampToViewport(node: HTMLElement, margin?: number): void;
/** Anchor a popup using viewport coordinates, flipping above when needed. */
export declare function placePopover(node: HTMLElement, anchor: DOMRect): void;
/** Arrow navigation for a popup containing ordinary buttons and selects. */
export declare function navigateControls(event: KeyboardEvent, root: HTMLElement): void;
