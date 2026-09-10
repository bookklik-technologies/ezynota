import { describe, it, expect } from "vitest";
import { normalizeDocument, normalizeBlock, SCHEMA_VERSION, GENERATOR_VERSION } from "../src/core/schema";
import { EzynotaError } from "../src/core/errors";

const idGen = () => "generated-id";

describe("normalizeDocument", () => {
  it("creates an empty document from null", () => {
    const doc = normalizeDocument(null, idGen);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.blocks).toEqual([]);
    expect(doc.generator).toEqual({ name: "ezynota", version: GENERATOR_VERSION });
    expect(doc.createdAt).toBeGreaterThan(0);
  });

  it("normalizes valid blocks and preserves ids/data", () => {
    const doc = normalizeDocument(
      {
        schemaVersion: "1.0.0",
        blocks: [
          { id: "blk_1", type: "paragraph", data: { content: [{ type: "text", text: "hello" }] } },
          { id: "blk_2", type: "code", data: { code: "x = 1" } }
        ]
      },
      idGen
    );
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0]).toMatchObject({ id: "blk_1", type: "paragraph" });
    expect(doc.blocks[1]).toMatchObject({ id: "blk_2", type: "code", data: { code: "x = 1" } });
  });

  it("generates ids for missing ids", () => {
    const doc = normalizeDocument({ blocks: [{ type: "paragraph", data: {} }] }, idGen);
    expect(doc.blocks[0]?.id).toBe("generated-id");
  });

  it("throws EZ_INVALID_DOCUMENT for non-object input", () => {
    expect(() => normalizeDocument("nope", idGen)).toThrow(EzynotaError);
    expect(() => normalizeDocument(42, idGen)).toThrow(EzynotaError);
  });

  it("throws EZ_INVALID_DOCUMENT when blocks is missing", () => {
    expect(() => normalizeDocument({}, idGen)).toThrow(EzynotaError);
    expect(() => normalizeDocument({ blocks: "no" }, idGen)).toThrow(EzynotaError);
  });

  it("throws on duplicate block ids", () => {
    expect(() =>
      normalizeDocument({ blocks: [{ id: "a", type: "paragraph", data: {} }, { id: "a", type: "code", data: {} }] }, idGen)
    ).toThrow(/duplicate block id/);
  });

  it("rejects non-JSON data (prototype pollution attempt)", () => {
    const evil = JSON.parse('{"blocks":[{"type":"paragraph","data":{"__proto__":{"polluted":true}}}]}');
    const doc = normalizeDocument(evil, idGen);
    // __proto__ is dropped by JSON.parse normalization (data must be JSON-safe)
    expect(JSON.stringify(doc.blocks[0]?.data)).not.toContain("polluted");
  });

  it("rejects blocks with function-like values", () => {
    const bad = { blocks: [{ type: "paragraph", data: { fn: () => {} } }] };
    expect(() => normalizeDocument(bad, idGen)).toThrow(EzynotaError);
  });
});

describe("normalizeBlock", () => {
  it("requires type and data", () => {
    expect(() => normalizeBlock({}, idGen)).toThrow(EzynotaError);
    expect(() => normalizeBlock({ type: "paragraph" }, idGen)).toThrow(EzynotaError);
    expect(() => normalizeBlock({ type: "paragraph", data: undefined }, idGen)).toThrow(EzynotaError);
  });

  it("keeps tunes and meta when valid", () => {
    const block = normalizeBlock(
      { type: "paragraph", data: {}, tunes: { alignment: "center" }, meta: { createdAt: 5 } },
      idGen
    );
    expect(block.tunes).toEqual({ alignment: "center" });
    expect(block.meta).toEqual({ createdAt: 5 });
  });
});
