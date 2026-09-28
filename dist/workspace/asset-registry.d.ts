import type { WorkspaceAsset } from "./types";
/**
 * Bridge between block tools and workspace asset storage. Tools stay
 * decoupled from the workspace: they ask for a store/resolve capability,
 * and each workspace controller registers its own implementation and
 * receives a disposer bound to that registration. Destroying one editor
 * therefore never removes another editor's handlers.
 */
export type AssetStorer = (file: File) => Promise<string | null>;
export type AssetLoader = (assetId: string) => Promise<WorkspaceAsset | null>;
export declare function registerAssetStore(fn: AssetStorer): () => void;
export declare function registerAssetLoader(fn: AssetLoader): () => void;
/** Compatibility helper: removes every registration (used by tests/legacy callers). */
export declare function unregisterAssetHandlers(): void;
export declare function hasAssetStore(): boolean;
/** Store a file as a workspace asset; resolves to `asset:<id>` or null. */
export declare function storeFileAsset(file: File): Promise<string | null>;
/** Drop the cached object URLs of one loader (revokes the blob URLs). */
export declare function releaseAssetUrls(loader: AssetLoader): void;
/** Resolve `asset:<id>` into a cached object URL for rendering (one per asset id). */
export declare function resolveAssetSrc(src: string): Promise<string | null>;
