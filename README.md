# Ezynota

**A free, block-style editor with portable JSON output.**

Ezynota is a framework-agnostic, block-based web editor library for building structured editing
experiences — CMS platforms, documentation systems, note-taking apps, comments, and knowledge bases.

- **Block-first** — every paragraph, heading, list, quote, code block or divider is a block.
- **JSON-first** — inline rich text is stored as portable JSON, never as opaque HTML strings.
- **Transaction-driven** — every edit becomes a typed transaction against the document model;
  the DOM is only a view.
- **Zero runtime dependencies.**
- **Accessible** — keyboard-complete operation, ARIA menus, RTL, reduced motion (WCAG 2.2 AA target).
- **Secure by default** — pasted HTML is sanitized, dangerous URLs are rejected, no `eval`.

## Quick start

### Declarative (browser bundle)

```html
<link rel="stylesheet" href="ezynota.css" />
<!-- A full writing workspace: notes, folders, trash, autosave,
     import/export, search and fullscreen — all browser-local. -->
<div data-ezn-editor></div>
<script src="ezynota.umd.cjs"></script>
```

Every `[data-ezn-editor]` element mounts a **workspace editor** after DOM
readiness, and elements inserted later are observed automatically. Only the
documented attribute values are parsed — attribute contents are never
evaluated:

| Attribute                | Values                                              | Description                          |
| ------------------------ | --------------------------------------------------- | ------------------------------------ |
| `data-ezn-mode`          | `workspace` \| `document` \| `embedded` \| `headless` | Lifecycle mode (default `workspace`). |
| `data-ezn-workspace`     | any workspace id                                    | Share notes across targets/pages.    |
| `data-ezn-theme`         | `light` \| `dark` \| `system`                       | UI theme.                            |
| `data-ezn-readonly`      | `true` \| `false`                                   | Read-only editing.                   |
| `data-ezn-placeholder`   | text                                                | First-block placeholder.             |
| `data-ezn-autofocus`     | `true` \| `false`                                   | Focus the document on mount.         |

`Ezynota.initAll(root?)` mounts manually (idempotent, shared with the
automatic scan) and `Ezynota.getInstance(elementOrSelector)` looks up a
mounted instance. Each mount element emits bubbling `ezn:ready`,
`ezn:change` and `ezn:error` DOM events with `{ instance, payload }` in
`event.detail`. Detached declarative editors are cleaned up after
confirming they remain disconnected; explicit `destroy()` unregisters and
suppresses immediate automatic remounting.

### ESM / bundlers

```ts
import { Ezynota } from "ezynota";           // main entry (declarative scanning side effect)
import { Ezynota } from "ezynota/core";     // no automatic scanning
import "ezynota/dist/ezynota.css";

const editor = new Ezynota({
  target: "#editor",
  placeholder: "Start writing...",
  onReady(api) {},
  onChange(api, batch) {}
});
```

## Configuration

| Option          | Type                         | Default        | Description                                    |
| --------------- | ---------------------------- | -------------- | ---------------------------------------------- |
| `target`        | `HTMLElement \| string`      | —              | Element (or selector) to mount the editor in.  |
| `data`          | `EzynotaDocument`            | `null`         | Initial document.                              |
| `tools`         | `Record<string, ToolClass>`  | all built-ins  | Block tools, by name.                          |
| `inlineTools`   | `InlineToolClass[]`          | all built-ins  | Bold, italic, underline, code, mark, link.     |
| `tunes`         | `TuneClass[]`                | `[Alignment]`  | Per-block tunes.                               |
| `defaultBlock`  | `string`                     | `"paragraph"`  | Tool used for new blocks.                      |
| `readOnly`      | `boolean`                    | `false`        | Render without editing.                        |
| `autofocus`     | `boolean`                    | `false`        | Focus the first block on mount.                |
| `placeholder`   | `string`                     | `"Start writing..."` | Placeholder for the first empty block.   |
| `minHeight`     | `number`                     | —              | Minimum editor height in px.                   |
| `locale`        | `string`                     | `"en"`         | UI locale (RTL auto for `he`/`ar`/`fa`/`ur`).   |
| `i18n`          | `{ messages }`               | —              | Namespaced message overrides.                  |
| `idGenerator`   | `() => string`               | `randomUUID`   | Custom block id generator.                     |
| `ui`            | `boolean \| object`          | `true`         | Toggle toolbars and the block picker; see below. |
| `mode`          | `EzynotaMode`                | `"workspace"`  | `workspace` \| `document` \| `embedded` \| `headless`. |
| `workspace`     | `string`                     | path+target id | Explicit workspace id; matching IDs share notes. |
| `storage`       | `StorageAdapter \| factory`  | IndexedDB      | Configurable async storage adapter.            |
| `theme`         | `"light" \| "dark" \| "system"` | `"system"`  | UI theme (also settable via attribute).        |

