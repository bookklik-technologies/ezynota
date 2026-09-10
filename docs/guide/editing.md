# Editing & block API

Everything in Ezynota flows through **transactions** — all-or-nothing units of work with mechanical undo. The public block API is a thin, safe layer over that pipeline, and the DOM is only a view of the document state.

## Reading the document

```ts
// Frozen snapshot of the current document
const doc = editor.getSnapshot();

// Flat list of block references (including nested children, flattened)
const refs = editor.getBlocks();
// [{ id, type, data, tunes, ... }, ...]

const ref = editor.getBlockById("b1");
const index = editor.getBlockIndex("b1");
```

`BlockRef` objects are lightweight, readonly views — always re-read after a change rather than caching them.

## Creating and modifying blocks

```ts
// Insert at the end; returns the new block id
const id = editor.insertBlock("paragraph", { content: [] });

// Control placement & focus
editor.insertBlock(
  "heading",
  { level: 2, content: [{ type: "text", text: "Title" }] },
  { after: id, focus: true }
);

// Update data (one undoable transaction)
editor.updateBlock(id, { level: 3, content: [] });

// Duplicate / convert / move / remove
const copyId = editor.duplicateBlock(id);
editor.convertBlock(id, "quote");
editor.moveBlock(id, { index: 0 });
editor.removeBlock(id);
```

`insertBlock` options: `{ index?, after?, before?, focus? }`.

## Save & render

```ts
// Collect every tool's save() output, validate, and return the document.
// Rejects with EZ_INVALID_DATA if any block is invalid.
const doc = await editor.save();

// Replace the entire document (migrates schema, resets history)
await editor.render(otherDocument);

// Remove everything in one transaction
editor.clear();
```

## Undo / redo

History is per-note in workspace mode and automatically coalesced (rapid typing collapses into single undo steps; a paste is one step).

```ts
editor.undo();
editor.redo();
editor.canUndo(); // boolean
editor.canRedo(); // boolean

// Per-note history can be exported/imported for persistence
const state = editor.exportHistoryState();
editor.importHistoryState(state);
```

## Focus & selection

```ts
editor.focus();                          // sensible default focus
editor.focus({ at: "end" });             // "start" | "end" | "default"
editor.focus({ blockId: id });           // focus a specific block
```

## Read-only mode

```ts
editor.setReadOnly(true);
editor.readOnly; // true (also true while the workspace is loading)
```

Emits `readOnly:changed`.

## Slash menu & block picker

Typing `/` opens the searchable block picker. Programmatically:

```ts
editor.openBlockPicker();               // pick for the active block
editor.openBlockPicker(blockId);        // convert a specific block
editor.openBlockPicker(blockId, true);  // insert mode (adds after target)
```

## Commands

All built-in behavior is also reachable through the command bus — useful for custom toolbars:

```ts
editor.dispatch("EZ_UNDO");
editor.dispatch("EZ_INSERT_BLOCK", { type: "callout", data: { variant: "info", content: [] } });
```

See the [Commands reference](/api/commands).

## Find & replace

```ts
editor.findReplace("TODO", "DONE");     // replace first match
editor.findReplace("TODO", "DONE", true); // replace all (one undo step)
```

In workspace mode, `editor.workspace.findInDocument(...)` wraps the same engine.

## Workspace convenience

```ts
editor.setDocumentTitle("Meeting notes");
editor.currentTitle();
editor.wordCount();       // workspace mode
editor.search("query");   // workspace mode
```

## Error handling

API calls throw typed [`EzynotaError`](/api/errors) instances with a `code`:

```ts
try {
  editor.updateBlock("missing", {});
} catch (e) {
  if (e.code === "EZ_BLOCK_NOT_FOUND") { /* … */ }
}
```
