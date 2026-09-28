type Parts = {
    brand: HTMLElement;
    title: HTMLInputElement;
    history: HTMLElement;
    specialist?: HTMLElement;
    view: HTMLElement;
    files: HTMLElement;
    exportControl: HTMLElement;
    more?: HTMLDetailsElement;
};
/** Native details semantics, with a top-layer panel for clipped embedded editors. */
export declare function bindSuiteMenu(details: HTMLDetailsElement, panel: HTMLElement): () => void;
export declare function installSuiteTopbar(root: HTMLElement, bar: HTMLElement, parts: Parts): () => void;
/** Accessible transient menus used by the grid and design editor topbars. */
export declare function openSuiteMenu(anchor: HTMLElement, items: {
    label: string;
    action: () => void;
    disabled?: boolean;
}[]): () => void;
export {};
