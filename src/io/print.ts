import type { EzynotaDocument } from "../types";
import { blocksToHtml } from "./export";
import { isSafeImageUrl, isSafeUrl } from "../core/url";

/**
 * Browser printing/PDF output for the active document. The print DOM is
 * built exclusively with createElement/textContent — untrusted content
 * never reaches innerHTML.
 */
export function printDocument(document: EzynotaDocument): void {
  // "noopener" makes window.open() return null per spec, which silently
  // disabled printing in every browser. The window contains only
  // code-generated first-party content, so an opener handle is acceptable.
  const win = window.open("", "_blank");
  if (!win) return;
  const doc = win.document;
  const title = String((document.meta as { title?: string } | undefined)?.title ?? "Ezynota document");
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = `
    body { font-family: Georgia, "Times New Roman", serif; color: #111; max-width: 720px; margin: 40px auto; line-height: 1.6; }
    h1, h2, h3, h4 { line-height: 1.25; }
    blockquote { border-inline-start: 3px solid #888; margin-inline: 0; padding-inline-start: 16px; color: #444; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 6px 10px; text-align: start; }
    img { max-width: 100%; }
    .ez-md-callout { border: 1px solid #bbb; border-inline-start: 4px solid #ec4899; padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
    .ez-md-task { list-style: none; margin-inline-start: -1.4em; }
  `;
  doc.head.appendChild(style);
  const h1 = doc.createElement("h1");
  h1.textContent = title;
  doc.body.appendChild(h1);
  const container = doc.createElement("div");
  renderHtmlInto(container, blocksToHtml(document.blocks));
  doc.body.appendChild(container);
  win.focus();
  win.print();
}

/**
 * Render an HTML export string into a live document safely: parse with
 * DOMParser, strip scripts/handlers and unsafe URLs, then adopt the
 * sanitized nodes. The HTML string produced by blocksToHtml is
 * code-generated, but the sanitizer guards both paths.
 */
function renderHtmlInto(target: Element, html: string): void {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const node of Array.from(parsed.body.querySelectorAll("*"))) {
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "EMBED" || tag === "LINK" || tag === "META" || tag === "FORM") {
      node.remove();
      continue;
    }
    if (tag === "IMG") {
      const src = node.getAttribute("src") ?? "";
      if (!(isSafeImageUrl(src) || src.startsWith("asset:"))) {
        node.remove();
        continue;
      }
    }
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      if (!isSafeUrl(href) && !href.startsWith("note:")) {
        node.removeAttribute("href");
      }
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (/^on/i.test(name) || name === "style" || name === "formaction" || name === "xlink:href") {
        node.removeAttribute(attr.name);
        continue;
      }
      // Strip any non-image attribute that carries a scriptable URL scheme.
      if (tag !== "IMG" && /^\s*(?:data|javascript|vbscript):/i.test(attr.value)) {
        node.removeAttribute(attr.name);
      }
    }
  }
  for (const child of Array.from(parsed.body.childNodes)) {
    target.appendChild(target.ownerDocument.importNode(child, true));
  }
}