### Modes

- **`workspace`** (default) — the browser-local writing workspace: a
  collapsible notes sidebar (folders, search, trash), document title,
  persistent formatting toolbar, heading outline, breadcrumbs, save status,
  word count, themes, responsive mobile drawers and a fullscreen toggle.
- **`document`** — the writing interface without note management; the
  active document stays memory-backed unless storage is configured.
- **`embedded`** — the current compact editor experience (block toolbars,
  floating inline toolbar).
- **`headless`** — document engine only. `ui: false` without an explicit
  mode is the shorthand; explicit UI options keep controlling individual
  tools.

`editor.ready` covers the initial workspace load; editing is prevented
until loading completes and `onReady` runs afterward. A failed load opens
an explicit recovery state (retry + download the stored data).

### Writing toolbar

The persistent toolbar is opt-in. Existing embeds keep their floating formatting toolbar.
For a familiar writing interface, enable the document toolbar and disable duplicate floating controls:

```ts
const editor = new Ezynota({
  target: "#editor",
  placeholder: "Start writing. Use + to add content or / for shortcuts.",
  ui: { documentToolbar: true, inlineToolbar: false, blockToolbar: true, slashMenu: true }
});
```

The document toolbar includes undo/redo, block type, bold, italic, underline, link, and a
More formatting menu. Heading and list options appear for the selected block. Bold, italic,
and underline can be enabled before typing. Highlight, inline code, and new links require a
text selection; an existing link can be edited with the caret inside it.

Block controls stay beside the active block in a single horizontal group. **Add block**
opens the picker; the grip opens **Block actions** when clicked and reorders the block when
dragged. On narrow screens, only Block actions is shown; **Add content below** is available
inside its menu. Moving the pointer over another paragraph does not move the active controls.

`editor.openBlockPicker(blockId?, insert = false)` opens the searchable picker. With
`true` as the second argument, it inserts after the target block or reuses an empty
paragraph. Without a target, it uses the selection or last block. If the picker is disabled,
the method adds the default block. `ui: false` disables all built-in toolbars and the picker.

Custom inline tools may call the optional `InlineToolOptions.onActivate()` callback to use
the editor's preserved selection and their `apply()` method. Custom tunes may call
`BlockTuneOptions.onChange(value)` to persist the tune through undoable transactions.
Existing tool methods and JSON schema are unchanged. `history:changed` emits
`{ canUndo, canRedo }` after undo/redo; document edits continue to emit `change`.

## Workspace API

Existing document methods and events keep operating on the active note:
`save()` returns `Promise<EzynotaDocument>`, `render()` replaces the active
document and resets its history. Each note keeps an independent in-memory
undo/redo timeline and selection — content undo never modifies another note.

