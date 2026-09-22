---
name: ezynota-interchange-migrations
description: "Implement Ezynota JSON, Markdown, HTML and text interchange plus schema normalization, salvage and migrations. Use for document conversion or version upgrades, not workspace storage adapters."
---

# Ezynota Interchange and Migrations

## Inputs and approach

Identify source and target formats, required fidelity, trust boundary, asset handling and schema versions. Use native JSON for lossless Ezynota data; describe any safe degradation in Markdown, HTML or text.

Read [interchange](../../../docs/guide/interchange.md), [schema and migrations](../../../docs/api/migrations.md), [security](../../../docs/guide/security.md), [import implementation](../../../src/io/import.ts), [export implementation](../../../src/io/export.ts), [schema](../../../src/core/schema.ts) and [migration manager](../../../src/core/migration-manager.ts).

## Workflow and contracts

- Treat imported files and HTML as untrusted. Use the public parsers and normalizers; do not bypass URL, HTML or prototype-pollution safeguards.
- JSON is lossless for documents. Markdown and HTML may safely degrade unsupported custom blocks, tunes or marks; state those limits.
- `parseImportFile` detects supported JSON, Markdown, HTML, text and workspace backups and enforces the import size cap. Do not silently reinterpret parse failures.
- Use `resolveDocumentAssets` to replace `asset:<id>` references for portable exports. Avoid leaking or retaining object URLs beyond their lifecycle.
- `normalizeDocument` rejects invalid structure; `salvageDocument` preserves recoverable content and represents invalid blocks as unknown placeholders.
- Migrations must be pure, deterministic and return the declared target schema version. Register explicit forward-version edges and let `MigrationManager` choose the path; the current manager refuses downgrades.
- `editor.render` migrates before installation and resets history. Unsupported schema content may enter read-only recovery and must remain recoverable.

## Example

```ts
import {
  MigrationManager, blocksToMarkdown, markdownToBlocks, normalizeDocument,
} from 'ezynota';

const migrations = new MigrationManager();
migrations.register({
  from: '1.0.0',
  to: '1.1.0',
  migrate(document) {
    return { ...document, schemaVersion: '1.1.0' };
  },
});

const normalized = normalizeDocument(input, () => crypto.randomUUID());
const markdown = blocksToMarkdown(normalized.blocks);
const importedBlocks = markdownToBlocks(markdown);
```

## Deliverables and verification

Deliver converters or migrations with an explicit fidelity and safety statement. Review malformed/deep JSON, duplicate ids, unknown blocks, unsafe links/HTML, large imports, assets, nested content, migration path failure, deterministic reruns and recovery-mode preservation. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
