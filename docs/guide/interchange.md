# Interchange

Your content must never be trapped in the editor. Ezynota treats JSON as the source of truth and treats Markdown, HTML, and plain text as lossless-or-safely-degraded projections of it.

## Formats at a glance

| Format | Direction | Fidelity |
| --- | --- | --- |
| JSON (EzynotaDocument) | ✅ native | Lossless — includes tunes, nested children, marks |
| Markdown | in + out | Near-lossless (headings, lists, tables, tasks, code fences, inline marks, callouts) |
| HTML | in (sanitized) + out | Rich export; sanitized import |
| Plain text | in + out | Structure approximated (paragraphs, list markers) |
| Print / PDF | out | Sanitized print window via `printDocument` |

## JSON

```ts
const doc = editor.getSnapshot();      // live, frozen snapshot
const saved = await editor.save();     // validated save output
```

A saved document embeds a generator stamp:

```json
{
  "schemaVersion": "1.0.0",
  "generator": { "name": "ezynota", "version": "0.1.1" },
  "blocks": []
}
```

See the [document format reference](/api/document-format).

## Markdown

```ts
import { blocksToMarkdown, markdownToBlocks, parseMarkdownInline } from "@bookklik/ezynota";

const md = blocksToMarkdown(doc.blocks, {
  noteLinkTitles: true, // render note:<id> links with their titles (workspace)
});

const blocks = markdownToBlocks(md);
```

Supported round-trip features: headings, bullet/ordered/task lists, quotes, fenced code, tables, delimiters, callouts (via markers), bold/italic/strike/code/marks, links (including `note:<id>` internal links), images.

## HTML

**Export** produces standalone HTML with tables and `<details>`-based toggles:

```ts
import { blocksToHtml } from "@bookklik/ezynota";

const html = blocksToHtml(doc.blocks);
```

**Import** runs through a strict sanitizer — scripts, styles, event handlers, and unsafe URLs are stripped, and the parsed tree is converted to blocks:

```ts
import { htmlToBlocks, textToBlocks } from "@bookklik/ezynota";

const blocks = htmlToBlocks(pastedHtml);
const fromText = textToBlocks(plainText);
```

## File import & export

```ts
import { parseImportFile, blocksToDocument, exportDocumentToString, downloadTextFile, detectFormat } from "@bookklik/ezynota";

// From a File/Blob (json, md, html, txt, or a workspace backup)
const parsed = await parseImportFile(file);
const doc = blocksToDocument(parsed.blocks, "Imported note");

// Serialize & download
const text = exportDocumentToString(doc, "md");
downloadTextFile(text, safeFilename("my note") + ".md");
```

`detectFormat` inspects content to pick the right parser; imports are size-capped (10 MB) as a safety measure.

## Assets

Image sources can be `asset:<id>` references into the workspace asset store. For portable exports, resolve them to data URLs:

```ts
import { resolveDocumentAssets } from "@bookklik/ezynota";

const portable = await resolveDocumentAssets(doc, (id) => loadAssetDataUrl(id));
```

## Print / PDF

```ts
import { printDocument } from "@bookklik/ezynota";

printDocument(doc); // opens a sanitized print window
```

The print view strips interactive chrome and uses sanitized HTML — trigger it and let the user "Save as PDF" from the browser dialog.

## Workspace shortcuts

In workspace mode, the [WorkspaceController](/api/workspace) wraps all of this:

```ts
await ws.exportActiveNote("md");
await ws.importFiles(fileList);
await ws.portableSnapshot(); // assets inlined as data URLs
```
