import { Ezynota } from "../editor";
import type { EzynotaConfig } from "../types";
/** Build a config from documented data-ezn-* attributes only. */
export declare function configFromAttributes(element: HTMLElement): Partial<EzynotaConfig> & {
    target: HTMLElement;
};
/** Mount one element unless it already holds an editor. Returns undefined when skipped. */
export declare function mountElement(element: HTMLElement): Ezynota | undefined;
/**
 * Mount one element, converting construction failures into reported errors
 * (console + bubbling `ezn:error`) instead of propagating them. Used by the
 * batch scan and the mutation observer so one broken element never aborts
 * the others. Returns the instance on success, undefined otherwise.
 */
export declare function safeMountElement(element: HTMLElement): Ezynota | undefined;
/** Initialize every `[data-ezn-editor]` under `root` (default: document). */
export declare function initAll(root?: ParentNode): Ezynota[];
/**
 * Side-effect hook used by the main entry: starts the DOM observer and
 * performs the initial scan. `ezynota/core` never calls this.
 */
export declare function setupDeclarativeScanning(): void;
/** Look up the editor instance for an element or selector. */
export declare function getInstance(elementOrSelector: Element | string): Ezynota | undefined;
