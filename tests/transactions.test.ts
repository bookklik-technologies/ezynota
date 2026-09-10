import { describe, it, expect } from "vitest";
import { TransactionManager } from "../src/core/transaction-manager";
import { DocumentState } from "../src/core/document-state";
import type { ChangeBatch, EzynotaChange } from "../src/core/types";

const doc = () => ({
  schemaVersion: "1.0.0",
  blocks: [
    { id: "a", type: "paragraph", data: { content: [{ type: "text", text: "one" }] } },
    { id: "b", type: "paragraph", data: { content: [{ type: "text", text: "two" }] } }
  ]
});

function setup() {
  const batches: ChangeBatch[] = [];
  const state = new DocumentState(doc(), () => "new");
  const tm = new TransactionManager(state, (batch) => batches.push(batch));
  return { state, tm, batches };
}

describe("TransactionManager", () => {
  it("commits block:insert and emits a change batch", () => {
    const { state, tm, batches } = setup();
    const block = { id: "c", type: "code", data: { code: "x" } };
    const result = tm.commit("user", [{ type: "block:insert", block, index: 1 }]);
    expect(result.changed).toBe(true);
    expect(state.get().blocks.map((b) => b.id)).toEqual(["a", "c", "b"]);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.origin).toBe("user");
    expect(batches[0]?.changes[0]?.type).toBe("block:insert");
  });

  it("commits block:update storing previous and current", () => {
    const { tm, batches } = setup();
    tm.commit("api", [
      { type: "block:update", id: "a", previous: { content: [{ type: "text", text: "one" }] }, current: { content: [] } }
    ]);
    expect(batches[0]?.changes[0]).toMatchObject({ type: "block:update", id: "a" });
  });

  it("inverts insert into remove", () => {
    const { state, tm } = setup();
    const changes: EzynotaChange[] = [{ type: "block:insert", block: { id: "c", type: "code", data: {} }, index: 0 }];
    tm.commit("user", changes);
    const inverse = tm.invert(changes);
    tm.commit("history", inverse);
    expect(state.get().blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("inverts remove into insert preserving data", () => {
    const { state, tm } = setup();
    const removed = doc().blocks[1]!;
    tm.commit("user", [{ type: "block:remove", id: "b", index: 1, block: removed }]);
    expect(state.get().blocks).toHaveLength(1);
    const inverse = tm.invert([{ type: "block:remove", id: "b", index: 1, block: removed }]);
    tm.commit("history", inverse);
    expect(state.get().blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("inverts update using previous payload", () => {
    const { state, tm } = setup();
    const previous = doc().blocks[0]!.data;
    const current = { content: [] };
    const changes: EzynotaChange[] = [{ type: "block:update", id: "a", previous, current }];
    tm.commit("user", changes);
    tm.commit("history", tm.invert(changes));
    expect(state.get().blocks[0]?.data).toEqual(previous);
  });

  it("inverts move", () => {
    const { state, tm } = setup();
    const changes: EzynotaChange[] = [{ type: "block:move", id: "a", from: 0, to: 2 }];
    tm.commit("user", changes);
    expect(state.get().blocks.map((b) => b.id)).toEqual(["b", "a"]);
    tm.commit("history", tm.invert(changes));
    expect(state.get().blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("handles tune:update and inversion", () => {
    const { state, tm } = setup();
    const changes: EzynotaChange[] = [
      { type: "tune:update", id: "a", tune: "alignment", previous: null, value: "center" }
    ];
    tm.commit("user", changes);
    expect((state.get().blocks[0] as { tunes?: Record<string, unknown> }).tunes?.alignment).toBe("center");
    tm.commit("history", tm.invert(changes));
    expect((state.get().blocks[0] as { tunes?: Record<string, unknown> }).tunes?.alignment).toBeNull();
  });

  it("skips committing empty change lists", () => {
    const { tm, batches } = setup();
    const result = tm.commit("user", []);
    expect(result.changed).toBe(false);
    expect(batches).toHaveLength(0);
  });
});
