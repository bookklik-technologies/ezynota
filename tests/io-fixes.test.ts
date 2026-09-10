import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { markdownToBlocks, blocksToMarkdown } from "../src/io/markdown";
import { blocksToHtml } from "../src/io/export";
import { printDocument } from "../src/io/print";
import { parseImportFile } from "../src/io/import";
import { isSafeUrl, isSafeImageUrl } from "../src/core/url";
import { EzynotaError } from "../src/core/errors";
import type { EzynotaBlock } from "../src/types";

function block(type: string, data: Record<string, unknown>): EzynotaBlock {
  return { id: `b_${Math.random().toString(36).slice(2)}`, type, data } as EzynotaBlock;
}

describe("markdownToBlocks terminates on rejected-paragraph lines", () => {
  // Regression: a line matching the paragraph-rejection regex ("*", "-",
  // "+", "1.", "1)", "*a", "| x") with no other matching branch never
  // advanced `i` and hung the parser forever.
  const hangInputs = ["*", "-", "+", "1.", "1)", "*a", "| x"];

  for (const input of hangInputs) {
    it(`parses "${input}" as plain text without hanging`, () => {
      const blocks = markdownToBlocks(input);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.type).toBe("paragraph");
      const content = blocks[0]!.data as { content: { type: string; text: string }[] };
      expect(content.content.map((n) => n.text).join("")).toBe(input);
    });
  }

  it("still parses real lists, dividers and tables", () => {
    const blocks = markdownToBlocks("- a\n- b\n\n---\n\n| h1 | h2 |\n| --- | --- |\n| a | b |");
    expect(blocks.map((b) => b.type)).toEqual(["list", "delimiter", "table"]);
  });

  it("emits a table's first row as a body row when the separator is missing", () => {
    const blocks = markdownToBlocks("| a | b |\n| c | d |");
    const tables = blocks.filter((b) => b.type === "table");
    expect(tables).toHaveLength(1);
    const data = tables[0]!.data as { header: boolean; rows: { content: { text: string }[] }[][] };
    expect(data.header).toBe(false);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]!.map((c) => c.content[0]!.text)).toEqual(["a", "b"]);
    expect(data.rows[1]!.map((c) => c.content[0]!.text)).toEqual(["c", "d"]);
  });

  it("keeps header behavior when the separator is present", () => {
    const blocks = markdownToBlocks("| a | b |\n| --- | --- |\n| c | d |");
    const data = blocks[0]!.data as { header: boolean; rows: unknown[][] };
    expect(data.header).toBe(true);
    expect(data.rows).toHaveLength(2);
  });
});

describe("blocksToHtml callout variant is escaped and normalized", () => {
  it("does not emit a hostile variant into the data attribute", () => {
    const html = blocksToHtml([
      block("callout", { variant: `"><img src=x onerror=alert(1)>`, content: [{ type: "text", text: "hi" }] })
    ]);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('"><img');
    expect(html).toContain('data-ezn-variant="info"');
  });

  it("keeps known variants", () => {
    for (const variant of ["info", "warning", "success", "danger"]) {
      const html = blocksToHtml([block("callout", { variant, content: [] })]);
      expect(html).toContain(`data-ezn-variant="${variant}"`);
    }
  });
});

describe("blocksToHtml/blocksToMarkdown tolerate non-array items/rows", () => {
  it("does not throw on a list block whose items are not an array", () => {
    expect(() => blocksToHtml([block("list", { style: "unordered", items: "nope" })])).not.toThrow();
    expect(blocksToHtml([block("list", { style: "unordered", items: "nope" })])).toContain("<ul></ul>");
    expect(() => blocksToMarkdown([block("list", { style: "unordered", items: { length: 3 } })])).not.toThrow();
  });

  it("does not throw on a table block whose rows are not an array", () => {
    expect(() => blocksToHtml([block("table", { rows: { bad: true } })])).not.toThrow();
    expect(blocksToHtml([block("table", { rows: { bad: true } })])).toContain("<table");
    expect(() => blocksToMarkdown([block("table", { rows: 42 })])).not.toThrow();
  });
});

