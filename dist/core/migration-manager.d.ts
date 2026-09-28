import type { EzynotaDocument } from "./types";
export interface Migration {
    from: string;
    to: string;
    migrate(document: EzynotaDocument): EzynotaDocument;
}
export declare function compareVersions(a: string, b: string): number;
/**
 * MigrationManager: deterministic, ordered, DOM-free, offline migrations
 * (spec §34). Unknown data is preserved by each migration's responsibility.
 */
export declare class MigrationManager {
    private migrations;
    register(migration: Migration): void;
    canMigrate(from: string, to: string): boolean;
    migrate(document: EzynotaDocument, to: string): EzynotaDocument;
    list(): Migration[];
    private buildPath;
}
