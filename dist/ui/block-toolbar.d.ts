import type { Host } from "../host";
/**
 * One horizontal group beside the active block: add and a combined drag/menu control.
 * The actions button opens a block menu with
 * convert / duplicate / move / delete and registered tunes.
 */
export declare class BlockToolbar {
    private root;
    private host;
    private settingsPopover;
    private activeBlockId;
    private open;
    private settingsButton;
    private disposers;
    private menuTunes;
    private activeBlockElement;
    private hoveredBlockId;
    constructor(host: Host);
    getElement(): HTMLElement;
    showFor(blockId: string): void;
    hide(): void;
    private toggleSettings;
    private openSettings;
    private closeSettings;
    private renderSettingsMenu;
    private renderTuneMenu;
    private hostToolApi;
    private menuButton;
    destroy(): void;
}
