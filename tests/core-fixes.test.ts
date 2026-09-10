import { describe, it, expect } from "vitest";
import { normalizeDocument, normalizeBlock, salvageDocument, MAX_JSON_DEPTH, SCHEMA_VERSION } from "../src/core/schema";
import { EzynotaError } from "../src/core/errors";
import { DocumentState } from "../src/core/document-state";
import { TransactionManager } from "../src/core/transaction-manager";
import { BlockManager } from "../src/core/block-manager";
import { HistoryManager } from "../src/core/history";
import { MigrationManager, compareVersions } from "../src/core/migration-manager";
import type { ChangeBatch, EditorSelection, EzynotaBlock, EzynotaChange, EzynotaDocument, JsonValue } from "../src/core/types";

const gen = () => "generated-id";

function paragraph(text: string, id?: string): EzynotaBlock {
  const block: EzynotaBlock = { id: id ?? `blk_${text}`, type: "paragraph", data: { content: [{ type: "text", text }] } };
  return block;
}

function setupState(blocks: EzynotaBlock[]) {
  const batches: ChangeBatch[] = [];
  const state = new DocumentState({ schemaVersion: "1.0.0", blocks } as EzynotaDocument, gen);
  const tm = new TransactionManager(state, (batch) => batches.push(batch));
  return { state, tm, batches };
}

describe("salvageDocument", () => {
  it("drops invalid blocks, keeps valid ones and reports them", () => {
    const result = salvageDocument({
      schemaVersion: "1.0.0",
      blocks: [
        { id: "ok1", type: "paragraph", data: { content: [{ type: "text", text: "keep" }] } },
        { id: "bad", type: "paragraph" }, // missing data
        { type: "code", data: { code: "x" } }
      ]
    });
    expect(result.document).not.toBeNull();
    expect(result.salvaged).toBe(true);
    expect(result.dropped).toEqual(["bad"]);
    const doc = result.document!;
    expect(doc.blocks.map((b) => b.id)).toEqual(["ok1", "bad", "ez_salvaged_1"]);
    expect(doc.blocks[0]!.data).toEqual({ content: [{ type: "text", text: "keep" }] });
    expect(doc.blocks[1]!.type).toBe("unknown");
    expect((doc.blocks[1]!.data as { raw: unknown }).raw).toEqual({ id: "bad", type: "paragraph" });
  });

  it("renames duplicate ids deterministically (first wins)", () => {
    const result = salvageDocument({
      blocks: [
        { id: "dup", type: "paragraph", data: {} },
        { id: "dup", type: "code", data: {} },
        { id: "dup", type: "quote", data: {} }
      ]
    });
    expect(result.document!.blocks.map((b) => b.id)).toEqual(["dup", "dup_2", "dup_3"]);
    expect(result.salvaged).toBe(true);
  });

  it("never throws on unusable envelopes", () => {
    expect(salvageDocument("nope").document).toBeNull();
    expect(salvageDocument(42).document).toBeNull();
    expect(salvageDocument({}).document).toBeNull();
    expect(salvageDocument({ blocks: "no" }).document).toBeNull();
    expect(salvageDocument(null).document).not.toBeNull();
  });

  it("respects the depth cap without a RangeError", () => {
    let deep: JsonValue = "leaf";
    for (let i = 0; i < MAX_JSON_DEPTH + 50; i++) deep = { nested: deep };
    const result = salvageDocument({ blocks: [{ id: "deep", type: "paragraph", data: deep }] });
    expect(result.salvaged).toBe(true);
    expect(result.document!.blocks.every((b) => b.type === "unknown" || b.type === "paragraph")).toBe(true);
  });
});

