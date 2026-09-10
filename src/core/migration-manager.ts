import type { EzynotaDocument } from "./types";
import { EzynotaError } from "./errors";

export interface Migration {
  from: string;
  to: string;
  migrate(document: EzynotaDocument): EzynotaDocument;
}

/** Split a semver string into numeric core parts and an optional prerelease. */
function splitVersion(v: string): { core: number[]; pre: string | null } {
  const dash = v.indexOf("-");
  const corePart = dash >= 0 ? v.slice(0, dash) : v;
  const pre = dash >= 0 ? v.slice(dash + 1) : null;
  const core = corePart.split(".").map((n) => parseInt(n, 10) || 0);
  while (core.length < 3) core.push(0);
  return { core: core.slice(0, 3), pre };
}

function comparePrerelease(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x) ? parseInt(x, 10) : null;
    const ny = /^\d+$/.test(y) ? parseInt(y, 10) : null;
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx - ny;
    } else if (nx !== null) {
      return -1; // numeric identifiers sort below alphanumeric ones
    } else if (ny !== null) {
      return 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export function compareVersions(a: string, b: string): number {
  const pa = splitVersion(a);
  const pb = splitVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i]! - pb.core[i]!;
  }
  // A prerelease sorts below the corresponding release.
  if (pa.pre === null && pb.pre === null) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return comparePrerelease(pa.pre, pb.pre);
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
    // Refuse to downgrade: the source is strictly newer than the target.
    if (compareVersions(document.schemaVersion, to) > 0) {
      throw new EzynotaError(
        "EZ_MIGRATION_FAILED",
        `Cannot migrate from newer schema version "${document.schemaVersion}" to "${to}"`,
        { from: document.schemaVersion, to }
      );
    }
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
    doc.schemaVersion = to;
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
