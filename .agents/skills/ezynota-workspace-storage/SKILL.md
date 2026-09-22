---
name: ezynota-workspace-storage
description: "Implement Ezynota workspace workflows, notes, folders, assets, backups and custom storage adapters with revision safety. Use for workspace persistence, not single-document interchange."
---

# Ezynota Workspace Storage

## Inputs and approach

Identify the workspace id, persistence backend, note/folder operations, asset needs, conflict policy and backup behavior. Use the controller for session workflows and implement `StorageAdapter` only when the built-in IndexedDB storage is insufficient.

Read [workspace](../../../docs/guide/workspace.md), [workspace API](../../../docs/api/workspace.md), [storage adapters](../../../docs/api/storage.md), [workspace controller](../../../src/workspace/controller.ts), [storage implementation](../../../src/workspace/storage.ts) and [workspace types](../../../src/workspace/types.ts).

## Workflow and contracts

- Use `mode: 'workspace'` for the full persisted experience and await `editor.ready` before accessing or mutating loaded state.
- `editor.workspace` can be null outside workspace/document modes. Use `WorkspaceController` for opening notes, exports, search and backups; use `WorkspaceState` for direct note/folder operations.
- Preserve `storageRevision`. A custom adapter's `commit(workspaceId, envelope, expectedRevision)` must reject stale commits rather than overwrite newer state so recovery and cross-tab conflict handling can work.
- Implement every storage method, including asset load/save and `close`. If `subscribe` is supported, return an unsubscribe function.
- Keep workspace envelopes and note documents versioned and JSON-compatible. Assets are stored separately and referenced as `asset:<id>`.
- `restoreBackup` creates a new workspace id by default; do not silently replace the current workspace. Backups include notes, folders and assets.
- Flush pending work and release subscriptions/object URLs on destruction. Do not add server sync or collaboration semantics unless the host explicitly implements them.

## Example

```ts
import { Ezynota, MemoryStorage } from 'ezynota';

const storage = new MemoryStorage(false);
const editor = new Ezynota({
  target: '#app', mode: 'workspace', workspace: 'demo', storage,
});

await editor.ready;
const ws = editor.workspace;
if (!ws) throw new Error('Workspace mode is required');

const folderId = ws.state.createFolder('Projects');
const noteId = ws.state.createNote('Launch plan', folderId);
await ws.openNoteById(noteId);
const backup = await ws.createBackup();
```

## Deliverables and verification

Deliver controller usage or a complete adapter plus ownership and conflict notes. Review empty/first load, stale revisions, quota/network errors, cross-tab signals, autosave retry, note switching/history, folder cycles, assets, backup restore to a new id and teardown. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
