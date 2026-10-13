export interface TextMatch {
  range: Range;
  editable: HTMLElement;
}

/** Match literal text without inserting markup into the editor document. */
export function findTextMatches(root: HTMLElement, query: string): TextMatch[] {
  if (!query) return [];
  const matches: TextMatch[] = [];
  for (const editable of root.querySelectorAll<HTMLElement>("[data-ez-editable]")) {
    // The replacement engine addresses top-level block data. Nested child
    // tools own their transactions and must not shift its match indexes.
    if (!editable.closest("[data-ez-block-id]")?.classList.contains("ez-block")) continue;
    const walker = editable.ownerDocument.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      let offset = text.indexOf(query);
      while (offset !== -1) {
        const range = editable.ownerDocument.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + query.length);
        matches.push({ range, editable });
        offset = text.indexOf(query, offset + query.length);
      }
    }
  }
  return matches;
}
