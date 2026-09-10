# Block tools

Block tools define block types: how they render, how they serialize, and how they behave under editing operations. Ezynota ships ten built-ins, and they're all built on the same public SDK you can use for your own.

## Built-in block types

| Type | Class | Highlights |
| --- | --- | --- |
| `paragraph` | `Paragraph` | Default block; converts to heading/list/quote/code/delimiter; inline tools enabled. |
| `heading` | `Heading` | Levels 1–3 by default (configurable); level switcher in block settings. Shortcut `Cmd/Ctrl+Shift+2`. |
| `quote` | `Quote` | Blockquote with rich content. |
| `code` | `CodeTool` | Plain-text editing (`Enter` = newline, no inline marks). Shortcut `Cmd/Ctrl+Shift+C`. |
| `delimiter` | `Delimiter` | Visual separator; `Enter` is ignored. |
| `list` | `ListTool` | Bulleted / ordered / task lists; checkboxes; style switcher. Shortcut `Cmd/Ctrl+Shift+L`. |
| `table` | `TableTool` | Rich-text cells, header toggle, add/delete rows & columns, `Tab` navigation that grows the table. |
| `image` | `ImageTool` | Upload, paste, drag & drop, URL; alt text, width slider, captions; `asset:<id>` sources. |
| `callout` | `CalloutTool` | `info` / `warning` / `success` / `danger` variants with a variant picker. |
| `toggle` | `ToggleTool` | Collapsible sections hosting **nested child blocks**; open/closed state is data (undoable). |

There's also `UnknownBlockTool` — a read-only fallback that preserves raw data for block types that fail to load or no longer exist.

## Tool static configuration

Tools declare capabilities as static properties:

```ts
class Paragraph extends TextBlockTool {
  static toolbox = { title: "Paragraph", category: "Basic blocks" };
  static conversion = { to: ["heading", "list", "quote", "code", "delimiter"] };
  static enableInlineTools = true;
}
```

| Static | Type | Effect |
| --- | --- | --- |
| `toolbox` | `{ title, icon?, category? }` | Entry in the slash menu / picker. |
| `shortcut` | `string` | Global shortcut, e.g. `"CMD+SHIFT+L"`. |
| `paste` | `{ tags?, files?, patterns? }` | Route pasted tags/files/regex matches to this tool. |
| `conversion` | `{ from?, to? }` | Enable convert-to entries in the block menu (`to`), and being converted (`from` mappers). |
| `enterKey` | `"split" \| "newline" \| "ignore"` | Enter behavior inside the block. |
| `enableInlineTools` | `boolean` | Floating inline toolbar available. |
| `supportsReadOnly` | `boolean` | Usable in read-only mode. |
| `sanitize?` | function | Data sanitizer applied on save. |
| `apiVersion` | `string` | For forward compatibility. |

## Lifecycle hooks

```ts
interface BlockTool {
  render(): HTMLElement;                      // build the DOM (required)
  save(element: HTMLElement): unknown;        // read DOM back into data (required)
  validate?(data): boolean;                   // gate save() output
  merge?(incoming): void;                     // Backspace/Delete merging
  renderSettings?(): MenuItem[];              // block settings menu entries
  onPaste?(event: PasteEvent): void;          // custom paste handling
  rendered?(): void;                          // after DOM attach
  updated?(): void;                           // after data update
  moved?(pos: { from: number; to: number }): void;
  removed?(): void;
  destroy?(): void;
}
```

## Editing primitives

The editor drives structural edits through tool helpers (`splitAtRange`, `merge`, `updated`, `isEmpty`, …). `TextBlockTool` implements all of these for rich-text blocks, so most custom text-ish tools just extend it:

```ts
import { TextBlockTool } from "@bookklik/ezynota";

class HintTool extends TextBlockTool {
  static toolbox = { title: "Hint", icon: "💡", category: "Basic blocks" };
  static enableInlineTools = true;

  render() {
    const el = document.createElement("div");
    el.className = "my-hint";
    /* … */
    return el;
  }
}
```

## Registering tools

```ts
const editor = new Ezynota({
  holder: "#app",
  tools: {
    hint: HintTool,        // usable as type: "hint", in slash menu, conversions
  },
});
```

Built-ins stay registered; your entries are additive. See the full walkthrough in [Custom tools](/guide/custom-tools).

## Lazy loading

The `ToolRegistry` supports lazy tool loaders — register a loader that resolves a constructor on demand. Broken loaders fall back to `UnknownBlockTool` so documents remain openable.

## Nested blocks (toggles)

Tools that host child blocks implement the `NestedBlockHost` capability (as `ToggleTool` does). Children live in `block.children` and participate in the same transactions, undo, and events (`children:update`).
