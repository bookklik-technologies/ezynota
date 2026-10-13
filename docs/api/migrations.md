# Schema & migrations

Documents outlive app versions. Ezynota handles this with three layers: **normalization** (validate), **salvage** (repair), and **migration** (upgrade).

## Normalization

```ts
import { normalizeDocument, normalizeBlock, SCHEMA_VERSION, MAX_JSON_DEPTH } from "@bookklik/ezynota";

const doc = normalizeDocument(untrustedInput, idGenerator);
```

- `SCHEMA_VERSION` is `"1.0.0"`; `MAX_JSON_DEPTH` is `200`.
- Throws `EZ_INVALID_DOCUMENT` / `EZ_INVALID_BLOCK` on structurally invalid input.
- Strips prototype-pollution keys (`__proto__`, `constructor`, `prototype`).
- Regenerates missing ids and renames duplicates (`<id>_2`, …).
- Applies sensible defaults per block type (e.g. heading level, list style).

## Salvage

For payloads that must never fail to open (user uploads, legacy data, third-party JSON):

```ts
import { salvageDocument } from "@bookklik/ezynota";

const result: SalvageResult = salvageDocument(badInput, idGenerator?);
// {
//   document,   // a valid document, best effort
//   salvaged: boolean,
//   dropped: number
// }
```

Invalid blocks become read-only `unknown` placeholders that preserve the raw data — nothing is silently lost, and users can still see (and copy) what was there.

## Migrations

Register forward migrations; Ezynota picks the shortest path automatically (BFS over the migration graph) and can even walk **downgrades** when opening an older-schema document is required.

```ts
import { MigrationManager } from "@bookklik/ezynota";

const migrations = new MigrationManager();
migrations.register({
  from: "1.0.0",
  to: "1.1.0",
  migrate(doc) {
    return {
      ...doc,
      schemaVersion: "1.1.0",
      blocks: doc.blocks.map(/* transform */),
    };
  },
});
```

```ts
interface Migration {
  from: string;
  to: string;
  migrate(doc: EzynotaDocument): EzynotaDocument;
}
```

A `compareVersions(docVersionA, docVersionB)` helper implements semver comparison for graph traversal.

## When migration runs

- `editor.render(document)` — migrates before the document is installed, emits `change` with origin `"migration"`.
- Workspace load — each note's document is migrated lazily.
- Imports — parsed files pass through normalization + migration before display.

## Writing a migration safely

1. Migrations must be **pure** — same input, same output, no side effects.
2. Prefer `salvageDocument` semantics inside `migrate()` for per-block cleanup instead of throwing.
3. Never reuse ids across different blocks; generate new ones for duplicated nodes.
4. Bump `schemaVersion` in the returned document — the manager verifies the graph resolves to the target version.
