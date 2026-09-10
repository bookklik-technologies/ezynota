const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

/**
 * Decide whether a URL is safe to store and render.
 * Blocks dangerous schemes (javascript:, data:, vbscript:) except for
 * image data URLs handled separately by image rendering code.
 */
export function isSafeUrl(input: unknown): boolean {
  if (typeof input !== "string") return false;
  const url = input.trim();
  if (url === "") return false;
  // Relative URLs (fragments, paths) are safe.
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return true;
  }
  try {
    const parsed = new URL(url, "https://ezynota.invalid");
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Image sources may use tightly-controlled data URLs. */
export function isSafeImageUrl(input: unknown): boolean {
  if (typeof input !== "string") return false;
  const url = input.trim();
  if (url === "") return false;
  if (url.startsWith("data:image/")) {
    // Only base64 or svg+xml data URLs, never data:text/html
    return /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i.test(url);
  }
  return isSafeUrl(url);
}

/** Normalize and sanitize a link target; returns null if unsafe. */
export function sanitizeLinkTarget(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const url = input.trim();
  return isSafeUrl(url) ? url : null;
}
