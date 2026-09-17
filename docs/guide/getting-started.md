# Getting started

Ezynota is a free, block-style editor with portable JSON output. It ships as a single ESM bundle, a UMD build, TypeScript types, and one CSS file — with **zero runtime dependencies**.

## Requirements

- A browser environment (the constructor throws `EZ_RENDER_FAILED` outside a DOM — it is not SSR-renderable, though you can render the empty target server-side and initialize on the client).
- No framework required. Works with plain HTML, React, Vue, Svelte, or anything else.

## Installation

### npm / pnpm / yarn

```bash
npm install @bookklik/ezynota
```

Then import the editor and its stylesheet:

```ts
import { Ezynota } from "@bookklik/ezynota";
import "@bookklik/ezynota/dist/ezynota.css";

const editor = new Ezynota({
  target: "#app",
  data: {
    schemaVersion: "1.0.0",
    blocks: [
      { id: "b1", type: "paragraph", data: { content: [{ type: "text", text: "Hello, Ezynota!" }] } },
    ],
  },
});

await editor.ready;
```

::: tip
Use the `ezynota/core` entry if you don't want the automatic declarative scanning side effect:

```ts
import { Ezynota } from "@bookklik/ezynota/core";
```

The core entry is identical except it does **not** auto-mount `[data-ezn-editor]` elements and does not import the CSS. You call `Ezynota.initAll()` yourself if you want declarative behavior.
:::

### Script tag (UMD)

```html
<link rel="stylesheet" href="https://unpkg.com/@bookklik/ezynota/dist/ezynota.css" />

<div id="editor"></div>

<script src="https://unpkg.com/@bookklik/ezynota/dist/ezynota.umd.cjs"></script>
<script>
  const editor = new Ezynota({ target: "#editor" });
</script>
```

The UMD build exposes the global `Ezynota`.

## Declarative usage (zero JavaScript)

Drop a single element and Ezynota mounts itself — even for elements added to the DOM later:

```html
<link rel="stylesheet" href="path/to/ezynota.css" />

<div
  data-ezn-editor
  data-ezn-mode="workspace"
  data-ezn-theme="light"
  data-ezn-placeholder="Every idea starts somewhere. Start writing…"
></div>

<script src="path/to/ezynota.umd.cjs"></script>
```

That's it. See [Declarative usage](./declarative) for all attributes and DOM events.

## Reading and writing content

```ts
// Snapshot of the current document (readonly, frozen)
const doc = editor.getSnapshot();

// Collect tool data, validate, and save
const saved = await editor.save();

// Replace the whole document (resets history)
await editor.render(newDoc);
```

## Listening to changes

```ts
const off = editor.on("change", (batch) => {
  console.log(batch.origin, batch.changes);
});

// Later: off()
```

Declarative editors emit `ezn:ready`, `ezn:change`, and `ezn:error` DOM events from the mount element.

## Package exports

| Export path | Contents |
| --- | --- |
| `ezynota` | Full public API + CSS + declarative auto-scan |
| `ezynota/core` | Same API, no CSS, no auto-scan |
| `ezynota/dist/ezynota.css` | The stylesheet |

## Next steps

- [Configuration](./configuration) — every option explained
- [Modes](./modes) — workspace, document, embedded, headless
- [Workspace](./workspace) — notes, folders, autosave, and backups
- [Custom tools](./custom-tools) — build your own blocks