describe("data:text/html image sources are rejected", () => {
  const hostile = "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==";

  it("blocksToHtml drops the img", () => {
    const html = blocksToHtml([block("image", { src: hostile, alt: "x" })]);
    expect(html).not.toContain("src=");
    expect(html).not.toContain(hostile);
  });

  it("blocksToMarkdown drops the image", () => {
    const md = blocksToMarkdown([block("image", { src: hostile, alt: "x" })]);
    expect(md).not.toContain("![");
    expect(md).not.toContain(hostile);
  });

  it("isSafeImageUrl rejects it while png/svg data URLs pass", () => {
    expect(isSafeImageUrl(hostile)).toBe(false);
    expect(isSafeImageUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isSafeImageUrl("data:image/svg+xml;base64,AAAA")).toBe(true);
  });
});

describe("URL safety for protocol-relative inputs", () => {
  it("rejects protocol-relative URLs", () => {
    expect(isSafeUrl("//evil.com")).toBe(false);
    expect(isSafeUrl("/\\evil.com")).toBe(false);
    expect(isSafeUrl("\\/evil.com")).toBe(false);
  });

  it("keeps normal relative paths and fragments safe", () => {
    expect(isSafeUrl("/docs/page")).toBe(true);
    expect(isSafeUrl("/anything-else")).toBe(true);
    expect(isSafeUrl("./relative")).toBe(true);
    expect(isSafeUrl("../up")).toBe(true);
    expect(isSafeUrl("#section")).toBe(true);
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com/path?q=1")).toBe(true);
  });
});

describe("markdown href escaping", () => {
  it("escapes parens so a hostile href cannot truncate the link", () => {
    const md = blocksToMarkdown([
      block("paragraph", { content: [{ type: "link", href: "http://x.com/a)b", content: [{ type: "text", text: "L" }] }] })
    ]);
    expect(md).toBe("[L](http://x.com/a%29b)");
  });

  it("escapes spaces and newlines in hrefs", () => {
    const md = blocksToMarkdown([
      block("paragraph", { content: [{ type: "link", href: "http://x.com/a b", content: [{ type: "text", text: "L" }] }] })
    ]);
    expect(md).toBe("[L](http://x.com/a%20b)");
  });

  it("survives a round trip through the importer", () => {
    const md = blocksToMarkdown([
      block("paragraph", { content: [{ type: "link", href: "http://x.com/a)b c", content: [{ type: "text", text: "L" }] }] })
    ]);
    const blocks = markdownToBlocks(md);
    const paragraph = blocks[0]!.data as { content: { type: string; href: string }[] };
    expect(paragraph.content[0]!.type).toBe("link");
    expect(paragraph.content[0]!.href).toBe("http://x.com/a%29b%20c");
  });
});

describe("printDocument sanitization", () => {
  interface FakeWindow {
    document: Document;
    print: ReturnType<typeof vi.fn>;
  }
  let opened: FakeWindow[];
  let originalOpen: typeof window.open | undefined;

  beforeEach(() => {
    opened = [];
    originalOpen = window.open;
    (window as unknown as { open: unknown }).open = () => {
      const doc = document.implementation.createHTMLDocument("");
      const win = { document: doc, print: vi.fn(), focus: vi.fn() };
      opened.push(win as unknown as FakeWindow);
      return win as unknown as Window;
    };
  });

  afterEach(() => {
    if (originalOpen) window.open = originalOpen;
  });

  it("opens a window, writes content and prints", () => {
    printDocument({
      schemaVersion: "1.0.0",
      blocks: [block("paragraph", { content: [{ type: "text", text: "hello" }] })]
    } as never);
    expect(opened).toHaveLength(1);
    expect(opened[0]!.document.body!.textContent).toContain("hello");
    expect(opened[0]!.print).toHaveBeenCalledTimes(1);
  });

  it("does nothing when window.open is blocked", () => {
    (window as unknown as { open: unknown }).open = () => null;
    expect(() =>
      printDocument({ schemaVersion: "1.0.0", blocks: [block("paragraph", { content: [] })] } as never)
    ).not.toThrow();
  });

  it("strips style attributes and unsafe image sources", () => {
    printDocument({
      schemaVersion: "1.0.0",
      blocks: [
        block("paragraph", {
          content: [{ type: "text", text: "styled", marks: [{ type: "color", attrs: { color: "red" } }] }]
        }),
        block("image", { src: "data:text/html,<script>alert(1)</script>", alt: "bad" }),
        block("image", { src: "data:image/png;base64,AAAA", alt: "good" })
      ]
    } as never);
    const body = opened[0]!.document.body!;
    expect(body.querySelectorAll("[style]")).toHaveLength(0);
    expect(body.querySelectorAll("script")).toHaveLength(0);
    // hostile image removed, safe image kept
    const imgs = Array.from(body.querySelectorAll("img"));
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("src")).toBe("data:image/png;base64,AAAA");
  });
});

