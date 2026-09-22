---
name: ezynota-inline-tool-development
description: "Create or update Ezynota inline formatting tools, marks and selection-aware popovers. Use for inline rich-text behavior, not block types or block-wide tunes."
---

# Ezynota Inline Tool Development

## Inputs and approach

Identify the mark's JSON representation, toggle behavior, toolbar label/icon, shortcut and whether it needs a popover. Prefer `MarkInlineTool` conventions for simple marks and a direct `InlineTool` implementation for custom interactions.

Read [inline tools](../../../docs/api/inline-tools.md), [custom tools](../../../docs/guide/custom-tools.md), [public interfaces](../../../src/core/types.ts), [built-in inline tools](../../../src/inline/inline-tools.ts), [rich-text DOM conversion](../../../src/rich-text/dom.ts) and [URL safety](../../../src/core/url.ts).

## Workflow and contracts

- Register constructors through `config.inlineTools`. Providing this option defines the toolbar order, so explicitly include any built-ins that must remain.
- Toolbar clicks and shortcuts use the same activation path. Call the provided activation hook so the editor applies the tool to its preserved selection.
- `apply(range, context)` must operate within `context.blockElement`, request one save and avoid replacing unrelated content or marks.
- Persist formatting as supported inline mark nodes. Custom marks render as `data-ez-mark` spans; keep attributes JSON-compatible and deterministic.
- Validate link-like values with the public URL safety rules. Never create executable URLs or inject unsanitized HTML.
- Popovers must restore selection, support Escape/outside dismissal, remain keyboard accessible and release document/window listeners.
- Implement `destroy` for owned DOM or global resources and preserve read-only behavior.

## Example

```ts
import type { InlineTool, InlineToolContext, InlineToolOptions } from 'ezynota/types';

class SmallCapsTool implements InlineTool {
  static isInline = true as const;
  static title = 'Small caps';
  private button: HTMLButtonElement | null = null;

  constructor(private options: InlineToolOptions) {}

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = 'SC';
    this.button.addEventListener('click', this.activate);
    return this.button;
  }

  private activate = () => this.options.onActivate?.();

  apply(range: Range, context: InlineToolContext) {
    if (range.collapsed) return;
    const span = context.blockElement.ownerDocument.createElement('span');
    span.dataset.ezMark = 'smallcaps';
    span.append(range.extractContents());
    range.insertNode(span);
    context.requestSave();
  }

  isActive() { return false; }
  destroy() { this.button?.removeEventListener('click', this.activate); }
}
```

Register it in the requested `inlineTools` list together with any built-ins the host wants to keep.

## Deliverables and verification

Deliver the tool, registration order, mark shape and styles. Review collapsed, forward and backward selections, partial existing marks, cross-node ranges, shortcuts, popover focus, unsafe URLs, undo/redo, save/render round-trip and cleanup. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
