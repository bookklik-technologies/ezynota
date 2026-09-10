import { describe, it, expect } from "vitest";
import { MigrationManager } from "../src/core/migration-manager";
import { Ezynota } from "../src/editor";
import type { EzynotaDocument } from "../src/core/types";

describe("MigrationManager", () => {
  it("builds and executes a migration path", () => {
    const migrations = new MigrationManager();
    migrations.register({
      from: "0.9.0",
      to: "1.0.0",
      migrate(doc) {
        return { ...doc, meta: { migrated: true } };
      }
    });
    expect(migrations.canMigrate("0.9.0", "1.0.0")).toBe(true);
    expect(migrations.canMigrate("1.0.0", "1.0.0")).toBe(true);
    expect(migrations.canMigrate("1.0.0", "0.9.0")).toBe(true); // downgrade = no-op path
    const result = migrations.migrate({ schemaVersion: "0.9.0", blocks: [] }, "1.0.0");
    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.meta).toEqual({ migrated: true });
  });

  it("chains multi-step migrations in order", () => {
    const migrations = new MigrationManager();
    migrations.register({ from: "0.8.0", to: "0.9.0", migrate: (d) => d });
    migrations.register({ from: "0.9.0", to: "1.0.0", migrate: (d) => d });
    const result = migrations.migrate({ schemaVersion: "0.8.0", blocks: [] }, "1.0.0");
    expect(result.schemaVersion).toBe("1.0.0");
  });

  it("throws EZ_MIGRATION_FAILED for unknown paths", () => {
    const migrations = new MigrationManager();
    expect(() => migrations.migrate({ schemaVersion: "0.1.0", blocks: [] }, "1.0.0")).toThrow(/No migration path/);
  });
});

describe("Editor-level migration", () => {
  it("keeps documents with unknown schema instead of destroying data", () => {
    const holder = document.createElement("div");
    const editor = new Ezynota({
      holder,
      mode: "embedded",
      data: { schemaVersion: "9.9.9", blocks: [{ id: "x", type: "paragraph", data: { content: [] } }] } as unknown as EzynotaDocument
    });
    const snapshot = editor.getSnapshot();
    expect(snapshot.blocks[0]?.id).toBe("x");
    editor.destroy();
  });
});
