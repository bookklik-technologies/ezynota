import type { Host } from "../host";
import type { EzynotaChange } from "../core/types";

/**
 * Document find/replace. Matches are located across block text — including
 * list items, table cells, toggle headings and image captions — and every
 * replacement commits as ONE transaction (one undo entry).
 *
 * LIMITATION (best effort): matching operates per text node, so a query
 * that SPANS an inline boundary (e.g. across "</strong><em>") is not
 * found. A per-block plain-text scan with offset mapping is required to
 * fix that and is intentionally out of scope here.
 *
 * Replacements use literal string splicing (split/join), so `$&`, `$\``
 * etc. in the replacement text are never expanded.
 */
export function createFindReplace(host: Host, holder: HTMLElement) {
  return (query: string, replaceWith: string, replaceAll: boolean): void => {
    if (!query) return;
    void holder;
    // Document-order first-match budget: "replace one" replaces exactly the
    // FIRST match in the document, not one match in every block.
    let budget = replaceAll ? Number.POSITIVE_INFINITY : 1;
    let replacedCount = 0;
    const changes: EzynotaChange[] = [];
    for (const block of host.blocks.blocks) {
      if (budget <= 0) break;
      const previous = cloneJson(block.data);
      const next = cloneJson(previous);
      const used = replaceInData(next, query, replaceWith, budget);
      if (used > 0) {
        budget -= used;
        replacedCount += used;
        changes.push({ type: "block:update", id: block.id, previous, current: next });
      }
    }
    if (changes.length === 0) {
      host.announce(`No matches for "${query}"`);
      return;
    }
    // ONE transaction for the whole operation (single undo entry).
    host.commitChanges("user", changes);
    host.announce(replaceAll ? `Replaced ${replacedCount} match(es)` : "Replaced match");
    if (!replaceAll) {
      // Focus the first replaced block so the user sees the change.
      const first = changes[0] as { id: string };
      host.focusBlock(first.id, "start");
    }
  };
}

/**
 * Replace matches within one block's data IN PLACE (the caller passes a
 * clone). Returns the number of replacements performed.
 */
function replaceInData(data: unknown, query: string, replaceWith: string, budget: number): number {
  if (!data || typeof data !== "object") return 0;
  let used = 0;
  const d = data as Record<string, unknown>;
  if (typeof d.code === "string") {
    const { text, count } = replaceString(d.code, query, replaceWith, budget);
    d.code = text;
    used += count;
  }
  if (Array.isArray(d.content)) {
    used += replaceInInlineList(d.content as unknown[], query, replaceWith, budget - used);
  }
  if (Array.isArray(d.heading)) {
    used += replaceInInlineList(d.heading as unknown[], query, replaceWith, budget - used);
  }
  if (Array.isArray(d.items)) {
    for (const item of d.items as Record<string, unknown>[]) {
      if (budget - used <= 0) break;
      if (Array.isArray(item?.content)) {
        used += replaceInInlineList(item.content as unknown[], query, replaceWith, budget - used);
      }
    }
  }
  if (Array.isArray(d.rows)) {
    for (const row of d.rows as unknown[]) {
      if (!Array.isArray(row)) continue;
      for (const cell of row as Record<string, unknown>[]) {
        if (budget - used <= 0) break;
        if (Array.isArray(cell?.content)) {
          used += replaceInInlineList(cell.content as unknown[], query, replaceWith, budget - used);
        }
      }
    }
  }
  if (typeof d.caption === "string") {
    const { text, count } = replaceString(d.caption, query, replaceWith, budget - used);
    d.caption = text;
    used += count;
  }
  return used;
}

function replaceInInlineList(nodes: unknown[], query: string, replaceWith: string, budget: number): number {
  let used = 0;
  for (const node of nodes) {
    if (budget - used <= 0) break;
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (typeof n.text === "string") {
      const { text, count } = replaceString(n.text, query, replaceWith, budget - used);
      n.text = text;
      used += count;
    }
    // Link nodes carry nested text nodes.
    if (Array.isArray(n.content)) {
      used += replaceInInlineList(n.content as unknown[], query, replaceWith, budget - used);
    }
  }
  return used;
}

/** Literal (non-expanding, non-regex) replace of up to `budget` occurrences. */
function replaceString(text: string, query: string, replaceWith: string, budget: number): { text: string; count: number } {
  if (budget <= 0) return { text, count: 0 };
  let out = text;
  let count = 0;
  let from = 0;
  while (count < budget) {
    const index = out.indexOf(query, from);
    if (index < 0) break;
    out = out.slice(0, index) + replaceWith + out.slice(index + query.length);
    count++;
    // Continue past the inserted replacement (it may itself contain the query).
    from = index + replaceWith.length;
  }
  return { text: out, count };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
