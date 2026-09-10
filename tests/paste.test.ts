import { describe, it, expect, beforeEach } from "vitest";
import { htmlToBlocks, textToBlocks } from "../src/input/html-to-blocks";
import { inlineToPlainText, type InlineContent } from "../src/rich-text/types";

beforeEach(() => {
  // happy-dom evaluates parsed <script> content; stub to keep tests deterministic.
  (window as unknown as { alert: unknown }).alert = () => {};
});

const textOf = (data: unknown): string => inlineToPlainText((data as { content?: InlineContent[] }).content ?? []);

describe("htmlToBlocks (paste sanitization)", () => {
  it("drops script, style and form elements entirely", () => {
    const blocks = htmlToBlocks(
      `<p>before</p><script>alert(1)</script><style>.x{}</style><form><input></form><p>after</p>`
    );
    expect(blocks.map((b) => textOf(b.data))).toEqual(["before", "after"]);
  });

  it("strips event handler attributes and dangerous hrefs", () => {
    const blocks = htmlToBlocks(
      `<p onclick="alert(1)" onmouseover="alert(2)">safe text <a href="javascript:alert(1)">bad link</a></p>`
    );
    const text = blocks.map((b) => JSON.stringify(b.data)).join("");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("javascript:");
  });

  it("converts headings with levels", () => {
    const blocks = htmlToBlocks(`<h2>Title</h2><p>Body</p>`);
    expect(blocks[0]).toMatchObject({ type: "heading", data: { level: 2 } });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });

  it("converts lists with ordered/unordered styles", () => {
    const blocks = htmlToBlocks(`<ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>`);
    expect(blocks[0]).toMatchObject({ type: "list", data: { style: "unordered" } });
    expect(blocks[1]).toMatchObject({ type: "list", data: { style: "ordered" } });
  });

  it("converts code, quote, hr", () => {
    const blocks = htmlToBlocks(`<pre><code>const x = 1</code></pre><hr><blockquote>quoted</blockquote>`);
    expect(blocks[0]).toMatchObject({ type: "code", data: { code: "const x = 1" } });
    expect(blocks[1]).toMatchObject({ type: "delimiter" });
    expect(blocks[2]).toMatchObject({ type: "quote" });
  });

  it("keeps bold marks from sanitized html", () => {
    const blocks = htmlToBlocks(`<p>hello <b>world</b></p>`);
    const content = (blocks[0]?.data as { content?: { text?: string; marks?: string[] }[] }).content ?? [];
    const bold = content.find((n) => n.text === "world");
    expect(bold?.marks).toEqual([{ type: "bold" }]);
  });

  it("flattens table cells into paragraphs", () => {
    const blocks = htmlToBlocks(`<table><tr><td>a</td><td>b</td></tr></table>`);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
  });
});

describe("textToBlocks", () => {
  it("creates a paragraph per non-empty line", () => {
    const blocks = textToBlocks("one\n\ntwo\nthree");
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => textOf(b.data))).toEqual(["one", "two", "three"]);
  });
});
