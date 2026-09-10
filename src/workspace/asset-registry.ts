import type { WorkspaceAsset } from "./types";

/**
 * Module-level bridge between block tools and workspace asset storage.
 * Tools stay decoupled from the workspace: they ask for a store/resolve
 * capability, and the workspace controller registers the implementation.
 */
export type AssetStorer = (file: File) => Promise<string | null>;
export type AssetLoader = (assetId: string) => Promise<WorkspaceAsset | null>;

let storer: AssetStorer | null = null;
let loader: AssetLoader | null = null;

export function registerAssetStore(fn: AssetStorer): void {
  storer = fn;
}

export function registerAssetLoader(fn: AssetLoader): void {
  loader = fn;
}

export function unregisterAssetHandlers(): void {
  storer = null;
  loader = null;
}

export function hasAssetStore(): boolean {
  return storer !== null;
}

/** Store a file as a workspace asset; resolves to `asset:<id>` or null. */
export async function storeFileAsset(file: File): Promise<string | null> {
  if (!storer) return null;
  return storer(file);
}

/** Resolve `asset:<id>` into a temporary object URL for rendering. */
export async function resolveAssetSrc(src: string): Promise<string | null> {
  if (!src.startsWith("asset:") || !loader) return null;
  const asset = await loader(src.slice("asset:".length));
  if (!asset) return null;
  try {
    return URL.createObjectURL(new Blob([asset.bytes as unknown as BlobPart], { type: asset.mime }));
  } catch {
    return null;
  }
}
