import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { it, expect } from "vitest";

it("UMD bundle loads and the playground flow works end-to-end", async () => {
  const window = new Window({ url: "http://localhost/examples/index.html" });
  const document = window.document;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = window;
  globals.document = document;
  globals.navigator = window.navigator;
  globals.Element = window.Element;
  globals.Node = window.Node;
  globals.localStorage = window.localStorage;

  document.body.innerHTML = `<div id="editor"></div>`;

  // Load the real UMD bundle the same way the playground does: via <script>.
  const bundle = readFileSync(resolve(__dirname, "../dist/ezynota.umd.cjs"), "utf8");
  const script = document.createElement("script");
  script.textContent = bundle;
  document.head.appendChild(script);

  const Ezynota = (window as unknown as Record<string, unknown>).Ezynota as {
    Ezynota: new (config: unknown) => {
      save(): Promise<{ blocks: { id: string; type: string; data: unknown }[] }>;
      render(doc: unknown): Promise<void>;
      insertBlock(type: string, data: unknown): string;
      undo(): void;
      redo(): void;
      canUndo(): boolean;
      getSnapshot(): { blocks: unknown[] };
      setReadOnly(value: boolean): void;
      destroy(): void;
    };
  };
  expect(typeof Ezynota.Ezynota).toBe("function");

  const Editor = Ezynota.Ezynota;
  const initial = {
    schemaVersion: "1.0.0",
    blocks: [
      { id: "demo-1", type: "heading", data: { level: 2, content: [{ type: "text", text: "Welcome to Ezynota" }] } },
      { id: "demo-2", type: "paragraph", data: { content: [
        { type: "text", text: "This is a " },
        { type: "text", text: "block-based editor", marks: [{ type: "bold" }] }
      ] } },
      { id: "demo-3", type: "list", data: { style: "unordered", items: [
        { content: [{ type: "text", text: "Item one" }] },
        { content: [{ type: "text", text: "Item two" }] }
      ] } },
      { id: "demo-4", type: "delimiter", data: {} },
      { id: "demo-5", type: "quote", data: { content: [{ type: "text", text: "Quote" }] } },
      { id: "demo-6", type: "code", data: { code: "const x = 1;" } }
    ]
  };

  const editor = new Editor({
    target: document.getElementById("editor"),
    mode: "embedded",
    data: initial,
    placeholder: "Start writing...",
    autofocus: false,
    onChange() {}
  });

  // Blocks rendered
  expect(document.querySelectorAll(".ez-block")).toHaveLength(6);

  // save() round-trip
  const saved = await editor.save();
  expect(saved.blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "delimiter", "quote", "code"]);
  expect((saved.blocks[1]!.data as { content: { text: string; marks?: unknown[] }[] }).content[1]!.marks).toEqual([{ type: "bold" }]);

  // re-render from saved
  await editor.render(saved);
  const resaved = await editor.save();
  expect(resaved.blocks.map((b) => b.id)).toEqual(saved.blocks.map((b) => b.id));

  // CRUD + undo/redo
  editor.insertBlock("paragraph", { content: [{ type: "text", text: "new" }] });
  editor.undo();
  expect(editor.getSnapshot().blocks).toHaveLength(6);
  editor.redo();
  expect(editor.getSnapshot().blocks).toHaveLength(7);

  // readOnly toggle
  editor.setReadOnly(true);
  expect(document.getElementById("editor")!.classList.contains("ez-readonly")).toBe(true);
  editor.setReadOnly(false);

  // destroy cleans up
  editor.destroy();
  expect(document.getElementById("editor")!.querySelector(".ez-blocks")).toBeNull();
});