```ts
const ws = editor.workspace;              // workspace/document modes

await ws.createNote("Title");             // note CRUD (create/rename/duplicate/move)
ws.renameNote(id, "New title");           // renames preserve note links (links use note IDs)
ws.trashNote(id); ws.restoreNote(id);     // deletion goes through trash/restore
ws.createFolder("Projects");              // folder CRUD; folder cycles are prevented
await ws.openNote(id);                    // navigation
ws.search("groceries");                   // search across titles and text
ws.backlinks(noteId);                     // notes linking to a note
await ws.save();                          // flush the active note + workspace
await ws.createBackup();                  // notes + folders + trash + assets
await ws.restoreBackup(backup);           // restores under a NEW workspace id by default
ws.toggleFullscreen();                    // expands over the browser viewport (no Fullscreen API)
ws.setTheme("dark");
```

Workspace and storage lifecycle events: `editor.on("workspace:changed", …)`
and `editor.on("fullscreen:changed", …)`, plus `ezn:*` DOM events.

### Example page workspace storage

The workspace stores all notes, folders, trash records and uploaded image
assets in **IndexedDB**, scoped to a workspace ID that defaults to the page
pathname plus the target ID (`"default"` for unnamed targets). An explicit
`workspace` id (or `data-ezn-workspace`) intentionally makes matching
targets share notes. Autosave runs after 500 ms of inactivity; writes are
serialized, revision-checked against the stored record, and cross-tab
changes are broadcast between tabs to prevent silent overwrites.

Malformed or newer-version payloads are preserved for recovery — a failed
save retains the unsaved state with retry/download recovery, and imports or
backups that fail validation are never committed. When explicit initial
document data is supplied in workspace mode, it opens as a new note instead
of replacing stored notes. A draft saved by an older version
(`ezynota:draft:v1` in localStorage) is offered as a one-time import.
Clearing the trash asks for confirmation. Undo history does not survive a
reload; notes do.

## Public API

```ts
await editor.save();               // Promise<EzynotaDocument> (active note)
editor.getSnapshot();              // Readonly<EzynotaDocument>
await editor.render(doc);          // replace the active document
editor.clear();
editor.focus({ at: "end" });
editor.setReadOnly(true);
editor.insertBlock("heading", { level: 2, content: [] }, { focus: true });
editor.updateBlock(id, data);
editor.removeBlock(id);
editor.moveBlock(id, 0);           // number | {before} | {after} | {at: "start"|"end"}
editor.duplicateBlock(id);         // descendant IDs are regenerated
editor.convertBlock(id, "quote");
editor.getBlockById(id);           // BlockRef | undefined
editor.getBlocks();                // readonly BlockRef[]
editor.undo(); editor.redo();
editor.canUndo(); editor.canRedo();
editor.setDocumentTitle("Title");  // undoable metadata transaction
editor.findReplace("a", "b", true);// find/replace in the active document
editor.on("change", (batch) => {}); // ready, change, block:*, selection:changed,
                                    // focus, blur, error, destroyed,
                                    // workspace:changed, fullscreen:changed
editor.dispatch("EZ_INSERT_BLOCK", { type: "paragraph" });
editor.destroy();
```

Every change is a `ChangeBatch` with an `origin` (`user | api | paste | history | remote | migration`)
and typed `changes` (`block:insert`, `block:update`, `block:remove`, `block:move`, `block:convert`,
`tune:update`, `document:replace`) — the same stream an autosave layer, collaboration adapter or
analytics consumes.

## Document format

```json
{
  "schemaVersion": "1.0.0",
  "blocks": [
    {
      "id": "blk_123",
      "type": "paragraph",
      "data": {
        "content": [
          { "type": "text", "text": "This is " },
          { "type": "text", "text": "Ezynota", "marks": [{ "type": "bold" }] }
        ]
      },
      "tunes": { "alignment": "center" }
    }
  ],
  "generator": { "name": "ezynota", "version": "0.3.0" }
}
```

`schemaVersion` is independent of the package version. Documents written by older schemas can be
migrated with `MigrationManager` (deterministic, offline, DOM-free). Unknown schema versions are
preserved rather than destroyed. Note titles are stored in document metadata (`meta.title`).

