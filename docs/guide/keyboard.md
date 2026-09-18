# Keyboard & markdown

Ezynota is keyboard-complete. All shortcuts are IME-safe (composition events and keyCode 229 are handled), so typing in CJK languages never triggers false conversions.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Split block at caret |
| `Shift+Enter` | Soft line break |
| `Backspace` (at block start) | Merge with previous block |
| `Delete` (at block end) | Merge with next block |
| `Tab` / `Shift+Tab` | Table cell navigation (creates rows/cols at the edges) |
| `Escape` | Exit browser fullscreen; otherwise close menus |
| `/` | Open slash menu |
| `[[` | Note-link suggestions (workspace mode) |

### Modifier shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Italic |
| `Ctrl/Cmd+U` | Underline |
| `Ctrl/Cmd+K` | Insert/edit link |
| `Ctrl/Cmd+D` | Duplicate block |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+Shift+L` | Toggle list |
| `Ctrl/Cmd+Shift+C` | Toggle code block |
| `Alt+↑` / `Alt+↓` | Move block up / down |

## Markdown typing shortcuts

Conversions trigger as you type and each is a **single undoable transaction**.

### Block shortcuts (on `Space`)

| Type | Result |
| --- | --- |
| `#` … `######` | Heading 1–6 (levels configurable, default 1–3) |
| `>` | Quote |
| `-` or `*` | Bulleted list |
| `1.` or `1)` | Ordered list |
| `[]` or `[x]` | Task list item (unchecked / checked) |

### Inline shortcuts

| Type | Result |
| --- | --- |
| `**bold**` or `__bold__` | **Bold** |
| `*italic*` | *Italic* |
| `~~strike~~` | ~~Strikethrough~~ |
| `` `code` `` | Inline code |
| `==mark==` | Highlighted text |

### On `Enter`

| Type | Result |
| --- | --- |
| `---`, `***`, `___` | Delimiter block |
| <code>```</code> | Code block |

## Markdown interchange

Typing shortcuts are just one direction of Markdown support. Ezynota converts documents to and from Markdown losslessly:

```ts
import { blocksToMarkdown, markdownToBlocks } from "@bookklik/ezynota";

const md = blocksToMarkdown(doc.blocks);
const blocks = markdownToBlocks(md);
```

See [Interchange](./interchange) for the full story (HTML, plain text, print).

## Clipboard

Copy/cut emit `text/plain`, `text/html`, **and** `application/x-ezynota+json` (a sanitized document fragment). Pasting follows this priority:

1. Ezynota JSON (copying between Ezynota editors is lossless)
2. Files (routed to image tools — paste screenshots directly)
3. Sanitized HTML (converted to blocks, scripts/styles stripped)
4. Plain text

Dragging text or files onto the editor uses the same pipeline.
