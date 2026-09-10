# Storage adapters

Workspace persistence goes through a small async interface. Ezynota ships with two implementations, and you can bring your own to sync with a server.

## Built-in adapters

```ts
import { IndexedDbStorage, MemoryStorage, emptyWorkspace } from "@bookklik/ezynota";

// Default — persists in the browser via IndexedDB
const editor = new Ezynota({ holder: "#app", mode: "workspace" });

// Explicit
const editor2 = new Ezynota({
  holder: "#app",
  mode: "workspace",
  storage: new IndexedDbStorage(),
});

// In-memory (tests, demos)
const demo = new Ezynota({
  holder: "#demo",
  mode: "workspace",
  storage: new MemoryStorage(emptyWorkspace("demo")),
});
```

`emptyWorkspace(id?)` creates a valid, empty `WorkspaceEnvelope`.

## StorageAdapter interface

```ts
interface StorageAdapter {
  init(): Promise<void>;
  loadWorkspace(id: string): Promise<WorkspaceEnvelope | null>;
  commit(id: string, envelope: WorkspaceEnvelope): Promise<CommitResult>;
  loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null>;
  saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<void>;
  subscribe?(id: string, cb: () => void): () => void; // cross-tab updates
  close(): Promise<void>;
}
```

### `CommitResult`

Commit may reject stale writes. If another tab saved first, the adapter reports the newer revision and the editor enters a recovery flow instead of clobbering data.

## WorkspaceEnvelope

The persisted unit — one JSON document per workspace:

```ts
interface WorkspaceEnvelope {
  workspaceSchemaVersion: "1.0.0";
  id: string;
  savedAt: number;
  storageRevision: number;
  notes: NoteRecord[];
  folders: FolderRecord[];
}
```

- `NoteRecord` — id, title, folderId, document, timestamps, trashed flag.
- `FolderRecord` — id, title, parentId, timestamps, trashed flag.

`WORKSPACE_SCHEMA_VERSION` is `"1.0.0"`, versioned independently from the package.

### Default workspace id

Without a custom id, the workspace is keyed by page location: `defaultWorkspaceId(holderId)` → `"<pathname>#<holderId|default>"`. So different pages can host different workspaces, and the same page shares one.

## Assets

Images can be stored as `asset:<id>` references resolved through the adapter:

```ts
await state.saveAsset(asset);          // WorkspaceAsset { id, mime, bytes, ... }
const url = await state.assetObjectUrl(id); // object URL for rendering
```

Backups include assets (`WorkspaceBackup`), and `encodeBackupForExport` produces base64-safe JSON for downloads. `resolveDocumentAssets(doc, loadAsset)` inlines assets as data URLs for portable exports.

## Server-backed storage

Implement the interface against your backend:

```ts
class ApiStorage {
  async init() {}
  async loadWorkspace(id) {
    const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`);
    return res.ok ? res.json() : null;
  }
  async commit(id, envelope) {
    const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });
    return { ok: res.ok, storageRevision: envelope.storageRevision };
  }
  // loadAsset / saveAsset / subscribe / close …
}
```

::: warning
Respect `storageRevision` on commit: if the server holds a newer revision, return a conflict result rather than overwriting. The editor's recovery UI depends on this to prevent silent data loss.
:::
