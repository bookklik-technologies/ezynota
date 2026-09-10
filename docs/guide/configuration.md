# Configuration

The editor is configured entirely through the `EzynotaConfig` object passed to the constructor:

```ts
const editor = new Ezynota(config);
```

## Full option reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `holder` | `string \| Element` | — | Element (or selector) the editor mounts into. **Required.** |
| `data` | `EzynotaDocument` | — | Initial document. In workspace mode this opens as a new note instead. |
| `tools` | `Record<string, BlockToolConstructor \| ToolDefinition>` | built-ins | Custom/extra block tools, keyed by block type. Built-ins remain registered. |
| `inlineTools` | `(InlineToolConstructor \| InlineToolDefinition)[]` | built-ins | Inline formatting tools for the floating toolbar. |
| `tunes` | `(BlockTuneConstructor \| TuneDefinition)[]` | `[AlignmentTune]` | Per-block tunes (e.g. alignment). |
| `defaultBlock` | `string` | `"paragraph"` | Block type inserted by Enter, the slash menu fallback, and empty docs. |
| `readOnly` | `boolean` | `false` | Start in read-only mode (toggle later with `setReadOnly`). |
| `autofocus` | `boolean` | `false` | Focus the editor after mount. |
| `placeholder` | `string` | — | Placeholder for the first/empty block. |
| `minHeight` | `number \| string` | — | Minimum height of the editing surface. |
| `locale` | `string` | — | BCP-47 locale. RTL is applied automatically for `he`, `ar`, `fa`, `ur`. |
| `i18n` | `{ messages }` | — | Overrides for UI strings (namespaced). See [i18n](./i18n). |
| `idGenerator` | `() => string` | crypto UUID / `ez_*` | Custom block id generator. |
| `ui` | `boolean` | `true` | Set `false` for a headless editor. |
| `mode` | `EzynotaMode` | auto | `"workspace" \| "document" \| "embedded" \| "headless"`. See [Modes](./modes). |
| `workspace` | object | — | Workspace options (note title, initial folder, etc.). |
| `storage` | `StorageAdapter \| factory` | `IndexedDbStorage` | Persistence backend for workspace mode. |
| `theme` | `"light" \| "dark" \| "system"` | — | Editor theme; `system` follows `prefers-color-scheme`. |
| `onReady` | `(editor) => void` | — | Called once the editor (and workspace, if any) is ready. |
| `onChange` | `(batch: ChangeBatch) => void` | — | Called on every committed change batch. |

## Minimal examples

### Embedded editor

```ts
const editor = new Ezynota({
  holder: "#comment-box",
  mode: "embedded",
  placeholder: "Write a comment…",
  minHeight: 120,
});
```

### Workspace app

```ts
const editor = new Ezynota({
  holder: "#app",
  mode: "workspace",
  theme: "system",
  storage: myCustomAdapter, // optional
  onReady: (ed) => {
    console.log("Workspace ready:", ed.workspace);
  },
});
```

### Read-only renderer

```ts
const viewer = new Ezynota({
  holder: "#article",
  readOnly: true,
  data: fetchedDocument,
});
```

## Editing lock

Until the initial workspace load completes (`editor.ready` resolves), all mutations throw `EZ_EDITING_LOCKED`. Wrap early API calls:

```ts
await editor.ready;
editor.insertBlock("paragraph", { content: [] });
```

## Custom block ids

Block ids must be unique strings. Provide `idGenerator` if you need a specific format (e.g. ULIDs that sort by time):

```ts
const editor = new Ezynota({
  holder: "#app",
  idGenerator: () => ulid(),
});
```

## See also

- [Modes](./modes)
- [Storage adapters](/api/storage)
- [Events](/api/events)
