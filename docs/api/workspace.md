# Workspace API

In workspace and document modes, `editor.workspace` exposes a `WorkspaceController` — the session layer that swaps documents, keeps per-note undo histories, and drives autosave.

```ts
await editor.ready;
const ws = editor.workspace;
```

## Sessions

| Member | Description |
| --- | --- |
| `state` | The underlying `WorkspaceState` (see below). |
| `start()` | Load the workspace and open the first note (or the initial data as a new note). |
| `openNoteById(id)` | Open a note — swaps the document **and** its per-note undo history. |
| `getActiveNoteId()` | Current note id, or `null`. |
| `saveActiveNote()` | Force-save the active note now. |
| `retryLoad()` / `retrySave()` | Re-attempt after load/save failures. |
| `destroy()` | Flush pending saves and tear down. |

Per-note history: undo stacks are kept per note in `histories: Map<string, HistoryState>` — switching notes preserves each note's undo position.

## Content access

| Member | Description |
| --- | --- |
| `portableSnapshot()` | Active note's document with `asset:<id>` sources resolved to data URLs. |
| `activeNoteHtml()` | Active note rendered to sanitized HTML. |
| `exportActiveNote(format)` | Export as `"json" \| "md" \| "html" \| "txt"` (triggers download). |
| `importFiles(files)` | Import json / md / html / txt / workspace backups. |
| `importLegacyDraft(data)` | Recover data from older draft formats. |
| `wordCount()` | Word count of the active note. |
| `findInDocument(query, replaceWith?, all?)` | Find & replace within the active note. |

## Search & links

| Member | Description |
| --- | --- |
| `search(query)` | Full-text search — `SearchHit[]` across notes. |
| `backlinks(noteId)` | Notes whose content links to this one. |
| `listNotes(includeTrashed?)` | `NoteRecord[]`. |
| `listFolders(includeTrashed?)` | `FolderRecord[]`. |

## Fullscreen & theme

| Member | Description |
| --- | --- |
| `toggleFullscreen(force?)` | `Promise<void>` — enter or exit browser fullscreen. Call from a user action such as a click. Failures show a notice. |
| `isFullscreen()` | Current state. |
| `setTheme(t)` / `getTheme()` | `"light" \| "dark" \| "system"`. |
| `resolvedTheme()` | Effective `"light" \| "dark"`. |

The fullscreen button uses the browser's Fullscreen API. Escape exits fullscreen, and `fullscreen:changed` reports the actual browser state. Embedded editors need fullscreen allowed by their containing iframe.

## Backups

| Member | Description |
| --- | --- |
| `createBackup()` | `Promise<WorkspaceBackup>` — notes + folders + assets. |
| `restoreBackup(backup)` | Restore under a **new** workspace id by default; returns `{ workspaceId }`. |
| `restoreBackupFile(file)` | Restore from a downloaded backup file. |
| `downloadStoredData()` | Download the raw stored envelope. |

## WorkspaceState

`ws.state` is the state machine under the controller:

- **Read:** `getEnvelope()`, `getRevision()`, `listNotes()`, `listFolders()`, `listTrashedNotes()`, `getNote(id)`, `getFolder(id)`, `folderPath(id)`, `noteLinks(id)`, `backlinks(id)`
- **Notes:** `createNote(title, folderId?, document?)`, `renameNote`, `moveNote`, `duplicateNote`, `updateNoteDocument`, `trashNote`, `restoreNote`, `deleteNoteForever`
- **Folders:** `createFolder`, `renameFolder`, `moveFolder` (cycle-proof), `trashFolder`, `restoreFolder`, `deleteFolderForever`, `emptyTrash`
- **Persistence:** `markDirty()` (500 ms debounce), `flushSave()`, `flush()`, `getUnsavedSnapshot()`, `createBackup()`
- **Assets:** `saveAsset(asset)`, `loadAsset(id)`, `assetObjectUrl(id)`
- **Lifecycle:** `load()`, `isLoaded()`, `getLoadError()`, `retryLoad()`, `destroy()`

## Autosave & conflict safety

- Changes call `markDirty()`; a debounced save (500 ms) follows.
- Commits carry a `storageRevision`; if another tab saved first, the editor surfaces a recovery state instead of overwriting (`workspace:changed` with kind `"remoteChange"` / `"loadFailed"`).
- `SaveStatus` drives the visible save indicator: pending / saved / error.
