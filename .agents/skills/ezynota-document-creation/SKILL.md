---
name: ezynota-document-creation
description: "Create or modify Ezynota documents, blocks and rich-text data through the public editor API. Use for editable document content, not custom tool implementation or file interchange."
---

# Ezynota Document Creation

## Inputs and approach

Identify the document structure, block types, copy, inline marks, tunes, placement and editor mode. Prefer built-in blocks so content stays editable and portable.

Read [editing](../../../docs/guide/editing.md), [document format](../../../docs/api/document-format.md), [editor API](../../../docs/api/editor.md), [schema implementation](../../../src/core/schema.ts), [editor implementation](../../../src/editor.ts) and [rich-text types](../../../src/rich-text/types.ts).

## Workflow and contracts

- Await `editor.ready` before mutations; early writes throw `EZ_EDITING_LOCKED` while workspace loading owns the document.
- Use `insertBlock`, `updateBlock`, `convertBlock`, `moveBlock`, `duplicateBlock` and `removeBlock`. Insert returns the new block id; block references are readonly snapshots and should be re-read after changes.
- Store rich text as `InlineContent[]`, not HTML strings. Preserve supported mark nodes and safe link targets.
- Keep block data, tunes, children and document metadata JSON-compatible. Let the editor generate ids unless stable imported ids are required.
- `save()` collects tool output and validates it. `getSnapshot()` is a frozen in-memory view. `render()` replaces the document, migrates it and resets history.
- Use built-in transactions through the public methods; do not mutate snapshots or DOM nodes as document state.
- Respect read-only and recovery modes. An unsupported schema may open as preserved read-only content rather than becoming editable.

## Example

```ts
import { Ezynota } from 'ezynota';

const editor = new Ezynota({ target: '#app', mode: 'document' });
await editor.ready;

const heading = editor.insertBlock('heading', {
  level: 1,
  content: [{ type: 'text', text: 'Project brief' }],
});
editor.insertBlock('paragraph', {
  content: [{ type: 'text', text: 'A portable, editable overview.' }],
}, { after: heading, focus: true });

const document = await editor.save();
```

## Deliverables and verification

Deliver document data or editor mutations with mode and readiness assumptions. Review empty content, inline marks, placement, nested blocks, invalid data, read-only/recovery behavior, undo/redo, save validation and JSON round-trip. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
