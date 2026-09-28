import type { EzynotaEditorAPI, JsonValue } from "./types";
export interface CommandDescriptor<TPayload extends JsonValue = JsonValue> {
    name: string;
    run: (payload: TPayload, api: EzynotaEditorAPI) => void;
}
/**
 * CommandManager: keyboard shortcuts, toolbar buttons, slash menu entries,
 * framework integrations and plugins all invoke behavior through commands.
 */
export declare class CommandManager {
    private commands;
    register(descriptor: CommandDescriptor<never> | {
        name: string;
        run: (payload: JsonValue, api: EzynotaEditorAPI) => void;
    }): void;
    has(name: string): boolean;
    dispatch(nameOrCommand: string | CommandDescriptor<never>, payload: JsonValue, api: EzynotaEditorAPI): void;
    list(): string[];
}
export declare const EZ: {
    readonly INSERT_BLOCK: "EZ_INSERT_BLOCK";
    readonly DELETE_BLOCK: "EZ_DELETE_BLOCK";
    readonly MOVE_BLOCK: "EZ_MOVE_BLOCK";
    readonly DUPLICATE_BLOCK: "EZ_DUPLICATE_BLOCK";
    readonly CONVERT_BLOCK: "EZ_CONVERT_BLOCK";
    readonly UPDATE_BLOCK: "EZ_UPDATE_BLOCK";
    readonly FOCUS_BLOCK: "EZ_FOCUS_BLOCK";
    readonly UNDO: "EZ_UNDO";
    readonly REDO: "EZ_REDO";
    readonly OPEN_SLASH_MENU: "EZ_OPEN_SLASH_MENU";
    readonly SET_READ_ONLY: "EZ_SET_READ_ONLY";
    readonly SELECT_BLOCK: "EZ_SELECT_BLOCK";
};
