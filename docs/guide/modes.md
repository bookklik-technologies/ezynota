# Modes

Ezynota ships with four modes that change how much chrome the editor renders. The mode is resolved in this order:

1. Explicit `config.mode`, if provided
2. `config.ui === false` → `"headless"`
3. Otherwise → `"workspace"`

You can inspect the resolved mode at runtime:

```ts
editor.getMode(); // "workspace" | "document" | "embedded" | "headless"
```

## `workspace`

The full note-taking experience: sidebar with folders and search, document toolbar, heading outline, breadcrumbs, save status, word count, trash, themes, and fullscreen.

```ts
const editor = new Ezynota({
  holder: "#app",
  mode: "workspace",
});

await editor.ready;
editor.workspace.createNote("My first note");
```

Workspace mode owns persistence (IndexedDB by default, 500 ms autosave debounce) and exposes the [WorkspaceController](/api/workspace) at `editor.workspace`.

- If `config.data` is provided, it opens as a **new note** rather than replacing the active document.
- `data-ezn-mode="workspace"` in declarative usage.

## `document`

A clean writing surface: the document toolbar and editor surface without the sidebar/workspace shell. Ideal for single-document editing UIs.

```ts
const editor = new Ezynota({
  holder: "#writing",
  mode: "document",
  placeholder: "Start writing…",
});
```

## `embedded`

A compact editor for comments, chat inputs, and inline forms. Minimal chrome, floating inline toolbar only.

```ts
const editor = new Ezynota({
  holder: "#comment",
  mode: "embedded",
  minHeight: 96,
});
```

## `headless`

No UI at all — a document engine you drive programmatically. Useful for server-side-ish workflows, migrations, tests, or building a completely custom UI on top of the editor core.

```ts
const engine = new Ezynota({
  holder: "#hidden",
  mode: "headless",
});

await engine.ready;
await engine.render(doc);
const id = engine.insertBlock("heading", { level: 1, content: [] });
```

::: tip
`ui: false` is a shorthand for `mode: "headless"`.
:::

## Comparison

| Capability | workspace | document | embedded | headless |
| --- | :---: | :---: | :---: | :---: |
| Notes / folders / trash | ✅ | — | — | — |
| Sidebar, search, outline | ✅ | — | — | — |
| Document toolbar | ✅ | ✅ | — | — |
| Floating inline toolbar | ✅ | ✅ | ✅ | — |
| Slash menu, drag & drop | ✅ | ✅ | ✅ | — |
| Persistence (autosave) | ✅ | — | — | — |
| Programmatic API | ✅ | ✅ | ✅ | ✅ |

All modes share the same [core document API](/api/editor) and emit the same [events](/api/events).
