# Commands

Every built-in behavior in Ezynota routes through a command bus. This gives custom toolbars, keyboard layers, and plugins a stable dispatch surface that doesn't depend on internal methods.

```ts
editor.dispatch("EZ_UNDO");
editor.dispatch("EZ_INSERT_BLOCK", { type: "callout", data: { variant: "info", content: [] } });
```

## Command reference

Commands are addressed by the `EZ` constants (all values are `"EZ_*"` strings):

| Constant | Value | Payload | Action |
| --- | --- | --- | --- |
| `EZ.INSERT_BLOCK` | `EZ_INSERT_BLOCK` | `{ type, data? }` | Insert a block. |
| `EZ.DELETE_BLOCK` | `EZ_DELETE_BLOCK` | `{ id }` | Delete a block. |
| `EZ.MOVE_BLOCK` | `EZ_MOVE_BLOCK` | `{ id, target }` | Move a block. |
| `EZ.DUPLICATE_BLOCK` | `EZ_DUPLICATE_BLOCK` | `{ id }` | Duplicate a block. |
| `EZ.CONVERT_BLOCK` | `EZ_CONVERT_BLOCK` | `{ id, targetType }` | Convert block type. |
| `EZ.UPDATE_BLOCK` | `EZ_UPDATE_BLOCK` | `{ id, data }` | Replace block data. |
| `EZ.FOCUS_BLOCK` | `EZ_FOCUS_BLOCK` | `{ id }` | Focus a block. |
| `EZ.UNDO` / `EZ.REDO` | `EZ_UNDO` / `EZ_REDO` | — | History step. |
| `EZ.OPEN_SLASH_MENU` | `EZ_OPEN_SLASH_MENU` | `{ blockId?, insert? }` | Open the block picker. |
| `EZ.SET_READ_ONLY` | `EZ_SET_READ_ONLY` | `{ value }` | Toggle read-only. |
| `EZ.SELECT_BLOCK` | `EZ_SELECT_BLOCK` | `{ id }` | Select a block. |

The raw string values work too — constants are just a typo-safety layer:

```ts
import { EZ } from "ezynota";

editor.dispatch(EZ.INSERT_BLOCK, { type: "paragraph", data: { content: [] } });
```

## CommandDescriptor

Commands are described by a small interface:

```ts
interface CommandDescriptor<TPayload = unknown> {
  name: string;
  run(payload: TPayload, api: EzynotaEditorAPI): void;
}
```

`api` is the editor's public API surface, so command handlers have the same capabilities as your integration code.

## When to use commands vs. methods

- **Methods** (`editor.insertBlock(...)`) — when you have a direct reference and want type checking.
- **Commands** (`editor.dispatch(...)`) — when the call site is generic or dynamic: custom toolbar buttons, saved macros, keyboard layers, plugin integrations.

Both paths end in the same transaction pipeline, emit the same events, and participate in undo.