describe("parseImportFile size cap", () => {
  it("rejects files larger than the import limit", async () => {
    const file = new File(["x"], "big.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    await expect(parseImportFile(file)).rejects.toMatchObject({
      code: "EZ_IMPORT_FAILED" satisfies EzynotaError["code"]
    });
  });

  it("still imports small files", async () => {
    const doc = { schemaVersion: "1.0.0", blocks: [] };
    const file = new File([JSON.stringify(doc)], "doc.json", { type: "application/json" });
    const parsed = await parseImportFile(file);
    expect(parsed.format).toBe("json");
    expect(parsed.result.kind).toBe("document");
  });
});

describe("declarative initialization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("initAll does not throw on a body-less document with readyState loading", async () => {
    const mod = await import("../src/init/declarative");
    const registry = await import("../src/init/registry");
    const docAny = document as unknown as Record<string, unknown>;
    const rsOwn = Object.getOwnPropertyDescriptor(docAny, "readyState");
    const rsProto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "readyState");
    const bodyOwn = Object.getOwnPropertyDescriptor(docAny, "body");
    const bodyProto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "body");
    Object.defineProperty(docAny, "readyState", { configurable: true, value: "loading" });
    Object.defineProperty(docAny, "body", { configurable: true, get: () => null });
    try {
      expect(() => mod.initAll()).not.toThrow();
      expect(registry.listInstances()).toHaveLength(0);
    } finally {
      delete docAny.readyState;
      delete docAny.body;
      if (rsOwn) Object.defineProperty(docAny, "readyState", rsOwn);
      else if (rsProto) Object.defineProperty(Object.getPrototypeOf(document), "readyState", rsProto);
      if (bodyOwn) Object.defineProperty(docAny, "body", bodyOwn);
      else if (bodyProto) Object.defineProperty(Object.getPrototypeOf(document), "body", bodyProto);
    }
  });

  it("flags the element only after successful construction", async () => {
    const mod = await import("../src/init/declarative");
    const element = document.createElement("div");
    element.setAttribute("data-ezn-editor", "");
    document.body.appendChild(element);
    const instance = mod.mountElement(element);
    expect(instance).toBeDefined();
    expect(element.hasAttribute("data-ezn-mounted")).toBe(true);
    // Second mount attempt is skipped (flag present).
    expect(mod.mountElement(element)).toBeUndefined();
    instance!.destroy();
  });

  it("a detached declarative editor is cleaned up and remounts afterwards", async () => {
    vi.useRealTimers();
    const mod = await import("../src/init/declarative");
    const element = document.createElement("div");
    element.setAttribute("data-ezn-editor", "");
    document.body.appendChild(element);

    const first = mod.initAll();
    expect(first).toHaveLength(1);
    expect(element.hasAttribute("data-ezn-mounted")).toBe(true);

    // Detach and wait past the 200ms cleanup timer + 100ms double-check.
    element.remove();
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(first[0]!.isDestroyed()).toBe(true);
    // Both flags cleared so the element is mountable again.
    expect(element.hasAttribute("data-ezn-destroyed")).toBe(false);
    expect(element.hasAttribute("data-ezn-mounted")).toBe(false);

    document.body.appendChild(element);
    const second = mod.initAll();
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first[0]);
    expect(element.hasAttribute("data-ezn-mounted")).toBe(true);
    second[0]!.destroy();
  });
});
