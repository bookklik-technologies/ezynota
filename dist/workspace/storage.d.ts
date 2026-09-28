import type { CommitResult, StorageAdapter, WorkspaceAsset, WorkspaceEnvelope } from "./types";
/**
 * IndexedDB storage adapter: one object store for workspace envelopes
 * (revision-checked commits) and one for binary assets.
 */
export declare class IndexedDbStorage implements StorageAdapter {
    private db;
    private initPromise;
    private listeners;
    private channel;
    private idb;
    private fallback;
    init(): Promise<void>;
    private ensureDb;
    loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null>;
    private getRecord;
    commit(workspaceId: string, envelope: WorkspaceEnvelope, expectedRevision: number): Promise<CommitResult>;
    loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null>;
    saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean>;
    subscribe(workspaceId: string, listener: () => void): () => void;
    private notifyLocal;
    private broadcast;
    close(): Promise<void>;
}
/**
 * In-memory storage adapter — the default for document, embedded and
 * headless modes and the fallback when IndexedDB is unavailable.
 */
export declare class MemoryStorage implements StorageAdapter {
    private workspaces;
    private assets;
    private listeners;
    private channel;
    constructor(crossTab?: boolean);
    init(): Promise<void>;
    loadWorkspace(workspaceId: string): Promise<WorkspaceEnvelope | null>;
    commit(workspaceId: string, envelope: WorkspaceEnvelope, expectedRevision: number): Promise<CommitResult>;
    loadAsset(workspaceId: string, assetId: string): Promise<WorkspaceAsset | null>;
    saveAsset(workspaceId: string, asset: WorkspaceAsset): Promise<boolean>;
    subscribe(workspaceId: string, listener: () => void): () => void;
    close(): Promise<void>;
}
/** Produce an empty workspace envelope for a fresh ID. */
export declare function emptyWorkspace(workspaceId: string): WorkspaceEnvelope;