The workspace keeps a separately versioned envelope (`workspaceSchemaVersion: "1.0.0"`)
holding notes, folders, trash records and revision counters; workspace backups add all
assets. Built-in block types include paragraph, heading (H1–H6), lists (bulleted, ordered,
tasks with checked state), quote, code, delimiter, tables with rich-text cells, images
(uploads become `asset:<id>` references, resolved to data URLs on portable export), callouts,
and collapsible toggle sections containing editable child blocks.

## Keyboard

| Key                    | Behavior                             |
| ---------------------- | ------------------------------------ |
| `Enter`                | Split block / create new block       |
| `Shift+Enter`          | Soft line break                      |
| `Backspace` at start   | Merge with previous compatible block |
| `Delete` at end        | Merge with next block                |
| `Ctrl/Cmd + B/I/U/K`   | Bold / italic / underline / link     |
| `Ctrl/Cmd + Z`         | Undo                                 |
| `Ctrl/Cmd + Shift + Z` | Redo                                 |
| `Ctrl/Cmd + Shift + L` | Convert to list                      |
| `Alt + ↑ / ↓`          | Move block (keyboard drag alternative) |
| `/`                    | Open the slash menu                  |
| `[[`                   | Open the note-link suggestions       |
| `Tab`                  | Table cells: next cell (creates rows/columns at the edges) |
| `Escape`               | Close menus (twice exits fullscreen) |

## Security

- Pasted HTML is parsed, dangerous nodes (`script`, `style`, `iframe`, `object`, …) and all
  attributes are stripped, and content is extracted as portable JSON — parsed HTML never enters
  document state. Imported files and printing go through the same sanitizer.
- URLs are validated against an allowlist (`http`, `https`, `mailto`, `tel`, relative);
  `javascript:`, `data:` and `vbscript:` are rejected for links and images.
- The DOM is built exclusively with `createElement` / `textContent` / `setAttribute`
  (Trusted Types friendly); no `innerHTML` with untrusted data, no `eval`, no `new Function`.
- Block data is JSON-validated and `__proto__`/`constructor`/`prototype` keys are stripped
  (prototype-pollution protection).

## Interchange

- **JSON** — lossless round trips for documents and workspace backups.
- **Markdown** — export covers headings, nested lists (including tasks),
  quotes, code fences, dividers, tables, images and internal note links;
  import parses the same shapes. Other content types report unsupported
  conversions.
- **HTML** — export includes tables and collapsible `<details>` sections;
  imported HTML is sanitized before parsing.
- **Plain text / printing** — text projection and a sanitized print view
  for browser PDF output.

## Development

```bash
pnpm install
pnpm test        # Vitest unit suite
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint
pnpm build       # ESM + UMD (.cjs) + TypeScript declarations + CSS into dist/
```

Self-contained examples (build first with `pnpm build`), served via any static
server (e.g. WAMP: `http://localhost/ezynota/examples/`):

- [Declarative initialization](examples/declarative.html) uses HTML attributes and automatic mounting.
- [Programmatic initialization](examples/programmatic.html) creates the editor in JavaScript.
- [Events](examples/events.html) listens to `ezn:ready`, `ezn:change` and `ezn:error`.
- [Workspace mode](examples/advanced.html) is a declarative workspace with notes, folders, autosave and fullscreen.

Each example is a single self-contained HTML file loading the local `dist/`
bundle. The minimal examples use `embedded` mode and in-memory content; they do
not configure persistence.

## Status

**v0.3.0** — the workspace release: browser-local multi-note workspaces
(folders, linked notes, trash, search), IndexedDB storage with a
configurable async adapter, declarative `data-ezn-editor` initialization
with `ezn:*` DOM events and an `ezynota/core` entry, four lifecycle modes,
tables, images, callouts, collapsible sections, task lists, strikethrough
and color marks, Markdown typing shortcuts and interchange, document
find/replace, workspace search, and fullscreen. Accounts, server
synchronization, collaboration, database-style tables, formulas, graph
views, plugin marketplaces, and direct DOCX/PDF conversion are outside the
current plan. Real-browser checks (mobile, IME, screen readers) remain
outstanding — treat it as release-candidate rather than production-hardened.

## License

MIT