describe("migration downgrade + versions", () => {
  it("compareVersions handles prerelease suffixes numerically", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0-rc.2")).toBeLessThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0-rc.1")).toBe(0);
    expect(compareVersions("1.0.0-rc.2", "1.0.1-rc.1")).toBeLessThan(0);
    expect(compareVersions("0.9.0", "1.0.0")).toBeLessThan(0);
  });

  it("migrate() throws EZ_MIGRATION_FAILED on downgrade", () => {
    const migrations = new MigrationManager();
    expect(() => migrations.migrate({ schemaVersion: "2.0.0", blocks: [] }, "1.0.0")).toThrow(EzynotaError);
    try {
      migrations.migrate({ schemaVersion: "2.0.0", blocks: [] }, "1.0.0");
    } catch (err) {
      expect((err as EzynotaError).code).toBe("EZ_MIGRATION_FAILED");
    }
  });

  it("migrate() is lenient for equal versions and sets schemaVersion explicitly", () => {
    const migrations = new MigrationManager();
    migrations.register({ from: "0.9.0", to: "1.0.0", migrate: (d) => d });
    const equal = migrations.migrate({ schemaVersion: "1.0.0", blocks: [] }, "1.0.0");
    expect(equal.schemaVersion).toBe("1.0.0");
    const migrated = migrations.migrate({ schemaVersion: "0.9.0", blocks: [] }, "1.0.0");
    expect(migrated.schemaVersion).toBe("1.0.0");
    expect(migrations.canMigrate("1.0.0", "1.0.0")).toBe(true);
  });
});

describe("history coalescing", () => {
  function makeHistory() {
    const { state, tm } = setupState([paragraph("one", "a")]);
    const history = new HistoryManager(tm);
    return { state, tm, history };
  }

  it("caps a coalesced group so entries stop growing (50 changes max)", () => {
    const { history, state } = makeHistory();
    const previous = state.get().blocks[0]!.data;
    const current: JsonValue = { content: [{ type: "text", text: "two" }] };
    for (let i = 0; i < 120; i++) {
      history.record(
        { origin: "user", changes: [{ type: "block:update", id: "a", previous, current }], timestamp: 1000 + i * 10 }
      );
    }
    const entries = history.exportState().undo;
    expect(entries.length).toBe(Math.ceil(120 / 50));
    for (const entry of entries) expect(entry.changes.length).toBeLessThanOrEqual(50);
  });

  it("coalesces title:update keystrokes into one entry", () => {
    const { history } = makeHistory();
    for (let i = 0; i < 5; i++) {
      history.record(
        { origin: "user", changes: [{ type: "title:update", previous: `t${i}`, current: `t${i + 1}` }], timestamp: 1000 + i * 100 }
      );
    }
    const entries = history.exportState().undo;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.changes).toHaveLength(5);
    history.undo();
    expect(history.canUndo()).toBe(false);
  });

  it("does not coalesce title edits with block edits", () => {
    const { history } = makeHistory();
    const data: JsonValue = { content: [] };
    history.record({ origin: "user", changes: [{ type: "block:update", id: "a", previous: data, current: data }], timestamp: 1000 });
    history.record({ origin: "user", changes: [{ type: "title:update", previous: "a", current: "b" }], timestamp: 1050 });
    expect(history.exportState().undo).toHaveLength(2);
  });

  it("redo restores the post-change selection, undo the pre-change one", () => {
    const { state, tm } = setupState([paragraph("one", "a")]);
    const restored: Array<EditorSelection | null> = [];
    const history = new HistoryManager(tm, {
      onRestoreSelection: (selection) => restored.push(selection),
      onCaptureSelection: () => ({ blockId: "post", index: 0, collapsed: true, anchorOffset: 7, focusOffset: 7 })
    });
    const before: EditorSelection = { blockId: "pre", index: 0, collapsed: true, anchorOffset: 1, focusOffset: 1 };
    const previous = state.get().blocks[0]!.data;
    const current: JsonValue = { content: [{ type: "text", text: "two" }] };
    history.record(
      { origin: "user", changes: [{ type: "block:update", id: "a", previous, current }], timestamp: 1000 },
      before
    );
    history.undo();
    expect(restored[0]!.blockId).toBe("pre");
    history.redo();
    expect(restored[1]!.blockId).toBe("post");
  });
});

