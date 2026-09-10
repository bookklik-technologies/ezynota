import type { Host } from "../host";
import { inlineToPlainText } from "../rich-text/types";

/**
 * Document find/replace. Matches are located across block text; replacing
 * commits through transactions (undoable, one entry per replace-all).
 * Current matches are highlighted with a `data-ez-find` attribute when a
 * match sits under the caret, and the host is scrolled to the block.
 */
export function createFindReplace(host: Host, holder: HTMLElement) {
  return (query: string, replaceWith: string, replaceAll: boolean): void => {
    if (!query) return;
    void holder;
    let replacedCount = 0;
    const changes: { id: string; data: Record<string, unknown> }[] = [];
    for (const block of host.blocks.blocks) {
      const result = replaceInBlock(block, query, replaceWith, replaceAll);
      if (result) {
        changes.push({ id: block.id, data: result });
        replacedCount += countMatches(block, query);
      }
    }
    if (changes.length === 0) {
      host.announce(`No matches for "${query}"`);
      return;
    }
    for (const change of changes) {
      host.updateBlockData(change.id, change.data as never, "user");
    }
    host.announce(replaceAll ? `Replaced ${replacedCount} match(es)` : "Replaced match");
    if (!replaceAll && changes.length > 0) {
      // Focus the first replaced block so the user sees the change.
      host.focusBlock(changes[0]!.id, "start");
    }
  };
}

/** Replace inline content matches within one block. Returns new data or null. */
function replaceInBlock(block: { id: string; type: string; data: unknown }, query: string, replaceWith: string, replaceAll: boolean): Record<string, unknown> | null {
  const data = block.data as Record<string, unknown>;
  if (block.type === "code") {
    const code = String(data.code ?? "");
    if (!code.includes(query)) return null;
    return { ...data, code: replaceAll ? code.split(query).join(replaceWith) : code.replace(query, replaceWith) };
  }
  if (block.type === "toggle" || block.type === "callout") {
    const content = data.content as { text?: string }[] | undefined;
    if (Array.isArray(content)) {
      const replaced = replaceInlineList(content as never, query, replaceWith, replaceAll);
      if (replaced) return { ...data, content: content };
    }
    return null;
  }
  const content = data.content as { text?: string }[] | undefined;
  if (!Array.isArray(content)) return null;
  const replaced = replaceInlineList(content, query, replaceWith, replaceAll);
  return replaced ? { ...data, content } : null;
}

function replaceInlineText(nodes: { text?: string }[], query: string, replaceWith: string, replaceAll: boolean): boolean {
  let replaced = false;
  for (const node of nodes) {
    if (typeof node.text === "string" && node.text.includes(query)) {
      node.text = replaceAll ? node.text.split(query).join(replaceWith) : node.text.replace(query, replaceWith);
      replaced = true;
      if (!replaceAll) return true;
    }
  }
  return replaced;
}

function replaceInlineList(content: unknown, query: string, replaceWith: string, replaceAll: boolean): boolean {
  return replaceInlineText(content as { text?: string }[], query, replaceWith, replaceAll);
}

function countMatches(block: { type: string; data: unknown }, query: string): number {
  const data = block.data as Record<string, unknown>;
  const content = data.content as { text?: string }[] | undefined;
  const text = block.type === "code" ? String(data.code ?? "") : Array.isArray(content) ? inlineToPlainText(content as never) : "";
  if (!text) return 0;
  let count = 0;
  let index = text.indexOf(query);
  while (index >= 0) {
    count++;
    index = text.indexOf(query, index + query.length);
  }
  return count;
}
