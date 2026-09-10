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

interface AssetRegistration {
  storer?: AssetStorer;
  loader?: AssetLoader;
}

const registrations = new Map<number, AssetRegistration>();
/** Cached object URLs per loader instance, revoked when that loader is disposed. */
const urlCaches = new WeakMap<AssetLoader, Map<string, string>>();
let nextToken = 1;

function activeRegistration(pick: (registration: AssetRegistration) => boolean): AssetRegistration | null {
  // Registrations are kept in insertion order; the most recent active one
  // wins (the last editor that registered).
  let active: AssetRegistration | null = null;
  for (const registration of registrations.values()) {
    if (pick(registration)) active = registration;
  }
  return active;
}

export function registerAssetStore(fn: AssetStorer): () => void {
  const token = nextToken++;
  registrations.set(token, { storer: fn });
  return () => {
    registrations.delete(token);
  };
}

export function registerAssetLoader(fn: AssetLoader): () => void {
  const token = nextToken++;
  registrations.set(token, { loader: fn });
  return () => {
    releaseAssetUrls(fn);
    registrations.delete(token);
  };
}

/** Compatibility helper: removes every registration (used by tests/legacy callers). */
export function unregisterAssetHandlers(): void {
  for (const registration of registrations.values()) {
    if (registration.loader) releaseAssetUrls(registration.loader);
  }
  registrations.clear();
}

export function hasAssetStore(): boolean {
  return activeRegistration((registration) => registration.storer !== undefined) !== null;
}

/** Store a file as a workspace asset; resolves to `asset:<id>` or null. */
export async function storeFileAsset(file: File): Promise<string | null> {
  const storer = activeRegistration((registration) => registration.storer !== undefined)?.storer;
  if (!storer) return null;
  return storer(file);
}

/** Drop the cached object URLs of one loader (revokes the blob URLs). */
export function releaseAssetUrls(loader: AssetLoader): void {
  const cache = urlCaches.get(loader);
  if (!cache) return;
  for (const url of cache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* already revoked */
    }
  }
  urlCaches.delete(loader);
}

/** Resolve `asset:<id>` into a cached object URL for rendering (one per asset id). */
export async function resolveAssetSrc(src: string): Promise<string | null> {
  if (!src.startsWith("asset:")) return null;
  const loader = activeRegistration((registration) => registration.loader !== undefined)?.loader;
  if (!loader) return null;
  const assetId = src.slice("asset:".length);
  let cache = urlCaches.get(loader);
  if (!cache) {
    cache = new Map<string, string>();
    urlCaches.set(loader, cache);
  }
  const cached = cache.get(assetId);
  if (cached) return cached;
  const asset = await loader(assetId);
  if (!asset) return null;
  try {
    const url = URL.createObjectURL(new Blob([asset.bytes as unknown as BlobPart], { type: asset.mime }));
    cache.set(assetId, url);
    return url;
  } catch {
    return null;
  }
}
