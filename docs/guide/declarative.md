# Declarative usage

Ezynota can mount itself without a single line of JavaScript. A `MutationObserver` watches for `[data-ezn-editor]` elements — including elements inserted into the DOM later — and initializes an editor for each.

## Basic setup

```html
<link rel="stylesheet" href="path/to/ezynota.css" />

<div
  data-ezn-editor
  data-ezn-placeholder="Start writing…"
></div>

<script src="path/to/ezynota.umd.cjs"></script>
```

::: warning
When using the main `ezynota` entry (or the UMD build), scanning happens automatically. If you import from `ezynota/core`, no scanning occurs — call `Ezynota.initAll()` yourself.
:::

## Attributes

Attribute values are **parsed, never evaluated** — no `eval`, no `new Function`.

| Attribute | Values | Description |
| --- | --- | --- |
| `data-ezn-editor` | (presence) | Marks the mount element. |
| `data-ezn-mode` | `workspace` \| `document` \| `embedded` | Editor mode. |
| `data-ezn-workspace` | string | Workspace id (overrides the default pathname-based id). |
| `data-ezn-theme` | `light` \| `dark` \| `system` | Initial theme. |
| `data-ezn-readonly` | `true` \| `false` | Start read-only. |
| `data-ezn-placeholder` | string | Placeholder text for the empty editor. |
| `data-ezn-autofocus` | `true` \| `false` | Focus after mount. |

State flags managed by Ezynota (don't set these yourself): `data-ezn-mounted`, `data-ezn-destroyed`.

## DOM events

Each mount element bubbles these events, with data in `event.detail`:

```html
<div id="editor" data-ezn-editor></div>

<script>
  const target = document.getElementById("editor");

  target.addEventListener("ezn:ready", (e) => {
    console.log("ready", e.detail.instance);
  });

  target.addEventListener("ezn:change", (e) => {
    console.log("change", e.detail.payload); // ChangeBatch
  });

  target.addEventListener("ezn:error", (e) => {
    console.error(e.detail.payload); // EzynotaError
  });
</script>
```

| Event | `detail.payload` |
| --- | --- |
| `ezn:ready` | — (the instance is in `detail.instance`) |
| `ezn:change` | `ChangeBatch` |
| `ezn:error` | `EzynotaError` |

::: tip
If an element fails to construct (e.g. an unknown `defaultBlock`), the scan and the auto-scan observer report it on that element — `console.error` plus a bubbling `ezn:error` event with `{ message }` in `detail.payload` — and keep mounting the other elements. One broken mount never aborts the batch.
:::

## Explicit initialization

If you need a handle on instances (or you're using the `core` entry), initialize manually:

```ts
// Mount every [data-ezn-editor] inside #root (default: document)
const editors = Ezynota.initAll(document.getElementById("root"));

// Retrieve the instance later
const editor = Ezynota.getInstance("#editor");
// or from the element:
const same = Ezynota.getInstance(element);
```

`initAll()` is **idempotent** — elements already mounted are skipped, so it's safe to call repeatedly (e.g. after SPA navigation).

## Lifecycle & cleanup

- Detached declarative editors are cleaned up automatically after a double-tick confirmation (so brief reparenting in frameworks doesn't destroy them).
- Calling `editor.destroy()` removes mount classes/attributes and empties the target.
- A shared instance registry keeps track of every live editor (`register`/`unregister`/`list` internally; use `Ezynota.getInstance()` publicly).

## When to prefer programmatic init

Declarative mounting is great for static pages and demos. Use `new Ezynota(config)` when you need:

- Initial `data` (a full document) — declarative mounts start empty
- Custom tools, inline tools, tunes, storage, or i18n
- Direct access to the instance before `ready`
