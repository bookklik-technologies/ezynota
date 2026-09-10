import { EzynotaError } from "../core/errors";
import type {
  CommitResult,
  StorageAdapter,
  WorkspaceAsset,
  WorkspaceEnvelope
} from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

const DB_NAME = "ezynota";
const DB_VERSION = 1;
const STORE_WORKSPACES = "workspaces";
const STORE_ASSETS = "assets";

/** Serialized workspace envelope plus a monotonic store revision. */
interface StoredWorkspace {
  id: string;
  envelope: WorkspaceEnvelope;
  revision: number;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function isIdbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * IndexedDB storage adapter: one object store for workspace envelopes
 * (revision-checked commits) and one for binary assets.
 */
export class IndexedDbStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners = new Map<string, Set<() => void>>();
  private channel: BroadcastChannel | null = null;
  private idb = isIdbAvailable();

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.idb) {
        try {
          this.db = await openDatabase();
        } catch {
          // A broken IndexedDB must not crash the editor: fall back to
          // memory-backed storage and surface the error through saves.
          this.db = null;
          this.idb = false;
        }
      }
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel("ezynota:workspace");
        this.channel.onmessage = (event: MessageEvent) => {
          const workspaceId = (event.data as { workspaceId?: string } | undefined)?.workspaceId;
          if (workspaceId) this.notifyLocal(workspaceId);
        };
      }
    })();
    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new EzynotaError("EZ_UNKNOWN_ERROR", "IndexedDB is not open");
    }
    return this.db;
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null> {
    await this.init();
    if (!this.idb || !this.db) return null;
    const record = await this.getRecord(workspaceId);
    return record ? { ...cloneEnvelope(record.envelope), storageRevision: record.revision } : null;
  }

  private getRecord(workspaceId: string): Promise<StoredWorkspace | undefined> {
    const store = this.ensureDb().transaction(STORE_WORKSPACES, "readonly").objectStore(STORE_WORKSPACES);
    return requestToPromise(store.get(workspaceId)) as Promise<StoredWorkspace | undefined>;
  }

  async commit(workspaceId: string, envelope: WorkspaceEnvelope, expectedRevision: number): Promise<CommitResult> {
    await this.init();
    if (!this.idb || !this.db) return { ok: false, reason: "error" };
    try {
      const db = this.ensureDb();
      const tx = db.transaction(STORE_WORKSPACES, "readwrite");
      const store = tx.objectStore(STORE_WORKSPACES);
      const current = await requestToPromise(store.get(workspaceId) as IDBRequest<StoredWorkspace | undefined>);
      const storedRevision = current?.revision ?? 0;
      // Revision check: another tab wrote since we loaded.
      if (storedRevision !== expectedRevision) {
        return { ok: false, reason: "stale" };
      }
      const next: StoredWorkspace = {
        id: workspaceId,
        envelope: cloneEnvelope(envelope),
        revision: storedRevision + 1
      };
      const result = await new Promise<CommitResult>((resolve, reject) => {
        const put = store.put(next);
        put.onsuccess = () => resolve({ ok: true, revision: next.revision });
        put.onerror = () => {
          // QuotaExceededError and friends surface here.
          const name = (put.error as { name?: string } | undefined)?.name ?? "";
          if (name === "QuotaExceededError") resolve({ ok: false, reason: "quota" });
          else reject(put.error);
        };
        tx.onabort = () => {
          const name = (tx.error as { name?: string } | undefined)?.name ?? "";
          if (name === "QuotaExceededError") resolve({ ok: false, reason: "quota" });
        };
      });
      await txDone(tx);
      if (result.ok) this.broadcast(workspaceId);
      return result;
    } catch (error) {
      return { ok: false, reason: (error as { name?: string })?.name === "QuotaExceededError" ? "quota" : "error" };
    }
  }

  async loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null> {
    await this.init();
    if (!this.idb || !this.db) return null;
    const key = assetKey(workspaceId, assetId);
    const record = await requestToPromise(
      this.ensureDb().transaction(STORE_ASSETS, "readonly").objectStore(STORE_ASSETS).get(key)
    );
    return record ? (cloneAsset(record) as WorkspaceAsset) : null;
  }

  async saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean> {
    await this.init();
    if (!this.idb || !this.db) return false;
    try {
      const tx = this.ensureDb().transaction(STORE_ASSETS, "readwrite");
      const store = tx.objectStore(STORE_ASSETS);
      const record: WorkspaceAsset & { key: string } = { ...asset, key: assetKey(workspaceId, asset.id) };
      const result = await new Promise<boolean>((resolve) => {
        const put = store.put(record);
        put.onsuccess = () => resolve(true);
        put.onerror = () => resolve(false);
      });
      await txDone(tx);
      return result;
    } catch {
      return false;
    }
  }

  subscribe(workspaceId: string, listener: () => void): () => void {
    let set = this.listeners.get(workspaceId);
    if (!set) {
      set = new Set();
      this.listeners.set(workspaceId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(workspaceId);
    };
  }

  private notifyLocal(workspaceId: string): void {
    for (const listener of this.listeners.get(workspaceId) ?? []) listener();
  }

  private broadcast(workspaceId: string): void {
    try {
      this.channel?.postMessage({ workspaceId });
    } catch {
      /* channel may be closed */
    }
  }

  async close(): Promise<void> {
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initPromise = null;
  }
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_WORKSPACES)) db.createObjectStore(STORE_WORKSPACES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function assetKey(workspaceId: string, assetId: string): string {
  return `${workspaceId}::${assetId}`;
}

function cloneEnvelope(envelope: WorkspaceEnvelope): WorkspaceEnvelope {
  return JSON.parse(JSON.stringify(envelope)) as WorkspaceEnvelope;
}

function cloneAsset(asset: WorkspaceAsset): WorkspaceAsset {
  return { ...asset, bytes: new Uint8Array(asset.bytes) };
}

/**
 * In-memory storage adapter — the default for document, embedded and
 * headless modes and the fallback when IndexedDB is unavailable.
 */
export class MemoryStorage implements StorageAdapter {
  private workspaces = new Map<string, StoredWorkspace>();
  private assets = new Map<string, WorkspaceAsset>();
  private listeners = new Map<string, Set<() => void>>();
  private channel: BroadcastChannel | null = null;

  constructor(crossTab = true) {
    if (crossTab && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("ezynota:workspace");
      this.channel.onmessage = (event: MessageEvent) => {
        const workspaceId = (event.data as { workspaceId?: string } | undefined)?.workspaceId;
        if (workspaceId) {
          for (const listener of this.listeners.get(workspaceId) ?? []) listener();
        }
      };
    }
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null> {
    const record = this.workspaces.get(workspaceId);
    return record ? { ...cloneEnvelope(record.envelope), storageRevision: record.revision } : null;
  }

  async commit(workspaceId: string, envelope: WorkspaceEnvelope, expectedRevision: number): Promise<CommitResult> {
    const current = this.workspaces.get(workspaceId);
    const storedRevision = current?.revision ?? 0;
    if (storedRevision !== expectedRevision) return { ok: false, reason: "stale" };
    const next: StoredWorkspace = {
      id: workspaceId,
      envelope: cloneEnvelope(envelope),
      revision: storedRevision + 1
    };
    this.workspaces.set(workspaceId, next);
    try {
      this.channel?.postMessage({ workspaceId });
    } catch {
      /* ignore */
    }
    return { ok: true, revision: next.revision };
  }

  async loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null> {
    return this.assets.get(assetKey(workspaceId, assetId)) ?? null;
  }

  async saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean> {
    this.assets.set(assetKey(workspaceId, asset.id), { ...asset, bytes: new Uint8Array(asset.bytes) });
    return true;
  }

  subscribe(workspaceId: string, listener: () => void): () => void {
    let set = this.listeners.get(workspaceId);
    if (!set) {
      set = new Set();
      this.listeners.set(workspaceId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(workspaceId);
    };
  }

  async close(): Promise<void> {
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
  }
}

/** Produce an empty workspace envelope for a fresh ID. */
export function emptyWorkspace(workspaceId: string): WorkspaceEnvelope {
  return {
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    id: workspaceId,
    notes: [],
    folders: [],
    savedAt: 0,
    generator: { name: "ezynota", version: "0.3.0" }
  };
}
