import { describe, it, expect } from "vitest";
import { normalizeInline, splitInlineAtOffset } from "../src/rich-text/normalize";
import { domToInline, inlineToDom, inlineToHtmlString, MARK_TAGS } from "../src/rich-text/dom";
import { textNode, inlineToPlainText, type InlineContent, type TextNode } from "../src/rich-text/types";

describe("normalizeInline", () => {
  it("drops empty text nodes", () => {
    expect(normalizeInline([textNode(""), textNode("hi")])).toEqual([textNode("hi")]);
  });

  it("merges adjacent text nodes with identical marks", () => {
    const merged = normalizeInline([textNode("he", [{ type: "bold" }]), textNode("llo", [{ type: "bold" }])]);
    expect(merged).toHaveLength(1);
    expect((merged[0] as TextNode)).toMatchObject({ text: "hello", marks: [{ type: "bold" }] });
  });

  it("keeps text nodes with different marks separate", () => {
    const merged = normalizeInline([textNode("a", [{ type: "bold" }]), textNode("b", [{ type: "italic" }])]);
    expect(merged).toHaveLength(2);
  });

  it("unwraps empty links", () => {
    expect(
      normalizeInline([
        { type: "link", href: "https://x", content: [] },
        textNode("ok")
      ])
    ).toEqual([textNode("ok")]);
  });
});

describe("splitInlineAtOffset", () => {
  it("splits at a plain-text offset", () => {
    const content = [textNode("hello "), textNode("world", [{ type: "bold" }])];
    const [before, after] = splitInlineAtOffset(content, 7);
    expect(inlineToPlainText(before)).toBe("hello w");
    expect(inlineToPlainText(after)).toBe("orld");
    expect((after[0] as TextNode)?.marks).toEqual([{ type: "bold" }]);
  });

  it("returns empty before for offset 0", () => {
    const [before, after] = splitInlineAtOffset([textNode("abc")], 0);
    expect(before).toEqual([]);
    expect(inlineToPlainText(after)).toBe("abc");
  });

  it("splits inside a link node", () => {
    const content: InlineContent[] = [{ type: "link", href: "https://e.com", content: [textNode("click here")] }];
    const [before, after] = splitInlineAtOffset(content, 5);
    expect(inlineToPlainText(before)).toBe("click");
    expect(inlineToPlainText(after)).toBe(" here");
  });
});

describe("DOM <-> JSON conversion", () => {
  it("round-trips marks through the DOM", () => {
    const content: InlineContent[] = [
      textNode("plain "),
      textNode("bold", [{ type: "bold" }]),
      textNode(" and "),
      { type: "link", href: "https://example.com", content: [textNode("link")] }
    ];
    const frag = inlineToDom(content);
    const div = document.createElement("div");
    div.appendChild(frag);
    const restored = domToInline(div);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(normalizeInline(content)));
  });

  it("maps mark types to tags", () => {
    expect(MARK_TAGS["bold"]).toBe("strong");
    expect(MARK_TAGS["italic"]).toBe("em");
    expect(MARK_TAGS["code"]).toBe("code");
  });

  it("drops unsafe hrefs but keeps the text", () => {
    const div = document.createElement("div");
    const a = document.createElement("a");
    a.setAttribute("href", "javascript:alert(1)");
    a.textContent = "click me";
    div.appendChild(a);
    const restored = domToInline(div);
    expect(inlineToPlainText(restored)).toBe("click me");
    expect(JSON.stringify(restored)).not.toContain("javascript");
  });

  it("serializes to a safe HTML string without innerHTML of untrusted data", () => {
    const html = inlineToHtmlString([textNode("hello ", ), textNode("world", [{ type: "bold" }])]);
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("hello ");
  });

  it("converts <br> into newline text", () => {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode("line1"));
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createTextNode("line2"));
    const restored = domToInline(div);
    expect(inlineToPlainText(restored)).toBe("line1\nline2");
  });
});
