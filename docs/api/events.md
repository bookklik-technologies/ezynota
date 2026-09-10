# Events

Ezynota uses a typed event bus. Subscribe with `editor.on(event, handler)`, which returns an unsubscribe function:

```ts
const off = editor.on("change", (batch) => {
  console.log(batch.origin, batch.changes.length);
});

off(); // stop listening
```

There's also `editor.off(event, handler)` if you prefer handler references.

## Event reference

| Event | Payload | Description |
| --- | --- | --- |
| `ready` | — | Editor (and workspace) finished loading. |
| `change` | `ChangeBatch` | **The main event.** Every committed transaction. |
| `block:inserted` | block info | A block was added. |
| `block:updated` | block info | Block data changed. |
| `block:removed` | block info | A block was deleted. |
| `block:moved` | `{ from, to }` | A block changed position. |
| `selection:changed` | selection info | Caret/selection moved between editables. |
| `focus` / `blur` | — | Editor surface gained/lost focus. |
| `readOnly:changed` | `boolean` | Read-only toggled. |
| `history:changed` | `{ canUndo, canRedo }` | Undo stack state changed. |
| `fullscreen:changed` | `boolean` | Workspace fullscreen toggled. |
| `workspace:changed` | `{ kind, detail }` | See workspace events below. |
| `error` | `EzynotaError` | A recoverable error occurred. |
| `destroyed` | — | Editor was destroyed. |

## ChangeBatch

Every `change` event receives a batch describing exactly what happened:

```ts
interface ChangeBatch {
  id: string;
  origin: "user" | "api" | "paste" | "history" | "remote" | "migration";
  timestamp: number;
  changes: EzynotaChange[];
}
```

### Change types

| Change `type` | Meaning |
| --- | --- |
| `block:insert` | Block added |
| `block:update` | Block data changed |
| `block:remove` | Block deleted |
| `block:move` | Block repositioned |
| `block:convert` | Block type converted |
| `tune:update` | A tune value changed (e.g. alignment) |
| `title:update` | Document title changed |
| `children:update` | Nested children changed (toggle sections) |
| `document:replace` | Whole document replaced (`render()`) |

### Origin examples

```ts
editor.on("change", (batch) => {
  switch (batch.origin) {
    case "user":     /* typed, clicked */ break;
    case "api":      /* your code called insertBlock etc. */ break;
    case "paste":    /* clipboard content applied */ break;
    case "history":  /* undo/redo replay */ break;
    case "remote":   /* cross-tab update */ break;
    case "migration": /* schema migration applied */ break;
  }
});
```

## Workspace events

`workspace:changed` carries a `kind` discriminator:

| `kind` | Meaning |
| --- | --- |
| `notes` | Notes created/renamed/moved/duplicated |
| `folders` | Folder tree changed |
| `trash` | Trash contents changed |
| `activeNote` | A different note opened |
| `activeFolder` | Active folder changed |
| `saveStatus` | Autosave status changed (pending/saved/error) |
| `remoteChange` | Another tab modified the workspace |
| `loaded` | Workspace finished loading |
| `loadFailed` | Workspace load failed (recovery UI shown) |
| `noteRenamed` | A note's title changed |

## Declarative DOM events

Mount elements bubble `ezn:ready`, `ezn:change`, and `ezn:error` with `{ instance, payload }` in `event.detail`. See [Declarative usage](/guide/declarative#dom-events).
