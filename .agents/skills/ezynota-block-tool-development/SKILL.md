---
name: ezynota-block-tool-development
description: "Create or update custom Ezynota block tools, including data shape, rendering, conversion, paste behavior and lifecycle. Use for new block types, not ordinary document composition."
---

# Ezynota Block Tool Development

## Inputs and approach

Define the persisted JSON shape first, then identify editing behavior, toolbox metadata, conversion, paste routes and read-only support. Extend `TextBlockTool` for rich-text blocks before implementing structural editing primitives yourself.

Read [custom tools](../../../docs/guide/custom-tools.md), [block tools](../../../docs/api/block-tools.md), [public tool types](../../../src/core/types.ts), [tool registry](../../../src/core/tool-registry.ts), [text tools](../../../src/tools/text-tools.ts) and [input contracts](../../../src/input/tool-interfaces.ts).

## Workflow and contracts

- Register tools through `config.tools` using a stable block type key. Built-ins remain available; the key becomes the persisted `block.type`.
- Keep tool data JSON-compatible and validate untrusted or malformed values. `save` output is normalized before entering the document.
- `TextBlockTool` already supplies rich-text content, splitting, merging, focus and empty-state behavior. Reuse it for text-like blocks.
- Static `toolbox`, `shortcut`, `paste`, `conversion`, `enterKey`, `enableInlineTools` and `supportsReadOnly` declarations drive editor behavior; only declare capabilities the tool implements.
- Build DOM with safe element/text APIs. Never insert unsanitized document data through `innerHTML`.
- Release DOM listeners and owned resources in `destroy`; account for `rendered`, `updated`, `moved` and `removed` when the tool keeps external state.
- Failed lazy loaders fall back to `UnknownBlockTool`, preserving raw data. Do not delete unknown block payloads during migrations or saves.

## Example

```ts
import { Ezynota, TextBlockTool } from 'ezynota';

class HintTool extends TextBlockTool {
  static toolbox = { title: 'Hint', icon: '💡', category: 'Basic blocks' };
  static enableInlineTools = true;
  static supportsReadOnly = true;

  render() {
    const wrap = document.createElement('aside');
    wrap.className = 'my-hint';
    wrap.append(this.editable);
    return wrap;
  }
}

const editor = new Ezynota({ target: '#app', tools: { hint: HintTool } });
await editor.ready;
editor.insertBlock('hint', { content: [{ type: 'text', text: 'Remember this.' }] });
```

## Deliverables and verification

Deliver the tool class, registration, data contract and required styles. Review malformed data, empty state, split/merge, conversion, paste, clipboard, read-only rendering, undo/redo, lazy-load failure and destroy cleanup. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
