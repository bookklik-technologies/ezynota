# Document format

Ezynota documents are plain, portable, versioned JSON. The DOM is never the source of truth — you can store a document in any database, diff it, sync it, or regenerate it years later.

## EzynotaDocument

```json
{
  "schemaVersion": "1.0.0",
  "generator": { "name": "ezynota", "version": "0.1.1" },
  "createdAt": 1727000000000,
  "updatedAt": 1727000123456,
  "meta": { "title": "Meeting notes" },
  "blocks": []
}
```

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `string` | Document schema version (`"1.0.0"`) — independent of the package version. |
| `blocks` | `EzynotaBlock[]` | Ordered top-level blocks. |
| `createdAt` / `updatedAt` | `number?` | Epoch milliseconds. |
| `meta` | `JsonObject?` | Free-form metadata; the note title lives at `meta.title`. |
| `generator` | `{ name, version }?` | Stamp of the producing editor. |

## EzynotaBlock

```json
{
  "id": "b7f9c2e1",
  "type": "paragraph",
  "data": { "content": [{ "type": "text", "text": "Hello" }] },
  "tunes": { "alignment": "center" },
  "meta": { "createdAt": 1727000000000 },
  "children": []
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id (UUID or `ez_*` fallback, or your `idGenerator`). |
| `type` | `string` | Block type — a built-in or any custom tool key. |
| `data` | `JsonValue` | Tool-specific payload. Always JSON-serializable. |
| `tunes` | `Record<string, JsonValue>?` | Per-block tune values, e.g. `{ alignment: "center" }`. |
| `meta` | `{ createdAt?, updatedAt? }?` | Block timestamps. |
| `children` | `EzynotaBlock[]?` | Nested blocks (used by toggle sections; reserved for future nesting). |

## Inline content

Text content is a structured array — never raw HTML:

```ts
type InlineContent = TextNode | LinkNode;

interface TextNode {
  type: "text";
  text: string;
  marks?: InlineMark[];
}

interface LinkNode {
  type: "link";
  href: string;        // https:, mailto:, or note:<id> internal links
  content: TextNode[];
}

interface InlineMark {
  type: string;        // see mark types below
  attrs?: JsonObject;
}
```

Helper: `textNode("hi", [{ type: "bold" }])`.

### Mark types

| Mark | Rendered as |
| --- | --- |
| `bold` | `<strong>` |
| `italic` | `<em>` |
| `underline` | `<u>` |
| `strike` | `<s>` |
| `code` | `<code>` |
| `mark` | `<mark>` |
| `color` | `span` with `attrs.color` |
| `background` | `span` with `attrs.color` |
| `link` | `<a>` (via LinkNode) |
| custom | `<span data-ez-mark="…">` |

Marks are stored in a deterministic order and normalized by `normalizeInline`, so equal content always produces byte-identical JSON.

## Block data shapes

| Type | Data |
| --- | --- |
| `paragraph` | `{ content: InlineContent[] }` |
| `heading` | `{ level: 1\|2\|3, content: InlineContent[] }` |
| `quote` | `{ content: InlineContent[] }` |
| `code` | `{ code: string }` (plain text, no inline marks) |
| `delimiter` | `{}` |
| `list` | `{ style: "unordered"\|"ordered"\|"task", items: [{ content, checked? }] }` |
| `table` | `{ header: boolean, rows: [[{ content: InlineContent[] }]] }` |
| `image` | `{ src, alt, caption?, width? }` — `src` may be `asset:<id>` or a data URL |
| `callout` | `{ variant: "info"\|"warning"\|"success"\|"danger", content: InlineContent[] }` |
| `toggle` | `{ open: boolean, heading: InlineContent[] }` + `children` |
| `unknown` | raw original data (read-only fallback) |

## Validation, salvage & freezing

- [`normalizeDocument`](/api/migrations) — strict validation; throws on bad input.
- [`salvageDocument`](/api/migrations) — never throws; repairs what it can.
- `freezeDocument` — deep-freeze snapshots (used by `getSnapshot()`).
- Duplicate ids are detected and renamed during normalization (`<id>_2`, —).

## Versioning

`SCHEMA_VERSION` (`"1.0.0"`) evolves independently of the npm version. Documents written by older schemas are [migrated](/api/migrations) automatically on `render()` and on workspace load.
