# Workspace

Workspace mode turns the editor into a small note-taking app: notes, folders, trash, full-text search, autosave, backups, and note-to-note links — all persisted in the browser with **zero server**.

## Concepts

- The **workspace** is stored as a `WorkspaceEnvelope` — a versioned JSON document containing notes, folders, and (in backups) assets.
- Each **note** holds an Ezynota document plus a title, folder assignment, and timestamps.
- Persistence goes through a [`StorageAdapter`](/api/storage). The default is `IndexedDbStorage`; there's also `MemoryStorage` for tests.
- Autosave is debounced at **500 ms** after changes; a save status indicator shows pending/saved/error states.
- Cross-tab changes are broadcast; a revision check prevents overwriting newer data (conflicts surface as recoverable states, never silent data loss).

## Accessing the workspace

```ts
const editor = new Ezynota({ target: "#app", mode: "workspace" });
await editor.ready;

const ws = editor.workspace; // WorkspaceController | null (workspace/document modes only)
```

## Notes & folders

```ts
// Notes
const id = ws.state.createNote("Groceries");
ws.state.createNote("Ideas", folderId);
ws.state.renameNote(id, "Shopping list");
ws.state.duplicateNote(id);
ws.state.trashNote(id);
ws.state.restoreNote(id);
ws.state.deleteNoteForever(id);

// Folders
const fId = ws.state.createFolder("Projects");
ws.state.renameFolder(fId, "Work");
ws.state.moveFolder(fId, parentId); // cycles prevented
ws.state.trashFolder(fId);
ws.state.emptyTrash();

// Queries
ws.listNotes();            // NoteRecord[]
ws.listFolders();
ws.state.getNote(id);      // NoteRecord | undefined
ws.state.folderPath(fId);  // ["Work", "Projects"]
```

Open a note (swaps the document and its per-note undo history):

```ts
await ws.openNoteById(id);
ws.getActiveNoteId();
```

## Search, links & backlinks

```ts
ws.search("quarterly");     // SearchHit[] — full-text across notes
ws.backlinks(noteId);       // NoteRecord[] — notes linking here
ws.state.noteLinks(noteId); // outgoing note:<id> targets
ws.wordCount();
```

Typing `[[` in the editor opens a note-link picker; links are stored as `note:<id>` hrefs and navigate on click.

## Saving & backups

```ts
await ws.saveActiveNote();  // force a save now
await ws.createBackup();    // WorkspaceBackup (notes + folders + assets)
await ws.restoreBackup(backup);            // restores under a NEW workspace id
await ws.restoreBackupFile(file);          // restore from a downloaded backup file
ws.downloadStoredData();    // download the raw stored envelope
```

Backups can be exported as base64-encoded JSON and re-imported later — a complete, portable snapshot of the workspace.

## Import & export

```ts
await ws.importFiles(fileList);          // json / md / html / txt
await ws.exportActiveNote("md");         // "json" | "md" | "html" | "txt"
const html = await ws.activeNoteHtml();
const portable = await ws.portableSnapshot(); // document with assets as data URLs
```

## Fullscreen, theme & recovery

```ts
ws.toggleFullscreen();      // CSS-based, no Fullscreen API permission needed
ws.isFullscreen();
ws.setTheme("dark");        // "light" | "dark" | "system"
ws.getTheme();
ws.resolvedTheme();         // "light" | "dark"
```

If a load or save fails (e.g. corrupted storage), the UI shows recovery panels rather than throwing — `retryLoad()` / `retrySave()` re-attempt, and legacy drafts can be imported with `ws.importLegacyDraft(data)`.

## Events

Workspace changes emit on the editor event bus:

```ts
editor.on("workspace:changed", ({ kind, detail }) => {
  // kind: "notes" | "folders" | "trash" | "activeNote" | "activeFolder"
  //       | "saveStatus" | "remoteChange" | "loaded" | "loadFailed" | "noteRenamed"
});
editor.on("fullscreen:changed", (isFullscreen) => { /* … */ });
```

See the [events reference](/api/events) and the full [Workspace API](/api/workspace).
