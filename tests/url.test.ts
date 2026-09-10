import { describe, it, expect } from "vitest";
import { isSafeUrl, isSafeImageUrl, sanitizeLinkTarget } from "../src/core/url";

describe("URL safety", () => {
  it("allows http, https, mailto, tel", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com/path?q=1")).toBe(true);
    expect(isSafeUrl("mailto:hi@example.com")).toBe(true);
    expect(isSafeUrl("tel:+123456")).toBe(true);
  });

  it("allows relative URLs and fragments", () => {
    expect(isSafeUrl("/docs/page")).toBe(true);
    expect(isSafeUrl("#section")).toBe(true);
    expect(isSafeUrl("./relative")).toBe(true);
    expect(isSafeUrl("../up")).toBe(true);
  });

  it("blocks dangerous protocols", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeUrl(" javascript:alert(1)")).toBe(false);
  });

  it("rejects non-strings and empty values", () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(123)).toBe(false);
  });

  it("allows image data URLs for supported types only", () => {
    expect(isSafeImageUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isSafeImageUrl("data:image/svg+xml;base64,AAAA")).toBe(true);
    expect(isSafeImageUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isSafeImageUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isSafeImageUrl("data:application/x-msdownload,AAAA")).toBe(false);
  });

  it("sanitizeLinkTarget returns null for unsafe input", () => {
    expect(sanitizeLinkTarget("https://ok.example")).toBe("https://ok.example");
    expect(sanitizeLinkTarget("javascript:alert(1)")).toBeNull();
  });
});
