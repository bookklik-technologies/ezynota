# Security

Ezynota is designed to render untrusted content safely. If your users paste from Word, import random HTML files, or open documents from the internet, the editor treats all of it as hostile input.

## The sanitization pipeline

Everything that enters the document passes through the same validators:

1. **`normalizeDocument` / `normalizeBlock`** — strict structural validation on every write. Unknown shapes throw `EZ_INVALID_DOCUMENT` / `EZ_INVALID_BLOCK` rather than being rendered.
2. **Depth cap** — JSON deeper than `MAX_JSON_DEPTH` (200) is rejected, defeating deep-nesting bombs.
3. **Prototype-pollution stripping** — keys like `__proto__`, `constructor`, and `prototype` are removed from all incoming JSON.
4. **`salvageDocument`** — for untrusted payloads that must not fail: invalid blocks become read-only `unknown` placeholders and duplicate ids are renamed (`<id>_2`, `<id>_3`, …) instead of crashing.

## URL safety

A strict allowlist guards every URL that can reach the DOM:

```ts
import { isSafeUrl, isSafeImageUrl, sanitizeLinkTarget } from "@bookklik/ezynota";

isSafeUrl("https://example.com");   // true
isSafeUrl("javascript:alert(1)");   // false
isSafeUrl("data:text/html,…");      // false
```

- `javascript:`, `vbscript:`, and other executable schemes are stripped.
- `data:` URLs are only allowed for **images** (and only real image MIME types).
- Protocol-relative URLs (`//evil.com`) are rejected.
- Link targets are normalized by `sanitizeLinkTarget` before rendering.
- Rendered links always get `rel="noopener noreferrer"`.

## Paste & import sanitization

- Pasted/dropped HTML goes through `htmlToBlocks`, which builds a sanitized tree first: scripts, styles, event handler attributes, and unsafe URLs never survive.
- Clipboard JSON (`application/x-ezynota+json`) is re-validated as a document — it is never trusted as-is.
- File imports are size-capped (**10 MB**) to prevent decompression bombs and memory exhaustion.
- Image sources are validated with `isSafeImageUrl` at render time.

## DOM construction

The renderer never assigns `innerHTML` from document data:

- All DOM is built with `createElement` / `textContent` / explicit attribute setting.
- Text is always inserted as text nodes — marks are elements built programmatically.
- Custom marks render as `span[data-ez-mark]` rather than raw tag names from data.

## Print & export

`printDocument` and `blocksToHtml` render through the same sanitized pipeline — exported HTML contains no scripts, handlers, or unsafe URLs from the source document.

## No eval, no remote code

- No `eval`, no `new Function`, anywhere.
- Declarative attribute values (`data-ezn-*`) are parsed, never evaluated.
- No runtime dependencies means no transitive supply-chain code at runtime.

## What's explicitly out of scope

Ezynota is a client-side editor. Accounts, server sync, real-time collaboration, and plugin marketplaces are non-goals — which keeps the trust boundary simple: **the browser is the whole runtime**.