describe("transaction rollback", () => {
  it("rolls back the whole batch when a change throws mid-application", () => {
    const { state, tm, batches } = setupState([paragraph("one", "a"), paragraph("two", "b")]);
    const before = JSON.parse(JSON.stringify(state.get().blocks)) as EzynotaBlock[];
    const versionBefore = state.getVersion();
    const goodUpdate: EzynotaChange = { type: "block:update", id: "a", previous: before[0]!.data, current: { content: [] } };
    const bogus = { type: "no-such-change" } as unknown as EzynotaChange;
    expect(() => tm.commit("api", [goodUpdate, bogus])).toThrow(EzynotaError);
    expect(state.get().blocks[0]!.data).toEqual(before[0]!.data);
    expect(state.get().blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(state.getVersion()).toBe(versionBefore);
    expect(batches).toHaveLength(0);
  });

  it("guards prototype-pollution tune keys", () => {
    const { state, tm } = setupState([paragraph("one", "a")]);
    const hostile = { type: "tune:update", id: "a", tune: "__proto__", previous: null, value: { polluted: true } } as unknown as EzynotaChange;
    expect(() => tm.commit("api", [hostile])).not.toThrow();
    expect((state.get().blocks[0] as { tunes?: Record<string, unknown> }).tunes).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("meta sanitization in normalizeDocument", () => {
  it("strips hostile meta keys and clones the meta object", () => {
    const evil = JSON.parse('{"blocks":[],"meta":{"__proto__":{"x":1},"constructor":"evil","title":"hi"}}');
    const doc = normalizeDocument(evil, gen);
    expect(doc.meta).toEqual({ title: "hi" });

    const metaInput: { title: string } = { title: "original" };
    const doc2 = normalizeDocument({ blocks: [], meta: metaInput }, gen);
    expect(doc2.meta).not.toBe(metaInput);
    metaInput.title = "mutated";
    expect(doc2.meta!.title).toBe("original");
  });
});

describe("unknown block fields are preserved", () => {
  it("keeps unknown JSON-safe top-level fields through normalizeBlock", () => {
    const block = normalizeBlock({ type: "paragraph", data: {}, customField: { b: 2, a: 1 } }, gen);
    expect((block as unknown as Record<string, unknown>).customField).toEqual({ b: 2, a: 1 });
  });

  it("still drops hostile keys and non-JSON unknown fields", () => {
    const evil = JSON.parse('{"type":"paragraph","data":{},"__proto__":{"x":1}}');
    const block = normalizeBlock(evil, gen);
    expect(({} as { x?: boolean }).x).toBeUndefined();
    expect(Object.keys(block)).not.toContain("__proto__");
    const dropped = normalizeBlock({ type: "paragraph", data: {}, fn: () => "nope" }, gen);
    expect((dropped as unknown as Record<string, unknown>).fn).toBeUndefined();
  });
});

describe("depth cap", () => {
  it("rejects over-deep block data with EZ_INVALID_DOCUMENT, not a RangeError", () => {
    let deep: JsonValue = "leaf";
    for (let i = 0; i < MAX_JSON_DEPTH + 50; i++) deep = { nested: deep };
    try {
      normalizeBlock({ type: "paragraph", data: deep }, gen);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EzynotaError);
      expect((err as EzynotaError).code).toBe("EZ_INVALID_DOCUMENT");
    }
  });

  it("rejects over-deep nested children with EZ_INVALID_DOCUMENT", () => {
    let block: Record<string, unknown> = { type: "paragraph", data: {} };
    for (let i = 0; i < MAX_JSON_DEPTH + 10; i++) block = { type: "paragraph", data: {}, children: [block] };
    expect(() => normalizeDocument({ blocks: [block] }, gen)).toThrow(EzynotaError);
    try {
      normalizeDocument({ blocks: [block] }, gen);
      expect.unreachable();
    } catch (err) {
      expect((err as EzynotaError).code).toBe("EZ_INVALID_DOCUMENT");
    }
  });
});

describe("unsafe hrefs are stripped during normalize", () => {
  it("replaces unsafe link nodes with their inner text", () => {
    const block = normalizeBlock(
      {
        type: "paragraph",
        data: {
          content: [
            { type: "link", href: "javascript:alert(1)", content: [{ type: "text", text: "click" }] },
            { type: "text", text: " after" }
          ]
        }
      },
      gen
    );
    const content = (block.data as { content: Array<{ type: string; text?: string }> }).content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "click" });
  });

  it("strips link marks with unsafe hrefs but keeps safe links", () => {
    const block = normalizeBlock(
      {
        type: "paragraph",
        data: {
          content: [
            { type: "text", text: "bad", marks: [{ type: "link", attrs: { href: "data:text/html,evil" } }] },
            { type: "link", href: "https://example.com", content: [{ type: "text", text: "ok" }] }
          ]
        }
      },
      gen
    );
    const content = block.data as { content: Array<{ type: string; href?: string; marks?: unknown[] }> };
    expect(content.content[0]!.marks).toEqual([]);
    expect(content.content[1]!.href).toBe("https://example.com");
  });
});

describe("block-manager fixes", () => {
  it("regenerates a colliding withId", () => {
    const { tm, batches } = setupState([paragraph("one", "a")]);
    const bm = new BlockManager(tm, () => "fresh", { onBatch: () => {} });
    const id = bm.insert("paragraph", { content: [] }, "api", -1, { withId: "a" });
    expect(id).toBe("a_2");
    expect(tm.getDocument().blocks.map((b) => b.id)).toEqual(["a", "a_2"]);
    expect(batches).toHaveLength(1);
  });

  it("keeps non-colliding withId as-is", () => {
    const { tm } = setupState([paragraph("one", "a")]);
    const bm = new BlockManager(tm, () => "fresh", { onBatch: () => {} });
    expect(bm.insert("paragraph", { content: [] }, "api", -1, { withId: "b" })).toBe("b");
  });

  it("move with an unknown before/after anchor is a no-op", () => {
    const { tm, batches } = setupState([paragraph("one", "a"), paragraph("two", "b")]);
    const bm = new BlockManager(tm, gen, { onBatch: () => {} });
    bm.move("a", { before: "missing" });
    bm.move("a", { after: "missing" });
    expect(tm.getDocument().blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(batches).toHaveLength(0);
  });

  it("update() treats key-order-equal data as unchanged", () => {
    const { state, tm, batches } = setupState([paragraph("one", "a")]);
    const bm = new BlockManager(tm, gen, { onBatch: () => {} });
    const versionBefore = state.getVersion();
    // Same data, keys in a different order → no commit.
    bm.update("a", { content: [{ type: "text", text: "one" }] } as JsonValue);
    bm.update("a", { content: [] });
    expect(state.getVersion()).toBe(versionBefore + 1);
    expect(batches).toHaveLength(1);
  });
});

describe("nested children duplicate ids are renumbered", () => {
  it("keeps first occurrences and renumbers nested duplicates deterministically", () => {
    const doc = normalizeDocument(
      {
        blocks: [
          {
            id: "root",
            type: "paragraph",
            data: {},
            children: [
              { id: "root", type: "paragraph", data: {} },
              { id: "child", type: "paragraph", data: {} },
              { id: "child", type: "paragraph", data: {} }
            ]
          },
          { id: "other", type: "paragraph", data: {} }
        ]
      },
      gen
    );
    const all: string[] = [];
    const collect = (blocks: EzynotaBlock[]): void => {
      for (const b of blocks) {
        all.push(b.id);
        if (b.children) collect(b.children);
      }
    };
    collect(doc.blocks);
    expect(new Set(all).size).toBe(all.length);
    const root = doc.blocks[0]!;
    expect(root.children!.map((c) => c.id)).toEqual(["root_2", "child", "child_2"]);
    expect(doc.blocks[1]!.id).toBe("other");
  });
});

describe("schema version default", () => {
  it("keeps SCHEMA_VERSION for docs without one", () => {
    const doc = normalizeDocument({ blocks: [] }, gen);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
