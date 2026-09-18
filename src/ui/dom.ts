/** Minimal DOM helpers — all UI is built with createElement/textContent (Trusted Types friendly). */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, label: string, ariaLabel?: string): HTMLButtonElement {
  const btn = el("button", className);
  btn.type = "button";
  btn.textContent = label;
  btn.setAttribute("aria-label", ariaLabel ?? label);
  return btn;
}

export function svgButton(className: string, svg: string, ariaLabel: string): HTMLButtonElement {
  const btn = el("button", className);
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.title = ariaLabel;
  btn.innerHTML = svg; // SVG icons are static, code-owned constants — safe.
  for (const icon of Array.from(btn.querySelectorAll("svg"))) {
    icon.setAttribute("stroke-width", "1.8"); // Suite UI icon standard.
  }
  return btn;
}

export function clearChildren(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function positionBelow(anchor: DOMRect | HTMLElement, target: HTMLElement): void {
  const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
  target.style.left = `${Math.round(rect.left)}px`;
  target.style.top = `${Math.round(rect.bottom + 6)}px`;
  target.style.position = "fixed";
}

export function clampToViewport(node: HTMLElement, margin = 8): void {
  node.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
  node.style.maxHeight = `calc(100dvh - ${margin * 2}px)`;
  const rect = node.getBoundingClientRect();
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - rect.width));
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - margin - rect.height));
  node.style.transform = "none";
  node.style.position = "fixed";
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

/** Anchor a popup using viewport coordinates, flipping above when needed. */
export function placePopover(node: HTMLElement, anchor: DOMRect): void {
  node.style.position = "fixed";
  node.style.transform = "none";
  node.style.left = `${anchor.left}px`;
  node.style.top = `${anchor.bottom + 6}px`;
  const height = node.getBoundingClientRect().height;
  if (anchor.bottom + 6 + height > window.innerHeight - 8 && anchor.top > height + 8) {
    node.style.top = `${anchor.top - height - 6}px`;
  }
  clampToViewport(node);
}

/** Arrow navigation for a popup containing ordinary buttons and selects. */
export function navigateControls(event: KeyboardEvent, root: HTMLElement): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  if ((event.target as HTMLElement).matches("input, select, textarea")) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled)"));
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
    : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
  event.preventDefault();
}
