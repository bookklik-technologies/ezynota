import { i as b } from "./core-entry-BeXf_jHg.js";
const g = [
  // The italic pattern avoids a regex lookbehind (`(?<!\*)`) which is a
  // syntax error on Safari < 16.4 — the prefix is captured instead and the
  // opening marker is located via the `open` string.
  { pattern: /\*\*([^*]+)\*\*$/, mark: "bold", open: "**" },
  { pattern: /__([^_]+)__$/, mark: "bold", open: "__" },
  { pattern: /(?:^|[^*])\*([^*\s][^*]*)\*$/, mark: "italic", open: "*" },
  { pattern: /~~([^~]+)~~$/, mark: "strike", open: "~~" },
  { pattern: /`([^`]+)`$/, mark: "code", open: "`" },
  { pattern: /==([^=]+)==$/, mark: "mark", open: "==" }
], v = { bold: "strong", italic: "em", code: "code", mark: "mark", strike: "span" };
class S {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.surface = e;
  }
  start() {
    const t = (e) => {
      const n = e;
      if (this.host.readOnly || this.host.isDestroyed() || b(n) || n.target.closest("[data-ez-ui]") || n.key !== " " && n.key !== "Enter") return;
      (n.key === " " ? this.handleSpace() : this.handleEnter()) && n.preventDefault();
    };
    this.surface.addEventListener("keydown", t, !0), this.disposers.push(() => this.surface.removeEventListener("keydown", t, !0));
  }
  stop() {
    for (const t of this.disposers) t();
    this.disposers.length = 0;
  }
  currentBlock() {
    const t = this.host.getSelectionInfo();
    if (!t) return null;
    const e = this.host.getEditableElement(t.blockId);
    if (!e) return null;
    const n = this.host.getBlockType(t.blockId);
    return n ? { id: t.blockId, type: n, editable: e } : null;
  }
  handleSpace() {
    const t = this.currentBlock();
    if (!t || t.type === "code") return !1;
    const e = this.host.getRange();
    if (!e || !e.collapsed) return !1;
    const n = f(t.editable, e), r = t.editable.textContent ?? "";
    for (const l of g) {
      const i = l.pattern.exec(n);
      if (i && i[1] !== void 0)
        return this.applyInlinePattern(t.editable, e, l);
    }
    const c = /^(#{1,6}|>|[-*+]|\d+[.)]|\[\]|\[x\])$/.exec(n);
    if (!c || r !== n) return !1;
    const s = c[1];
    return s.startsWith("#") ? this.convert(t.id, "heading", { level: s.length, content: [] }) : s === ">" ? this.convert(t.id, "quote", { content: [] }) : s === "-" || s === "*" ? this.convert(t.id, "list", { style: "unordered", items: [{ content: [] }] }) : s === "[]" ? this.convert(t.id, "list", { style: "task", items: [{ content: [], checked: !1 }] }) : s === "[x]" ? this.convert(t.id, "list", { style: "task", items: [{ content: [], checked: !0 }] }) : /^\d/.test(s) ? this.convert(t.id, "list", { style: "ordered", items: [{ content: [] }] }) : !1;
  }
  handleEnter() {
    const t = this.currentBlock();
    if (!t || t.type === "code") return !1;
    const e = this.host.getRange();
    if (!e || !e.collapsed) return !1;
    const n = f(t.editable, e);
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(n) && k(t.editable, e).trim() === "") {
      this.host.convertBlock(t.id, "delimiter");
      const r = this.host.insertBlock(this.host.defaultBlock, void 0, { after: t.id, focus: !0 });
      return this.host.focusBlock(r, "start"), this.host.announce("Divider created"), !0;
    }
    return /^```$/.test(n) && k(t.editable, e).trim() === "" ? (this.host.convertBlock(t.id, "code"), this.host.focusBlock(t.id, "start"), this.host.announce("Code block created"), !0) : !1;
  }
  /** Convert a block in ONE transaction (undoable via history). */
  convert(t, e, n) {
    const r = this.host.blocks.getById(t);
    return r ? (this.host.commitChanges("user", [
      { type: "block:update", id: t, previous: E(r.data), current: n },
      { type: "block:convert", id: t, fromType: r.type, toType: e }
    ]), this.host.focusBlock(t, "end"), this.host.announce(`Converted to ${e}`), !0) : !1;
  }
  /** Strip inline markers from the DOM and wrap the inner text in the mark. */
  applyInlinePattern(t, e, n) {
    const r = e.startContainer;
    if (r.nodeType !== Node.TEXT_NODE) return !1;
    const c = r, s = e.startOffset, l = c.data.slice(0, s), i = n.pattern.exec(l);
    if (!i || i[1] === void 0) return !1;
    const p = l.length - i[1].length - n.open.length, m = i[1], u = c.ownerDocument;
    try {
      const a = u.createRange();
      a.setStart(c, p), a.setEnd(c, s), a.deleteContents();
    } catch {
      return !1;
    }
    const y = v[n.mark] ?? "span", d = u.createElement(y);
    (n.mark === "strike" || n.mark === "mark") && d.setAttribute("data-ez-mark", n.mark), d.textContent = m, e.insertNode(d);
    const h = window.getSelection();
    if (h) {
      const a = u.createRange();
      a.setStartAfter(d), a.collapse(!0), h.removeAllRanges(), h.addRange(a);
    }
    return t.dispatchEvent(new Event("input", { bubbles: !0 })), this.host.announce(`Formatted as ${n.mark}`), !0;
  }
}
function f(o, t) {
  try {
    const e = (o.ownerDocument ?? document).createRange();
    return e.selectNodeContents(o), e.setEnd(t.startContainer, t.startOffset), e.toString();
  } catch {
    return "";
  }
}
function k(o, t) {
  try {
    const e = (o.ownerDocument ?? document).createRange();
    return e.selectNodeContents(o), e.setStart(t.endContainer, t.endOffset), e.toString();
  } catch {
    return "";
  }
}
function E(o) {
  return JSON.parse(JSON.stringify(o));
}
export {
  S as MarkdownShortcuts
};
//# sourceMappingURL=markdown-shortcuts-Du4C2zMP.js.map
