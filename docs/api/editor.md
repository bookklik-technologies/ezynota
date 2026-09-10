# Ezynota class

The `Ezynota` class is the editor. One instance mounts into one holder element.

```ts
import { Ezynota } from "@bookklik/ezynota";

const editor = new Ezynota({ holder: "#app" });
await editor.ready;
```

The constructor is SSR-safe in the sense that it **throws** `EZ_RENDER_FAILED` when there is no DOM — it never silently no-ops.

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `ready` | `Promise<void>` | Resolves after the initial workspace load. **Await this before mutating.** |
| `holder` | `Element` | The mount surface element. |
| `readOnly` | `boolean` | `config.readOnly \|\| editingLocked` — true during workspace load. |
| `registry` | `ToolRegistry` | The tool registry (block tools, inline tools, tunes). |
| `i18n` | `I18n` | The i18n instance. |
| `blocks` | `BlockManager` | Low-level block CRUD (the public methods below wrap it). |
| `workspace` | `WorkspaceController \| null` | Only in workspace/document modes. See [Workspace API](/api/workspace). |
| `declarative` | `boolean` | Set when mounted via `initAll()`. |

## Lifecycle

### `save(): Promise<EzynotaDocument>`

Collects every block tool's `save()` output, validates each block, and returns the document. Rejects with `EZ_INVALID_DATA` if any block is invalid. In recovery mode, returns the original payload verbatim.

### `render(document): Promise<void>`

Migrates the document to the current schema version, replaces the in-memory document, and **resets history**.

### `getSnapshot(): Readonly<EzynotaDocument>`

Frozen view of the current document — cheap, no tool round-trips.

### `clear(): void`

Removes all blocks in one transaction.

### `focus(options?)`

```ts
editor.focus({ at: "start" | "end" | "default", blockId?: string });
```

### `setReadOnly(value: boolean)`

Toggles read-only mode. Emits `readOnly:changed`.

### `destroy(): void`

Tolerant teardown — safe to call twice. Removes mount classes/attributes and empties the holder. Emits `destroyed`.

## Block API

| Method | Returns | Description |
| --- | --- | --- |
| `insertBlock(type, data?, options?)` | `string` (new id) | `options: { index?, after?, before?, focus? }` |
| `updateBlock(id, data)` | `void` | Replace block data (one transaction). |
| `removeBlock(id)` | `void` | Delete a block. |
| `moveBlock(id, target)` | `void` | `target: BlockPosition` — final destination index. |
| `duplicateBlock(id)` | `string` (new id) | Deep copy, ids regenerated. |
| `convertBlock(id, targetType)` | `void` | Convert using tool conversion configs. |
| `getBlockById(id)` | `BlockRef \| undefined` | Lightweight readonly ref. |
| `getBlocks()` | `readonly BlockRef[]` | All blocks, nested children flattened. |
| `getBlockIndex(id)` | `number` | Current index, `-1` if missing. |

## History

| Method | Description |
| --- | --- |
| `undo()` / `redo()` | Step backward/forward. |
| `canUndo()` / `canRedo()` | Boolean guards (also exposed via `history:changed`). |
| `exportHistoryState()` | Serialize the current note's undo history. |
| `importHistoryState(state)` | Restore a previously exported history. |

## Events & commands

### `on(event, handler): () => void`

Typed subscription. Returns an unsubscribe function.

```ts
const off = editor.on("change", (batch) => console.log(batch));
off(); // done
```

See the full [events list](/api/events).

### `dispatch<T>(command, payload)`

Run a named command through the command bus. See [Commands](/api/commands).

```ts
editor.dispatch("EZ_UNDO");
```

## UI helpers

| Method | Description |
| --- | --- |
| `openBlockPicker(blockId?, insert = false)` | Open the slash-menu picker; convert or insert. |
| `setDocumentTitle(title)` / `currentTitle()` | Document title (stored in `meta.title`). |
| `findReplace(query, replaceWith, replaceAll?)` | Document find & replace. |
| `isRecoveryMode()` / `getOriginalDocument()` | Introspect recovery state after a bad load. |
| `getMode()` | `"workspace" \| "document" \| "embedded" \| "headless"`. |

## Static members

### `Ezynota.initAll(root?: ParentNode): Ezynota[]`

Mount every `[data-ezn-editor]` under `root` (default: `document`). Idempotent — already-mounted holders are skipped.

### `Ezynota.getInstance(elementOrSelector): Ezynota | undefined`

Look up the instance mounted on an element or selector.

## Error contract

- All mutations throw `EZ_DESTROYED` after `destroy()`.
- All mutations throw `EZ_EDITING_LOCKED` before `ready` resolves.
- Invalid documents throw `EZ_INVALID_DOCUMENT` / `EZ_INVALID_BLOCK` / `EZ_INVALID_DATA`.

See [Errors](/api/errors) for the full code list.
