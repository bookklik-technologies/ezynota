export interface IdGenerator {
  (): string;
}

const FALLBACK_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Fallback id generator for environments without crypto.randomUUID. */
function fallbackId(): string {
  let out = "ez_";
  for (let i = 0; i < 12; i++) {
    out += FALLBACK_ALPHABET[Math.floor(Math.random() * FALLBACK_ALPHABET.length)];
  }
  return out;
}

export function createDefaultIdGenerator(): IdGenerator {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return () => c.randomUUID();
  }
  return fallbackId;
}

export function createIdFactory(custom?: IdGenerator): IdGenerator {
  const fallback = createDefaultIdGenerator();
  if (!custom) return fallback;
  // A custom generator must return a non-empty string; fall back otherwise.
  return () => {
    const id = custom();
    return typeof id === "string" && id !== "" ? id : fallback();
  };
}
