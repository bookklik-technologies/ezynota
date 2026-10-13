import type { Host } from "../host";

const textTools = new Set(["paragraph", "heading", "list", "quote", "code"]);

/** Only offer text conversions or a mapper that understands the source data. */
export function canConvertBlock(host: Host, from: string, to: string): boolean {
  if (from === to) return true;
  if (to === "delimiter" || !host.registry.has(from) || !host.registry.has(to)) return false;
  if (host.registry.get(to).toolClass.conversion?.from?.[from]) return true;
  return textTools.has(from) && textTools.has(to)
    && !!host.registry.get(from).toolClass.conversion?.to?.includes(to);
}
