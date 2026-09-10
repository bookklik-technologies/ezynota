import type { EzynotaDocument } from "./types";
import { EzynotaError } from "./errors";

export interface Migration {
  from: string;
  to: string;
  migrate(document: EzynotaDocument): EzynotaDocument;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * MigrationManager: deterministic, ordered, DOM-free, offline migrations
 * (spec §34). Unknown data is preserved by each migration's responsibility.
 */
export class MigrationManager {
  private migrations: Migration[] = [];

  register(migration: Migration): void {
    if (this.migrations.some((m) => m.from === migration.from && m.to === migration.to)) return;
    this.migrations.push(migration);
    this.migrations.sort((a, b) => compareVersions(a.from, b.from) || compareVersions(a.to, b.to));
  }

  canMigrate(from: string, to: string): boolean {
    try {
      this.buildPath(from, to);
      return true;
    } catch {
      return false;
    }
  }

  migrate(document: EzynotaDocument, to: string): EzynotaDocument {
    if (document.schemaVersion === to) return document;
    const path = this.buildPath(document.schemaVersion, to);
    let doc = document;
    for (const migration of path) {
      try {
        doc = migration.migrate(doc);
        doc.schemaVersion = migration.to;
      } catch (err) {
        throw new EzynotaError("EZ_MIGRATION_FAILED", `Migration ${migration.from} -> ${migration.to} failed`, { from: migration.from, to: migration.to }, err);
      }
    }
    return doc;
  }

  list(): Migration[] {
    return this.migrations.slice();
  }

  private buildPath(from: string, to: string): Migration[] {
    if (compareVersions(from, to) >= 0) return [];
    // Simple BFS over the migration graph.
    const queue: { version: string; path: Migration[] }[] = [{ version: from, path: [] }];
    const visited = new Set<string>([from]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const m of this.migrations) {
        if (m.from !== current.version || visited.has(m.to)) continue;
        const path = [...current.path, m];
        if (compareVersions(m.to, to) === 0) return path;
        if (compareVersions(m.to, to) < 0) {
          visited.add(m.to);
          queue.push({ version: m.to, path });
        }
      }
    }
    throw new EzynotaError("EZ_MIGRATION_FAILED", `No migration path from "${from}" to "${to}"`, { from, to });
  }
}
