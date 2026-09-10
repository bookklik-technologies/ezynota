import type { EzynotaEditorAPI, JsonValue } from "./types";
import { EzynotaError } from "./errors";

export interface CommandDescriptor<TPayload extends JsonValue = JsonValue> {
  name: string;
  run: (payload: TPayload, api: EzynotaEditorAPI) => void;
}

/**
 * CommandManager: keyboard shortcuts, toolbar buttons, slash menu entries,
 * framework integrations and plugins all invoke behavior through commands.
 */
export class CommandManager {
  private commands = new Map<string, { run: (payload: JsonValue, api: EzynotaEditorAPI) => void }>();

  register(descriptor: CommandDescriptor<never> | { name: string; run: (payload: JsonValue, api: EzynotaEditorAPI) => void }): void {
    this.commands.set(descriptor.name, descriptor as { run: (payload: JsonValue, api: EzynotaEditorAPI) => void });
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  dispatch(nameOrCommand: string | CommandDescriptor<never>, payload: JsonValue, api: EzynotaEditorAPI): void {
    const name = typeof nameOrCommand === "string" ? nameOrCommand : nameOrCommand.name;
    const command = this.commands.get(name);
    if (!command) {
      throw new EzynotaError("EZ_UNKNOWN_ERROR", `Command "${name}" is not registered`, { command: name });
    }
    command.run(payload, api);
  }

  list(): string[] {
    return Array.from(this.commands.keys());
  }
}

export const EZ = {
  INSERT_BLOCK: "EZ_INSERT_BLOCK",
  DELETE_BLOCK: "EZ_DELETE_BLOCK",
  MOVE_BLOCK: "EZ_MOVE_BLOCK",
  DUPLICATE_BLOCK: "EZ_DUPLICATE_BLOCK",
  CONVERT_BLOCK: "EZ_CONVERT_BLOCK",
  UPDATE_BLOCK: "EZ_UPDATE_BLOCK",
  FOCUS_BLOCK: "EZ_FOCUS_BLOCK",
  UNDO: "EZ_UNDO",
  REDO: "EZ_REDO",
  OPEN_SLASH_MENU: "EZ_OPEN_SLASH_MENU",
  SET_READ_ONLY: "EZ_SET_READ_ONLY",
  SELECT_BLOCK: "EZ_SELECT_BLOCK"
} as const;
