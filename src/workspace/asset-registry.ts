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
  scope?: object;
  storer?: AssetStorer;
  loader?: AssetLoader;
}

const registrations = new Map<number, AssetRegistration>();
/** Cached object URLs per loader instance, revoked when that loader is disposed. */
const urlCaches = new WeakMap<AssetLoader, Map<string, string>>();
let nextToken = 1;

function activeRegistration(pick: (registration: AssetRegistration) => boolean, scope?: object): AssetRegistration | null {
  // Only registrations owned by the requesting editor can handle its assets.
  let active: AssetRegistration | null = null;
  for (const registration of registrations.values()) {
    if (registration.scope === scope && pick(registration)) active = registration;
  }
  return active;
}

export function registerAssetStore(fn: AssetStorer, scope?: object): () => void {
  const token = nextToken++;
  registrations.set(token, { storer: fn, scope });
  return () => {
    registrations.delete(token);
  };
}

export function registerAssetLoader(fn: AssetLoader, scope?: object): () => void {
  const token = nextToken++;
  registrations.set(token, { loader: fn, scope });
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

export function hasAssetStore(scope?: object): boolean {
  return activeRegistration((registration) => registration.storer !== undefined, scope) !== null;
}

/** Store a file as a workspace asset; resolves to `asset:<id>` or null. */
export async function storeFileAsset(file: File, scope?: object): Promise<string | null> {
  const storer = activeRegistration((registration) => registration.storer !== undefined, scope)?.storer;
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
export async function resolveAssetSrc(src: string, scope?: object): Promise<string | null> {
  if (!src.startsWith("asset:")) return null;
  const loader = activeRegistration((registration) => registration.loader !== undefined, scope)?.loader;
  if (!loader) return null;
  const assetId = src.slice("asset:".length);
  let cache = urlCaches.get(loader);
  if (!cache) {
    cache = new Map<string, string>();
    urlCaches.set(loader, cache);
  }
  const cached = cache.get(assetId);
  if (cached) return cached;
  let asset: WorkspaceAsset | null;
  try { asset = await loader(assetId); } catch { return null; }
  if (activeRegistration((registration) => registration.loader === loader, scope) === null) return null;
  if (!asset) return null;
  try {
    const existing = cache.get(assetId);
    if (existing) return existing;
    const url = URL.createObjectURL(new Blob([asset.bytes as unknown as BlobPart], { type: asset.mime }));
    cache.set(assetId, url);
    return url;
  } catch {
    return null;
  }
}
