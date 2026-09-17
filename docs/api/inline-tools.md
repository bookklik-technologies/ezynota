# Inline tools

Inline tools apply formatting to the current selection. They populate the floating toolbar (and the document toolbar's formatting row) and are wired to keyboard shortcuts.

## Built-in inline tools

| Key | Class | Effect | Shortcut |
| --- | --- | --- | --- |
| `bold` | `BoldTool` | `<strong>` | `Ctrl/Cmd+B` |
| `italic` | `ItalicTool` | `<em>` | `Ctrl/Cmd+I` |
| `underline` | `UnderlineTool` | `<u>` | `Ctrl/Cmd+U` |
| `strike` | `StrikethroughTool` | `<s>` | — |
| `code` | `CodeInlineTool` | `<code>` | — |
| `mark` | `MarkTool` | `<mark>` highlight | — |
| `color` | `ColorTool` | Text color palette | — |
| `background` | `BackgroundColorTool` | Background color palette | — |
| `link` | `LinkTool` | URL popover; `rel="noopener noreferrer"`; URL validation | `Ctrl/Cmd+K` |

All of them are exported both individually and as a map:

```ts
import { BUILTIN_INLINE_TOOLS, BoldTool, LinkTool } from "@bookklik/ezynota";

BUILTIN_INLINE_TOOLS.bold === BoldTool; // true
```

The full set (in default order) is registered unless you provide `config.inlineTools`.

## InlineTool interface

```ts
interface InlineTool {
  render(): HTMLElement;               // button contents (required)
  apply(range, context): void;         // apply to the preserved selection (required)
  remove?(range, context): void;       // toggle-off behavior
  isActive(selection): boolean;        // highlight state in toolbar
  destroy?(): void;
}
```

Static surface:

```ts
class BoldTool {
  static isInline = true;
  static title = "Bold";
  static icon = "bold";      // from the built-in icon set
  static shortcut = "CMD+B";
}
```

Most formatting tools extend `MarkInlineTool`, which handles button rendering, `aria-pressed` state, and toggling a named mark. Custom marks render as `<span data-ez-mark="…">`.

## Popover-based tools

`LinkTool`, `ColorTool`, and `BackgroundColorTool` open popovers instead of applying instantly. `InlineToolOptions.onActivate()` lets custom popover tools hook the editor's **preserved selection** — the selection is saved when the toolbar button is clicked (which naturally blurs the editor) and restored for `apply()`.

## Activation path

Everything funnels through one shared function — toolbar clicks and keyboard shortcuts alike:

```ts
applyInlineTool(host, "bold");
```

That guarantees identical selection handling, undo participation, and active-state updates regardless of how the tool was triggered.

## Registering custom inline tools

```ts
const editor = new Ezynota({
  target: "#app",
  inlineTools: [
    // Replace the whole set, or append to the defaults in your own order
    ...defaultInlineTools,
    MyHighlighterTool,
  ],
});
```

See [Custom tools](/guide/custom-tools) for a full worked example.
