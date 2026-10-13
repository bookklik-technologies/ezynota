class Qs {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map(), this.destroyed = !1;
  }
  on(t, e) {
    const s = t;
    let n = this.listeners.get(s);
    n || (n = /* @__PURE__ */ new Set(), this.listeners.set(s, n));
    const i = e;
    return n.add(i), () => {
      n == null || n.delete(i);
    };
  }
  emit(t, ...e) {
    if (!this.destroyed)
      for (const s of Array.from(this.listeners.get(t) ?? []))
        try {
          s(...e);
        } catch (n) {
          typeof console < "u" && console.error(`Ezynota: error in "${String(t)}" handler`, n);
        }
  }
  destroy() {
    this.destroyed = !0, this.listeners.clear();
  }
}
class tn {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map(), this.destroyed = !1;
  }
  on(t, e) {
    const s = t;
    let n = this.listeners.get(s);
    n || (n = /* @__PURE__ */ new Set(), this.listeners.set(s, n));
    const i = e;
    return n.add(i), () => {
      n == null || n.delete(i);
    };
  }
  off(t, e) {
    var s;
    (s = this.listeners.get(t)) == null || s.delete(e);
  }
  /** Internal only — public consumers use `on()` for observation. */
  emit(t, ...e) {
    if (this.destroyed) return;
    const s = this.listeners.get(t);
    if (s)
      for (const n of Array.from(s))
        try {
          n(...e);
        } catch (i) {
          typeof console < "u" && console.error(`Ezynota: error in "${String(t)}" handler`, i);
        }
  }
  destroy() {
    this.destroyed = !0, this.listeners.clear();
  }
}
let Ht = 0, le = 0;
function en() {
  Ht++;
}
function sn() {
  Ht = Math.max(0, Ht - 1), le = Date.now();
}
function nn() {
  return Ht > 0;
}
function rn(o = 50) {
  return le !== 0 && Date.now() - le < o;
}
function Ts(o) {
  if (nn() || rn() || o.isComposing) return !0;
  const t = o.keyCode;
  return t === void 0 ? !1 : t === 229;
}
const on = [
  // The italic pattern avoids a regex lookbehind (`(?<!\*)`) which is a
  // syntax error on Safari < 16.4 — the prefix is captured instead and the
  // opening marker is located via the `open` string.
  { pattern: /\*\*([^*]+)\*\*$/, mark: "bold", open: "**" },
  { pattern: /__([^_]+)__$/, mark: "bold", open: "__" },
  { pattern: /(?:^|[^*])\*([^*\s][^*]*)\*$/, mark: "italic", open: "*" },
  { pattern: /~~([^~]+)~~$/, mark: "strike", open: "~~" },
  { pattern: /`([^`]+)`$/, mark: "code", open: "`" },
  { pattern: /==([^=]+)==$/, mark: "mark", open: "==" }
], an = { bold: "strong", italic: "em", code: "code", mark: "mark", strike: "span" };
class ln {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.surface = e;
  }
  start() {
    const t = (e) => {
      const s = e;
      if (this.host.readOnly || this.host.isDestroyed() || Ts(s) || s.target.closest("[data-ez-ui]") || s.key !== " " && s.key !== "Enter") return;
      (s.key === " " ? this.handleSpace() : this.handleEnter()) && s.preventDefault();
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
    const s = this.host.getBlockType(t.blockId);
    return s ? { id: t.blockId, type: s, editable: e } : null;
  }
  handleSpace() {
    const t = this.currentBlock();
    if (!t || t.type === "code") return !1;
    const e = this.host.getRange();
    if (!e || !e.collapsed) return !1;
    const s = Ve(t.editable, e), n = t.editable.textContent ?? "";
    for (const a of on) {
      const l = a.pattern.exec(s);
      if (l && l[1] !== void 0)
        return this.applyInlinePattern(t.editable, e, a);
    }
    const i = /^(#{1,6}|>|[-*+]|\d+[.)]|\[\]|\[x\])$/.exec(s);
    if (!i || n !== s) return !1;
    const r = i[1];
    return r.startsWith("#") ? this.convert(t.id, "heading", { level: r.length, content: [] }) : r === ">" ? this.convert(t.id, "quote", { content: [] }) : r === "-" || r === "*" ? this.convert(t.id, "list", { style: "unordered", items: [{ content: [] }] }) : r === "[]" ? this.convert(t.id, "list", { style: "task", items: [{ content: [], checked: !1 }] }) : r === "[x]" ? this.convert(t.id, "list", { style: "task", items: [{ content: [], checked: !0 }] }) : /^\d/.test(r) ? this.convert(t.id, "list", { style: "ordered", items: [{ content: [] }] }) : !1;
  }
  handleEnter() {
    const t = this.currentBlock();
    if (!t || t.type === "code") return !1;
    const e = this.host.getRange();
    if (!e || !e.collapsed) return !1;
    const s = Ve(t.editable, e);
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(s) && Ke(t.editable, e).trim() === "") {
      this.host.convertBlock(t.id, "delimiter");
      const n = this.host.insertBlock(this.host.defaultBlock, void 0, { after: t.id, focus: !0 });
      return this.host.focusBlock(n, "start"), this.host.announce("Divider created"), !0;
    }
    return /^```$/.test(s) && Ke(t.editable, e).trim() === "" ? (this.host.convertBlock(t.id, "code"), this.host.focusBlock(t.id, "start"), this.host.announce("Code block created"), !0) : !1;
  }
  /** Convert a block in ONE transaction (undoable via history). */
  convert(t, e, s) {
    const n = this.host.blocks.getById(t);
    return n ? (this.host.commitChanges("user", [
      { type: "block:update", id: t, previous: cn(n.data), current: s },
      { type: "block:convert", id: t, fromType: n.type, toType: e }
    ]), this.host.focusBlock(t, "end"), this.host.announce(`Converted to ${e}`), !0) : !1;
  }
  /** Strip inline markers from the DOM and wrap the inner text in the mark. */
  applyInlinePattern(t, e, s) {
    const n = e.startContainer;
    if (n.nodeType !== Node.TEXT_NODE) return !1;
    const i = n, r = e.startOffset, a = i.data.slice(0, r), l = s.pattern.exec(a);
    if (!l || l[1] === void 0) return !1;
    const c = a.length - l[1].length - s.open.length, d = l[1], u = i.ownerDocument;
    try {
      const m = u.createRange();
      m.setStart(i, c), m.setEnd(i, r), m.deleteContents();
    } catch {
      return !1;
    }
    const h = an[s.mark] ?? "span", f = u.createElement(h);
    (s.mark === "strike" || s.mark === "mark") && f.setAttribute("data-ez-mark", s.mark), f.textContent = d, e.insertNode(f);
    const g = window.getSelection();
    if (g) {
      const m = u.createRange();
      m.setStartAfter(f), m.collapse(!0), g.removeAllRanges(), g.addRange(m);
    }
    return t.dispatchEvent(new Event("input", { bubbles: !0 })), this.host.announce(`Formatted as ${s.mark}`), !0;
  }
}
function Ve(o, t) {
  try {
    const e = (o.ownerDocument ?? document).createRange();
    return e.selectNodeContents(o), e.setEnd(t.startContainer, t.startOffset), e.toString();
  } catch {
    return "";
  }
}
function Ke(o, t) {
  try {
    const e = (o.ownerDocument ?? document).createRange();
    return e.selectNodeContents(o), e.setStart(t.endContainer, t.endOffset), e.toString();
  } catch {
    return "";
  }
}
function cn(o) {
  return JSON.parse(JSON.stringify(o));
}
function dn(o, t) {
  return (e, s, n, i = 0) => {
    if (!e || o.readOnly) return;
    let r = n ? Number.POSITIVE_INFINITY : 1, a = 0;
    const l = { remaining: n ? 0 : Math.max(0, i) }, c = [];
    for (const d of o.blocks.blocks) {
      if (r <= 0) break;
      const u = Je(d.data), h = Je(u), f = hn(h, e, s, r, l);
      f > 0 && (r -= f, a += f, c.push({ type: "block:update", id: d.id, previous: u, current: h }));
    }
    if (c.length === 0) {
      o.announce(`No matches for "${e}"`);
      return;
    }
    if (o.commitChanges("api", c), o.announce(n ? `Replaced ${a} match(es)` : "Replaced match"), !n) {
      const d = c[0];
      o.focusBlock(d.id, "start");
    }
  };
}
function hn(o, t, e, s, n) {
  if (!o || typeof o != "object") return 0;
  let i = 0;
  const r = o;
  if (typeof r.code == "string") {
    const { text: a, count: l } = ce(r.code, t, e, s, n);
    r.code = a, i += l;
  }
  if (Array.isArray(r.content) && (i += wt(r.content, t, e, s - i, n)), Array.isArray(r.heading) && (i += wt(r.heading, t, e, s - i, n)), Array.isArray(r.items))
    for (const a of r.items) {
      if (s - i <= 0) break;
      Array.isArray(a == null ? void 0 : a.content) && (i += wt(a.content, t, e, s - i, n));
    }
  if (Array.isArray(r.rows)) {
    for (const a of r.rows)
      if (Array.isArray(a))
        for (const l of a) {
          if (s - i <= 0) break;
          Array.isArray(l == null ? void 0 : l.content) && (i += wt(l.content, t, e, s - i, n));
        }
  }
  if (typeof r.caption == "string") {
    const { text: a, count: l } = ce(r.caption, t, e, s - i, n);
    r.caption = a, i += l;
  }
  return i;
}
function wt(o, t, e, s, n) {
  let i = 0;
  for (const r of o) {
    if (s - i <= 0) break;
    if (!r || typeof r != "object") continue;
    const a = r;
    if (typeof a.text == "string") {
      const { text: l, count: c } = ce(a.text, t, e, s - i, n);
      a.text = l, i += c;
    }
    Array.isArray(a.content) && (i += wt(a.content, t, e, s - i, n));
  }
  return i;
}
function ce(o, t, e, s, n) {
  if (s <= 0) return { text: o, count: 0 };
  let i = o, r = 0, a = 0;
  for (; r < s; ) {
    const l = i.indexOf(t, a);
    if (l < 0) break;
    if (n.remaining > 0) {
      n.remaining--, a = l + t.length;
      continue;
    }
    i = i.slice(0, l) + e + i.slice(l + t.length), r++, a = l + e.length;
  }
  return { text: i, count: r };
}
function Je(o) {
  return JSON.parse(JSON.stringify(o));
}
class k extends Error {
  constructor(t, e, s, n) {
    super(e), this.name = "EzynotaError", this.code = t, s !== void 0 && (this.context = s), n !== void 0 && (this.cause = n);
  }
}
function tt(o) {
  return new k("EZ_TOOL_NOT_FOUND", `Tool "${o}" is not registered`, { tool: o });
}
function q(o, t) {
  return new k("EZ_INVALID_DOCUMENT", `Invalid document: ${o}`, t);
}
const un = ["http:", "https:", "mailto:", "tel:"];
function G(o) {
  if (typeof o != "string") return !1;
  const t = o.trim();
  if (t === "") return !1;
  if (t.startsWith("#") || t.startsWith("./") || t.startsWith("../"))
    return !0;
  if (/^[\\/][\\/]/.test(t))
    return !1;
  try {
    const e = new URL(t, "https://ezynota.invalid");
    return un.includes(e.protocol);
  } catch {
    return !1;
  }
}
function Z(o) {
  if (typeof o != "string") return !1;
  const t = o.trim();
  return t === "" ? !1 : t.startsWith("data:image/") ? /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i.test(t) : G(t);
}
function $o(o) {
  if (typeof o != "string") return null;
  const t = o.trim();
  return G(t) ? t : null;
}
const P = "1.0.0", Xt = "0.1.2", U = 200, fn = /* @__PURE__ */ new Set(["id", "type", "data", "tunes", "meta", "children"]);
function L(o) {
  var e;
  if (o === null || typeof o != "object" || Array.isArray(o)) return !1;
  const t = Object.getPrototypeOf(o);
  return t === null ? !0 : t === Object.prototype || ((e = t.constructor) == null ? void 0 : e.name) === "Object";
}
function mt(o) {
  return o === null || typeof o == "string" || typeof o == "number" || typeof o == "boolean" ? !0 : Array.isArray(o) ? o.every((t) => mt(t)) : L(o) ? Object.values(o).every((t) => mt(t)) : !1;
}
function pn(o) {
  let t = 0;
  const e = [{ v: o, d: 0 }];
  for (; e.length > 0; ) {
    const { v: s, d: n } = e.pop();
    if (n > t && (t = n), t > U) return t;
    if (Array.isArray(s))
      for (const i of s) e.push({ v: i, d: n + 1 });
    else if (L(s))
      for (const i of Object.values(s)) e.push({ v: i, d: n + 1 });
  }
  return t;
}
function Et(o) {
  return pn(o) > U;
}
function et(o, t = 0) {
  if (t > U)
    throw q(`value exceeds the maximum nesting depth of ${U}`);
  if (Array.isArray(o))
    return o.map((e) => et(e, t + 1));
  if (L(o)) {
    const e = {};
    for (const [s, n] of Object.entries(o))
      s === "__proto__" || s === "constructor" || s === "prototype" || (e[s] = et(n, t + 1));
    return e;
  }
  return o;
}
function ot(o) {
  if (Array.isArray(o)) {
    const t = [];
    for (const e of o) {
      if (L(e) && e.type === "link") {
        const s = e;
        if (Ze(s.href) === null) {
          const i = Array.isArray(s.content) ? ot(s.content) : [];
          Array.isArray(i) && t.push(...i);
          continue;
        }
        t.push(ot(e));
        continue;
      }
      t.push(ot(e));
    }
    return t;
  }
  if (L(o)) {
    const t = {};
    for (const [e, s] of Object.entries(o)) {
      if (e === "marks" && Array.isArray(s)) {
        t[e] = s.filter((n) => {
          if (!L(n) || n.type !== "link") return !0;
          const i = n.attrs, r = n.href ?? (i == null ? void 0 : i.href);
          return typeof r == "string" && Ze(r) !== null;
        }).map((n) => ot(n));
        continue;
      }
      t[e] = ot(s);
    }
    return t;
  }
  return o;
}
function De(o, t, e = 0) {
  if (e > U)
    throw q(`block nesting exceeds ${U} levels`);
  if (!L(o))
    throw new k("EZ_INVALID_BLOCK", "Block must be an object", { received: typeof o });
  if (typeof o.type != "string" || o.type === "")
    throw new k("EZ_INVALID_BLOCK", 'Block is missing a valid "type"', { id: String(o.id ?? "") });
  const s = o.data;
  if (s === void 0)
    throw new k("EZ_INVALID_BLOCK", 'Block is missing "data"', { type: o.type });
  if (Et(s))
    throw q(`block data exceeds the maximum nesting depth of ${U}`, { type: o.type });
  if (!mt(s))
    throw new k("EZ_INVALID_BLOCK", "Block data is not JSON-serializable", { type: o.type });
  const n = typeof o.id == "string" && o.id !== "" ? o.id : t(), i = {
    id: n,
    type: o.type,
    data: ot(et(s))
  }, r = o.tunes;
  if (L(r)) {
    if (Et(r))
      throw q(`block tunes exceed the maximum nesting depth of ${U}`, { id: n });
    mt(r) && (i.tunes = et(r));
  }
  const a = o.meta;
  if (L(a)) {
    const c = {};
    typeof a.createdAt == "number" && (c.createdAt = a.createdAt), typeof a.updatedAt == "number" && (c.updatedAt = a.updatedAt), (c.createdAt !== void 0 || c.updatedAt !== void 0) && (i.meta = c);
  }
  const l = o.children;
  Array.isArray(l) && (i.children = l.map((c) => De(c, t, e + 1)));
  for (const c of Object.keys(o)) {
    if (fn.has(c) || c === "__proto__" || c === "constructor" || c === "prototype") continue;
    const d = o[c];
    if (Et(d))
      throw q(`block field "${c}" exceeds the maximum nesting depth of ${U}`, { id: n });
    mt(d) && (i[c] = et(d));
  }
  return i;
}
function gn() {
  let o = 0;
  return () => `ez_salvaged_${(++o).toString(36)}`;
}
function de(o, t) {
  let e = `${o}_2`;
  for (let s = 2; t.has(e); s++) e = `${o}_${s}`;
  return e;
}
function mn(o) {
  try {
    const t = JSON.parse(JSON.stringify(o));
    return Et(t) ? null : et(t);
  } catch {
    return null;
  }
}
function Ls(o, t) {
  let e = 0;
  const s = (n) => {
    if (Array.isArray(n.children))
      for (const i of n.children)
        t.has(i.id) && (i.id = de(i.id, t), e++), t.add(i.id), s(i);
  };
  for (const n of o) s(n);
  return e;
}
function Ds(o, t) {
  const s = { schemaVersion: typeof o.schemaVersion == "string" ? o.schemaVersion : P, blocks: t }, n = o.meta;
  if (L(n)) {
    if (Et(n))
      throw q("document meta exceeds the maximum nesting depth");
    mt(n) && (s.meta = et(n));
  }
  typeof o.createdAt == "number" && (s.createdAt = o.createdAt), typeof o.updatedAt == "number" && (s.updatedAt = o.updatedAt);
  const i = o.generator;
  return L(i) && i.name === "ezynota" && typeof i.version == "string" && (s.generator = { name: "ezynota", version: i.version }), s;
}
function jt(o, t) {
  if (o == null) {
    const i = Date.now();
    return { schemaVersion: P, blocks: [], createdAt: i, updatedAt: i, generator: { name: "ezynota", version: Xt } };
  }
  if (!L(o))
    throw q("expected an object", { received: typeof o });
  const e = o.blocks;
  if (!Array.isArray(e))
    throw q('"blocks" must be an array');
  const s = /* @__PURE__ */ new Set(), n = e.map((i) => {
    const r = De(i, t);
    if (s.has(r.id))
      throw q(`duplicate block id "${r.id}"`);
    return s.add(r.id), r;
  });
  return Ls(n, s), Ds(o, n);
}
function he(o, t) {
  const e = t ?? gn();
  if (o == null)
    return { document: jt(null, e), salvaged: !1, dropped: [] };
  if (!L(o))
    return { document: null, salvaged: !1, dropped: [] };
  const s = o.blocks;
  if (!Array.isArray(s))
    return { document: null, salvaged: !1, dropped: [] };
  const n = [], i = /* @__PURE__ */ new Set(), r = [];
  let a = !1;
  for (let c = 0; c < s.length; c++) {
    const d = s[c];
    try {
      const u = De(d, e);
      i.has(u.id) && (u.id = de(u.id, i), a = !0), i.add(u.id), r.push(u);
    } catch {
      a = !0;
      const u = L(d) && typeof d.id == "string" ? d.id : "";
      n.push(u !== "" ? u : `#${c}`);
      const h = mn(d);
      if (h === null) continue;
      const f = L(h) ? h.id : void 0;
      let g = typeof f == "string" && f !== "" ? f : e();
      i.has(g) && (g = de(g, i)), i.add(g), r.push({ id: g, type: "unknown", data: { raw: h } });
    }
  }
  Ls(r, i) > 0 && (a = !0);
  let l;
  try {
    l = Ds(o, r);
  } catch {
    l = { schemaVersion: P, blocks: r };
  }
  return { document: l, salvaged: a, dropped: n };
}
function J(o) {
  return typeof structuredClone == "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}
function bn(o) {
  const t = Object.freeze(o.blocks.map((e) => Object.freeze({ ...e })));
  return Object.freeze({ ...o, blocks: t });
}
function Ze(o) {
  if (typeof o != "string") return null;
  const t = o.trim();
  return t !== "" && G(t) ? t : null;
}
class se {
  constructor(t, e) {
    this.version = 0, this.document = jt(t ?? null, e);
  }
  getVersion() {
    return this.version;
  }
  bump() {
    this.version++;
  }
  /** Raw mutable reference — only TransactionManager may use this. */
  raw() {
    return this.document;
  }
  get() {
    return this.document;
  }
  /**
   * Frozen snapshot of the document. Blocks and the top-level document
   * object are shallow-frozen (freezeDocument) — nested data/tunes objects
   * stay mutable, so callers must treat the snapshot as read-only and
   * never mutate nested values in place.
   */
  snapshot() {
    return bn(J(this.document));
  }
  replace(t, e) {
    this.document = jt(t, e), this.version++;
  }
  updatedAt() {
    this.document.updatedAt = Date.now();
  }
  clone() {
    return J(this.document);
  }
}
let Ge = 0;
class yn {
  constructor(t, e) {
    this.state = t, this.onCommit = e;
  }
  getDocument() {
    return this.state.get();
  }
  replaceDocument(t, e) {
    this.state.replace(t, e), this.state.bump();
  }
  /**
   * Apply changes to the document. Each change carries enough context
   * (previous values / removed blocks / move offsets) to compute its inverse.
   */
  commit(t, e) {
    if (e.length === 0) return { batch: this.emptyBatch(t), changed: !1 };
    const s = this.state.raw(), n = J({ blocks: s.blocks, meta: s.meta ?? null });
    try {
      for (const r of e)
        this.applyChange(s, r);
    } catch (r) {
      throw s.blocks = n.blocks, s.meta = n.meta ?? void 0, r instanceof k ? r : new k("EZ_UNKNOWN_ERROR", "Transaction failed and was rolled back", { origin: t, changes: e.length }, r);
    }
    this.state.updatedAt(), this.state.bump();
    const i = {
      id: `ch_${Date.now().toString(36)}_${(Ge++).toString(36)}`,
      origin: t,
      timestamp: Date.now(),
      changes: e
    };
    return this.onCommit(i), { batch: i, changed: !0 };
  }
  /** Apply a batch of inverse changes (used by history). */
  applyChange(t, e) {
    switch (e.type) {
      case "block:insert": {
        t.blocks.splice(Math.max(0, Math.min(e.index, t.blocks.length)), 0, kn(e.block));
        break;
      }
      case "block:remove": {
        const s = t.blocks.findIndex((n) => n.id === e.id);
        s >= 0 && t.blocks.splice(s, 1);
        break;
      }
      case "block:update": {
        const s = t.blocks.find((n) => n.id === e.id);
        s && (s.data = J(e.current));
        break;
      }
      case "block:move": {
        vn(t.blocks, e.id, e.to);
        break;
      }
      case "block:convert": {
        const s = t.blocks.find((n) => n.id === e.id);
        s && (s.type = e.toType);
        break;
      }
      case "tune:update": {
        if (e.tune === "__proto__" || e.tune === "constructor" || e.tune === "prototype") break;
        const s = t.blocks.find((n) => n.id === e.id);
        if (s) {
          const n = s.tunes ?? (s.tunes = {});
          n[e.tune] = J(e.value);
        }
        break;
      }
      case "title:update": {
        t.meta = { ...t.meta ?? {}, title: e.current };
        break;
      }
      case "children:update": {
        const s = t.blocks.find((n) => n.id === e.id);
        s && (s.children = J(e.current));
        break;
      }
      case "document:replace":
        break;
      default:
        throw new k("EZ_UNKNOWN_ERROR", "Unknown change type", { change: e.type });
    }
  }
  emptyBatch(t) {
    return { id: `ch_${Date.now().toString(36)}_${(Ge++).toString(36)}`, origin: t, timestamp: Date.now(), changes: [] };
  }
  /** Invert a set of changes (mechanical, payload-driven). */
  invert(t) {
    const e = [];
    for (let s = t.length - 1; s >= 0; s--) {
      const n = t[s];
      switch (n.type) {
        case "block:insert":
          e.push({ type: "block:remove", id: n.block.id, index: n.index, block: n.block });
          break;
        case "block:remove":
          e.push({ type: "block:insert", block: n.block, index: n.index });
          break;
        case "block:update":
          e.push({ type: "block:update", id: n.id, previous: n.current, current: n.previous });
          break;
        case "block:move":
          e.push({ type: "block:move", id: n.id, from: n.to, to: n.from });
          break;
        case "block:convert":
          e.push({ type: "block:convert", id: n.id, fromType: n.toType, toType: n.fromType });
          break;
        case "tune:update":
          e.push({ type: "tune:update", id: n.id, tune: n.tune, previous: n.value, value: n.previous });
          break;
        case "title:update":
          e.push({ type: "title:update", previous: n.current, current: n.previous });
          break;
        case "children:update":
          e.push({ type: "children:update", id: n.id, previous: n.current, current: n.previous });
          break;
        case "document:replace":
          e.push({ type: "document:replace" });
          break;
      }
    }
    return e;
  }
}
function kn(o) {
  return J(o);
}
function vn(o, t, e) {
  const s = o.findIndex((r) => r.id === t);
  if (s < 0) return;
  const [n] = o.splice(s, 1);
  if (!n) return;
  const i = Math.max(0, Math.min(e, o.length));
  o.splice(i, 0, n);
}
class wn {
  constructor(t, e, s) {
    this.tm = t, this.generateId = e, this.callbacks = s;
  }
  run(t, e) {
    const s = e();
    s.length !== 0 && (this.tm.commit(t, s), this.callbacks.onBatch(t, s));
  }
  document() {
    return this.tm.getDocument();
  }
  get blocks() {
    return this.document().blocks;
  }
  get length() {
    return this.blocks.length;
  }
  getById(t) {
    return this.blocks.find((e) => e.id === t);
  }
  /** Recursive lookup: root blocks first, then nested children. */
  getByIdRecursive(t) {
    const e = (s) => {
      for (const n of s) {
        if (n.id === t) return n;
        if (Array.isArray(n.children)) {
          const i = e(n.children);
          if (i) return i;
        }
      }
    };
    return e(this.blocks);
  }
  /** Parent context for a block: null at root level, parent id when nested. */
  getParentId(t) {
    for (const e of this.blocks) {
      if (e.id === t) return null;
      if (Array.isArray(e.children) && e.children.some((s) => s.id === t)) return e.id;
    }
    return null;
  }
  getIndex(t) {
    return this.blocks.findIndex((e) => e.id === t);
  }
  insert(t, e, s = "api", n = -1, i) {
    const r = this.blocks;
    let a = (i == null ? void 0 : i.withId) ?? this.generateId();
    if (r.some((d) => d.id === a)) {
      const d = a;
      let u = 2;
      for (; r.some((h) => h.id === `${d}_${u}`); ) u++;
      a = `${d}_${u}`;
    }
    const l = { id: a, type: t, data: e }, c = n >= 0 ? Math.max(0, Math.min(n, r.length)) : r.length;
    return this.run(s, () => [{ type: "block:insert", block: l, index: c }]), a;
  }
  update(t, e, s = "api") {
    const n = this.getById(t);
    if (!n || ct(n.data) === ct(e)) return;
    const i = nt(n.data), r = nt(e);
    this.run(s, () => [{ type: "block:update", id: t, previous: i, current: r }]);
  }
  remove(t, e = "api") {
    const s = this.blocks, n = s.findIndex((r) => r.id === t);
    if (n < 0) return;
    const i = JSON.parse(JSON.stringify(s[n]));
    this.run(e, () => [{ type: "block:remove", id: t, index: n, block: i }]);
  }
  /**
   * Move a block. `target` resolves to the block's FINAL index in the
   * resulting array (shared convention with drag, keyboard and undo).
   */
  move(t, e, s = "api") {
    const n = this.blocks, i = n.findIndex((a) => a.id === t);
    if (i < 0) return;
    let r;
    if (typeof e == "number")
      r = e;
    else if ("before" in e) {
      const a = n.findIndex((l) => l.id === e.before);
      if (a < 0) return;
      r = a > i ? a - 1 : a;
    } else if ("after" in e) {
      const a = n.findIndex((l) => l.id === e.after);
      if (a < 0) return;
      r = a > i ? a : a + 1;
    } else
      r = e.at === "start" ? 0 : n.length;
    r = Math.max(0, Math.min(r, n.length)), r !== i && this.run(s, () => [{ type: "block:move", id: t, from: i, to: r }]);
  }
  /** Move between root and nested lists atomically, preserving the whole subtree. */
  relocate(t, e, s, n = "user") {
    var f;
    if (t === e) return;
    const i = this.blocks, r = JSON.parse(JSON.stringify(i)), a = (g, m) => {
      for (let y = 0; y < g.length; y++) {
        const v = g[y];
        if (v.id === m) return { block: v, siblings: g, index: y };
        const w = a(v.children ?? [], m);
        if (w) return w;
      }
    }, l = a(r, t), c = a(r, e);
    if (!l || !c || a(l.block.children ?? [], e) || s === "inside" && c.block.type !== "toggle") return;
    if (s !== "inside" && l.siblings === r && c.siblings === r) {
      this.move(t, s === "before" ? { before: e } : { after: e }, n);
      return;
    }
    l.siblings.splice(l.index, 1);
    const d = s === "inside" ? (f = c.block).children ?? (f.children = []) : c.siblings, u = s === "inside" ? d.length : d.indexOf(c.block) + (s === "after" ? 1 : 0);
    d.splice(u, 0, l.block), s === "inside" && (c.block.data = { ...c.block.data, open: !0 });
    const h = [];
    for (let g = 0; g < i.length; g++) {
      const m = i[g];
      r.some((y) => y.id === m.id) || h.push({ type: "block:remove", id: m.id, index: g, block: m });
    }
    for (const g of r) {
      const m = i.find((y) => y.id === g.id);
      m && (JSON.stringify(m.data) !== JSON.stringify(g.data) && h.push({ type: "block:update", id: g.id, previous: m.data, current: g.data }), JSON.stringify(m.children ?? []) !== JSON.stringify(g.children ?? []) && h.push({ type: "children:update", id: g.id, previous: m.children ?? [], current: g.children ?? [] }));
    }
    r.forEach((g, m) => {
      i.some((y) => y.id === g.id) || h.push({ type: "block:insert", block: g, index: m });
    }), this.run(n, () => h);
  }
  duplicate(t, e = "api") {
    const s = this.getIndex(t), n = this.getById(t);
    if (s < 0 || !n) return "";
    const i = this.generateId(), r = JSON.parse(JSON.stringify(n));
    return r.id = i, r.meta = {}, Ns(r, this.generateId), this.run(e, () => [{ type: "block:insert", block: r, index: s + 1 }]), i;
  }
  convert(t, e, s, n = "api") {
    const i = this.getById(t);
    if (!i) return;
    const r = i.type;
    if (r === e) return;
    const a = nt(i.data), l = nt(s);
    this.run(n, () => [
      { type: "block:update", id: t, previous: a, current: l },
      { type: "block:convert", id: t, fromType: r, toType: e }
    ]);
  }
  setTune(t, e, s, n = "user") {
    var a;
    const i = this.getById(t);
    if (!i) return;
    const r = nt(((a = i.tunes) == null ? void 0 : a[e]) ?? null);
    ct(r) !== ct(s) && this.run(n, () => [{ type: "tune:update", id: t, tune: e, previous: r, value: nt(s) }]);
  }
}
function nt(o) {
  return JSON.parse(JSON.stringify(o));
}
function ct(o) {
  return o === null || typeof o != "object" ? JSON.stringify(o) ?? "null" : Array.isArray(o) ? `[${o.map(ct).join(",")}]` : `{${Object.keys(o).sort().map((e) => `${JSON.stringify(e)}:${ct(o[e])}`).join(",")}}`;
}
function Ns(o, t) {
  if (Array.isArray(o.children))
    for (const e of o.children)
      e.id = t(), Ns(e, t);
}
const En = 50, An = 2e4;
class Sn {
  constructor(t, e = {}, s = 900) {
    this.tm = t, this.callbacks = e, this.undoStack = [], this.redoStack = [], this.coalesceWindowMs = s;
  }
  record(t, e) {
    if (t.changes.length === 0 || t.origin === "remote") return;
    const s = this.tm.invert(t.changes), n = this.callbacks.onCaptureSelection ? this.callbacks.onCaptureSelection() : e ?? null, i = this.undoStack[this.undoStack.length - 1], r = t.changes.every(
      (d) => d.type === "block:update" || d.type === "tune:update" || d.type === "title:update"
    ), a = (i == null ? void 0 : i.groupStart) ?? (i == null ? void 0 : i.time) ?? 0, l = ((i == null ? void 0 : i.changes.length) ?? 0) + t.changes.length > En, c = t.timestamp - a >= An;
    if (i && r && !l && !c && i.origin === "user" && t.origin === "user" && t.timestamp - i.time < this.coalesceWindowMs && xn(i.changes, t.changes)) {
      i.changes = i.changes.concat(t.changes), i.inverse = this.tm.invert(i.changes), i.time = t.timestamp, i.postSelection = n, this.redoStack.length = 0;
      return;
    }
    this.undoStack.push({
      changes: t.changes,
      inverse: s,
      origin: t.origin,
      selection: e ?? null,
      postSelection: n,
      time: t.timestamp,
      groupStart: t.timestamp
    }), this.undoStack.length > 300 && this.undoStack.shift(), this.redoStack.length = 0;
  }
  /** Refresh the post-change selection of the newest entry (after the DOM applied the change). */
  updatePostSelection(t) {
    const e = this.undoStack[this.undoStack.length - 1];
    e && (e.postSelection = t);
  }
  undo() {
    var e, s;
    const t = this.undoStack.pop();
    return t ? (this.tm.commit("history", t.inverse), this.redoStack.push(t), (s = (e = this.callbacks).onRestoreSelection) == null || s.call(e, t.selection ?? null), !0) : !1;
  }
  redo() {
    var e, s;
    const t = this.redoStack.pop();
    return t ? (this.tm.commit("history", t.changes), this.undoStack.push(t), (s = (e = this.callbacks).onRestoreSelection) == null || s.call(e, t.postSelection ?? t.selection ?? null), !0) : !1;
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
  clear() {
    this.undoStack.length = 0, this.redoStack.length = 0;
  }
  /**
   * Snapshot the in-memory history stacks. Used by workspace mode to keep
   * an independent undo/redo timeline per note: content undo must never
   * reach into another note's document.
   */
  exportState() {
    return {
      undo: this.undoStack.slice(),
      redo: this.redoStack.slice()
    };
  }
  importState(t) {
    this.undoStack.length = 0, this.redoStack.length = 0, this.undoStack.push(...t.undo), this.redoStack.push(...t.redo);
  }
}
function xn(o, t) {
  const e = (s) => Array.from(
    new Set(
      s.map((n) => n.type === "title:update" ? "title" : "id" in n ? n.id : "block" in n ? n.block.id : "")
    )
  ).sort().join("|");
  return e(o) === e(t);
}
class In {
  constructor() {
    this.commands = /* @__PURE__ */ new Map();
  }
  register(t) {
    this.commands.set(t.name, t);
  }
  has(t) {
    return this.commands.has(t);
  }
  dispatch(t, e, s) {
    const n = typeof t == "string" ? t : t.name, i = this.commands.get(n);
    if (!i)
      throw new k("EZ_UNKNOWN_ERROR", `Command "${n}" is not registered`, { command: n });
    i.run(e, s);
  }
  list() {
    return Array.from(this.commands.keys());
  }
}
const O = {
  INSERT_BLOCK: "EZ_INSERT_BLOCK",
  DELETE_BLOCK: "EZ_DELETE_BLOCK",
  MOVE_BLOCK: "EZ_MOVE_BLOCK",
  DUPLICATE_BLOCK: "EZ_DUPLICATE_BLOCK",
  CONVERT_BLOCK: "EZ_CONVERT_BLOCK",
  UPDATE_BLOCK: "EZ_UPDATE_BLOCK",
  FOCUS_BLOCK: "EZ_FOCUS_BLOCK",
  UNDO: "EZ_UNDO",
  REDO: "EZ_REDO",
  OPEN_SLASH_MENU: "EZ_OPEN_SLASH_MENU",
  SET_READ_ONLY: "EZ_SET_READ_ONLY",
  SELECT_BLOCK: "EZ_SELECT_BLOCK"
};
class Cn {
  constructor() {
    this.blockTools = /* @__PURE__ */ new Map(), this.blockToolLoaders = /* @__PURE__ */ new Map(), this.inlineTools = [], this.tunes = [], this.defaultBlock = "paragraph";
  }
  registerBlockTool(t, e, s = !1) {
    const n = zn(e);
    this.blockTools.set(t, {
      name: t,
      toolClass: n.cls,
      config: n.config ?? {},
      toolbox: n.cls.toolbox,
      shortcut: n.cls.shortcut ?? e.shortcut
    }), s && (this.defaultBlock = t);
  }
  registerBlockToolLoader(t, e) {
    this.blockToolLoaders.set(t, async () => {
      const s = await e();
      this.registerBlockTool(t, s);
    });
  }
  async ensureLoaded(t) {
    const e = this.blockToolLoaders.get(t);
    if (e) {
      try {
        await e();
      } catch (s) {
        throw new k("EZ_TOOL_LOAD_FAILED", `Failed to load tool "${t}"`, { tool: t }, s);
      }
      this.blockToolLoaders.delete(t);
    }
  }
  /**
   * Whether the tool CLASS is currently registered (matches get()).
   * Loader-only registrations are NOT reflected here — use isLoadable()
   * when a lazy loader should also count.
   */
  has(t) {
    return this.blockTools.has(t);
  }
  /** Whether a lazy loader is registered for this tool but not yet run. */
  hasLoader(t) {
    return this.blockToolLoaders.has(t);
  }
  /** Whether the tool is loaded OR loadable via a registered lazy loader. */
  isLoadable(t) {
    return this.blockTools.has(t) || this.blockToolLoaders.has(t);
  }
  /**
   * The registered tool class. Throws EZ_TOOL_NOT_FOUND when only a lazy
   * loader is registered — call ensureLoaded(name) first (see isLoadable).
   */
  get(t) {
    const e = this.blockTools.get(t);
    if (!e) throw tt(t);
    return e;
  }
  createBlockTool(t, e) {
    const s = this.get(t);
    return new s.toolClass({ ...e, config: { ...s.config, ...e.config } });
  }
  listBlockTools() {
    return Array.from(this.blockTools.values());
  }
  toolboxEntries() {
    return this.listBlockTools().filter((t) => t.toolbox && t.name !== this.defaultBlock);
  }
  getDefaultBlock() {
    return this.defaultBlock;
  }
  setDefaultBlock(t) {
    this.defaultBlock = t;
  }
  registerInlineTool(t, e) {
    const s = Bn(e);
    this.inlineTools.push({ name: t, toolClass: s.cls, config: s.config ?? {} });
  }
  listInlineTools() {
    return this.inlineTools;
  }
  createInlineTool(t, e) {
    const s = this.inlineTools.find((n) => n.name === t);
    if (!s) throw tt(t);
    return new s.toolClass({ ...e, config: { ...s.config, ...e.config } });
  }
  registerTune(t, e) {
    const s = Tn(e);
    this.tunes.push({ name: t, toolClass: s.cls, config: s.config ?? {} });
  }
  listTunes() {
    return this.tunes;
  }
  createTune(t, e) {
    const s = this.tunes.find((n) => n.name === t);
    if (!s) throw tt(t);
    return new s.toolClass({ ...e, config: { ...s.config, ...e.config } });
  }
}
function zn(o) {
  if (typeof o == "function") return { cls: o, config: void 0 };
  const t = o;
  if (!t || typeof t.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Tool definition must be a class or { class, config }");
  return { cls: t.class, config: t.config, shortcut: t.shortcut };
}
function Bn(o) {
  if (typeof o == "function") return { cls: o, config: void 0 };
  if (!o || typeof o.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Inline tool definition must be a class or { class, config }");
  return { cls: o.class, config: o.config };
}
function Tn(o) {
  if (typeof o == "function") return { cls: o, config: void 0 };
  if (!o || typeof o.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Tune definition must be a class or { class, config }");
  return { cls: o.class, config: o.config };
}
function Ye(o) {
  const t = o.indexOf("-"), e = t >= 0 ? o.slice(0, t) : o, s = t >= 0 ? o.slice(t + 1) : null, n = e.split(".").map((i) => parseInt(i, 10) || 0);
  for (; n.length < 3; ) n.push(0);
  return { core: n.slice(0, 3), pre: s };
}
function Ln(o, t) {
  const e = o.split("."), s = t.split("."), n = Math.max(e.length, s.length);
  for (let i = 0; i < n; i++) {
    const r = e[i], a = s[i];
    if (r === void 0) return -1;
    if (a === void 0) return 1;
    const l = /^\d+$/.test(r) ? parseInt(r, 10) : null, c = /^\d+$/.test(a) ? parseInt(a, 10) : null;
    if (l !== null && c !== null) {
      if (l !== c) return l - c;
    } else {
      if (l !== null)
        return -1;
      if (c !== null)
        return 1;
      if (r !== a)
        return r < a ? -1 : 1;
    }
  }
  return 0;
}
function Q(o, t) {
  const e = Ye(o), s = Ye(t);
  for (let n = 0; n < 3; n++)
    if (e.core[n] !== s.core[n]) return e.core[n] - s.core[n];
  return e.pre === null && s.pre === null ? 0 : e.pre === null ? 1 : s.pre === null ? -1 : Ln(e.pre, s.pre);
}
class Dn {
  constructor() {
    this.migrations = [];
  }
  register(t) {
    this.migrations.some((e) => e.from === t.from && e.to === t.to) || (this.migrations.push(t), this.migrations.sort((e, s) => Q(e.from, s.from) || Q(e.to, s.to)));
  }
  canMigrate(t, e) {
    try {
      return this.buildPath(t, e), !0;
    } catch {
      return !1;
    }
  }
  migrate(t, e) {
    if (t.schemaVersion === e) return t;
    if (Q(t.schemaVersion, e) > 0)
      throw new k(
        "EZ_MIGRATION_FAILED",
        `Cannot migrate from newer schema version "${t.schemaVersion}" to "${e}"`,
        { from: t.schemaVersion, to: e }
      );
    const s = this.buildPath(t.schemaVersion, e);
    let n = t;
    for (const i of s)
      try {
        n = i.migrate(n), n.schemaVersion = i.to;
      } catch (r) {
        throw new k("EZ_MIGRATION_FAILED", `Migration ${i.from} -> ${i.to} failed`, { from: i.from, to: i.to }, r);
      }
    return n.schemaVersion = e, n;
  }
  list() {
    return this.migrations.slice();
  }
  buildPath(t, e) {
    if (Q(t, e) >= 0) return [];
    const s = [{ version: t, path: [] }], n = /* @__PURE__ */ new Set([t]);
    for (; s.length > 0; ) {
      const i = s.shift();
      for (const r of this.migrations) {
        if (r.from !== i.version || n.has(r.to)) continue;
        const a = [...i.path, r];
        if (Q(r.to, e) === 0) return a;
        Q(r.to, e) < 0 && (n.add(r.to), s.push({ version: r.to, path: a }));
      }
    }
    throw new k("EZ_MIGRATION_FAILED", `No migration path from "${t}" to "${e}"`, { from: t, to: e });
  }
}
const Nn = {
  "core.placeholder": "Start writing...",
  "core.emptyDocument": "This document is empty.",
  "core.blockHint": "Type / to choose a block",
  "toolbar.formatting": "Text formatting",
  "toolbar.blockActions": "Block actions",
  "toolbar.blockType": "Block type",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "toolbar.more": "More formatting",
  "toolbar.add": "Add block",
  "toolbar.addBelow": "Add content below",
  "toolbar.settings": "Block settings",
  "toolbar.drag": "Drag to reorder",
  "settings.convert": "Convert to",
  "settings.convertPicker": "Turn into…",
  "settings.duplicate": "Duplicate",
  "settings.moveUp": "Move up",
  "settings.moveDown": "Move down",
  "settings.delete": "Delete",
  "settings.deleted": "Block deleted. Use Undo to restore it.",
  "settings.tunes": "Tunes",
  "slash.placeholder": "Search blocks...",
  "slash.empty": "No results",
  "inline.bold": "Bold",
  "inline.italic": "Italic",
  "inline.underline": "Underline",
  "inline.code": "Inline code",
  "inline.mark": "Highlight",
  "inline.strike": "Strikethrough",
  "inline.color": "Text color",
  "inline.background": "Highlight color",
  "inline.link": "Link",
  "inline.linkUrl": "Link URL",
  "inline.linkApply": "Apply",
  "inline.linkRemove": "Remove",
  "inline.linkCancel": "Cancel",
  "inline.linkInvalid": "Enter a web address, relative path, email link, or telephone link.",
  "workspace.search": "Search workspace",
  "workspace.newNote": "New note",
  "workspace.newFolder": "New folder",
  "workspace.trash": "Trash",
  "workspace.restore": "Restore",
  "workspace.deleteForever": "Delete permanently",
  "workspace.emptyTrash": "Empty trash",
  "workspace.saveStatus.idle": "Ready",
  "workspace.saveStatus.saving": "Saving…",
  "workspace.saveStatus.saved": "Saved",
  "workspace.saveStatus.error": "Save failed — click to retry",
  "workspace.fullscreenEnter": "Enter fullscreen",
  "workspace.fullscreenExit": "Exit fullscreen",
  "workspace.outline": "Heading outline",
  "workspace.find": "Find in document",
  "workspace.replace": "Replace",
  "workspace.replaceAll": "Replace all",
  "workspace.untitled": "Untitled",
  "workspace.export": "Export",
  "workspace.import": "Import file…",
  "workspace.print": "Print document",
  "workspace.backup": "Download workspace backup",
  "workspace.restoreBackup": "Restore workspace backup…",
  "workspace.theme": "Theme",
  "workspace.loading": "Loading your notes…",
  "workspace.loadFailed": "Notes could not be loaded. Retry or download the stored data.",
  "workspace.legacyDraft": "A draft saved by an older version was found. Import it as a new note?",
  "workspace.noteActions": "Note actions",
  "workspace.folderActions": "Folder actions",
  "workspace.moveNoteToTrash": "Move to trash",
  "workspace.duplicate": "Duplicate",
  "workspace.rename": "Rename…",
  "tune.alignment": "Alignment",
  "tune.alignment.left": "Left",
  "tune.alignment.center": "Center",
  "tune.alignment.right": "Right",
  "error.toolNotFound": "Tool not found"
};
class Mn {
  constructor(t = "en", e = {}) {
    this.messages = {}, this.locale = t, this.messages.en = { ...Nn };
    for (const [s, n] of Object.entries(e))
      this.messages[s] = { ...this.messages[s] ?? {}, ...n };
  }
  t(t, e) {
    var i, r, a;
    const s = Object.keys(this.messages).sort((l, c) => c.length - l.length);
    for (const l of s)
      if (l !== "en" && t.startsWith(`${l}.`)) {
        const c = ((i = this.messages[l]) == null ? void 0 : i[t.slice(l.length + 1)]) ?? ((r = this.messages[l]) == null ? void 0 : r[t]);
        if (c !== void 0) return this.substitute(c, e);
      }
    const n = (a = this.messages.en) == null ? void 0 : a[t];
    return this.substitute(n ?? t, e);
  }
  substitute(t, e) {
    return e ? t.replace(/\{(\w+)\}/g, (s, n) => String(e[n] ?? `{${n}}`)) : t;
  }
  getLocale() {
    return this.locale;
  }
}
const Xe = "abcdefghijklmnopqrstuvwxyz0123456789";
function Rn() {
  let o = "ez_";
  for (let t = 0; t < 12; t++)
    o += Xe[Math.floor(Math.random() * Xe.length)];
  return o;
}
function Qt() {
  const o = typeof crypto < "u" ? crypto : void 0;
  return o && typeof o.randomUUID == "function" ? () => o.randomUUID() : Rn;
}
function M(o) {
  const t = Qt();
  return o ? () => {
    const e = o();
    return typeof e == "string" && e !== "" ? e : t();
  } : t;
}
function st(o, t) {
  const e = { type: "text", text: o };
  return t && t.length > 0 && (e.marks = t), e;
}
function H(o) {
  return o.type === "text";
}
function Dt(o) {
  return o.type === "link" && Array.isArray(o.content);
}
const Qe = ["bold", "italic", "underline", "strike", "code", "mark", "link", "color", "background"];
function ue(o) {
  return o.attrs ? `${o.type}:${JSON.stringify(o.attrs)}` : o.type;
}
function R(o) {
  if (!o) return [];
  const t = [];
  for (const e of o) {
    if (Dt(e)) {
      const i = R(e.content);
      if (i.length === 0 || i.every((r) => r.text === "")) continue;
      t.push({ type: "link", href: e.href, content: i });
      continue;
    }
    const s = e;
    if (typeof s.text != "string" || s.text === "") continue;
    const n = t[t.length - 1];
    if (n && H(n) && H(s) && Fn(n.marks, s.marks))
      n.text += s.text;
    else if (H(s)) {
      const i = { type: "text", text: s.text }, r = On(s.marks);
      r && (i.marks = r), t.push(i);
    } else
      t.push(s);
  }
  return t;
}
function On(o) {
  if (!o || o.length === 0) return;
  const t = /* @__PURE__ */ new Set(), e = [];
  for (const s of o) {
    const n = ue(s);
    t.has(n) || (t.add(n), e.push(s));
  }
  return e.sort((s, n) => Qe.indexOf(s.type) - Qe.indexOf(n.type)), e;
}
function Fn(o, t) {
  const e = (o ?? []).map(ue).sort().join(","), s = (t ?? []).map(ue).sort().join(",");
  return e === s;
}
function $n(o, t) {
  if (t <= 0) return [[], R(o)];
  const e = [], s = [];
  let n = 0;
  for (const i of o) {
    const r = H(i) ? i.text : i.content.map((l) => l.text).join("");
    if (n >= t) {
      s.push(i);
      continue;
    }
    if (n + r.length <= t) {
      e.push(i), n += r.length;
      continue;
    }
    const a = t - n;
    if (H(i))
      e.push(st(i.text.slice(0, a), i.marks)), s.push(st(i.text.slice(a), i.marks));
    else {
      const [l, c] = $n(i.content, a);
      l.length > 0 && e.push({ type: "link", href: i.href, content: l }), c.length > 0 && s.push({ type: "link", href: i.href, content: c });
    }
    n += r.length;
  }
  return [R(e), R(s)];
}
const ts = {
  bold: "strong",
  italic: "em",
  underline: "u",
  code: "code",
  mark: "mark",
  strike: "s"
}, Pn = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
  CODE: "code",
  MARK: "mark",
  S: "strike",
  DEL: "strike"
}, _n = /* @__PURE__ */ new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE", "UL", "OL"]);
function Ut(o) {
  return typeof o == "string" && (G(o) || o.startsWith("note:"));
}
function fe(o) {
  var e, s;
  if (!o) return [];
  const t = [];
  for (const n of o) {
    if (Dt(n)) {
      Ut(n.href) ? t.push({ type: "link", href: n.href, content: fe(n.content) }) : t.push(...fe(n.content));
      continue;
    }
    if (H(n)) {
      const i = (e = n.marks) == null ? void 0 : e.filter((r) => {
        var l;
        if (r.type !== "link") return !0;
        const a = ((l = r.attrs) == null ? void 0 : l.href) ?? r.href;
        return Ut(a);
      });
      if (i && i.length !== (((s = n.marks) == null ? void 0 : s.length) ?? 0)) {
        const r = { type: "text", text: n.text };
        i.length > 0 && (r.marks = i), t.push(r);
        continue;
      }
    }
    t.push(n);
  }
  return t;
}
function F(o, t = document) {
  const e = t.createDocumentFragment();
  if (!o) return e;
  for (const s of R(fe(o)))
    if (H(s))
      e.appendChild($t(s, s.marks ?? [], t));
    else if (Dt(s)) {
      if (!Ut(s.href)) {
        for (const i of s.content)
          e.appendChild($t(i, i.marks ?? [], t));
        continue;
      }
      const n = t.createElement("a");
      n.setAttribute("href", s.href), n.setAttribute("rel", "noopener noreferrer");
      for (const i of s.content)
        n.appendChild($t(i, i.marks ?? [], t));
      e.appendChild(n);
    }
  return e;
}
function $t(o, t, e) {
  if (t.length === 0)
    return e.createTextNode(o.text);
  const [s, ...n] = t, i = ts[s.type] ?? "span", r = e.createElement(i);
  if (!ts[s.type]) {
    r.setAttribute("data-ez-mark", s.type);
    const a = s.attrs;
    if (a)
      for (const [l, c] of Object.entries(a))
        (typeof c == "string" || typeof c == "number") && (r.setAttribute(`data-ez-${Hn(l)}`, String(c)), s.type === "color" && l === "color" && (r.style.color = String(c)), s.type === "background" && l === "color" && (r.style.backgroundColor = String(c)));
  }
  return n && n.length > 0 ? r.appendChild($t(o, n, e)) : r.textContent = o.text, r;
}
function Hn(o) {
  return o.replace(/[A-Z]/g, (t) => `-${t.toLowerCase()}`);
}
function z(o) {
  const t = [];
  return Ms(o, [], t), R(jn(t));
}
function jn(o) {
  var s, n;
  const t = [];
  let e = null;
  for (const i of o) {
    if (H(i) && ((s = i.marks) != null && s.some((r) => r.type === "link"))) {
      const r = i.marks.find((d) => d.type === "link"), a = String(((n = r.attrs) == null ? void 0 : n.href) ?? ""), l = i.marks.filter((d) => d !== r), c = { type: "text", text: i.text };
      l.length > 0 && (c.marks = l), (!e || e.href !== a) && (e = { type: "link", href: a, content: [] }, t.push(e)), e.content.push(c);
      continue;
    }
    e = null, t.push(i);
  }
  return t;
}
function Ms(o, t, e) {
  if (o.nodeType === Node.TEXT_NODE) {
    const r = o.nodeValue ?? "";
    r !== "" && e.push(st(r, t.length ? t : void 0));
    return;
  }
  if (o.nodeType !== Node.ELEMENT_NODE) return;
  const s = o, n = s.tagName;
  if (n === "BR") {
    e.push(st(`
`, t.length ? t : void 0));
    return;
  }
  _n.has(n) && (s.textContent ?? "").trim() !== "" && e.length > 0 && e.push(st(`
`, void 0));
  const i = Un(s, t);
  for (const r of Array.from(s.childNodes))
    Ms(r, i, e);
}
function Un(o, t) {
  const e = o.tagName;
  let s = t;
  const n = Pn[e];
  if (n && (s = [...s, { type: n }]), e === "A") {
    const r = o.getAttribute("href") ?? "";
    Ut(r) && (s = [...s, { type: "link", attrs: { href: r } }]);
  }
  const i = o.getAttribute("data-ez-mark");
  if (i) {
    const r = {};
    for (const a of Array.from(o.attributes))
      a.name.startsWith("data-ez-") && a.name !== "data-ez-mark" && (r[qn(a.name.slice(8))] = a.value);
    s = [...s, { type: i, attrs: Object.keys(r).length > 0 ? r : void 0 }];
  }
  return s;
}
function qn(o) {
  return o.replace(/-([a-z])/g, (t, e) => e.toUpperCase());
}
function Po(o) {
  if (typeof document > "u" || !o) return "";
  const t = document.createElement("div");
  return t.appendChild(F(o, document)), t.innerHTML;
}
function Wn(o, t) {
  const e = o.ownerDocument ?? document, s = e.createRange();
  s.setStart(t.endContainer, t.endOffset), s.setEndAfter(o);
  const n = s.extractContents(), i = e.createElement("div");
  i.appendChild(n);
  const r = z(i);
  return { before: z(o), after: r };
}
function Nt(o) {
  return o ? o.map((e) => H(e) ? e.text : Dt(e) ? e.content.map((s) => s.text).join("") : "").join("").replace(/\u200B/g, "").trim() === "" : !0;
}
const Vn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-save"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
  <path d="M7 3v4a1 1 0 0 0 1 1h7" />
</svg>
`, Kn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-plus"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12h14" />
  <path d="M12 5v14" />
</svg>
`, Jn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-grip-vertical"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="9" cy="12" r="1" />
  <circle cx="9" cy="5" r="1" />
  <circle cx="9" cy="19" r="1" />
  <circle cx="15" cy="12" r="1" />
  <circle cx="15" cy="5" r="1" />
  <circle cx="15" cy="19" r="1" />
</svg>
`, Zn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-trash-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
</svg>
`, Gn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-copy"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
</svg>
`, Yn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-chevron-up"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m18 15-6-6-6 6" />
</svg>
`, es = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-chevron-down"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m6 9 6 6 6-6" />
</svg>
`, Xn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-pilcrow"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M13 4v16" />
  <path d="M17 4v16" />
  <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />
</svg>
`, Qn = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-heading"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 12h12" />
  <path d="M6 20V4" />
  <path d="M18 20V4" />
</svg>
`, ti = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-list"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 5h.01" />
  <path d="M3 12h.01" />
  <path d="M3 19h.01" />
  <path d="M8 5h13" />
  <path d="M8 12h13" />
  <path d="M8 19h13" />
</svg>
`, ei = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-quote"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
  <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
</svg>
`, Rs = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-code-xml"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m18 16 4-4-4-4" />
  <path d="m6 8-4 4 4 4" />
  <path d="m14.5 4-5 16" />
</svg>
`, si = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-separator-horizontal"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m16 16-4 4-4-4" />
  <path d="M3 12h18" />
  <path d="m8 8 4-4 4 4" />
</svg>
`, ni = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-align-left"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M21 5H3" />
  <path d="M15 12H3" />
  <path d="M17 19H3" />
</svg>
`, ii = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-align-center"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M21 5H3" />
  <path d="M17 12H7" />
  <path d="M19 19H5" />
</svg>
`, ri = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-align-right"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M21 5H3" />
  <path d="M21 12H9" />
  <path d="M21 19H7" />
</svg>
`, oi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-search"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m21 21-4.34-4.34" />
  <circle cx="11" cy="11" r="8" />
</svg>
`, ai = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-file-text"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
  <path d="M10 9H8" />
  <path d="M16 13H8" />
  <path d="M16 17H8" />
</svg>
`, li = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-folder"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</svg>
`, ci = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-folder-open"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
</svg>
`, di = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-folder-plus"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 10v6" />
  <path d="M9 13h6" />
  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</svg>
`, hi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-moon"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
</svg>
`, ui = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-sun"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2" />
  <path d="M12 20v2" />
  <path d="m4.93 4.93 1.41 1.41" />
  <path d="m17.66 17.66 1.41 1.41" />
  <path d="M2 12h2" />
  <path d="M20 12h2" />
  <path d="m6.34 17.66-1.41 1.41" />
  <path d="m19.07 4.93-1.41 1.41" />
</svg>
`, fi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-monitor"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="20" height="14" x="2" y="3" rx="2" />
  <line x1="8" x2="16" y1="21" y2="21" />
  <line x1="12" x2="12" y1="17" y2="21" />
</svg>
`, pi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-maximize"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
</svg>
`, gi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-minimize"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
</svg>
`, mi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-x"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M18 6 6 18" />
  <path d="m6 6 12 12" />
</svg>
`, pe = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-chevron-right"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m9 18 6-6-6-6" />
</svg>
`, bi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-undo-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M9 14 4 9l5-5" />
  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
</svg>
`, yi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-redo-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m15 14 5-5-5-5" />
  <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
</svg>
`, ki = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-download"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 15V3" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <path d="m7 10 5 5 5-5" />
</svg>
`, vi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-upload"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v12" />
  <path d="m17 8-5-5-5 5" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
</svg>
`, wi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-rotate-ccw"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
  <path d="M3 3v5h5" />
</svg>
`, Ei = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-list-tree"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M8 5h13" />
  <path d="M13 12h8" />
  <path d="M13 19h8" />
  <path d="M3 10a2 2 0 0 0 2 2h3" />
  <path d="M3 5v12a2 2 0 0 0 2 2h3" />
</svg>
`, Ai = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-strikethrough"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M16 4H9a3 3 0 0 0-2.83 4" />
  <path d="M14 12a4 4 0 0 1 0 8H6" />
  <line x1="4" x2="20" y1="12" y2="12" />
</svg>
`, Si = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-highlighter"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m9 11-6 6v3h9l3-3" />
  <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
</svg>
`, xi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-baseline"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M4 20h16" />
  <path d="m6 16 6-12 6 12" />
  <path d="M8 12h8" />
</svg>
`, Ii = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-paint-bucket"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M11 7 6 2" />
  <path d="M18.992 12H2.041" />
  <path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595" />
  <path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33" />
</svg>
`, Ci = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-table"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v18" />
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <path d="M3 9h18" />
  <path d="M3 15h18" />
</svg>
`, zi = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="11" rx="2" />
  <path d="M3 8h18M12 3v11M9 20h6M12 17v6" />
</svg>
`, Bi = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="11" height="18" rx="2" />
  <path d="M8 3v18M3 12h11M17 12h6M20 9v6" />
</svg>
`, Ti = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="11" rx="2" />
  <path d="M3 8h18M12 3v11M9 20h6" />
</svg>
`, Li = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="11" height="18" rx="2" />
  <path d="M8 3v18M3 12h11M17 12h6" />
</svg>
`, Di = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-panel-top"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <path d="M3 9h18" />
</svg>
`, Ni = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-image"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  <circle cx="9" cy="9" r="2" />
  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
</svg>
`, Os = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-info"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="10" />
  <path d="M12 16v-4" />
  <path d="M12 8h.01" />
</svg>
`, Mi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-panel-left"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <path d="M9 3v18" />
</svg>
`, Ri = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-link"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
`, Oi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-ellipsis-vertical"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="1" />
  <circle cx="12" cy="5" r="1" />
  <circle cx="12" cy="19" r="1" />
</svg>
`, Fi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-bold"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
</svg>
`, $i = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-italic"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <line x1="19" x2="10" y1="4" y2="4" />
  <line x1="14" x2="5" y1="20" y2="20" />
  <line x1="15" x2="9" y1="4" y2="20" />
</svg>
`, Pi = `<!-- @license lucide-static v1.43.0 - ISC -->
<svg
  class="lucide lucide-underline"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 4v6a6 6 0 0 0 12 0V4" />
  <line x1="4" x2="20" y1="20" y2="20" />
</svg>
`, b = {
  save: Vn,
  plus: Kn,
  grip: Jn,
  trash: Zn,
  copy: Gn,
  up: Yn,
  down: es,
  alignLeft: ni,
  alignCenter: ii,
  alignRight: ri,
  search: oi,
  file: ai,
  folder: li,
  folderOpen: ci,
  folderPlus: di,
  moon: hi,
  sun: ui,
  monitor: fi,
  maximize: pi,
  minimize: gi,
  x: mi,
  chevronRight: pe,
  undo: bi,
  redo: yi,
  download: ki,
  upload: vi,
  restore: wi,
  outline: Ei,
  strikethrough: Ai,
  highlighter: Si,
  code: Rs,
  textColor: xi,
  backgroundColor: Ii,
  tableRowAdd: zi,
  tableColumnAdd: Bi,
  tableRowDelete: Ti,
  tableColumnDelete: Li,
  tableHeader: Di,
  info: Os,
  caretRight: pe,
  caretDown: es,
  panelLeft: Mi,
  link: Ri,
  ellipsis: Oi,
  bold: Fi,
  italic: $i,
  underline: Pi
}, j = {
  paragraph: Xn,
  heading: Qn,
  list: ti,
  quote: ei,
  code: Rs,
  delimiter: si,
  table: Ci,
  image: Ni,
  callout: Os,
  toggle: pe
};
function Fs(o) {
  return typeof o == "string" && /^(?:\s|<!--[\s\S]*?-->)*<svg(?:\s|>)/i.test(o);
}
function D(o) {
  const t = document.createElement("span");
  t.className = "ez-menu-icon", t.innerHTML = o, t.setAttribute("aria-hidden", "true");
  for (const e of Array.from(t.querySelectorAll("svg")))
    e.setAttribute("stroke-width", "1.8");
  return t;
}
class Mt {
  constructor(t, e = "", s = !1) {
    this.api = t.api, this.config = t.config ?? {}, this.placeholder = e, this.multiline = s;
  }
  render() {
    var n;
    const t = ((n = this.editable) == null ? void 0 : n.ownerDocument) ?? document, e = t.createElement(this.tag());
    e.classList.add("ez-text-input"), e.contentEditable = "true", e.setAttribute("data-ez-editable", "true"), this.placeholder && e.setAttribute("data-ez-placeholder", this.placeholder), this.multiline && e.setAttribute("data-ez-multiline", "true");
    const s = this.api.getData();
    return s != null && s.content && !Nt(s.content) && e.appendChild(F(s.content, t)), this.editable = e, e;
  }
  validate(t) {
    return !!t;
  }
  merge(t) {
    var r;
    const e = ((r = this.api.getData()) == null ? void 0 : r.content) ?? [], s = (t == null ? void 0 : t.content) ?? [], n = R([...e, ...s]), i = { content: n };
    return this.replaceEditableContent(this.editable, F(n, this.editable.ownerDocument)), this.api.update(i), i;
  }
  /** Sync the DOM after an external transaction updated this block. */
  updated() {
    const t = this.api.getData();
    if (!this.editable) return;
    const e = z(this.editable);
    JSON.stringify(R(e)) !== JSON.stringify(R((t == null ? void 0 : t.content) ?? [])) && this.replaceEditableContent(this.editable, F((t == null ? void 0 : t.content) ?? [], this.editable.ownerDocument));
  }
  replaceEditableContent(t, e) {
    for (; t.firstChild; ) t.removeChild(t.firstChild);
    e.childNodes.length > 0 && t.appendChild(e);
  }
  focus(t) {
    if (!this.editable) return;
    this.editable.focus();
    const e = window.getSelection();
    if (!e) return;
    const s = this.editable.ownerDocument.createRange();
    s.selectNodeContents(this.editable), s.collapse(t !== "end"), e.removeAllRanges(), e.addRange(s);
  }
  getEditable() {
    return this.editable;
  }
  /**
   * Split this block's content at a DOM range (the caret). Returns the
   * [before, after] data shapes; the DOM is mutated in place (the prefix
   * stays in the editable, the remainder is extracted).
   */
  splitAtRange(t) {
    if (!this.editable) return null;
    const { before: e, after: s } = Wn(this.editable, t), n = this.tagDataShape(), i = { ...n, content: e }, r = { ...n, content: s };
    return [i, r];
  }
  /** Extra fields kept on split (e.g. heading level). */
  tagDataShape() {
    return {};
  }
  destroy() {
  }
}
const At = class At extends Mt {
  constructor(t) {
    var s;
    const e = (s = t.config) == null ? void 0 : s.placeholder;
    super(t, typeof e == "string" ? e : "", !1);
  }
  tag() {
    return "p";
  }
  save(t) {
    return { content: z(this.editable) };
  }
};
At.toolbox = { icon: j.paragraph, title: "Paragraph", category: "Basic blocks" }, At.conversion = { to: ["heading", "list", "quote", "code", "delimiter"] }, At.enableInlineTools = !0;
let ge = At;
const ut = class ut extends Mt {
  constructor(t) {
    var i;
    super(t, "", !1), this.levels = [1, 2, 3], this.level = 2;
    const e = (i = t.config) == null ? void 0 : i.levels;
    if (Array.isArray(e)) {
      const r = e.filter((a) => typeof a == "number" && a >= 1 && a <= 6);
      r.length > 0 && (this.levels = r);
    }
    const s = this.api.getData(), n = Number(s == null ? void 0 : s.level);
    this.level = this.levels.includes(n) ? n : this.levels[0] ?? 2;
  }
  tag() {
    return `h${this.level}`;
  }
  save(t) {
    return { level: this.level, content: z(this.editable) };
  }
  tagDataShape() {
    return { level: this.level };
  }
  /** Level switcher rendered inside the block settings menu. */
  renderSettings() {
    if (this.levels.length < 2) return null;
    const t = document.createElement("div");
    t.className = "ez-inline-group";
    for (const e of this.levels) {
      const s = document.createElement("button");
      s.type = "button", s.className = "ez-inline-btn" + (e === this.level ? " ez-active" : ""), s.textContent = `H${e}`, s.setAttribute("aria-label", `Heading level ${e}`), s.setAttribute("aria-pressed", String(e === this.level)), s.addEventListener("click", () => {
        this.api.readOnly || (this.level = e, this.api.update({ level: this.level, content: z(this.editable) }), this.refreshElement(), this.api.focus("end"));
      }), t.appendChild(s);
    }
    return t;
  }
  updated() {
    const t = this.api.getData(), e = Number(t == null ? void 0 : t.level), s = this.levels.includes(e) ? e : this.level;
    if (s !== this.level || !this.editable || this.editable.tagName.toLowerCase() !== `h${s}`) {
      this.level = s, this.refreshElement();
      return;
    }
    super.updated();
  }
  refreshElement() {
    var s;
    if (!((s = this.editable) != null && s.parentElement)) return;
    const t = this.editable, e = this.render();
    t.replaceWith(e), this.editable = e;
  }
};
ut.toolbox = { icon: j.heading, title: "Heading", category: "Basic blocks" }, ut.shortcut = "CMD+SHIFT+2", ut.conversion = { to: ["paragraph", "list", "quote"] }, ut.enableInlineTools = !0;
let me = ut;
const St = class St extends Mt {
  constructor(t) {
    super(t, "", !1);
  }
  tag() {
    return "blockquote";
  }
  save(t) {
    return { content: z(this.editable) };
  }
};
St.toolbox = { icon: j.quote, title: "Quote", category: "Basic blocks" }, St.conversion = { to: ["paragraph", "heading", "list"] }, St.enableInlineTools = !0;
let be = St;
const ft = class ft extends Mt {
  constructor(t) {
    super(t, "Enter code...", !0);
  }
  tag() {
    return "pre";
  }
  render() {
    var n;
    const e = (((n = this.editable) == null ? void 0 : n.ownerDocument) ?? document).createElement("pre");
    e.classList.add("ez-text-input", "ez-code"), e.contentEditable = "true", e.setAttribute("data-ez-editable", "true"), e.setAttribute("data-ez-placeholder", this.placeholder), e.setAttribute("data-ez-multiline", "true"), e.setAttribute("data-ez-plain", "true"), e.spellcheck = !1;
    const s = this.api.getData();
    return typeof (s == null ? void 0 : s.code) == "string" && s.code !== "" && (e.textContent = s.code), this.editable = e, e;
  }
  save(t) {
    return { code: (this.editable.innerText ?? this.editable.textContent ?? "").replace(/\n$/, "") };
  }
  validate(t) {
    return typeof (t == null ? void 0 : t.code) == "string";
  }
  updated() {
    if (!this.editable) return;
    const t = this.api.getData();
    this.editable.textContent !== (t == null ? void 0 : t.code) && (this.editable.textContent = (t == null ? void 0 : t.code) ?? "");
  }
};
ft.toolbox = { icon: j.code, title: "Code", category: "Basic blocks" }, ft.shortcut = "CMD+SHIFT+C", ft.enterKey = "newline", ft.conversion = { to: ["paragraph", "delimiter"] };
let ye = ft;
const xt = class xt {
  constructor(t) {
    this.api = t.api;
  }
  render() {
    const t = document.createElement("div");
    return t.className = "ez-delimiter", t.setAttribute("role", "separator"), this.api, t;
  }
  save() {
    return {};
  }
  validate() {
    return !0;
  }
  focus() {
  }
  destroy() {
  }
};
xt.toolbox = { icon: j.delimiter, title: "Divider", category: "Basic blocks" }, xt.enterKey = "ignore", xt.conversion = { to: ["paragraph"] };
let ke = xt;
const pt = class pt {
  constructor(t) {
    var n;
    this.style = "unordered", this.api = t.api;
    const e = (n = t.config) == null ? void 0 : n.style;
    (e === "ordered" || e === "unordered" || e === "task") && (this.style = e);
    const s = t.api.getData();
    ((s == null ? void 0 : s.style) === "ordered" || (s == null ? void 0 : s.style) === "unordered" || (s == null ? void 0 : s.style) === "task") && (this.style = s.style);
  }
  tag() {
    return this.style === "ordered" ? "ol" : "ul";
  }
  render() {
    var r;
    const t = ((r = this.editable) == null ? void 0 : r.ownerDocument) ?? document, e = t.createElement("div");
    e.classList.add("ez-text-input", "ez-list"), e.contentEditable = "true", e.setAttribute("data-ez-editable", "true"), e.setAttribute("data-ez-multiline", "true");
    const s = t.createElement(this.tag()), n = this.api.getData();
    return (Array.isArray(n == null ? void 0 : n.items) && n.items.length > 0 ? n.items : [{ content: [] }]).forEach((a, l) => {
      const c = t.createElement("li");
      this.style === "task" && (c.appendChild(this.createCheckbox((a == null ? void 0 : a.checked) === !0, l, c)), c.classList.toggle("ez-task-checked", (a == null ? void 0 : a.checked) === !0)), a != null && a.content && !Nt(a.content) && c.appendChild(F(a.content, t)), s.appendChild(c);
    }), e.appendChild(s), e.addEventListener("input", () => this.ensureCheckboxes()), this.editable = e, this.listEl = s, e;
  }
  createCheckbox(t, e, s) {
    const i = s.ownerDocument.createElement("input");
    return i.type = "checkbox", i.className = "ez-task-checkbox", i.checked = t, i.setAttribute("aria-label", `Task ${e + 1}`), this.api.readOnly ? i.disabled = !0 : i.addEventListener("change", () => {
      i.disabled = !1, s.classList.toggle("ez-task-checked", i.checked), this.api.update(this.save(this.editable));
    }), i;
  }
  /** Inject a checkbox into every task <li> that is missing one. */
  ensureCheckboxes() {
    if (this.style !== "task" || this.api.readOnly || !this.listEl) return;
    let t = 0;
    for (const e of Array.from(this.listEl.children))
      e.tagName === "LI" && (t++, !e.querySelector(".ez-task-checkbox") && (e.prepend(this.createCheckbox(!1, t - 1, e)), e.classList.remove("ez-task-checked")));
  }
  save(t) {
    const e = [];
    for (const s of Array.from(this.listEl.children)) {
      if (s.tagName !== "LI") continue;
      const n = { content: z(s) };
      if (this.style === "task") {
        const i = s.querySelector(".ez-task-checkbox");
        n.checked = (i == null ? void 0 : i.checked) === !0;
      }
      e.push(n);
    }
    return e.length === 0 && e.push({ content: [] }), { style: this.style, items: ss(e) };
  }
  validate(t) {
    return !!t && Array.isArray(t.items);
  }
  merge(t) {
    var i;
    const e = ((i = this.api.getData()) == null ? void 0 : i.items) ?? [], s = ss([...e, ...(t == null ? void 0 : t.items) ?? []]), n = { style: this.style, items: s };
    return this.api.update(n), n;
  }
  /** Toggle between ordered and unordered (block settings entry). */
  renderSettings() {
    var s;
    const t = ((s = this.editable) == null ? void 0 : s.ownerDocument) ?? document, e = t.createElement("div");
    e.className = "ez-inline-group";
    for (const n of ["unordered", "ordered", "task"]) {
      const i = t.createElement("button");
      i.type = "button", i.className = "ez-inline-btn", i.textContent = n === "ordered" ? "Numbered" : n === "task" ? "Tasks" : "Bulleted", i.setAttribute("aria-pressed", String(this.style === n)), i.addEventListener("click", () => {
        this.api.readOnly || (this.style = n, this.api.update(this.save(this.editable)), this.refreshElement(), this.api.focus("end"));
      }), e.appendChild(i);
    }
    return e;
  }
  updated() {
    var i, r;
    const t = this.api.getData(), e = (t == null ? void 0 : t.style) === "ordered" ? "ordered" : (t == null ? void 0 : t.style) === "unordered" ? "unordered" : (t == null ? void 0 : t.style) === "task" ? "task" : this.style;
    if (!this.editable || !this.listEl || e !== this.style) {
      this.style = e, this.refreshElement();
      return;
    }
    const s = Array.from(this.listEl.children).filter((a) => a.tagName === "LI"), n = (t == null ? void 0 : t.items) ?? [];
    if (s.length !== n.length) {
      this.refreshElement();
      return;
    }
    for (let a = 0; a < s.length; a++) {
      const l = s[a], c = ((i = n[a]) == null ? void 0 : i.content) ?? [], d = z(l);
      if (JSON.stringify(R(d)) !== JSON.stringify(R(c))) {
        for (; l.firstChild; ) l.removeChild(l.firstChild);
        l.appendChild(F(c, l.ownerDocument));
      }
      if (this.style === "task") {
        const u = l.querySelector(".ez-task-checkbox");
        if (u) {
          const h = ((r = n[a]) == null ? void 0 : r.checked) === !0;
          u.checked !== h && (u.checked = h, l.classList.toggle("ez-task-checked", h));
        }
      }
    }
  }
  /** List items split natively by the browser; no custom split. */
  splitAtRange() {
    return null;
  }
  focus(t) {
    if (!this.editable) return;
    this.editable.focus();
    const e = window.getSelection();
    if (!e) return;
    const s = Array.from(this.listEl.children).filter((r) => r.tagName === "LI"), n = t === "end" ? s[s.length - 1] : s[0];
    if (!n) return;
    const i = this.editable.ownerDocument.createRange();
    i.selectNodeContents(n), i.collapse(t !== "end"), e.removeAllRanges(), e.addRange(i);
  }
  getEditable() {
    return this.editable;
  }
  destroy() {
  }
  refreshElement() {
    var s;
    if (!((s = this.editable) != null && s.parentElement)) return;
    const t = this.editable, e = this.render();
    t.replaceWith(e), this.editable = e, this.listEl = e.firstElementChild ?? e;
  }
};
pt.toolbox = { icon: j.list, title: "List", category: "Basic blocks" }, pt.shortcut = "CMD+SHIFT+L", pt.conversion = { to: ["paragraph", "quote", "heading"] }, pt.enableInlineTools = !0;
let ve = pt;
function ss(o) {
  return o.map((t) => {
    const e = { content: R((t == null ? void 0 : t.content) ?? []) };
    return (t == null ? void 0 : t.checked) !== void 0 && (e.checked = t.checked), e;
  });
}
function p(o, t, e) {
  const s = document.createElement(o);
  return t && (s.className = t), e !== void 0 && (s.textContent = e), s;
}
function A(o, t, e) {
  const s = p("button", o);
  return s.type = "button", s.textContent = t, s.setAttribute("aria-label", e ?? t), s;
}
function E(o, t, e) {
  const s = p("button", o);
  s.type = "button", s.setAttribute("aria-label", e), s.title = e, s.innerHTML = t;
  for (const n of Array.from(s.querySelectorAll("svg")))
    n.setAttribute("stroke-width", "1.8");
  return s;
}
function N(o) {
  for (; o.firstChild; ) o.removeChild(o.firstChild);
}
function _i(o, t = 8) {
  o.style.maxWidth = `calc(100vw - ${t * 2}px)`, o.style.maxHeight = `calc(100dvh - ${t * 2}px)`;
  const e = o.getBoundingClientRect(), s = Math.max(t, Math.min(e.left, window.innerWidth - t - e.width)), n = Math.max(t, Math.min(e.top, window.innerHeight - t - e.height));
  o.style.transform = "none", o.style.position = "fixed", o.style.left = `${s}px`, o.style.top = `${n}px`;
}
function we(o) {
  o.hidePopover && o.matches(":popover-open") && o.hidePopover();
}
function _(o, t, e = "below") {
  o.showPopover && o.isConnected && (o.setAttribute("popover", "manual"), o.matches(":popover-open") || o.showPopover()), o.style.position = "fixed", o.style.transform = "none", o.style.margin = "0", o.style.inset = "auto", o.style.left = `${t.left}px`, o.style.top = `${t.bottom + 6}px`;
  const s = o.getBoundingClientRect().height;
  (e === "above" || t.bottom + 6 + s > window.innerHeight - 8) && t.top > s + 8 && (o.style.top = `${t.top - s - 6}px`), _i(o);
}
function te(o, t) {
  var i;
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(o.key) || o.target.matches("input, select, textarea")) return;
  const e = Array.from(t.querySelectorAll("button:not(:disabled), select:not(:disabled)")), s = e.indexOf(document.activeElement), n = o.key === "Home" ? 0 : o.key === "End" ? e.length - 1 : (s + (o.key === "ArrowDown" ? 1 : -1) + e.length) % e.length;
  (i = e[n]) == null || i.focus(), o.preventDefault();
}
function Ne(o, t, e) {
  var s;
  try {
    (s = o.ownerDocument) == null || s.execCommand(t, !1, e);
  } catch {
  }
}
function bt(o, t) {
  var e;
  try {
    return ((e = o.ownerDocument) == null ? void 0 : e.queryCommandState(t)) ?? !1;
  } catch {
    return !1;
  }
}
function ee(o, t, e) {
  let s = o.startContainer;
  for (; s && s !== t; ) {
    if (s.nodeType === Node.ELEMENT_NODE && e(s))
      return s;
    s = s.parentNode;
  }
  return null;
}
function Hi(o) {
  const t = window.getSelection(), e = /* @__PURE__ */ new Set();
  if (!t || t.rangeCount === 0) return e;
  const s = t.getRangeAt(0);
  if (!o.contains(s.commonAncestorContainer)) return e;
  bt(o, "bold") && e.add("bold"), bt(o, "italic") && e.add("italic"), bt(o, "underline") && e.add("underline");
  let n = s.startContainer;
  for (; n && n !== o; ) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const i = n.tagName;
      i === "CODE" && e.add("code"), i === "MARK" && e.add("mark"), i === "A" && e.add("link"), i === "SPAN" && n.hasAttribute("data-ez-mark") && e.add(n.getAttribute("data-ez-mark"));
    }
    n = n.parentNode;
  }
  return e;
}
function zt(o, t) {
  const e = o.startContainer.ownerDocument ?? t.ownerDocument, s = o.extractContents();
  t.appendChild(s), o.insertNode(t);
  const n = window.getSelection();
  if (n) {
    const i = e.createRange();
    i.selectNodeContents(t), n.removeAllRanges(), n.addRange(i);
  }
}
function Ee(o) {
  const t = o.parentNode;
  if (!t) return;
  const e = o.ownerDocument, s = o.firstChild, n = o.lastChild, i = e.createDocumentFragment();
  for (; o.firstChild; ) i.appendChild(o.firstChild);
  t.insertBefore(i, o);
  const r = window.getSelection();
  if (r && s && n) {
    const a = e.createRange();
    a.setStartBefore(s), a.setEndAfter(n), r.removeAllRanges(), r.addRange(a);
  }
  t.removeChild(o);
}
function Me(o, t) {
  const e = o.parentNode;
  if (!e) return;
  const s = o.ownerDocument, n = o.contains(t.startContainer), i = o.contains(t.endContainer), r = n ? t.startContainer : o, a = n ? t.startOffset : 0, l = i ? t.endContainer : o, c = i ? t.endOffset : o.childNodes.length, d = !n || r === o && a === 0, u = !i || l === o && c === o.childNodes.length;
  if (d && u) {
    Ee(o);
    return;
  }
  try {
    const h = s.createRange();
    h.setStart(o, 0), h.setEnd(r, a);
    const f = s.createRange();
    f.setStart(r, a), f.setEnd(l, c);
    const g = s.createRange();
    g.setStart(l, c), g.setEnd(o, o.childNodes.length);
    const m = h.extractContents(), y = f.extractContents(), v = g.extractContents(), w = m.firstChild ? o.cloneNode(!1) : null, I = v.firstChild ? o.cloneNode(!1) : null;
    w && (w.appendChild(m), e.insertBefore(w, o)), e.insertBefore(y, o), I && (I.appendChild(v), e.insertBefore(I, o)), e.removeChild(o);
  } catch {
    Ee(o);
  }
}
function $s(o, t, e, s) {
  var m, y;
  const n = t instanceof HTMLElement ? t : t.commonAncestorContainer, r = (((m = n instanceof Element ? n : n.parentElement) == null ? void 0 : m.ownerDocument) ?? document).createElement("div");
  r.className = "ez-popover ez-inline-popover", r.setAttribute("role", "dialog"), r.setAttribute("aria-label", o.getAttribute("aria-label") ?? "Link"), r.setAttribute("data-ez-ui", "true"), r.appendChild(o);
  const a = ((y = n instanceof Element ? n : n.parentElement) == null ? void 0 : y.closest(".ez-editor")) ?? document.body;
  a.appendChild(r);
  const l = () => {
    const v = s != null && s.isConnected && s.getClientRects().length ? s : t;
    _(r, v.getBoundingClientRect(), t instanceof HTMLElement ? "below" : "above");
  };
  l();
  let c = !1;
  const d = (v) => {
    v.key === "Escape" && (v.preventDefault(), v.stopPropagation(), f());
  }, u = (v) => {
    r.contains(v.target) || f(!1);
  }, h = (v) => {
    r.contains(v.target) || f(!1);
  };
  function f(v = !0) {
    c || (c = !0, document.removeEventListener("keydown", d, !0), document.removeEventListener("mousedown", u, !0), document.removeEventListener("focusin", h), window.removeEventListener("resize", l), document.removeEventListener("scroll", l, !0), a.removeEventListener("ez-close-popovers", g), r.remove(), v && (e == null || e()));
  }
  const g = () => f(!1);
  return document.addEventListener("keydown", d, !0), document.addEventListener("mousedown", u, !0), document.addEventListener("focusin", h), window.addEventListener("resize", l), document.addEventListener("scroll", l, !0), a.addEventListener("ez-close-popovers", g), { close: f };
}
class kt {
  constructor(t) {
    this.node = null, this.options = t;
  }
  render() {
    var s;
    const t = this.options.t(this.labelKey), e = this.icon ? E("ez-inline-tool-btn", this.icon, t) : A("ez-inline-tool-btn", t, t);
    return (s = e.querySelector("svg")) == null || s.setAttribute("aria-hidden", "true"), e.addEventListener("click", () => this.toggle()), e.title = t, e.setAttribute("data-ez-inline-tool", this.markType), e.setAttribute("aria-pressed", "false"), this.node = e, e;
  }
  /** Optional Lucide icon; a text label renders when undefined. */
  get icon() {
  }
  isActive(t) {
    return !1;
  }
  /** Toolbar uses this to sync the active visual state. */
  setActive(t) {
    var e, s;
    (e = this.node) == null || e.classList.toggle("ez-active", t), (s = this.node) == null || s.setAttribute("aria-pressed", String(t));
  }
  /** Toggle the mark on the current DOM selection; returns new state. */
  toggle() {
    var t, e;
    (e = (t = this.options).onActivate) == null || e.call(t);
  }
  destroy() {
    this.node = null;
  }
}
class Re extends kt {
  constructor(t, e, s) {
    super(t), this.markType = e, this.tag = s;
  }
  get labelKey() {
    return `inline.${this.markType}`;
  }
  apply(t, e) {
    const s = ee(
      t,
      e.blockElement,
      (n) => {
        var i;
        return n.tagName === this.tag.toUpperCase() || ((i = n.getAttribute) == null ? void 0 : i.call(n, "data-ez-mark")) === this.markType;
      }
    );
    if (s)
      Me(s, t);
    else if (this.markType === "code" || this.markType === "mark") {
      const n = e.blockElement.ownerDocument.createElement(this.tag);
      zt(t, n);
    } else {
      const n = e.blockElement.ownerDocument.createElement("span");
      n.setAttribute("data-ez-mark", this.markType), zt(t, n);
    }
    e.requestSave();
  }
}
class ji extends kt {
  constructor() {
    super(...arguments), this.markType = "bold";
  }
  get labelKey() {
    return "inline.bold";
  }
  get icon() {
    return b.bold;
  }
  apply(t, e) {
    Ne(e.blockElement, "bold"), e.requestSave();
  }
  isActive() {
    return bt(document, "bold");
  }
}
class Ui extends kt {
  constructor() {
    super(...arguments), this.markType = "italic";
  }
  get labelKey() {
    return "inline.italic";
  }
  get icon() {
    return b.italic;
  }
  apply(t, e) {
    Ne(e.blockElement, "italic"), e.requestSave();
  }
  isActive() {
    return bt(document, "italic");
  }
}
class qi extends kt {
  constructor() {
    super(...arguments), this.markType = "underline";
  }
  get labelKey() {
    return "inline.underline";
  }
  get icon() {
    return b.underline;
  }
  apply(t, e) {
    Ne(e.blockElement, "underline"), e.requestSave();
  }
  isActive() {
    return bt(document, "underline");
  }
}
class Wi extends Re {
  constructor(t) {
    super(t, "code", "code");
  }
  get icon() {
    return b.code;
  }
}
class Vi extends Re {
  constructor(t) {
    super(t, "mark", "mark");
  }
  get icon() {
    return b.highlighter;
  }
}
class Ki extends Re {
  constructor(t) {
    super(t, "strike", "s");
  }
  get icon() {
    return b.strikethrough;
  }
  apply(t, e) {
    const s = ee(t, e.blockElement, (n) => {
      var i;
      return n.tagName === "S" || ((i = n.getAttribute) == null ? void 0 : i.call(n, "data-ez-mark")) === "strike";
    });
    if (s)
      Me(s, t);
    else {
      const n = e.blockElement.ownerDocument.createElement("s");
      zt(t, n);
    }
    e.requestSave();
  }
}
const Ji = [
  "var(--ez-text)",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#ec4899",
  "#7c3aed",
  "transparent"
];
class Ps extends kt {
  get labelKey() {
    return `inline.${this.markType}`;
  }
  apply(t, e) {
    t.collapsed || this.promptForColor(t, e);
  }
  promptForColor(t, e) {
    const s = p("div", "ez-color-form");
    s.setAttribute("aria-label", this.options.t(this.labelKey));
    const n = () => {
      if (!t.startContainer.isConnected || e.blockElement.contentEditable === "false") return;
      e.blockElement.focus();
      const r = window.getSelection();
      r == null || r.removeAllRanges(), r == null || r.addRange(t);
    };
    for (const r of Ji) {
      const a = p("button", "ez-color-swatch");
      a.type = "button", a.setAttribute("aria-label", r === "transparent" ? "Remove color" : `Set ${this.markType} color ${r}`), a.style.background = r, a.title = r, a.addEventListener("click", () => {
        n();
        const l = Zi(t, e.blockElement, this.markType);
        if (l && Me(l, t), r !== "transparent") {
          const c = e.blockElement.ownerDocument.createElement("span");
          c.setAttribute("data-ez-mark", this.markType), c.setAttribute(`data-ez-${this.markType}`, r), c.style.setProperty(this.markType === "color" ? "color" : "background-color", r), zt(t, c);
        }
        e.requestSave(), i(), e.closeToolbar();
      }), s.appendChild(a);
    }
    const { close: i } = $s(s, t.cloneRange(), n, this.node ?? void 0);
  }
}
function Zi(o, t, e) {
  var n;
  let s = o.startContainer;
  for (; s && s !== t; ) {
    if (s.nodeType === Node.ELEMENT_NODE) {
      const i = s;
      if (((n = i.getAttribute) == null ? void 0 : n.call(i, "data-ez-mark")) === e) return i;
    }
    s = s.parentNode;
  }
  return null;
}
class Gi extends Ps {
  constructor() {
    super(...arguments), this.markType = "color";
  }
  get icon() {
    return b.textColor;
  }
}
class Yi extends Ps {
  constructor() {
    super(...arguments), this.markType = "background";
  }
  get icon() {
    return b.backgroundColor;
  }
}
class Xi extends kt {
  constructor() {
    super(...arguments), this.markType = "link";
  }
  get labelKey() {
    return "inline.link";
  }
  get icon() {
    return b.link;
  }
  apply(t, e) {
    const s = ee(t, e.blockElement, (n) => n.tagName === "A");
    this.promptForUrl(t.cloneRange(), e, s);
  }
  isActive(t) {
    return !1;
  }
  promptForUrl(t, e, s) {
    const n = p("form", "ez-link-form");
    n.setAttribute("aria-label", this.options.t("inline.link"));
    const i = p("input", "ez-link-input");
    i.type = "text", i.inputMode = "url", i.placeholder = "https://", i.value = (s == null ? void 0 : s.getAttribute("href")) ?? "", i.setAttribute("aria-label", this.options.t("inline.linkUrl"));
    const r = A("ez-btn ez-btn-primary", this.options.t("inline.linkApply")), a = A("ez-btn", this.options.t("inline.linkRemove"));
    a.disabled = !s;
    const l = A("ez-btn", this.options.t("inline.linkCancel")), c = p("div", "ez-field-error");
    c.id = `ez-link-error-${++Qi}`, c.setAttribute("role", "alert"), i.setAttribute("aria-describedby", c.id);
    const d = p("div", "ez-link-actions");
    d.append(r, a, l), n.append(i, c, d);
    const u = () => {
      if (!t.startContainer.isConnected || e.blockElement.contentEditable === "false") return;
      e.blockElement.focus();
      const g = window.getSelection();
      g == null || g.removeAllRanges(), g == null || g.addRange(t);
    }, { close: h } = $s(n, t, u, this.node ?? void 0), f = () => {
      const g = i.value.trim();
      if (!g || !tr(g)) {
        i.setAttribute("aria-invalid", "true"), c.textContent = this.options.t("inline.linkInvalid"), i.focus();
        return;
      }
      if (u(), s)
        s.setAttribute("href", g);
      else {
        const m = e.blockElement.ownerDocument.createElement("a");
        if (m.setAttribute("href", g), m.setAttribute("rel", "noopener noreferrer"), t.collapsed) {
          const y = e.blockElement.ownerDocument;
          m.textContent = g, t.insertNode(m);
          const v = window.getSelection();
          if (v) {
            const w = y.createRange();
            w.setStartAfter(m), w.collapse(!0), v.removeAllRanges(), v.addRange(w);
          }
        } else
          zt(t, m);
      }
      e.requestSave(), h(), e.closeToolbar();
    };
    r.addEventListener("click", f), a.addEventListener("click", () => {
      s && (u(), Ee(s), e.requestSave()), h(), e.closeToolbar();
    }), l.addEventListener("click", () => h()), i.addEventListener("input", () => {
      i.removeAttribute("aria-invalid"), c.textContent = "";
    }), n.addEventListener("submit", (g) => {
      g.preventDefault(), f();
    }), i.focus();
  }
}
let Qi = 0;
function tr(o) {
  try {
    const t = new URL(o, "https://ezynota.invalid");
    return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
  } catch {
    return !1;
  }
}
const _s = {
  bold: ji,
  italic: Ui,
  underline: qi,
  strike: Ki,
  code: Wi,
  mark: Vi,
  color: Gi,
  background: Yi,
  link: Xi
}, ne = ["left", "center", "right"], er = {
  left: b.alignLeft,
  center: b.alignCenter,
  right: b.alignRight
}, Ue = class Ue {
  constructor(t) {
    this.value = "left", this.api = t.api, this.t = t.t, this.onChange = t.onChange;
    const e = t.value;
    this.value = ne.includes(e) ? e : "left";
  }
  render() {
    const t = document.createElement("div");
    t.className = "ez-inline-group";
    for (const e of ne) {
      const s = this.t(`tune.alignment.${e}`), n = E(
        "ez-inline-btn" + (e === this.value ? " ez-active" : ""),
        er[e],
        s
      );
      n.setAttribute("aria-pressed", String(e === this.value)), n.addEventListener("click", () => {
        var i;
        if (!this.api.readOnly) {
          this.value = e, (i = this.onChange) == null || i.call(this, e);
          for (const r of Array.from(t.children))
            r.classList.remove("ez-active"), r.setAttribute("aria-pressed", "false");
          n.classList.add("ez-active"), n.setAttribute("aria-pressed", "true"), this.applyWrap();
        }
      }), t.appendChild(n);
    }
    return t;
  }
  save() {
    return this.value;
  }
  wrap(t) {
    return this.applyTo(t), t;
  }
  /** Re-apply the current alignment to a wrap element (non-destructive update). */
  applyTo(t) {
    t.classList.remove("ez-align-left", "ez-align-center", "ez-align-right"), this.value !== "left" && t.classList.add(`ez-align-${this.value}`);
  }
  /** Accept an externally committed tune value (e.g. undo/redo) without a rebuild. */
  setValue(t) {
    this.value = ne.includes(t) ? t : "left";
  }
  applyWrap() {
    this.applyTo(this.api.element);
  }
  destroy() {
  }
};
Ue.title = "Alignment";
let Bt = Ue;
class ns {
  constructor(t) {
    this.api = t.api;
  }
  render() {
    const t = this.api.element.ownerDocument ?? document, e = t.createElement("div");
    e.className = "ez-unknown-block", e.setAttribute("data-ez-unsupported", "true"), e.setAttribute("tabindex", "0");
    const s = t.createElement("div");
    s.className = "ez-unknown-block-label", s.textContent = `Unsupported block type "${this.api.type}" — content preserved`;
    const n = t.createElement("pre");
    n.className = "ez-unknown-block-data";
    try {
      n.textContent = JSON.stringify(this.api.getData(), null, 2) ?? "";
    } catch {
      n.textContent = "";
    }
    return e.appendChild(s), e.appendChild(n), e;
  }
  /** Preserve the original data verbatim. */
  save() {
    return JSON.parse(JSON.stringify(this.api.getData()));
  }
}
class sr {
  constructor(t, e) {
    this.rendered = /* @__PURE__ */ new Map(), this.childrenSignatures = /* @__PURE__ */ new Map(), this.blockSignatures = /* @__PURE__ */ new Map(), this.tuneSignatures = /* @__PURE__ */ new Map(), this.suspended = 0, this.observer = null, this.destroyed = !1, this.hostApi = t, this.target = e, this.blocksRoot = t.target.ownerDocument.createElement("div"), this.blocksRoot.className = "ez-blocks", this.blocksRoot.setAttribute("role", "presentation"), e.appendChild(this.blocksRoot);
  }
  /** Re-render (or re-render) the full document. */
  renderAll(t) {
    if (!this.destroyed) {
      this.suspend();
      for (const [e] of this.rendered)
        this.destroyToolDom(e);
      for (this.rendered.clear(), this.childrenSignatures.clear(), this.blockSignatures.clear(), this.tuneSignatures.clear(); this.blocksRoot.firstChild; ) this.blocksRoot.removeChild(this.blocksRoot.firstChild);
      for (const e of t)
        this.renderBlockInto(e);
      this.resume(), this.updateEmptyHint(t.length === 0), this.refreshPlaceholderScope();
    }
  }
  destroyToolDom(t) {
    var s, n, i, r;
    const e = this.rendered.get(t);
    if (e) {
      try {
        (n = (s = e.tool).destroy) == null || n.call(s);
        for (const a of e.tunes) (r = (i = a.instance).destroy) == null || r.call(i);
      } catch {
      }
      e.element.remove(), this.rendered.delete(t);
    }
  }
  /** Create DOM for a single block at its state index. */
  insert(t, e, s) {
    this.destroyed || (this.suspend(), this.renderBlockInto(t, e), this.resume(), this.updateEmptyHint(!1), this.refreshPlaceholderScope());
  }
  remove(t) {
    var n, i, r, a;
    const e = this.rendered.get(t);
    if (!e) return;
    const s = e.tool;
    try {
      (n = s.removed) == null || n.call(s), (i = s.destroy) == null || i.call(s);
      for (const l of e.tunes) (a = (r = l.instance).destroy) == null || a.call(r);
    } catch {
    }
    e.element.remove(), this.rendered.delete(t), this.childrenSignatures.delete(t), this.blockSignatures.delete(t), this.tuneSignatures.delete(t), this.updateEmptyHint(this.rendered.size === 0), this.refreshPlaceholderScope();
  }
  move(t, e) {
    var c;
    const s = this.rendered.get(t);
    if (!s) return;
    const n = Array.from(this.blocksRoot.children).indexOf(s.element), i = Array.from(this.blocksRoot.children).filter((d) => d !== s.element), r = Math.max(0, Math.min(e, i.length)), a = i[r] ?? null;
    this.blocksRoot.insertBefore(s.element, a);
    const l = s.tool;
    try {
      (c = l.moved) == null || c.call(l, { from: n, to: r });
    } catch {
    }
  }
  update(t, e) {
    const s = this.rendered.get(t);
    if (!s) return;
    const n = this.hostApi.blocks.getById(t);
    if (e === "user") {
      if (n) {
        const i = JSON.stringify(n.children ?? []);
        this.childrenSignatures.get(t) !== i && (this.childrenSignatures.set(t, i), this.callUpdated(s));
      }
      return;
    }
    n && this.childrenSignatures.set(t, JSON.stringify(n.children ?? [])), this.callUpdated(s);
  }
  callUpdated(t) {
    var e, s;
    try {
      (s = (e = t.tool).updated) == null || s.call(e);
    } catch {
    }
  }
  convert(t, e) {
    var n, i, r, a;
    const s = this.rendered.get(t);
    if (!(s && this.applyTuneUpdate(t, s, e))) {
      if (s) {
        try {
          (i = (n = s.tool).destroy) == null || i.call(n);
          for (const l of s.tunes) (a = (r = l.instance).destroy) == null || a.call(r);
        } catch {
        }
        s.element.remove(), this.rendered.delete(t), this.childrenSignatures.delete(t), this.blockSignatures.delete(t), this.tuneSignatures.delete(t);
      }
      this.suspend(), this.renderBlockInto(e, this.stateIndexOf(t)), this.resume(), this.refreshPlaceholderScope();
    }
  }
  /**
   * Non-destructive tune update: when only the tunes changed (the block
   * type and data are unchanged), apply the tune values to the existing
   * wrap element instead of destroying and rebuilding the tool. Used by
   * editor.applyToDom for tune:update (e.g. alignment clicks and undo/redo).
   */
  applyTuneUpdate(t, e, s) {
    var r;
    if (this.blockSignatures.get(t) !== is(s)) return !1;
    const i = [];
    for (const a of e.tunes) {
      const l = a.instance;
      if (typeof l.setValue != "function" || typeof l.applyTo != "function")
        return !1;
      i.push({ tune: a, setValue: l.setValue, applyTo: l.applyTo });
    }
    for (const a of i)
      a.setValue(((r = s.tunes) == null ? void 0 : r[a.tune.name]) ?? null), a.applyTo(e.host);
    return this.tuneSignatures.set(t, JSON.stringify(s.tunes ?? {})), !0;
  }
  stateIndexOf(t) {
    return this.hostApi.getBlockIndex(t);
  }
  renderBlockInto(t, e) {
    var u, h, f, g, m;
    const s = this.target.ownerDocument, n = this.hostApi.registry.has(t.type), i = n ? this.hostApi.registry.get(t.type) : void 0, r = s.createElement("div");
    r.className = "ez-block", r.setAttribute("data-ez-block-id", t.id), r.setAttribute("data-ez-block-type", t.type), r.setAttribute("role", "group"), r.setAttribute("aria-label", n ? ((u = i == null ? void 0 : i.toolbox) == null ? void 0 : u.title) ?? t.type : `Unsupported block (${t.type})`);
    const a = nr(s, t.type);
    r.appendChild(a);
    let l;
    try {
      l = n ? this.createToolInstance(t, a) : new ns({ api: this.blockApiForTool(t.id, a) }), a.appendChild(l.render());
    } catch {
      for (; a.firstChild; ) a.removeChild(a.firstChild);
      l = new ns({ api: this.blockApiForTool(t.id, a) }), a.appendChild(l.render());
    }
    const c = Array.from(a.querySelectorAll("[data-ez-editable]"));
    for (const y of c)
      y.contentEditable = this.hostApi.readOnly ? "false" : "true", y.setAttribute("aria-label", n ? ((h = i == null ? void 0 : i.toolbox) == null ? void 0 : h.title) ?? t.type : `Unsupported block (${t.type})`), y.setAttribute("role", "textbox"), y.setAttribute("aria-multiline", "true");
    c.length === 0 && (r.tabIndex = 0, r.addEventListener("focus", () => {
      const y = r.ownerDocument.createRange();
      y.selectNodeContents(r), y.collapse(!0), this.hostApi.setSelectionFromRange(y);
    }));
    try {
      (f = l.rendered) == null || f.call(l);
    } catch {
    }
    const d = [];
    for (const y of this.hostApi.registry.listTunes())
      try {
        const v = this.hostApi.registry.createTune(y.name, {
          api: this.blockApiFor(t.id),
          config: {},
          value: ((g = t.tunes) == null ? void 0 : g[y.name]) ?? null,
          onChange: (w) => this.hostApi.blocks.setTune(t.id, y.name, w),
          t: (w) => this.hostApi.i18n.t(w)
        });
        (m = v.wrap) == null || m.call(v, a), d.push({ name: y.name, instance: v });
      } catch {
      }
    if (this.rendered.set(t.id, { element: r, host: a, tool: l, tunes: d }), this.childrenSignatures.set(t.id, JSON.stringify(t.children ?? [])), this.blockSignatures.set(t.id, is(t)), this.tuneSignatures.set(t.id, JSON.stringify(t.tunes ?? {})), typeof e == "number") {
      const y = this.blocksRoot.children[e] ?? null;
      this.blocksRoot.insertBefore(r, y);
    } else {
      const y = this.stateIndexOf(t.id), v = this.blocksRoot.children[y] ?? null;
      this.blocksRoot.insertBefore(r, v);
    }
    this.refreshEditableFlags(r);
  }
  /** Instantiate the block tool. */
  createToolInstance(t, e) {
    var s, n;
    return this.hostApi.registry.createBlockTool(t.type, {
      api: this.blockApiForTool(t.id, e),
      // The note placeholder is managed by refreshPlaceholderScope(): it
      // only applies to a fresh note (exactly one block), not to every
      // empty block in the document.
      config: {},
      block: t,
      readOnly: this.hostApi.readOnly,
      locale: this.hostApi.i18n.getLocale(),
      // Tools that host nested child blocks (e.g. toggles) receive the
      // host for their own children; other tools ignore the option.
      nested: (n = (s = this.hostApi).nestedHost) == null ? void 0 : n.call(s, t.id)
    });
  }
  /** Instantiate a block tool for a nested child (collapsible sections). */
  createToolInstancePublic(t, e, s, n) {
    var r, a;
    n && (n = Object.assign(Object.create(n), { assetScope: this.hostApi.target }));
    const i = (a = (r = this.hostApi).nestedHost) == null ? void 0 : a.call(r, t.id);
    return this.hostApi.registry.createBlockTool(t.type, {
      api: n ?? this.blockApiForTool(t.id, e),
      config: {},
      block: t,
      readOnly: this.hostApi.readOnly,
      locale: this.hostApi.i18n.getLocale(),
      nested: i
    });
  }
  blockApiForTool(t, e) {
    const s = this.hostApi;
    return {
      assetScope: s.target,
      id: t,
      type: s.getBlockType(t) ?? "",
      get readOnly() {
        return s.readOnly;
      },
      element: e,
      getData: () => s.getBlockData(t),
      update: (n) => s.updateBlockData(t, n, "user"),
      patch: (n) => {
        const r = { ...s.getBlockData(t) ?? {}, ...n };
        s.updateBlockData(t, r);
      },
      requestSave: () => s.requestSaveBlock(t),
      focus: (n) => this.focus(t, n),
      remove: () => s.removeBlock(t, "user"),
      move: (n) => s.moveBlock(t, n),
      duplicate: () => s.duplicateBlock(t),
      convert: (n) => s.convertBlock(t, n)
    };
  }
  blockApiFor(t) {
    return this.blockApiForTool(t, this.getToolHost(t) ?? this.target);
  }
  getToolHost(t) {
    var e;
    return ((e = this.rendered.get(t)) == null ? void 0 : e.host) ?? null;
  }
  /** Focus the tool's primary editable element. */
  focus(t, e) {
    const s = this.rendered.get(t);
    if (!s) return;
    const n = s.tool;
    if (typeof n.focus == "function" && s.host.querySelector("[data-ez-editable]"))
      try {
        n.focus(e);
        return;
      } catch {
      }
    const i = s.host.querySelector("[data-ez-editable]");
    i ? i.focus() : s.element.focus();
  }
  getTool(t) {
    var e;
    return (e = this.rendered.get(t)) == null ? void 0 : e.tool;
  }
  getEditableElement(t) {
    const e = this.rendered.get(t);
    return e ? e.host.querySelector("[data-ez-editable]") ?? null : null;
  }
  getBlockElement(t) {
    var e;
    return ((e = this.rendered.get(t)) == null ? void 0 : e.element) ?? null;
  }
  setReadOnly(t) {
    var e, s;
    for (const [, n] of this.rendered) {
      for (const i of Array.from(n.host.querySelectorAll("[data-ez-editable]")))
        i.contentEditable = t ? "false" : "true";
      (s = (e = n.tool).updated) == null || s.call(e);
    }
    this.updateEmptyHint(this.rendered.size === 0);
  }
  /** Fallback: catch DOM changes that bypass the input flow. Only the
   * block(s) that own the mutated DOM nodes are reported. */
  startObserver(t) {
    this.observer || (this.observer = new MutationObserver((e) => {
      if (this.suspended > 0) return;
      const s = /* @__PURE__ */ new Set(), n = (i) => {
        var c;
        const r = i instanceof Element ? i : (i == null ? void 0 : i.parentElement) ?? null, a = (c = r == null ? void 0 : r.closest) == null ? void 0 : c.call(r, "[data-ez-block-id]"), l = a == null ? void 0 : a.getAttribute("data-ez-block-id");
        l && s.add(l);
      };
      for (const i of e)
        if (n(i.target), i.type === "childList")
          for (const r of Array.from(i.addedNodes)) n(r);
      for (const i of s) t(i);
    }), this.observer.observe(this.blocksRoot, { childList: !0, subtree: !0, characterData: !0 }));
  }
  stopObserver() {
    var t;
    (t = this.observer) == null || t.disconnect(), this.observer = null;
  }
  destroy() {
    var t, e, s, n;
    this.destroyed = !0, this.stopObserver();
    for (const [, i] of this.rendered)
      try {
        (e = (t = i.tool).destroy) == null || e.call(t);
        for (const r of i.tunes) (n = (s = r.instance).destroy) == null || n.call(s);
      } catch {
      }
    this.rendered.clear(), this.childrenSignatures.clear(), this.blockSignatures.clear(), this.tuneSignatures.clear(), this.blocksRoot.remove();
  }
  suspend() {
    this.suspended++;
  }
  resume() {
    this.suspended = Math.max(0, this.suspended - 1);
  }
  updateEmptyHint(t) {
    var n;
    if ((n = this.blocksRoot.querySelector(".ez-empty-input")) == null || n.remove(), !t) return;
    const s = this.blocksRoot.ownerDocument.createElement("p");
    s.className = "ez-text-input ez-empty-input", s.setAttribute("data-ez-placeholder", this.hostApi.placeholder), this.hostApi.readOnly ? s.textContent = this.hostApi.i18n.t("core.emptyDocument") : (s.contentEditable = "true", s.setAttribute("role", "textbox"), s.setAttribute("aria-label", this.hostApi.placeholder), s.addEventListener("focus", () => {
      if (!this.hostApi.readOnly && this.hostApi.blocks.length === 0) {
        const i = this.hostApi.insertBlock(this.hostApi.defaultBlock, void 0, { focus: !1 });
        this.hostApi.focusBlock(i, "start");
      }
    })), this.blocksRoot.appendChild(s);
  }
  refreshEditableFlags(t) {
    (t ?? this.blocksRoot).querySelectorAll("[data-ez-editable]").forEach((e) => {
      const s = (e.textContent ?? "").replace(/\u200B/g, "").trim() === "";
      e.setAttribute("data-ez-empty", s ? "true" : "false");
    });
  }
  /**
   * The note placeholder is only meaningful on a fresh note: when the
   * document contains exactly one block, its primary editable carries
   * `data-ez-note-placeholder` (shown by CSS while empty). In any other
   * situation empty blocks render as plain empty space.
   */
  refreshPlaceholderScope() {
    if (this.destroyed) return;
    for (const n of Array.from(this.blocksRoot.querySelectorAll("[data-ez-note-placeholder]")))
      n.removeAttribute("data-ez-note-placeholder");
    if (this.hostApi.readOnly) return;
    const t = this.blocksRoot.children;
    if (t.length !== 1) return;
    const s = t[0].querySelector("[data-ez-editable]");
    s && s.setAttribute("data-ez-note-placeholder", this.hostApi.placeholder);
  }
}
function is(o) {
  return JSON.stringify({ type: o.type, data: o.data });
}
function nr(o, t) {
  const e = o.createElement("div");
  return e.className = "ez-tool-host", e.setAttribute("data-ez-tool", t), e;
}
class ir {
  constructor(t, e) {
    this.bus = new Qs(), this.current = null, this.savedRange = null, this.started = !1, this.stopped = !1, this.disposers = [], this.host = t, this.target = e;
  }
  start() {
    if (this.started || this.stopped) return;
    this.started = !0;
    const t = () => {
      this.refresh();
    }, e = () => {
      this.refresh(), this.bus.emit("focus");
    }, s = (n) => {
      const i = n.relatedTarget;
      (!i || !this.target.contains(i)) && (this.bus.emit("blur"), this.target.contains(i) || (this.current = null, this.savedRange = null, this.bus.emit("selection", null)));
    };
    document.addEventListener("selectionchange", t), this.target.addEventListener("focusin", e), this.target.addEventListener("focusout", s), this.disposers.push(() => {
      document.removeEventListener("selectionchange", t), this.target.removeEventListener("focusin", e), this.target.removeEventListener("focusout", s);
    });
  }
  stop() {
    this.stopped = !0;
    for (const t of this.disposers) t();
    this.disposers.length = 0, this.bus.destroy();
  }
  on(t, e) {
    return this.bus.on(t, e);
  }
  getSelection() {
    return this.current;
  }
  getRange() {
    const t = typeof window < "u" ? window.getSelection() : null;
    if (!t || t.rangeCount === 0) return this.uiRange();
    const e = t.getRangeAt(0);
    return this.target.contains(e.commonAncestorContainer) ? e : this.uiRange();
  }
  uiRange() {
    var e;
    const t = document.activeElement;
    return t && this.target.contains(t) && t.closest("[data-ez-ui]") && ((e = this.savedRange) != null && e.startContainer.isConnected) ? this.savedRange : null;
  }
  setRange(t) {
    const e = window.getSelection();
    e && (e.removeAllRanges(), e.addRange(t), this.refresh());
  }
  /** Compute block-level selection from the DOM selection. */
  refresh() {
    var y;
    const t = this.getRange();
    if (!t)
      return this.current = null, this.bus.emit("selection", null), null;
    const e = this.blockForBoundary(t.startContainer, t.startOffset);
    if (!e)
      return this.current = null, this.bus.emit("selection", null), null;
    const s = e.getAttribute("data-ez-block-id") ?? "";
    this.savedRange = t.cloneRange();
    const n = t.collapsed, i = t.toString(), r = typeof window < "u" ? window.getSelection() : null, a = r && r.anchorNode ? r.anchorNode : t.startContainer, l = r && r.anchorNode ? r.anchorOffset : t.startOffset, c = r && r.focusNode ? r.focusNode : t.endContainer, d = r && r.focusNode ? r.focusOffset : t.endOffset, u = this.blockForBoundary(a, l), h = this.blockForBoundary(c, d), f = (y = t.commonAncestorContainer instanceof Element ? t.commonAncestorContainer : t.commonAncestorContainer.parentElement) == null ? void 0 : y.closest("[data-ez-region]"), g = {
      blockId: s,
      index: this.host.getBlockIndex(s),
      collapsed: n,
      anchorOffset: rs(u ?? e, a, l),
      focusOffset: rs(h ?? e, c, d),
      text: i,
      anchorBlockId: (u == null ? void 0 : u.getAttribute("data-ez-block-id")) ?? s,
      focusBlockId: (h == null ? void 0 : h.getAttribute("data-ez-block-id")) ?? s,
      regionId: (f == null ? void 0 : f.getAttribute("data-ez-region")) ?? void 0
    }, m = !this.current || this.current.blockId !== g.blockId || this.current.collapsed !== g.collapsed || this.current.anchorOffset !== g.anchorOffset || this.current.focusOffset !== g.focusOffset;
    return this.current = g, m && this.bus.emit("selection", g), g;
  }
  findBlockElement(t) {
    var s;
    let e = t;
    for (e.nodeType === Node.TEXT_NODE && (e = e.parentNode); e && e !== this.target; ) {
      if (e.nodeType === Node.ELEMENT_NODE && ((s = e.hasAttribute) != null && s.call(e, "data-ez-block-id")))
        return e;
      e = e.parentNode;
    }
    return null;
  }
  /**
   * Resolve the block element for a selection boundary point. A boundary on
   * the target itself (whole-document selections) is clamped to the child
   * at the boundary offset.
   */
  blockForBoundary(t, e) {
    if (t === this.target || t === this.target.parentNode) {
      const s = this.target.childNodes[Math.min(e, this.target.childNodes.length - 1)];
      return s ? this.findBlockElement(s) : null;
    }
    return this.findBlockElement(t);
  }
}
function rs(o, t, e) {
  try {
    const n = o.ownerDocument.createRange();
    return n.selectNodeContents(o.querySelector("[data-ez-editable]") ?? o), n.setEnd(t, e), n.toString().length;
  } catch {
    return 0;
  }
}
function rr(o, t) {
  var d;
  const e = o.ownerDocument, s = window.getSelection();
  if (!s) return;
  const n = e.createTreeWalker(o, NodeFilter.SHOW_TEXT);
  let i = t, r = n.nextNode(), a = null, l = 0;
  for (; r; ) {
    const u = r, h = ((d = u.data) == null ? void 0 : d.length) ?? 0;
    if (i <= h) {
      a = u, l = i;
      break;
    }
    i -= h, r = n.nextNode();
  }
  const c = e.createRange();
  a ? (c.setStart(a, l), c.collapse(!0)) : (c.selectNodeContents(o), c.collapse(!1)), s.removeAllRanges(), s.addRange(c);
}
class or {
  constructor(t, e) {
    this.disposers = [], this.lastInputAt = /* @__PURE__ */ new Map(), this.composing = !1, this.lastCompositionEndAt = 0, this.lastCompositionBlock = "", this.onInputCallbacks = [], this.host = t, this.target = e;
  }
  start() {
    const t = (i) => {
      var a;
      let r = i;
      for (; r && r !== this.target; ) {
        if (r.nodeType === Node.ELEMENT_NODE) {
          const l = r;
          if ((a = l.hasAttribute) != null && a.call(l, "data-ez-editable")) {
            const c = l.closest("[data-ez-block-id]");
            if (c) {
              const d = l.closest("[data-ez-nested-id]"), u = d && c.contains(d) ? d.getAttribute("data-ez-nested-id") : null;
              return { id: c.getAttribute("data-ez-block-id") ?? "", nestedId: u, editable: l };
            }
          }
        }
        r = r.parentNode;
      }
      return null;
    }, e = (i) => {
      if (this.host.readOnly) return;
      const r = t(i.target);
      r && (this.lastInputAt.set(r.id, Date.now()), r.nestedId && this.lastInputAt.set(r.nestedId, Date.now()), this.updateEmptyState(r.editable), !this.composing && (this.lastCompositionEndAt !== 0 && Date.now() - this.lastCompositionEndAt < 50 && (r.nestedId ?? r.id) === this.lastCompositionBlock || this.emitInput(r.id, r.nestedId)));
    }, s = () => {
      this.composing = !0, en();
    }, n = (i) => {
      this.composing = !1, sn(), this.lastCompositionEndAt = Date.now();
      const r = t(i.target);
      this.lastCompositionBlock = r ? r.nestedId ?? r.id : "", r && (this.updateEmptyState(r.editable), this.emitInput(r.id, r.nestedId));
    };
    this.target.addEventListener("input", e, !0), this.target.addEventListener("compositionstart", s, !0), this.target.addEventListener("compositionend", n, !0), this.disposers.push(() => {
      this.target.removeEventListener("input", e, !0), this.target.removeEventListener("compositionstart", s, !0), this.target.removeEventListener("compositionend", n, !0);
    });
  }
  stop() {
    for (const t of this.disposers) t();
    this.disposers.length = 0, this.onInputCallbacks.length = 0;
  }
  emitInput(t, e = null) {
    e ? this.host.requestSaveNestedChild(t, e) : this.host.requestSaveBlock(t, "user");
    for (const s of Array.from(this.onInputCallbacks)) s(e ?? t);
  }
  onBlockInput(t) {
    return this.onInputCallbacks.push(t), () => {
      this.onInputCallbacks = this.onInputCallbacks.filter((e) => e !== t);
    };
  }
  updateEmptyState(t) {
    const s = (t.textContent ?? "").replace(/\u200B/g, "").trim() === "";
    (t.hasAttribute("data-ez-placeholder") || t.hasAttribute("data-ez-note-placeholder") || t.hasAttribute("data-ez-writing-hint")) && t.setAttribute("data-ez-empty", s ? "true" : "false");
  }
  wasInputRecently(t, e = 250) {
    const s = this.lastInputAt.get(t);
    return s !== void 0 && Date.now() - s < e;
  }
}
function Hs(o) {
  if (!o || typeof o != "object") return "";
  const t = o;
  return typeof t.code == "string" ? t.code : Array.isArray(t.items) ? t.items.map((e) => Ae((e == null ? void 0 : e.content) ?? [])).join(`
`) : Array.isArray(t.content) ? Ae(t.content) : "";
}
function Ae(o) {
  let t = "";
  for (const e of o)
    (e == null ? void 0 : e.type) === "text" ? t += e.text ?? "" : (e == null ? void 0 : e.type) === "link" && (t += (e.content ?? []).map((s) => (s == null ? void 0 : s.text) ?? "").join(""));
  return t;
}
function yt(o, t) {
  return !t || typeof t != "object" ? !0 : o === "delimiter" ? !1 : Hs(t).trim() === "";
}
function ar(o, t) {
  const e = Pt(t);
  switch (o) {
    case "paragraph":
      return { content: e };
    case "heading":
      return { level: 2, content: e };
    case "quote":
      return { content: e };
    case "list":
      return { style: "unordered", items: e.length > 0 ? e.map((s) => ({ content: [s] })) : [{ content: [] }] };
    case "code":
      return { code: Ae(e) };
    case "delimiter":
      return {};
    default:
      return {};
  }
}
function Pt(o) {
  if (!o || typeof o != "object") return [];
  const t = o;
  if (Array.isArray(t.content)) return t.content;
  if (typeof t.code == "string") return t.code === "" ? [] : [{ type: "text", text: t.code }];
  if (Array.isArray(t.items)) {
    const e = [];
    for (const s of t.items)
      e.length > 0 && e.push({ type: "text", text: `
` }), e.push(...(s == null ? void 0 : s.content) ?? []);
    return e;
  }
  return [];
}
function lr(o) {
  var e;
  const t = o == null ? void 0 : o.items;
  return ((e = t == null ? void 0 : t[0]) == null ? void 0 : e.content) ?? [];
}
function cr(o, t, e, s) {
  switch (o) {
    case "paragraph":
    case "heading":
    case "quote": {
      const n = Pt(t), i = e === "list" ? lr(s) : Pt(s), l = { content: n.length > 0 && i.length > 0 ? [...n, { type: "text", text: `
` }, ...i] : [...n, ...i] };
      return o === "heading" && (l.level = t.level ?? 2), l;
    }
    case "list": {
      const n = Pt(s);
      let i;
      return e === "list" ? i = [...ie(t), ...ie(s)] : i = [...ie(t), ...n.map((r) => ({ content: [r] }))], { style: t.style ?? "unordered", items: i };
    }
    case "code": {
      const n = t.code ?? "", i = Hs(s);
      return { code: `${n}
${i}` };
    }
    default:
      return {};
  }
}
function ie(o) {
  return ((o == null ? void 0 : o.items) ?? []).map((e) => ({ content: (e == null ? void 0 : e.content) ?? [] }));
}
function Se(o, t) {
  const e = ["paragraph", "heading", "quote"];
  return o === "list" ? t === "list" || e.includes(t) : o === "code" ? ["paragraph", "heading", "quote", "code"].includes(t) : e.includes(o) ? [...e, "list", "code"].includes(t) : !1;
}
class dr {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.target = e;
  }
  start() {
    const t = (e) => {
      const s = e;
      this.host.readOnly || this.host.isDestroyed() || Ts(s) || s.target.closest("[data-ez-ui]") || this.handle(s) && s.preventDefault();
    };
    this.target.addEventListener("keydown", t), this.disposers.push(() => this.target.removeEventListener("keydown", t));
  }
  stop() {
    for (const t of this.disposers) t();
    this.disposers.length = 0;
  }
  /** Returns true when the event was handled and default must be prevented. */
  handle(t) {
    const e = t.metaKey || t.ctrlKey;
    if (t.altKey && !e && (t.key === "ArrowUp" || t.key === "ArrowDown"))
      return this.handleMoveBlock(t.key === "ArrowUp" ? -1 : 1);
    if (e && !t.shiftKey && !t.altKey)
      switch (t.key.toLowerCase()) {
        case "b":
          return this.inline("bold");
        case "i":
          return this.inline("italic");
        case "u":
          return this.inline("underline");
        case "k":
          return this.handleLinkShortcut();
        case "z":
          return this.host.undo(), this.host.announce("Undo"), !0;
        case "d": {
          const s = this.host.getSelectionInfo();
          return s ? (this.host.duplicateBlock(s.blockId), this.host.announce("Block duplicated"), !0) : !1;
        }
      }
    if (e && t.shiftKey && !t.altKey) {
      const s = t.key.toLowerCase();
      if (s === "z")
        return this.host.redo(), this.host.announce("Redo"), !0;
      if (s === "l") {
        const n = this.host.getSelectionInfo();
        if (n)
          return this.host.convertBlock(n.blockId, "list"), this.host.announce("Converted to list"), !0;
      }
      if (s === "c") {
        const n = this.host.getSelectionInfo();
        if (n)
          return this.host.convertBlock(n.blockId, "code"), this.host.announce("Converted to code"), !0;
      }
    }
    switch (t.key) {
      case "Enter":
        return t.shiftKey ? this.handleSoftBreak() : this.handleEnter();
      case "Backspace":
        return this.handleBackspace();
      case "Delete":
        return this.handleDelete();
      case "Tab":
        return this.handleTab(t);
      case "Escape":
        return this.somethingOpen() ? (this.host.closeMenus(), !0) : !1;
      default:
        return !1;
    }
  }
  inline(t) {
    const e = this.host.getSelectionInfo();
    return !e || e.collapsed && !["bold", "italic", "underline", "link"].includes(t) ? !1 : (this.host.dispatchInlineTool(t), !0);
  }
  /**
   * Ctrl/Cmd+K: activate the link tool directly (preserving the selection)
   * so a collapsed caret outside a link still opens the link popover
   * instead of being swallowed as a no-op.
   */
  handleLinkShortcut() {
    var r;
    const t = this.host.getSelectionInfo();
    if (!t) return !1;
    const e = this.host.getEditableElement(t.blockId), s = this.host.getBlockType(t.blockId);
    if (!e || !s || s === "code" || this.host.registry.get(s).toolClass.enableInlineTools === !1) return !1;
    const n = (r = this.host.getRange()) == null ? void 0 : r.cloneRange();
    if (!n || !this.host.registry.listInlineTools().some((a) => a.name === "link")) return !1;
    const i = this.host.registry.createInlineTool("link", {
      config: {},
      closeToolbar: () => {
      },
      t: (a) => this.host.i18n.t(a)
    });
    return i ? (e.focus(), this.host.setSelectionFromRange(n), i.apply(n, {
      blockId: t.blockId,
      blockElement: e,
      range: n,
      requestSave: () => this.host.requestSaveBlock(t.blockId, "user"),
      closeToolbar: () => {
      }
    }), !0) : !1;
  }
  /** True when a menu/popover is currently visible inside the surface. */
  somethingOpen() {
    for (const t of Array.from(this.target.querySelectorAll(".ez-popover, .ez-slash-menu")))
      if (t.isConnected && t.style.display !== "none")
        return !0;
    return !1;
  }
  /** Enter: split the block, or create a new one below for empty blocks. */
  handleEnter() {
    const t = this.host.getSelectionInfo();
    if (!t) return !1;
    const e = t.blockId, s = this.host.getBlockType(e), n = this.host.getTool(e);
    if (!n || !s) return !1;
    const i = n.constructor.enterKey;
    return i === "ignore" ? (this.host.insertBlock(this.host.defaultBlock, void 0, { after: e, focus: !0 }), !0) : i === "newline" || s === "code" || s === "list" ? !1 : this.splitAtSelection(e);
  }
  /** Shift+Enter: soft line break inside the editable. */
  handleSoftBreak() {
    const t = this.host.getSelectionInfo();
    if (!t) return !1;
    const e = this.host.getEditableElement(t.blockId);
    if (!e) return !1;
    const s = this.host.getRange();
    if (!s) return !1;
    const n = e.ownerDocument.createElement("br");
    s.deleteContents(), s.insertNode(n);
    const i = window.getSelection();
    if (i) {
      const r = e.ownerDocument.createRange();
      r.setStartAfter(n), r.collapse(!0), i.removeAllRanges(), i.addRange(r);
    }
    return this.host.requestSaveBlock(t.blockId, "user"), !0;
  }
  /**
   * Split the current text block at the caret into two blocks — committed
   * as ONE transaction so a single undo restores the original block with
   * all of its text.
   */
  splitAtSelection(t) {
    const e = this.host.getEditableElement(t), s = this.host.getBlockType(t), n = this.host.getTool(t);
    if (!e || !s || !n) return !1;
    const i = n;
    if (typeof i.splitAtRange != "function") return !1;
    const r = this.host.getBlockData(t);
    if (yt(s, r))
      return this.host.insertBlock(this.host.defaultBlock, void 0, { after: t, focus: !0 }), !0;
    const a = this.host.getRange();
    if (!a) return !1;
    if (!a.collapsed) {
      const f = e.ownerDocument.createRange();
      f.setStart(a.startContainer, a.startOffset), e.contains(a.endContainer) ? f.setEnd(a.endContainer, a.endOffset) : f.setEnd(e, e.childNodes.length), f.deleteContents();
    }
    const l = i.splitAtRange(a);
    if (!l) return !1;
    const [c, d] = l, u = this.host.splitBlock(t, c, d);
    return u ? (this.host.focusBlock(u, "start"), this.host.announce("Block split"), !0) : !1;
  }
  handleBackspace() {
    const t = this.host.getSelectionInfo();
    if (!t || !t.collapsed) return !1;
    const e = this.host.getEditableElement(t.blockId);
    if (!e || !hr(e, this.host.getRange())) return !1;
    const s = this.host.getBlockIndex(t.blockId);
    if (s <= 0) return !1;
    const n = this.host.blocks.blocks[s - 1];
    if (!n) return !1;
    const i = this.host.getBlockType(t.blockId) ?? "";
    return yt(i, this.host.getBlockData(t.blockId)) ? (this.host.removeBlock(t.blockId, "user"), this.host.focusBlock(n.id, "end"), !0) : Se(n.type, i) ? (this.host.mergeBlocks(n.id, t.blockId, "user"), !0) : !1;
  }
  /**
   * Delete mirrors Backspace at the caret's END: an empty block is removed
   * (focusing the next block) and a non-empty caret-at-end block merges
   * with the next block.
   */
  handleDelete() {
    const t = this.host.getSelectionInfo();
    if (!t || !t.collapsed) return !1;
    const e = this.host.getEditableElement(t.blockId);
    if (!e || !ur(e, this.host.getRange())) return !1;
    const s = this.host.getBlockIndex(t.blockId);
    if (s < 0) return !1;
    const n = this.host.blocks.blocks[s + 1];
    if (!n) return !1;
    const i = this.host.getBlockType(t.blockId) ?? "";
    return yt(i, this.host.getBlockData(t.blockId)) ? (this.host.removeBlock(t.blockId, "user"), this.host.focusBlock(n.id, "start"), !0) : Se(i, n.type) ? (this.host.mergeBlocks(t.blockId, n.id, "user"), !0) : !1;
  }
  /**
   * Tab inside a code block inserts spaces. Shift+Tab is the keyboard exit:
   * it moves focus out of the code block (creating a paragraph below when
   * the code block is last) so the editor never traps the keyboard.
   */
  handleTab(t) {
    const e = this.host.getSelectionInfo();
    if (!e || this.host.getBlockType(e.blockId) !== "code") return !1;
    const s = this.host.getEditableElement(e.blockId);
    return s ? t.shiftKey ? (this.host.focusNextBlock(e.blockId, "start") || this.host.insertBlock(this.host.defaultBlock, void 0, { after: e.blockId, focus: !0 }), this.host.announce("Left code block"), !0) : ((s.ownerDocument ?? document).execCommand("insertText", !1, "  "), this.host.requestSaveBlock(e.blockId, "user"), !0) : !1;
  }
  handleMoveBlock(t) {
    const e = this.host.getSelectionInfo();
    if (!e) return !1;
    const s = this.host.getBlockIndex(e.blockId), n = s + t;
    return s < 0 || n < 0 || n >= this.host.blocks.length ? !1 : (this.host.moveBlock(e.blockId, n), this.host.focusBlock(e.blockId), this.host.announce(`Block moved to position ${n + 1}`), !0);
  }
}
function hr(o, t) {
  if (!t || !t.collapsed) return !1;
  const e = o.ownerDocument.createRange();
  e.selectNodeContents(o);
  try {
    e.setEnd(t.startContainer, t.startOffset);
  } catch {
    return !1;
  }
  return e.toString().replace(/\u200B/g, "").length === 0;
}
function ur(o, t) {
  if (!t || !t.collapsed) return !1;
  const e = o.ownerDocument.createRange();
  e.selectNodeContents(o);
  try {
    e.setStart(t.endContainer, t.endOffset);
  } catch {
    return !1;
  }
  return e.toString().replace(/\u200B/g, "").length === 0;
}
const fr = /* @__PURE__ */ new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "LINK",
  "META",
  "NOSCRIPT",
  "TEMPLATE",
  "FORM",
  "INPUT",
  "BUTTON",
  "TEXTAREA",
  "SELECT",
  "OPTION",
  "SVG",
  "MATH",
  "CANVAS",
  "AUDIO",
  "VIDEO",
  "SOURCE",
  "TRACK",
  "MAP",
  "AREA",
  "APPLET",
  "DIALOG",
  "NAV",
  "ASIDE",
  "HEADER",
  "FOOTER"
]), pr = /* @__PURE__ */ new Set([
  "SPAN",
  "SMALL",
  "S",
  "SUB",
  "SUP",
  "BIG",
  "ABBR",
  "CITE",
  "Q",
  "TIME",
  "VAR",
  "SAMP",
  "KBD",
  "BDO",
  "FONT",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "CODE",
  "MARK",
  "A",
  "BR"
]), os = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }, gr = {
  A: /* @__PURE__ */ new Set(["href"]),
  IMG: /* @__PURE__ */ new Set(["src", "alt"])
};
function mr(o, t, e) {
  var n;
  return ((n = gr[o]) == null ? void 0 : n.has(t)) ?? !1 ? t === "href" ? G(e) || e.startsWith("note:") : t === "src" ? Z(e) : !0 : !1;
}
function br(o) {
  for (const e of Array.from(o.querySelectorAll("*"))) {
    if (fr.has(e.tagName)) {
      const s = e.parentNode;
      s && s.removeChild(e);
      continue;
    }
    for (const s of Array.from(e.attributes))
      mr(e.tagName, s.name, s.value) || e.removeAttribute(s.name);
  }
  const t = o.ownerDocument.createTreeWalker(o, NodeFilter.SHOW_COMMENT);
  for (; t.nextNode(); ) {
    const e = t.currentNode;
    e.parentNode && e.parentNode.removeChild(e);
  }
}
function js(o) {
  const t = new DOMParser().parseFromString(o, "text/html");
  return br(t.body), yr(t.body);
}
function yr(o) {
  const t = [];
  let e = [];
  const s = () => {
    if (e.length === 0) return;
    const n = o.ownerDocument.createElement("div");
    for (const r of e) n.appendChild(r);
    const i = z(n);
    i.length > 0 && t.push({ type: "paragraph", data: { content: i } }), e = [];
  };
  for (const n of Array.from(o.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      (n.textContent ?? "").trim() !== "" && e.push(n);
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const i = n, r = i.tagName;
    if (pr.has(r)) {
      e.push(n);
      continue;
    }
    if (s(), r in os) {
      const a = os[r], l = z(i);
      l.length > 0 && t.push({ type: "heading", data: { level: a, content: l } });
    } else if (r === "UL" || r === "OL") {
      const a = Array.from(i.children).filter((l) => l.tagName === "LI").map((l) => ({ content: z(l) }));
      a.length > 0 && t.push({ type: "list", data: { style: r === "OL" ? "ordered" : "unordered", items: a } });
    } else if (r === "BLOCKQUOTE") {
      const a = z(i);
      a.length > 0 && t.push({ type: "quote", data: { content: a } });
    } else if (r === "PRE") {
      const a = (i.textContent ?? "").replace(/\n$/, "");
      t.push({ type: "code", data: { code: a } });
    } else if (r === "HR")
      t.push({ type: "delimiter", data: {} });
    else if (r === "TABLE")
      for (const a of Array.from(i.querySelectorAll("tr")))
        for (const l of Array.from(a.querySelectorAll("th,td"))) {
          const c = z(l);
          c.length > 0 && t.push({ type: "paragraph", data: { content: c } });
        }
    else if (r === "IMG" || r === "PICTURE") {
      const a = r === "IMG" ? i : i.querySelector("img"), l = (a == null ? void 0 : a.getAttribute("src")) ?? "";
      a && Z(l) && t.push({ type: "image", data: { src: l, alt: a.getAttribute("alt") ?? "" } });
      continue;
    } else {
      const a = z(i);
      a.length > 0 && t.push({ type: "paragraph", data: { content: a } });
      for (const l of Array.from(i.querySelectorAll("img"))) {
        const c = l.getAttribute("src") ?? "";
        Z(c) && t.push({ type: "image", data: { src: c, alt: l.getAttribute("alt") ?? "" } });
      }
    }
  }
  return s(), t;
}
function Us(o) {
  const t = o.split(/\r?\n/), e = [];
  for (const s of t) {
    if (s.trim() === "") continue;
    const n = [{ type: "text", text: s }];
    e.push({ type: "paragraph", data: { content: n } });
  }
  return e;
}
const re = "application/x-ezynota+json";
class kr {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.target = e;
  }
  start() {
    const t = (r) => {
      var l;
      const a = r;
      return !!a && this.target.contains(a) && !((l = a.closest) != null && l.call(a, "[data-ez-ui]"));
    }, e = (r) => {
      if (!t(r.target)) return;
      const a = r, l = this.host.getRange();
      if (!l || l.collapsed) return;
      const c = a.clipboardData;
      c && (a.preventDefault(), this.writeClipboard(c, l));
    }, s = (r) => {
      if (!t(r.target)) return;
      const a = r, l = this.host.getRange();
      if (!l || l.collapsed) return;
      const c = a.clipboardData;
      c && this.writeClipboard(c, l);
    }, n = async (r) => {
      const a = r, l = this.host.getSelectionInfo();
      if (!l || this.host.readOnly) return;
      a.preventDefault();
      const c = a.clipboardData;
      c && await this.paste(c, l.blockId);
    }, i = async (r) => {
      const a = r;
      if (this.host.readOnly) return;
      const l = a.dataTransfer, c = l == null ? void 0 : l.files;
      if (!c || c.length === 0) {
        const u = (l == null ? void 0 : l.getData("text/plain")) ?? "", h = (l == null ? void 0 : l.getData("text/html")) ?? "";
        if (u === "" && h === "" || !l) return;
        const f = this.host.getSelectionInfo();
        if (!f) return;
        a.preventDefault(), await this.paste(l, f.blockId);
        return;
      }
      const d = this.host.getSelectionInfo();
      d && (a.preventDefault(), await this.routeFiles(Array.from(c), d.blockId));
    };
    this.target.addEventListener("copy", e), this.target.addEventListener("cut", s), this.target.addEventListener("paste", n), this.target.addEventListener("drop", i), this.disposers.push(() => {
      this.target.removeEventListener("copy", e), this.target.removeEventListener("cut", s), this.target.removeEventListener("paste", n), this.target.removeEventListener("drop", i);
    });
  }
  stop() {
    for (const t of this.disposers) t();
    this.disposers.length = 0;
  }
  /**
   * Full blocks covered by the selection, in document order — or null when
   * the selection starts/ends mid-block (partial copy instead).
   */
  wholeBlocksInSelection(t) {
    const e = this.closestBlock(t.startContainer), s = this.closestBlock(t.endContainer);
    if (!e) return null;
    const n = s ?? e;
    if (!this.selectionCoversBlockStart(e, t) || !this.selectionCoversBlockEnd(n, t)) return null;
    const i = Array.from(this.target.querySelectorAll("[data-ez-block-id]")), r = [];
    let a = !1;
    for (const c of i)
      if (c === e && (a = !0), a && r.push(c.getAttribute("data-ez-block-id") ?? ""), c === n) break;
    const l = [];
    for (const c of r) {
      const d = this.host.blocks.getById(c);
      d && l.push(d);
    }
    return l.length > 0 ? l : null;
  }
  selectionCoversBlockStart(t, e) {
    const s = this.target.ownerDocument.createRange();
    s.selectNodeContents(t);
    try {
      s.setEnd(e.startContainer, e.startOffset);
    } catch {
      return !1;
    }
    return s.toString().replace(/\u200B/g, "").length === 0;
  }
  selectionCoversBlockEnd(t, e) {
    const s = this.target.ownerDocument.createRange();
    s.selectNodeContents(t);
    try {
      s.setStart(e.endContainer, e.endOffset);
    } catch {
      return !1;
    }
    return s.toString().replace(/\u200B/g, "").length === 0;
  }
  closestBlock(t) {
    var s;
    let e = t;
    for (; e && e !== this.target; ) {
      if (e.nodeType === Node.ELEMENT_NODE && ((s = e.hasAttribute) != null && s.call(e, "data-ez-block-id")))
        return e;
      e = e.parentNode;
    }
    return null;
  }
  /** Serialize the selection (whole blocks or fragment) into a DataTransfer. */
  writeClipboard(t, e) {
    const s = this.wholeBlocksInSelection(e);
    if (s && s.length > 0) {
      const i = s.map((r) => wr(r)).join(`

`);
      t.setData("text/plain", i), t.setData("text/html", s.map((r) => Er(r)).join(""));
      try {
        t.setData(re, JSON.stringify({ blocks: s }));
      } catch {
      }
      return;
    }
    const n = e.toString().replace(/\u200B/g, "");
    t.setData("text/plain", n);
    try {
      const i = e.cloneContents();
      t.setData("text/html", Ar(i));
    } catch {
    }
    try {
      t.setData(re, JSON.stringify({ text: n }));
    } catch {
    }
  }
  /** Paste priority: Ezynota JSON → files → sanitized HTML → plain text. */
  async paste(t, e) {
    const s = t.getData(re);
    if (s)
      try {
        const r = JSON.parse(s);
        if (Array.isArray(r.blocks) && r.blocks.length > 0) {
          const a = vr(r.blocks);
          if (a.length > 0) {
            this.insertClipboardBlocks(a, e);
            return;
          }
        }
        if (typeof r.text == "string" && r.text !== "") {
          this.insertTextAtCaret(r.text, e);
          return;
        }
      } catch {
      }
    if (t.files && t.files.length > 0 && await this.routeFiles(Array.from(t.files), e))
      return;
    const n = t.getData("text/html");
    if (n && n.trim() !== "") {
      const r = js(n);
      if (r.length > 0) {
        this.insertParsed(r, e);
        return;
      }
    }
    const i = t.getData("text/plain") ?? "";
    i.trim() !== "" && (i.includes(`
`) ? this.insertParsed(Us(i), e) : this.insertTextAtCaret(i, e));
  }
  /** Route files to tools that declare matching file paste rules. */
  async routeFiles(t, e) {
    var s;
    for (const n of this.host.registry.listBlockTools()) {
      const i = (s = n.toolClass.paste) == null ? void 0 : s.files;
      if (!i) continue;
      const r = i.mimeTypes ?? [], a = t.filter(
        (d) => r.some(
          (u) => u.endsWith("/*") ? d.type.startsWith(u.slice(0, -1)) : d.type === u
        )
      );
      if (a.length === 0) continue;
      const l = this.host.getTool(e);
      if (l != null && l.onPaste && this.host.getBlockType(e) === n.name)
        return l.onPaste({ files: a }), !0;
      const c = n.toolClass.filesToBlockDataAsync;
      if (typeof c == "function") {
        const d = await c(a, this.host.target);
        if (this.host.isDestroyed()) return !1;
        if (d.length > 0)
          return this.host.pasteBlocks(d, e, "paste"), !0;
      }
    }
    return !1;
  }
  insertParsed(t, e) {
    const s = t.map((n) => ({ type: n.type, data: n.data }));
    this.insertClipboardBlocks(s, e);
  }
  /** Block-level paste: one transaction, one undo step. */
  insertClipboardBlocks(t, e) {
    const s = t.map((n) => ({
      type: typeof n.type == "string" && n.type !== "" ? n.type : this.host.defaultBlock,
      data: n.data ?? {}
    }));
    s.length !== 0 && this.host.pasteBlocks(s, e, "paste");
  }
  /**
   * Inline paste at the caret (also replaces a same-block selection).
   * Falls back to a block-level paste when the caret is not in an editable.
   */
  insertTextAtCaret(t, e) {
    const s = this.host.getEditableElement(e), n = this.host.getRange(), i = n ? this.closestBlock(n.startContainer) : null, r = (i == null ? void 0 : i.getAttribute("data-ez-block-id")) === e;
    if (!s || !n || !r) {
      this.insertClipboardBlocks([{ type: this.host.defaultBlock, data: { content: [{ type: "text", text: t }] } }], e);
      return;
    }
    n.deleteContents();
    const a = this.target.ownerDocument.createTextNode(t);
    n.insertNode(a), n.setStartAfter(a), n.collapse(!0);
    const l = window.getSelection();
    l && (l.removeAllRanges(), l.addRange(n)), this.host.requestSaveBlock(e, "user"), this.host.announce("Pasted content inserted");
  }
}
function vr(o) {
  return (he({ blocks: o }).document ?? { blocks: [] }).blocks.map((s) => ({ type: s.type, data: s.data }));
}
function wr(o) {
  const t = o.data;
  return typeof t.code == "string" ? t.code : Array.isArray(t.items) ? t.items.map((e) => as((e == null ? void 0 : e.content) ?? [])).join(`
`) : as(Array.isArray(t.content) ? t.content : []);
}
function as(o) {
  let t = "";
  for (const e of o)
    (e == null ? void 0 : e.type) === "text" ? t += e.text ?? "" : (e == null ? void 0 : e.type) === "link" && (t += (e.content ?? []).map((s) => (s == null ? void 0 : s.text) ?? "").join(""));
  return t;
}
function Er(o) {
  const t = document.implementation.createHTMLDocument("copy"), e = t.createElement("div");
  e.setAttribute("data-ez-block-type", o.type);
  const s = o.data;
  if (typeof s.code == "string") {
    const n = t.createElement("pre");
    n.textContent = s.code, e.appendChild(n);
  } else if (Array.isArray(s.items)) {
    const n = t.createElement(s.style === "ordered" ? "ol" : "ul");
    for (const i of s.items) {
      const r = t.createElement("li");
      r.appendChild(ls((i == null ? void 0 : i.content) ?? [], t)), n.appendChild(r);
    }
    e.appendChild(n);
  } else if (Array.isArray(s.content)) {
    let n = "p";
    if (o.type === "heading") {
      const r = Number(s.level ?? 2);
      n = Number.isInteger(r) && r >= 1 && r <= 6 ? `h${r}` : "p";
    } else o.type === "quote" && (n = "blockquote");
    const i = t.createElement(n);
    i.appendChild(ls(s.content, t)), e.appendChild(i);
  } else o.type === "delimiter" && e.appendChild(t.createElement("hr"));
  return e.innerHTML;
}
function Ar(o) {
  const t = document.implementation.createHTMLDocument("copy"), e = t.createElement("div");
  return e.appendChild(t.importNode(o, !0)), e.innerHTML;
}
function ls(o, t) {
  return F(o, t);
}
const cs = /* @__PURE__ */ new Set(["paragraph", "heading", "list", "quote", "code"]);
function Oe(o, t, e) {
  var s, n, i, r;
  return t === e ? !0 : e === "delimiter" || !o.registry.has(t) || !o.registry.has(e) ? !1 : (n = (s = o.registry.get(e).toolClass.conversion) == null ? void 0 : s.from) != null && n[t] ? !0 : cs.has(t) && cs.has(e) && !!((r = (i = o.registry.get(t).toolClass.conversion) == null ? void 0 : i.to) != null && r.includes(e));
}
class ds {
  constructor(t, e = !1) {
    this.host = t, this.documentMode = e, this.tools = [], this.visible = !1, this.savedRange = null, this.settingsKey = "", this.alignmentButtons = [], this.disposers = [], this.root = p("div", e ? "ez-document-toolbar" : "ez-inline-toolbar"), this.root.setAttribute("role", "toolbar"), this.root.setAttribute("data-ez-ui", "true"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.formatting")), this.root.addEventListener("mousedown", (n) => {
      n.target.closest("button") && n.preventDefault();
    }), this.root.addEventListener("keydown", (n) => {
      var i;
      n.key === "Escape" && (n.preventDefault(), (i = this.more) != null && i.open && (this.more.open = !1), this.restoreSelection(), this.documentMode || this.hide()), te(n, n.target.closest(".ez-more-panel") ?? this.root), n.stopPropagation();
    }), e && this.buildDocumentControls();
    for (const n of t.registry.listInlineTools()) {
      const i = t.registry.createInlineTool(n.name, {
        config: {},
        closeToolbar: () => {
          this.documentMode || this.hide();
        },
        onActivate: () => {
          this.restoreSelection() && (qs(t, n.name, i), this.updateSelection(t.getSelectionInfo()));
        },
        t: (l) => t.i18n.t(l)
      }), r = i.render();
      this.tools.push({ name: n.name, instance: i, element: r }), (e && !["bold", "italic", "underline", "link"].includes(n.name) ? this.morePanel : this.root).appendChild(r);
    }
    e ? (this.buildAlignment(), this.root.appendChild(this.more), this.refresh()) : this.root.style.display = "none";
    const s = () => {
      var n, i;
      !this.documentMode && this.visible && ((n = this.savedRange) != null && n.startContainer.isConnected) && _(this.root, this.savedRange.getBoundingClientRect(), "above"), (i = this.more) != null && i.open && this.morePanel && _(this.morePanel, this.more.getBoundingClientRect());
    };
    window.addEventListener("resize", s), document.addEventListener("scroll", s, !0), this.disposers.push(() => window.removeEventListener("resize", s), () => document.removeEventListener("scroll", s, !0));
  }
  getElement() {
    return this.root;
  }
  buildDocumentControls() {
    const t = (n) => this.host.i18n.t(n);
    this.undoButton = A("ez-btn", t("toolbar.undo")), this.redoButton = A("ez-btn", t("toolbar.redo")), this.undoButton.addEventListener("click", () => {
      this.host.undo(), this.refresh();
    }), this.redoButton.addEventListener("click", () => {
      this.host.redo(), this.refresh();
    }), this.blockType = p("select", "ez-block-select"), this.blockType.setAttribute("aria-label", t("toolbar.blockType"));
    for (const n of this.host.registry.listBlockTools()) {
      if (!n.toolbox) continue;
      const i = p("option", void 0, n.toolbox.title);
      i.value = n.name, i.disabled = n.name === "delimiter", this.blockType.appendChild(i);
    }
    this.blockType.addEventListener("change", () => {
      var r;
      const n = this.blockType.value;
      if (!this.restoreSelection()) return;
      const i = (r = this.host.getSelectionInfo()) == null ? void 0 : r.blockId;
      i && (this.host.convertBlock(i, n), this.host.focusBlock(i, "end"), this.refresh());
    }), this.settings = p("div", "ez-inline-group ez-type-settings"), this.more = p("details", "ez-more-formatting");
    const e = p("summary", "ez-btn", t("toolbar.more"));
    this.morePanel = p("div", "ez-popover ez-more-panel"), this.morePanel.setAttribute("role", "group"), this.morePanel.setAttribute("aria-label", t("toolbar.more")), this.more.append(e, this.morePanel), this.more.addEventListener("toggle", () => {
      this.more.open ? _(this.morePanel, e.getBoundingClientRect()) : we(this.morePanel);
    });
    const s = (n) => {
      this.more.contains(n.target) || (this.more.open = !1);
    };
    document.addEventListener("pointerdown", s), document.addEventListener("focusin", s), this.disposers.push(() => document.removeEventListener("pointerdown", s), () => document.removeEventListener("focusin", s)), this.root.append(this.undoButton, this.redoButton, this.blockType, this.settings);
  }
  buildAlignment() {
    if (!this.host.registry.listTunes().some((s) => s.name === "alignment")) return;
    const t = { left: b.alignLeft, center: b.alignCenter, right: b.alignRight }, e = p("div", "ez-inline-group");
    e.setAttribute("role", "group"), e.setAttribute("aria-label", this.host.i18n.t("tune.alignment"));
    for (const s of ["left", "center", "right"]) {
      const n = E("ez-inline-btn", t[s] ?? "", this.host.i18n.t(`tune.alignment.${s}`));
      n.dataset.alignment = s, n.addEventListener("click", () => {
        var r;
        if (!this.restoreSelection()) return;
        const i = (r = this.host.getSelectionInfo()) == null ? void 0 : r.blockId;
        i && (this.host.blocks.setTune(i, "alignment", s), this.host.focusBlock(i, "end"), this.refresh());
      }), this.alignmentButtons.push(n), e.appendChild(n);
    }
    this.morePanel.append(p("div", "ez-menu-category", this.host.i18n.t("tune.alignment")), e);
  }
  updateSelection(t) {
    const e = this.host.getRange();
    if (t && e ? this.savedRange = e.cloneRange() : this.root.contains(document.activeElement) || (this.savedRange = null), !this.documentMode) {
      if (!t || t.collapsed || this.host.readOnly || !this.inlineEnabled(t) || !e) {
        this.hide();
        return;
      }
      this.visible = !0, this.root.style.display = "flex", _(this.root, e.getBoundingClientRect(), "above");
    }
    this.refresh();
  }
  refresh() {
    var l, c, d, u;
    const t = this.host.getSelectionInfo(), e = t ? this.host.getEditableElement(t.blockId) : null, s = !!t && !this.host.readOnly && this.inlineEnabled(t), n = e ? Hi(e) : /* @__PURE__ */ new Set();
    for (const { name: h, instance: f, element: g } of this.tools) {
      let m = n.has(h);
      if (t && !m)
        try {
          m = f.isActive(t);
        } catch {
        }
      (l = f.setActive) == null || l.call(f, m);
      const y = ["mark", "code"].includes(h) || h === "link" && !n.has("link"), v = !s || y && !!(t != null && t.collapsed), w = g.matches("button") ? [g] : Array.from(g.querySelectorAll("button"));
      for (const I of w) I.disabled = v;
    }
    if (!this.documentMode) return;
    this.undoButton.disabled = this.host.readOnly || !this.host.canUndo(), this.redoButton.disabled = this.host.readOnly || !this.host.canRedo(), this.blockType.disabled = !t || this.host.readOnly;
    const i = t ? this.host.blocks.getById(t.blockId) : void 0;
    if (i) {
      this.blockType.value = i.type;
      for (const h of Array.from(this.blockType.options)) h.disabled = !Oe(this.host, i.type, h.value);
    }
    const r = i == null ? void 0 : i.data, a = `${i == null ? void 0 : i.id}:${i == null ? void 0 : i.type}:${r == null ? void 0 : r.level}:${r == null ? void 0 : r.style}:${this.host.readOnly}`;
    if (a !== this.settingsKey && (this.settingsKey = a, N(this.settings), i && !this.host.readOnly)) {
      const h = (d = (c = this.host.getTool(i.id)) == null ? void 0 : c.renderSettings) == null ? void 0 : d.call(c);
      h && this.settings.appendChild(h);
    }
    for (const h of this.alignmentButtons)
      h.disabled = !i || this.host.readOnly, h.setAttribute("aria-pressed", String((((u = i == null ? void 0 : i.tunes) == null ? void 0 : u.alignment) ?? "left") === h.dataset.alignment));
    this.host.readOnly && this.more && (this.more.open = !1);
  }
  inlineEnabled(t) {
    const e = this.host.getBlockType(t.blockId);
    return !e || !this.host.registry.has(e) ? !1 : !!this.host.getEditableElement(t.blockId) && this.host.registry.get(e).toolClass.enableInlineTools !== !1 && e !== "code";
  }
  restoreSelection() {
    var s, n, i;
    if (this.host.readOnly || !((s = this.savedRange) != null && s.startContainer.isConnected)) return !1;
    const t = this.savedRange.cloneRange(), e = t.startContainer;
    return (i = (n = e instanceof Element ? e : e.parentElement) == null ? void 0 : n.closest("[data-ez-editable]")) == null || i.focus(), this.host.setSelectionFromRange(t), !0;
  }
  hide() {
    this.more && (this.more.open = !1), !this.documentMode && (this.visible = !1, we(this.root), this.root.style.display = "none");
  }
  isVisible() {
    return this.documentMode || this.visible;
  }
  withSavedRange(t) {
    return this.savedRange ? t(this.savedRange) : void 0;
  }
  destroy() {
    var t;
    for (const e of this.disposers) e();
    for (const { instance: e } of this.tools) (t = e.destroy) == null || t.call(e);
    this.root.remove();
  }
}
function qs(o, t, e) {
  var l;
  const s = o.getSelectionInfo();
  if (!s || o.readOnly) return;
  const n = o.getEditableElement(s.blockId), i = (l = o.getRange()) == null ? void 0 : l.cloneRange(), r = o.getBlockType(s.blockId);
  if (!n || !i || !r || r === "code" || !o.registry.has(r) || o.registry.get(r).toolClass.enableInlineTools === !1 || !o.registry.listInlineTools().some((c) => c.name === t) || i.collapsed && ["mark", "code"].includes(t) || i.collapsed && t === "link" && !ee(i, n, (c) => c.tagName === "A")) return;
  n.focus(), o.setSelectionFromRange(i), (e ?? o.registry.createInlineTool(t, {
    config: {},
    closeToolbar: () => {
    },
    t: (c) => o.i18n.t(c)
  })).apply(i, {
    blockId: s.blockId,
    blockElement: n,
    range: i,
    requestSave: () => o.requestSaveBlock(s.blockId, "user"),
    closeToolbar: () => {
    }
  });
}
class Sr {
  constructor(t) {
    this.settingsPopover = null, this.activeBlockId = null, this.open = !1, this.disposers = [], this.menuTunes = [], this.activeBlockElement = null, this.hoveredBlockId = null, this.host = t, this.root = p("div", "ez-block-toolbar"), this.root.setAttribute("role", "toolbar"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.blockActions")), this.root.setAttribute("data-ez-ui", "true"), this.root.hidden = !0, this.root.addEventListener("mousedown", (l) => {
      l.target.closest("button:not([draggable=true])") && l.preventDefault();
    });
    const e = E("ez-tool-btn ez-block-add", b.plus, t.i18n.t("toolbar.add"));
    e.addEventListener("click", () => {
      var c;
      const l = this.activeBlockId ?? ((c = this.host.blocks.blocks[this.host.blocks.length - 1]) == null ? void 0 : c.id);
      this.hide(), this.host.openBlockPicker(l, !0);
    });
    const s = E("ez-tool-btn ez-block-actions", b.grip, t.i18n.t("toolbar.blockActions"));
    s.title = `${t.i18n.t("toolbar.blockActions")} · ${t.i18n.t("toolbar.drag")}`, s.draggable = !0, s.addEventListener("click", () => this.toggleSettings()), s.addEventListener("dragstart", (l) => {
      var c;
      this.activeBlockId && ((c = l.dataTransfer) == null || c.setData("text/x-ezynota-drag", this.activeBlockId), l.dataTransfer.effectAllowed = "move");
    }), this.settingsButton = s, s.setAttribute("aria-haspopup", "dialog"), s.setAttribute("aria-expanded", "false"), this.root.append(e, s), this.root.querySelectorAll("svg").forEach((l) => l.setAttribute("aria-hidden", "true")), this.root.addEventListener("keydown", (l) => {
      var c;
      if (!this.open && ["ArrowLeft", "ArrowRight"].includes(l.key)) {
        const d = Array.from(this.root.children).filter((f) => f.matches("button") && getComputedStyle(f).display !== "none"), u = (l.key === "ArrowRight" ? 1 : -1) * (this.host.target.getAttribute("dir") === "rtl" ? -1 : 1), h = d.indexOf(document.activeElement);
        (c = d[(h + u + d.length) % d.length]) == null || c.focus(), l.preventDefault();
      }
      if (l.key === "Escape") {
        l.preventDefault();
        const d = this.open;
        this.closeSettings(), d ? this.settingsButton.focus() : this.activeBlockId && this.host.focusBlock(this.activeBlockId, "end");
      }
      te(l, this.settingsPopover ?? this.root), l.stopPropagation();
    });
    const n = (l) => {
      this.root.contains(l.target) || this.closeSettings();
    }, i = () => {
      !this.root.hidden && this.activeBlockId && this.showFor(this.activeBlockId), this.settingsPopover && _(this.settingsPopover, this.settingsButton.getBoundingClientRect());
    }, r = () => {
      this.hoveredBlockId = null, this.root.classList.remove("ez-hovered");
      const l = this.host.getSelectionInfo();
      !this.open && !this.root.contains(document.activeElement) && (l != null && l.collapsed) && this.showFor(l.blockId);
    }, a = (l) => {
      if (l.pointerType === "touch" || l.buttons !== 0 || this.open) return;
      if (this.host.readOnly) {
        this.hide();
        return;
      }
      const c = l.target;
      if (this.root.contains(c)) return;
      const d = this.host.getSelectionInfo();
      if (d && !d.collapsed) {
        r();
        return;
      }
      if (this.root.contains(document.activeElement)) return;
      const u = c.closest("[data-ez-block-id]");
      if (u && this.host.target.contains(u)) {
        this.hoveredBlockId = u.getAttribute("data-ez-block-id"), this.hoveredBlockId && this.showFor(this.hoveredBlockId);
        return;
      }
      if (this.hoveredBlockId && this.activeBlockElement) {
        const h = this.activeBlockElement.getBoundingClientRect(), f = this.root.getBoundingClientRect();
        if (l.clientY >= f.top && l.clientY <= f.bottom && l.clientX >= Math.min(h.left, f.left) && l.clientX <= Math.max(h.right, f.right)) return;
      }
      r();
    };
    this.host.target.addEventListener("pointermove", a), this.host.target.addEventListener("pointerleave", r), document.addEventListener("pointerdown", n), document.addEventListener("focusin", n), window.addEventListener("resize", i), document.addEventListener("scroll", i, !0), this.disposers.push(
      () => document.removeEventListener("pointerdown", n),
      () => document.removeEventListener("focusin", n),
      () => window.removeEventListener("resize", i),
      () => document.removeEventListener("scroll", i, !0),
      () => this.host.target.removeEventListener("pointermove", a),
      () => this.host.target.removeEventListener("pointerleave", r)
    );
  }
  getElement() {
    return this.root;
  }
  showFor(t) {
    var u;
    if (this.host.readOnly) {
      this.hide();
      return;
    }
    t = this.hoveredBlockId ?? t, this.activeBlockId !== t && this.closeSettings(), this.activeBlockId = t;
    const e = this.host.target.querySelector(`[data-ez-block-id="${CSS.escape(t)}"]`);
    if (!e) {
      this.hide();
      return;
    }
    const s = this.host.target.getBoundingClientRect(), n = e.getBoundingClientRect();
    this.activeBlockElement !== e && ((u = this.activeBlockElement) == null || u.classList.remove("ez-active")), this.activeBlockElement = e, e.classList.add("ez-active"), this.root.hidden = !1;
    const i = this.root.getBoundingClientRect(), r = this.host.getEditableElement(t), a = (r == null ? void 0 : r.querySelector("li")) ?? r, l = (a == null ? void 0 : a.getBoundingClientRect()) ?? n, c = a ? Number.parseFloat(getComputedStyle(a).lineHeight) || 26 : n.height;
    this.root.style.top = `${Math.round(l.top - s.top + this.host.target.scrollTop + (Math.min(c, l.height) - i.height) / 2)}px`;
    const d = this.host.target.getAttribute("dir") === "rtl";
    this.root.style.left = "", this.root.style.right = "", this.root.style[d ? "right" : "left"] = d ? `${Math.max(0, Math.round(s.right - n.right - i.width - 10))}px` : `${Math.max(0, Math.round(n.left - s.left - i.width - 10))}px`, this.root.classList.add("ez-visible"), this.root.classList.toggle("ez-hovered", this.hoveredBlockId === t || e.matches(":hover"));
  }
  hide() {
    var t;
    this.closeSettings(), this.root.contains(document.activeElement) && this.activeBlockId && !this.host.readOnly && !this.host.isDestroyed() && this.host.focusBlock(this.activeBlockId, "end"), this.root.hidden = !0, this.root.classList.remove("ez-visible", "ez-hovered"), this.hoveredBlockId = null, (t = this.activeBlockElement) == null || t.classList.remove("ez-active"), this.activeBlockElement = null;
  }
  toggleSettings() {
    if (this.open) {
      this.closeSettings();
      return;
    }
    this.openSettings();
  }
  openSettings() {
    var e;
    !this.activeBlockId || this.host.readOnly || (this.host.focusBlock(this.activeBlockId, "end"), this.settingsPopover = p("div", "ez-popover"), this.settingsPopover.setAttribute("role", "dialog"), this.settingsPopover.setAttribute("aria-label", this.host.i18n.t("toolbar.settings")), this.settingsPopover.addEventListener("focusout", (s) => {
      const n = s.relatedTarget;
      n && this.root.contains(n) || (this.closeSettings(), n || this.settingsButton.focus());
    }), this.renderSettingsMenu(this.activeBlockId), !this.host.target.querySelector(`[data-ez-block-id="${CSS.escape(this.activeBlockId)}"]`)) || (this.root.appendChild(this.settingsPopover), _(this.settingsPopover, this.settingsButton.getBoundingClientRect()), this.open = !0, this.settingsButton.setAttribute("aria-expanded", "true"), (e = this.settingsPopover.querySelector("button")) == null || e.focus({ preventScroll: !0 }));
  }
  closeSettings() {
    var s;
    const t = this.settingsPopover, e = this.menuTunes;
    this.settingsPopover = null, this.menuTunes = [], this.open = !1, this.settingsButton.setAttribute("aria-expanded", "false"), t != null && t.contains(document.activeElement) && !this.root.hidden && this.settingsButton.focus({ preventScroll: !0 }), t == null || t.remove();
    for (const n of e) (s = n.destroy) == null || s.call(n);
  }
  renderSettingsMenu(t) {
    var u, h;
    const e = p("div", "ez-menu"), s = this.host.getBlockType(t) ?? "";
    e.appendChild(this.menuButton(b.plus, this.host.i18n.t("toolbar.addBelow"), () => {
      this.hide(), this.host.openBlockPicker(t, !0);
    }));
    const n = (h = (u = this.host.getTool(t)) == null ? void 0 : u.renderSettings) == null ? void 0 : h.call(u);
    n && e.appendChild(n), this.host.registry.listBlockTools().filter((f) => f.toolbox && f.name !== s && Oe(this.host, s, f.name)).length > 0 && e.appendChild(this.menuButton(b.chevronRight, this.host.i18n.t("settings.convertPicker"), () => {
      this.hide(), this.host.openBlockPicker(t);
    })), e.appendChild(p("div", "ez-menu-category", this.host.i18n.t("toolbar.settings")));
    const r = this.menuButton(b.copy, this.host.i18n.t("settings.duplicate"), () => {
      this.closeSettings(), this.hide();
      const f = this.host.duplicateBlock(t);
      this.host.focusBlock(f, "end");
    }), a = this.menuButton(b.up, this.host.i18n.t("settings.moveUp"), () => {
      this.closeSettings(), this.hide();
      const f = this.host.getBlockIndex(t);
      f > 0 && this.host.moveBlock(t, f - 1), this.host.focusBlock(t, "end");
    }), l = this.menuButton(b.down, this.host.i18n.t("settings.moveDown"), () => {
      this.closeSettings(), this.hide();
      const f = this.host.getBlockIndex(t);
      f >= 0 && f < this.host.blocks.length - 1 && this.host.moveBlock(t, f + 1), this.host.focusBlock(t, "end");
    }), c = this.menuButton(b.trash, this.host.i18n.t("settings.delete"), () => {
      var m;
      this.closeSettings(), this.hide();
      const f = this.host.getBlockIndex(t);
      this.host.removeBlock(t);
      const g = this.host.blocks.blocks[Math.min(f, this.host.blocks.length - 1)];
      g ? this.host.focusBlock(g.id, "end") : (m = this.host.target.querySelector(".ez-empty-input")) == null || m.focus(), this.host.announce(this.host.i18n.t("settings.deleted"));
    });
    c.classList.add("ez-danger"), a.disabled = this.host.getBlockIndex(t) === 0, l.disabled = this.host.getBlockIndex(t) === this.host.blocks.length - 1, e.append(r, a, l, c);
    for (const f of this.host.registry.listTunes()) {
      const g = this.renderTuneMenu(t, f.name);
      g && (e.appendChild(p("div", "ez-menu-category", this.host.i18n.t(`tune.${f.name}`))), e.appendChild(g));
    }
    const d = this.settingsPopover;
    d && (N(d), d.appendChild(e));
  }
  renderTuneMenu(t, e) {
    var s, n;
    try {
      const i = this.host.registry.createTune(e, {
        api: this.hostToolApi(t),
        config: {},
        value: ((n = (s = this.host.blocks.getById(t)) == null ? void 0 : s.tunes) == null ? void 0 : n[e]) ?? null,
        onChange: (a) => {
          this.host.blocks.setTune(t, e, a), this.closeSettings(), this.host.focusBlock(t, "end");
        },
        t: (a) => this.host.i18n.t(a)
      }), r = i.render();
      return this.menuTunes.push(i), r.setAttribute("role", "group"), r;
    } catch {
      return null;
    }
  }
  hostToolApi(t) {
    const e = this.host;
    return {
      id: t,
      type: e.getBlockType(t) ?? "",
      readOnly: e.readOnly,
      element: e.target.querySelector(`[data-ez-block-id="${CSS.escape(t)}"] .ez-tool-host`) ?? document.createElement("div"),
      getData: () => e.getBlockData(t) ?? {},
      update: (s) => e.updateBlockData(t, s),
      patch: (s) => {
        const i = { ...e.getBlockData(t) ?? {}, ...s };
        e.updateBlockData(t, i);
      },
      requestSave: () => e.requestSaveBlock(t),
      focus: (s) => e.focusBlock(t, s),
      remove: () => e.removeBlock(t),
      move: (s) => e.moveBlock(t, s),
      duplicate: () => e.duplicateBlock(t),
      convert: (s) => e.convertBlock(t, s)
    };
  }
  menuButton(t, e, s) {
    const n = p("button", "ez-menu-item");
    if (n.type = "button", Fs(t))
      n.appendChild(D(t));
    else {
      const r = p("span", "ez-menu-icon", t);
      n.appendChild(r);
    }
    const i = p("span", "ez-menu-label", e);
    return n.appendChild(i), n.addEventListener("click", s), n;
  }
  destroy() {
    this.hide();
    for (const t of this.disposers) t();
    this.root.remove();
  }
}
function hs(o, t) {
  if (o === "") return 0;
  const e = o.toLowerCase(), s = t.toLowerCase();
  let n = 0, i = 0, r = 0;
  for (let a = 0; a < s.length && n < e.length; a++)
    s[a] === e[n] ? (r++, i += 1 + r, n++) : r = 0;
  return n === e.length ? i : -1;
}
class xr {
  constructor(t) {
    this.entries = [], this.filtered = [], this.focusedIndex = 0, this.isOpen = !1, this.blockId = null, this.unsubOutside = null, this.insertMode = !1, this.typedSlash = !1, this.prefix = `ez-slash-${++Ir}`, this.host = t, this.root = p("div", "ez-popover ez-slash-menu"), this.root.setAttribute("role", "dialog"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.add")), this.root.setAttribute("data-ez-ui", "true"), this.root.style.display = "none", this.root.addEventListener("mousedown", (e) => {
      e.target.closest("button") && e.preventDefault();
    }), this.root.addEventListener("keydown", (e) => {
      !e.isComposing && this.handleKey(e) && e.preventDefault(), e.stopPropagation();
    });
  }
  getElement() {
    return this.root;
  }
  open(t, e = !1, s = !1) {
    if (this.host.readOnly) return;
    this.close(), this.blockId = t, this.insertMode = e, this.typedSlash = s, this.root.setAttribute("aria-label", this.host.i18n.t(e || s ? "toolbar.add" : "settings.convertPicker"));
    const n = this.host.getBlockType(t) ?? "";
    this.entries = this.host.registry.listBlockTools().filter((i) => !!i.toolbox).filter((i) => e || s || Oe(this.host, n, i.name)).map((i) => ({ name: i.name, title: i.toolbox.title, icon: i.toolbox.icon ?? "•", category: i.toolbox.category })), this.isOpen = !0, this.buildDom(), this.root.style.display = "block", this.filter(""), this.focusedIndex = 0, this.renderList(), this.position(), this.input.focus({ preventScroll: !0 });
  }
  isOpenMenu() {
    return this.isOpen;
  }
  /** Update the query while the user keeps typing after "/". */
  setQuery(t) {
    this.isOpen && (this.filter(t), this.focusedIndex = 0, this.renderList());
  }
  handleKey(t) {
    if (!this.isOpen) return !1;
    switch (t.key) {
      case "ArrowDown":
        return this.focusedIndex = Math.min(this.focusedIndex + 1, this.filtered.length - 1), this.renderList(), !0;
      case "ArrowUp":
        return this.focusedIndex = Math.max(this.focusedIndex - 1, 0), this.renderList(), !0;
      case "Home":
        return this.focusedIndex = 0, this.renderList(), !0;
      case "End":
        return this.focusedIndex = this.filtered.length - 1, this.renderList(), !0;
      case "Enter":
        return this.filtered[this.focusedIndex] ? (t.preventDefault(), this.select(this.filtered[this.focusedIndex]), !0) : !1;
      case "Escape":
        return t.preventDefault(), this.close(!0), !0;
      case "Tab":
        return this.close(!0), !0;
      default:
        return !1;
    }
  }
  close(t = !1) {
    var s;
    if (!this.isOpen) return;
    const e = this.blockId;
    this.isOpen = !1, this.blockId = null, we(this.root), this.root.style.display = "none", (s = this.unsubOutside) == null || s.call(this), this.input.setAttribute("aria-expanded", "false"), this.unsubOutside = null, t && e && !this.host.readOnly && this.host.focusBlock(e, "end");
  }
  buildDom() {
    N(this.root), this.input = p("input", "ez-menu-search"), this.input.type = "text", this.input.placeholder = this.host.i18n.t("slash.placeholder"), this.input.setAttribute("aria-label", this.host.i18n.t("slash.placeholder")), this.input.setAttribute("role", "combobox"), this.input.setAttribute("aria-expanded", "true"), this.input.setAttribute("aria-autocomplete", "list"), this.input.setAttribute("aria-controls", `${this.prefix}-list`), this.input.addEventListener("input", () => this.setQuery(this.input.value)), this.list = p("div", "ez-menu"), this.list.setAttribute("role", "listbox"), this.list.id = `${this.prefix}-list`, this.list.setAttribute("aria-label", this.host.i18n.t("toolbar.blockType")), this.root.append(this.input, this.list);
    const t = (s) => {
      this.root.contains(s.target) || this.close();
    };
    document.addEventListener("mousedown", t, !0);
    const e = () => this.position();
    window.addEventListener("resize", e), document.addEventListener("scroll", e, !0), this.unsubOutside = () => {
      document.removeEventListener("mousedown", t, !0), window.removeEventListener("resize", e), document.removeEventListener("scroll", e, !0);
    };
  }
  filter(t) {
    if (t === "") {
      this.filtered = this.entries.slice();
      return;
    }
    this.filtered = this.entries.map((e) => ({ entry: e, score: Math.max(hs(t, e.title), hs(t, e.name)) })).filter((e) => e.score >= 0).sort((e, s) => s.score - e.score).map((e) => e.entry);
  }
  renderList() {
    if (N(this.list), this.filtered.length === 0) {
      const s = p("div", "ez-menu-empty", this.host.i18n.t("slash.empty"));
      s.setAttribute("role", "status"), this.input.removeAttribute("aria-activedescendant"), this.list.appendChild(s);
      return;
    }
    let t;
    this.filtered.forEach((s, n) => {
      s.category && s.category !== t && (this.list.appendChild(p("div", "ez-menu-category", s.category)), t = s.category);
      const i = p("button", "ez-menu-item" + (n === this.focusedIndex ? " ez-focused" : ""));
      i.type = "button", i.setAttribute("role", "option"), i.setAttribute("aria-selected", n === this.focusedIndex ? "true" : "false"), i.id = `${this.prefix}-option-${n}`, i.tabIndex = -1, Fs(s.icon) ? i.appendChild(D(s.icon)) : i.appendChild(p("span", "ez-menu-icon", s.icon));
      const r = p("span", "ez-menu-label", s.title);
      i.appendChild(r), i.addEventListener("click", () => this.select(s)), this.list.appendChild(i);
    }), this.input.setAttribute("aria-activedescendant", `${this.prefix}-option-${this.focusedIndex}`);
    const e = this.list.querySelector(".ez-focused");
    e == null || e.scrollIntoView({ block: "nearest" });
  }
  select(t) {
    var a;
    const e = this.blockId, s = this.insertMode, n = this.typedSlash;
    if (this.close(), !e || this.host.readOnly) return;
    const i = this.host.getBlockData(e), r = ((a = this.host.getEditableElement(e)) == null ? void 0 : a.textContent) ?? "";
    if (n && r.trim().startsWith("/") && Array.isArray(i == null ? void 0 : i.content) && this.host.updateBlockData(e, { ...i, content: [] }), s && !(this.host.getBlockType(e) === "paragraph" && r.trim() === "")) {
      this.host.insertBlock(t.name, void 0, { after: e, focus: !0 }), this.host.announce(`${t.title} added`);
      return;
    }
    this.host.convertBlock(e, t.name), this.host.focusBlock(e, "end"), this.host.announce(`Converted to ${t.title}`);
  }
  position() {
    if (!this.isOpen || !this.blockId) return;
    const t = this.host.target.querySelector(`[data-ez-block-id="${CSS.escape(this.blockId)}"]`);
    _(this.root, (t ?? this.host.target).getBoundingClientRect());
  }
  destroy() {
    this.close(), this.root.remove();
  }
}
let Ir = 0;
const us = "[data-ez-block-id], [data-ez-nested-id]";
class fs {
  constructor(t, e) {
    this.started = !1, this.disposers = [], this.draggingId = null, this.pointerDrag = null, this.host = t, this.target = e;
  }
  start() {
    if (this.started || this.host.readOnly) return;
    this.started = !0;
    const t = (a) => {
      if (this.host.readOnly || !this.draggingId) return;
      const l = this.dropTarget(this.blockFromEvent(a), a.clientY);
      this.highlight(l), l && (a.preventDefault(), a.dataTransfer && (a.dataTransfer.dropEffect = "move"));
    }, e = (a) => {
      const l = this.blockFromEvent(a);
      l && (!a.relatedTarget || !l.contains(a.relatedTarget)) && this.highlight(null);
    }, s = (a) => {
      if (this.host.readOnly || !this.draggingId) return;
      a.preventDefault();
      const l = this.dropTarget(this.blockFromEvent(a), a.clientY);
      l && this.moveTo(l), n();
    }, n = () => {
      this.draggingId = null, this.highlight(null);
      for (const a of Array.from(this.target.querySelectorAll(".ez-drop-target, .ez-dragging")))
        a.classList.remove("ez-drop-target", "ez-below", "ez-drop-inside", "ez-dragging");
    };
    this.target.addEventListener("dragover", t), this.target.addEventListener("dragleave", e), this.target.addEventListener("drop", s), this.target.addEventListener("dragend", n);
    const i = (a) => {
      var u, h;
      if (this.host.readOnly) {
        a.preventDefault();
        return;
      }
      const l = (u = a.dataTransfer) == null ? void 0 : u.getData("text/x-ezynota-drag"), c = a.target.closest(".ez-nested-drag"), d = l ? this.findBlock(l) : c ? this.blockFromEvent(a) : null;
      d && (this.draggingId = this.blockId(d), (h = a.dataTransfer) == null || h.setData("text/x-ezynota-drag", this.draggingId), a.dataTransfer && (a.dataTransfer.effectAllowed = "move"), d.classList.add("ez-dragging"));
    };
    this.target.addEventListener("dragstart", i);
    const r = (a) => {
      var u, h;
      if (this.host.readOnly || a.pointerType === "mouse" || a.button !== 0 || this.pointerDrag) return;
      const l = (h = (u = a.target).closest) == null ? void 0 : h.call(u, ".ez-block-actions, .ez-nested-drag");
      if (!l) return;
      const c = l.closest("[data-ez-nested-id]") ?? this.target.querySelector(".ez-block.ez-active"), d = c ? this.blockId(c) : null;
      d && (this.pointerDrag = this.beginPointerDrag(d));
    };
    this.target.addEventListener("pointerdown", r), this.disposers.push(() => {
      var a;
      this.target.removeEventListener("dragover", t), this.target.removeEventListener("dragleave", e), this.target.removeEventListener("drop", s), this.target.removeEventListener("dragend", n), this.target.removeEventListener("dragstart", i), this.target.removeEventListener("pointerdown", r), (a = this.pointerDrag) == null || a.cleanup(), this.pointerDrag = null, n();
    });
  }
  stop() {
    for (const t of this.disposers) t();
    this.disposers.length = 0, this.started = !1;
  }
  /** Shared destination and transaction path for mouse and touch dragging. */
  moveTo(t) {
    const e = this.draggingId;
    !e || this.host.readOnly || (this.host.blocks.relocate(e, t.id, t.placement), this.host.focusBlock(e, "start"), this.host.announce(t.placement === "inside" ? "Block moved inside section" : "Block moved"));
  }
  blockId(t) {
    return t.getAttribute("data-ez-nested-id") ?? t.getAttribute("data-ez-block-id") ?? "";
  }
  findBlock(t) {
    return this.target.querySelector(`[data-ez-block-id="${CSS.escape(t)}"], [data-ez-nested-id="${CSS.escape(t)}"]`);
  }
  dropTarget(t, e) {
    var a;
    if (!t || !this.draggingId) return null;
    const s = this.blockId(t), n = this.findBlock(this.draggingId);
    if (!s || n != null && n.contains(t)) return null;
    const i = t.getBoundingClientRect();
    let r = e > i.top + i.height / 2 ? "after" : "before";
    if (((a = this.host.blocks.getByIdRecursive(s)) == null ? void 0 : a.type) === "toggle") {
      const l = Math.min(8, i.height / 4);
      e >= i.top + l && e <= i.bottom - l && (r = "inside");
    }
    return { element: t, id: s, placement: r };
  }
  highlight(t) {
    for (const e of this.target.querySelectorAll(".ez-drop-target"))
      e.classList.remove("ez-drop-target", "ez-below", "ez-drop-inside");
    t && (t.element.classList.add("ez-drop-target"), t.element.classList.toggle("ez-below", t.placement === "after"), t.element.classList.toggle("ez-drop-inside", t.placement === "inside"));
  }
  /** Visual ghost + drop tracking driven by document-level pointer events. */
  beginPointerDrag(t) {
    const e = this.target.ownerDocument, s = e.createElement("div");
    s.className = "ez-drag-ghost", s.setAttribute("data-ez-ui", "true"), s.style.position = "fixed", s.style.pointerEvents = "none", s.style.zIndex = "1000", s.style.padding = "4px 10px", s.style.maxWidth = "240px", s.style.overflow = "hidden", s.style.whiteSpace = "nowrap", s.style.textOverflow = "ellipsis";
    const n = this.findBlock(t);
    s.textContent = ((n == null ? void 0 : n.textContent) ?? "").trim().slice(0, 80) || t, e.body.appendChild(s);
    const i = (c) => {
      this.host.readOnly || (s.style.left = `${c.clientX + 12}px`, s.style.top = `${c.clientY + 12}px`, this.highlight(this.dropTarget(this.blockFromPoint(c.clientX, c.clientY), c.clientY)));
    }, r = () => {
      e.removeEventListener("pointermove", i), e.removeEventListener("pointerup", a), e.removeEventListener("pointercancel", l), s.remove(), this.highlight(null), this.draggingId = null, this.pointerDrag = null;
    }, a = (c) => {
      const d = this.dropTarget(this.blockFromPoint(c.clientX, c.clientY), c.clientY);
      d && this.moveTo(d), r();
    }, l = () => {
      r();
    };
    return this.draggingId = t, e.addEventListener("pointermove", i), e.addEventListener("pointerup", a), e.addEventListener("pointercancel", l), { cleanup: r };
  }
  blockFromEvent(t) {
    let e = t.target;
    for (; e && e !== this.target; ) {
      if (e.nodeType === Node.ELEMENT_NODE && e.matches(us))
        return e;
      e = e.parentNode;
    }
    return null;
  }
  blockFromPoint(t, e) {
    const n = this.target.ownerDocument.elementFromPoint(t, e);
    if (!n) return null;
    const i = n.closest(us);
    return i && this.target.contains(i) ? i : null;
  }
}
const It = class It {
  constructor(t) {
    this.api = t.api;
  }
  render() {
    var i;
    const t = ((i = this.wrapper) == null ? void 0 : i.ownerDocument) ?? this.api.element.ownerDocument ?? document, e = this.api.getData(), s = (e == null ? void 0 : e.header) !== !1, n = Array.isArray(e == null ? void 0 : e.rows) && e.rows.length > 0 ? e.rows : [[{ content: [] }, { content: [] }], [{ content: [] }, { content: [] }]];
    this.wrapper = p("div", "ez-table-wrap"), this.tableEl = t.createElement("table"), this.tableEl.className = "ez-table";
    for (let r = 0; r < n.length; r++) {
      const a = n[r], l = t.createElement("tr");
      for (let c = 0; c < a.length; c++) {
        const d = a[c] ?? { content: [] }, u = s && r === 0 ? "th" : "td", h = t.createElement(u);
        h.contentEditable = this.api.readOnly ? "false" : "true", h.setAttribute("data-ez-editable", "true"), h.setAttribute("data-ez-region", `r${r}c${c}`), h.setAttribute("role", "textbox"), h.setAttribute("aria-multiline", "true"), d != null && d.content && !Nt(d.content) && h.appendChild(F(d.content, t)), l.appendChild(h);
      }
      this.tableEl.appendChild(l);
    }
    return this.wrapper.appendChild(this.tableEl), this.wrapper.addEventListener("keydown", (r) => this.handleKeydown(r)), this.wrapper;
  }
  save(t) {
    const e = [], s = this.tableEl.querySelector("th") !== null;
    for (const n of Array.from(this.tableEl.rows)) {
      const i = [];
      for (const r of Array.from(n.cells))
        i.push({ content: z(r) });
      e.push(i);
    }
    return { header: s, rows: e.length > 0 ? e : [[{ content: [] }, { content: [] }]] };
  }
  validate(t) {
    return !!t && Array.isArray(t.rows) && t.rows.length > 0;
  }
  /** Table settings: row/column operations and the header toggle. */
  renderSettings() {
    var s;
    const t = p("div", "ez-inline-group");
    t.setAttribute("role", "group"), t.setAttribute("aria-label", "Table options");
    const e = [
      { label: "Add row", icon: b.tableRowAdd, run: () => this.addRowAt(-1) },
      { label: "Add column", icon: b.tableColumnAdd, run: () => this.addColumnAt(-1) },
      { label: "Delete row", icon: b.tableRowDelete, run: () => this.deleteRow() },
      { label: "Delete column", icon: b.tableColumnDelete, run: () => this.deleteColumn() },
      { label: "Toggle header", icon: b.tableHeader, run: () => this.toggleHeader(), toggle: !0 }
    ];
    for (const n of e) {
      const i = E("ez-inline-btn", n.icon, n.label);
      (s = i.querySelector("svg")) == null || s.setAttribute("aria-hidden", "true");
      const r = () => {
        if (!n.toggle) return;
        const a = this.tableEl.querySelector("th") !== null;
        i.classList.toggle("ez-active", a), i.setAttribute("aria-pressed", String(a));
      };
      r(), i.addEventListener("click", () => {
        this.api.readOnly || (n.run(), r());
      }), t.appendChild(i);
    }
    return t;
  }
  updated() {
    const t = this.api.getData();
    !this.wrapper || !(t != null && t.rows) || this.swapWrapper();
  }
  /** render() reassigns this.wrapper, so capture the old element first. */
  swapWrapper() {
    const t = this.wrapper, e = this.render();
    return t.parentElement && t.replaceWith(e), this.wrapper = e, e;
  }
  focus(t) {
    if (!this.tableEl) return;
    const e = Array.from(this.tableEl.querySelectorAll("[data-ez-editable]")), s = (t === "end" ? e[e.length - 1] : e[0]) ?? this.tableEl;
    s == null || s.focus();
  }
  getEditable() {
    return this.tableEl.querySelector("[data-ez-editable]") ?? void 0;
  }
  destroy() {
  }
  /* ---------- keyboard navigation ---------- */
  handleKeydown(t) {
    var e;
    if (!this.api.readOnly && t.key === "Tab") {
      t.preventDefault();
      const s = this.tableEl.ownerDocument, n = Array.from(this.tableEl.querySelectorAll("[data-ez-editable]")), i = n.indexOf(s.activeElement), r = t.shiftKey ? i - 1 : i + 1;
      if (r >= 0 && r < n.length)
        n[r].focus();
      else if (!t.shiftKey) {
        this.addRowAt(-1);
        const a = Array.from(this.tableEl.querySelectorAll("[data-ez-editable]"));
        (e = a[a.length - 1]) == null || e.focus();
      }
    }
  }
  /* ---------- structural operations ---------- */
  addRowAt(t) {
    var r;
    const e = this.save(this.wrapper), s = ((r = e.rows[0]) == null ? void 0 : r.length) ?? 2, n = Array.from({ length: s }, () => ({ content: [] })), i = t < 0 ? e.rows.length : Math.max(1, t);
    e.rows.splice(i, 0, n), this.commit(e);
  }
  addColumnAt(t) {
    const e = this.save(this.wrapper), s = t < 0 ? e.rows[0].length : t;
    for (const n of e.rows) n.splice(s, 0, { content: [] });
    this.commit(e);
  }
  deleteRow() {
    const t = this.activeCell();
    if (!t) return;
    const e = this.save(this.wrapper);
    if (e.rows.length <= 1) return;
    const s = t.row;
    e.rows.splice(s, 1), s === 0 && e.header && (e.header = !1), this.commit(e);
  }
  deleteColumn() {
    var n;
    const t = this.activeCell();
    if (!t) return;
    const e = this.save(this.wrapper);
    if ((((n = e.rows[0]) == null ? void 0 : n.length) ?? 0) <= 1) return;
    const s = t.column;
    for (const i of e.rows) i.splice(s, 1);
    this.commit(e);
  }
  toggleHeader() {
    const t = this.save(this.wrapper);
    t.header = !t.header, this.commit(t);
  }
  activeCell() {
    var s;
    const t = (s = document.activeElement) == null ? void 0 : s.closest("td, th");
    if (!t || !this.tableEl.contains(t)) return null;
    const e = t.parentElement;
    return {
      row: Array.from(this.tableEl.rows).indexOf(e),
      column: Array.from(e.cells).indexOf(t)
    };
  }
  /** Persist structural changes through the editor's transaction stream. */
  commit(t) {
    const e = this.activeCell();
    this.api.update(t);
    const s = this.swapWrapper();
    if (e) {
      const n = s.querySelectorAll("tr"), i = n[Math.min(e.row, n.length - 1)], r = i ? Array.from(i.querySelectorAll("[data-ez-editable]")) : [], a = r[Math.min(e.column, r.length - 1)];
      if (a) {
        a.focus();
        return;
      }
    }
    this.api.focus("start");
  }
};
It.toolbox = { icon: j.table, title: "Table", category: "Rich blocks" }, It.conversion = { to: ["paragraph"] }, It.enableInlineTools = !0;
let xe = It;
const Tt = /* @__PURE__ */ new Map(), qt = /* @__PURE__ */ new WeakMap();
let Ws = 1;
function Wt(o, t) {
  let e = null;
  for (const s of Tt.values())
    s.scope === t && o(s) && (e = s);
  return e;
}
function Cr(o, t) {
  const e = Ws++;
  return Tt.set(e, { storer: o, scope: t }), () => {
    Tt.delete(e);
  };
}
function zr(o, t) {
  const e = Ws++;
  return Tt.set(e, { loader: o, scope: t }), () => {
    Br(o), Tt.delete(e);
  };
}
function ps(o) {
  return Wt((t) => t.storer !== void 0, o) !== null;
}
async function gs(o, t) {
  var s;
  const e = (s = Wt((n) => n.storer !== void 0, t)) == null ? void 0 : s.storer;
  return e ? e(o) : null;
}
function Br(o) {
  const t = qt.get(o);
  if (t) {
    for (const e of t.values())
      try {
        URL.revokeObjectURL(e);
      } catch {
      }
    qt.delete(o);
  }
}
async function Tr(o, t) {
  var a;
  if (!o.startsWith("asset:")) return null;
  const e = (a = Wt((l) => l.loader !== void 0, t)) == null ? void 0 : a.loader;
  if (!e) return null;
  const s = o.slice(6);
  let n = qt.get(e);
  n || (n = /* @__PURE__ */ new Map(), qt.set(e, n));
  const i = n.get(s);
  if (i) return i;
  let r;
  try {
    r = await e(s);
  } catch {
    return null;
  }
  if (Wt((l) => l.loader === e, t) === null || !r) return null;
  try {
    const l = n.get(s);
    if (l) return l;
    const c = URL.createObjectURL(new Blob([r.bytes], { type: r.mime }));
    return n.set(s, c), c;
  } catch {
    return null;
  }
}
const gt = class gt {
  constructor(t) {
    this.srcGeneration = 0, this.destroyed = !1, this.resizeInput = null, this.resizeValue = null, this.editPanel = null, this.panelTrigger = null, this.uploadButton = null, this.feedback = null, this.api = t.api;
  }
  render() {
    const t = document, e = this.api.getData();
    this.figure = t.createElement("figure"), this.figure.className = "ez-image";
    const s = t.createElement("div");
    s.className = "ez-image-frame", s.style.width = `${this.currentWidth()}%`, this.img = t.createElement("img"), this.img.alt = typeof (e == null ? void 0 : e.alt) == "string" ? e.alt : "", this.applySrcToImg((e == null ? void 0 : e.src) ?? ""), this.api.readOnly || (this.img.addEventListener("dblclick", () => this.pickFile()), this.figure.addEventListener("dragover", (i) => {
      var r;
      (r = i.dataTransfer) != null && r.types.includes("Files") && i.preventDefault();
    }), this.figure.addEventListener("drop", (i) => {
      var a;
      const r = (a = i.dataTransfer) == null ? void 0 : a.files;
      r && r.length > 0 && (i.preventDefault(), i.stopPropagation(), this.storeFile(r[0]));
    })), s.appendChild(this.img), this.figure.appendChild(s);
    const n = t.createElement("figcaption");
    return n.className = "ez-text-input ez-image-caption", n.contentEditable = this.api.readOnly ? "false" : "true", n.setAttribute("data-ez-editable", "true"), n.setAttribute("data-ez-placeholder", "Add a caption..."), n.setAttribute("data-ez-region", "caption"), n.setAttribute("aria-label", "Image caption"), n.textContent = typeof (e == null ? void 0 : e.caption) == "string" ? e.caption : "", this.figure.appendChild(n), this.api.readOnly || (this.figure.appendChild(this.buildToolbar()), this.editPanel = p("div", "ez-image-edit-panel"), this.editPanel.setAttribute("data-ez-ui", "true"), this.editPanel.hidden = !0, this.feedback = p("p", "ez-image-feedback"), this.feedback.setAttribute("role", "status"), this.feedback.hidden = !0, this.figure.append(this.editPanel, this.feedback)), this.figure;
  }
  save(t) {
    var n, i;
    const e = (n = this.figure) == null ? void 0 : n.querySelector(".ez-image-caption"), s = this.api.getData();
    return {
      src: typeof (s == null ? void 0 : s.src) == "string" ? s.src : "",
      alt: ((i = this.img) == null ? void 0 : i.alt) ?? "",
      caption: (e == null ? void 0 : e.textContent) ?? "",
      width: this.currentWidth()
    };
  }
  validate(t) {
    return !!t && typeof t.src == "string";
  }
  /** Files pasted into this block replace the image. */
  onPaste(t) {
    var s;
    const e = (s = t.files) == null ? void 0 : s[0];
    e && this.storeFile(e);
  }
  updated() {
    const t = this.api.getData();
    if (!this.figure || !t) return;
    this.applySrcToImg(t.src);
    const e = typeof t.alt == "string" ? t.alt : "";
    this.img && this.img.alt !== e && (this.img.alt = e);
    const s = this.currentWidth(), n = this.figure.querySelector(".ez-image-frame");
    n && (n.style.width = `${s}%`), this.resizeInput && (this.resizeInput.value = String(s)), this.updateWidthLabel(s);
    const i = this.figure.querySelector(".ez-image-caption");
    i && document.activeElement !== i && (i.textContent ?? "") !== (t.caption ?? "") && (i.textContent = t.caption ?? "");
  }
  focus() {
    var t, e;
    (e = (t = this.figure) == null ? void 0 : t.querySelector(".ez-image-caption")) == null || e.focus();
  }
  getEditable() {
    var t;
    return ((t = this.figure) == null ? void 0 : t.querySelector(".ez-image-caption")) ?? void 0;
  }
  destroy() {
    this.destroyed = !0, this.srcGeneration++;
  }
  /* ---------- implementation ---------- */
  applySrcToImg(t) {
    const e = ++this.srcGeneration;
    if (this.img && (this.clearBrokenImageState(), !(typeof t != "string" || t === ""))) {
      if (t.startsWith("asset:")) {
        Tr(t, this.api.assetScope).then((s) => {
          var n;
          this.destroyed || e !== this.srcGeneration || !((n = this.img) != null && n.isConnected) || (s ? this.img.src = s : this.showBrokenImage("This image could not be loaded."));
        });
        return;
      }
      if (Z(t) || t.startsWith("data:image/")) {
        this.img.src = t;
        return;
      }
      this.showBrokenImage("This image could not be loaded.");
    }
  }
  showBrokenImage(t) {
    this.img && (this.img.classList.add("ez-image-broken"), this.img.setAttribute("aria-label", `${this.img.alt || "Image"} — could not be loaded`), this.showFeedback(t));
  }
  clearBrokenImageState() {
    this.img && (this.img.classList.remove("ez-image-broken"), this.img.hasAttribute("aria-label") && this.img.removeAttribute("aria-label")), this.showFeedback("");
  }
  buildToolbar() {
    const t = p("div", "ez-image-toolbar");
    t.setAttribute("data-ez-ui", "true"), t.setAttribute("role", "group"), t.setAttribute("aria-label", "Image controls");
    const e = p("div", "ez-image-actions"), s = (c, d, u) => {
      const h = A("ez-image-action", c, u);
      return h.prepend(D(d)), h.title = u, h;
    }, n = s("Upload", b.upload, "Upload image");
    this.uploadButton = n, n.addEventListener("click", () => this.pickFile());
    const i = s("Image URL", b.link, "Insert image from URL");
    i.setAttribute("aria-expanded", "false"), i.addEventListener("click", () => this.openEditPanel("url", i));
    const r = s("Alt text", b.info, "Edit image description for screen readers");
    r.setAttribute("aria-expanded", "false"), r.addEventListener("click", () => this.openEditPanel("alt", r));
    const a = p("label", "ez-image-size");
    a.appendChild(p("span", "ez-image-size-label", "Width"));
    const l = p("input", "ez-image-resize");
    return this.resizeInput = l, l.type = "range", l.min = "10", l.max = "100", l.value = String(this.currentWidth()), l.setAttribute("aria-label", "Image width"), this.resizeValue = p("output", "ez-image-size-value"), this.updateWidthLabel(this.currentWidth()), l.addEventListener("input", () => {
      const c = this.figure.querySelector(".ez-image-frame");
      c && (c.style.width = `${l.value}%`), this.updateWidthLabel(Number(l.value));
    }), l.addEventListener("change", () => {
      this.api.update({ ...this.save(this.figure), width: Number(l.value) });
    }), e.append(n, i, r), a.append(l, this.resizeValue), t.append(e, a), t;
  }
  updateWidthLabel(t) {
    var e;
    this.resizeValue && (this.resizeValue.textContent = `${t}%`), (e = this.resizeInput) == null || e.setAttribute("aria-valuetext", `${t} percent`);
  }
  currentWidth() {
    const t = this.api.getData();
    return typeof (t == null ? void 0 : t.width) == "number" && Number.isFinite(t.width) && t.width > 0 ? Math.max(10, Math.min(100, t.width)) : 100;
  }
  pickFile() {
    const t = document.createElement("input");
    t.type = "file", t.accept = "image/*", t.addEventListener("change", () => {
      var s;
      const e = (s = t.files) == null ? void 0 : s[0];
      e && this.storeFile(e);
    }), t.click();
  }
  async storeFile(t) {
    var e;
    if (!t.type.startsWith("image/")) {
      this.showFeedback("Choose an image file to upload.");
      return;
    }
    if (!((e = this.uploadButton) != null && e.disabled)) {
      this.uploadButton && (this.uploadButton.disabled = !0), this.figure.setAttribute("aria-busy", "true"), this.showFeedback("Adding image…");
      try {
        if (ps(this.api.assetScope)) {
          const n = await gs(t, this.api.assetScope);
          if (this.destroyed) return;
          if (n) {
            this.applyImage(n, t.name.replace(/\.[^.]+$/, "")), this.showFeedback("");
            return;
          }
          this.showFeedback("Could not save this image to storage. Free up space and try again.");
          return;
        }
        const s = await ms(t);
        this.applyImage(s, t.name.replace(/\.[^.]+$/, "")), this.showFeedback("");
      } catch {
        this.showFeedback("Could not add this image. Try another file.");
      } finally {
        this.uploadButton && (this.uploadButton.disabled = !1), this.figure.removeAttribute("aria-busy");
      }
    }
  }
  applyImage(t, e) {
    const s = this.save(this.figure);
    this.api.update({ ...s, src: t, alt: e });
    const n = this.api.getData();
    this.applySrcToImg(n.src);
  }
  showFeedback(t) {
    this.feedback && (this.feedback.textContent = t, this.feedback.hidden = !t);
  }
  closeEditPanel() {
    var t, e;
    this.editPanel && (this.editPanel.hidden = !0), (t = this.panelTrigger) == null || t.setAttribute("aria-expanded", "false"), (e = this.panelTrigger) == null || e.focus(), this.panelTrigger = null;
  }
  openEditPanel(t, e) {
    const s = this.editPanel;
    if (!s) return;
    const n = this.panelTrigger === e && !s.hidden;
    if (this.closeEditPanel(), n) return;
    s.replaceChildren(), this.panelTrigger = e, e.setAttribute("aria-expanded", "true");
    const i = p("label", "ez-image-field");
    i.appendChild(p("span", "ez-image-field-title", t === "url" ? "Image URL" : "Image description"));
    const r = p("input", "ez-image-field-input");
    r.type = "text", r.placeholder = t === "url" ? "https://example.com/image.jpg" : "Describe what’s in the image…";
    const a = this.api.getData();
    r.value = t === "alt" ? a.alt ?? "" : /^https?:\/\//i.test(a.src) ? a.src : "", t === "url" && (r.inputMode = "url"), i.appendChild(r);
    const l = p("p", "ez-image-field-hint", t === "url" ? "Paste a direct link to an image." : "Help people using screen readers understand this image. Leave blank for a decorative image."), c = p("p", "ez-image-field-error");
    c.setAttribute("role", "alert"), c.hidden = !0;
    const d = p("div", "ez-image-panel-actions"), u = A("ez-image-action", "Cancel");
    u.addEventListener("click", () => this.closeEditPanel());
    const h = A("ez-image-action ez-image-action-primary", t === "url" ? "Use image" : "Save description"), f = () => {
      if (t === "url") {
        const g = r.value.trim();
        if (!g || !Z(g)) {
          c.textContent = "Enter a valid image URL.", c.hidden = !1, r.setAttribute("aria-invalid", "true"), r.focus();
          return;
        }
        this.applyImage(g, this.save(this.figure).alt);
      } else
        this.api.update({ ...this.save(this.figure), alt: r.value }), this.img.alt = r.value;
      this.closeEditPanel();
    };
    h.addEventListener("click", f), r.addEventListener("input", () => {
      c.hidden = !0, r.removeAttribute("aria-invalid");
    }), s.onkeydown = (g) => {
      g.stopPropagation(), g.key === "Escape" ? (g.preventDefault(), this.closeEditPanel()) : g.key === "Enter" && g.target === r && !g.isComposing && (g.preventDefault(), f());
    }, d.append(u, h), s.append(i, l, c, d), s.hidden = !1, r.focus();
  }
};
gt.toolbox = { icon: j.image, title: "Image", category: "Rich blocks" }, gt.conversion = { to: ["paragraph"] }, gt.paste = { files: { mimeTypes: ["image/*"] } }, gt.filesToBlockDataAsync = async (t, e) => {
  const s = [];
  for (const n of t) {
    if (!n.type.startsWith("image/")) continue;
    const i = ps(e) ? await gs(n, e) : await ms(n);
    i && s.push({ type: "image", data: { src: i, alt: n.name.replace(/\.[^.]+$/, "") } });
  }
  return s;
};
let Ie = gt;
function ms(o) {
  return new Promise((t, e) => {
    const s = new FileReader();
    s.onload = () => t(String(s.result)), s.onerror = () => e(s.error ?? new Error("FileReader failed")), s.readAsDataURL(o);
  });
}
const Rt = ["info", "warning", "success", "danger"], bs = {
  info: "ℹ",
  warning: "⚠",
  success: "✓",
  danger: "✕"
}, Ct = class Ct extends Mt {
  constructor(t) {
    super(t, "Write something...", !1), this.variant = "info", this.containerEl = null;
    const e = this.api.getData();
    typeof e == "string" && Rt.includes(e) ? this.variant = e : e && typeof e == "object" && typeof e.variant == "string" && Rt.includes(e.variant) && (this.variant = e.variant);
  }
  tag() {
    return "div";
  }
  render() {
    var r;
    const t = ((r = this.editable) == null ? void 0 : r.ownerDocument) ?? document, e = t.createElement("div");
    e.className = `ez-callout ez-callout-${this.variant}`, e.setAttribute("data-ez-callout", this.variant);
    const s = t.createElement("span");
    s.className = "ez-callout-badge", s.textContent = bs[this.variant], s.setAttribute("aria-hidden", "true");
    const n = t.createElement("div");
    n.classList.add("ez-text-input"), n.contentEditable = "true", n.setAttribute("data-ez-editable", "true"), n.setAttribute("data-ez-region", "callout-content"), this.placeholder && n.setAttribute("data-ez-placeholder", this.placeholder);
    const i = this.api.getData();
    return i != null && i.content && !Nt(i.content) && n.appendChild(F(i.content, t)), this.editable = n, this.containerEl = e, e.append(s, n), e;
  }
  save(t) {
    return { variant: this.variant, content: z(this.editable) };
  }
  updated() {
    const t = this.api.getData(), e = Rt.includes(t == null ? void 0 : t.variant) ? t.variant : this.variant;
    if (e !== this.variant) {
      this.variant = e, this.refreshElement();
      return;
    }
    super.updated();
  }
  renderSettings() {
    const t = document.createElement("div");
    t.className = "ez-inline-group";
    for (const e of Rt) {
      const s = document.createElement("button");
      s.type = "button", s.className = "ez-inline-btn" + (e === this.variant ? " ez-active" : ""), s.textContent = `${bs[e]} ${e}`, s.setAttribute("aria-pressed", String(e === this.variant)), s.addEventListener("click", () => {
        this.api.readOnly || (this.variant = e, this.api.update(this.save(this.editable)), this.refreshElement(), this.api.focus("end"));
      }), t.appendChild(s);
    }
    return t;
  }
  refreshElement() {
    var s;
    if (!((s = this.containerEl) != null && s.parentElement)) return;
    const t = this.containerEl, e = this.render();
    t.replaceWith(e), this.containerEl = e, this.editable = e.querySelector("[data-ez-editable]");
  }
};
Ct.toolbox = { icon: j.callout, title: "Callout", category: "Rich blocks" }, Ct.enableInlineTools = !0, Ct.conversion = { to: ["paragraph", "quote"] };
let Ce = Ct;
const Yt = class Yt {
  constructor(t) {
    this.open = !0, this.childTools = /* @__PURE__ */ new Map(), this.childSignatures = /* @__PURE__ */ new Map(), this.api = t.api, this.nested = t.nested;
    const e = t.api.getData();
    this.open = (e == null ? void 0 : e.open) !== !1;
  }
  render() {
    var l;
    const t = document, e = this.api.getData();
    this.open = (e == null ? void 0 : e.open) !== !1, this.container = p("div", "ez-toggle"), this.container.setAttribute("data-ez-toggle-open", String(this.open));
    const s = p("div", "ez-toggle-header"), n = E("ez-icon-btn ez-toggle-caret", this.open ? b.caretDown : b.caretRight, this.open ? "Collapse section" : "Expand section");
    n.setAttribute("aria-expanded", String(this.open)), n.addEventListener("click", () => {
      this.api.readOnly || (this.open = !this.open, this.api.update({ ...this.save(this.container), open: this.open }), this.container.setAttribute("data-ez-toggle-open", String(this.open)), n.innerHTML = this.open ? b.caretDown : b.caretRight, n.setAttribute("aria-expanded", String(this.open)), n.setAttribute("aria-label", this.open ? "Collapse section" : "Expand section"), n.title = this.open ? "Collapse section" : "Expand section");
    });
    const i = t.createElement("div");
    i.classList.add("ez-text-input", "ez-toggle-heading"), i.contentEditable = this.api.readOnly ? "false" : "true", i.setAttribute("data-ez-editable", "true"), i.setAttribute("data-ez-region", "toggle-heading"), i.setAttribute("data-ez-placeholder", "Section title"), e != null && e.heading && !Nt(e.heading) && i.appendChild(F(e.heading, t)), this.headingEl = i, s.append(n, i), this.childrenHost = p("div", "ez-toggle-children"), this.renderChildren();
    const r = p("div", "ez-toggle-add-row"), a = E("ez-icon-btn ez-toggle-add", b.plus, "Add block inside");
    return a.setAttribute("data-ez-ui", "true"), (l = a.querySelector("svg")) == null || l.setAttribute("aria-hidden", "true"), a.hidden = this.api.readOnly, a.addEventListener("click", () => {
      if (!this.nested || this.nested.readOnly) return;
      const c = this.nested.insert("paragraph", void 0);
      this.nested.focusBlock(c, "start");
    }), r.appendChild(a), this.container.append(s, this.childrenHost, r), this.container;
  }
  save(t) {
    return { open: this.open, heading: z(this.headingEl) };
  }
  validate(t) {
    return !!t;
  }
  updated() {
    const t = this.api.getData();
    if (!this.container || !t) return;
    const e = t.open !== !1;
    e !== this.open && (this.open = e, this.container.setAttribute("data-ez-toggle-open", String(e)));
    const s = this.findCaret();
    if (s && (s.innerHTML = e ? b.caretDown : b.caretRight, s.setAttribute("aria-expanded", String(e)), s.setAttribute("aria-label", e ? "Collapse section" : "Expand section"), s.title = e ? "Collapse section" : "Expand section"), this.headingEl && document.activeElement !== this.headingEl) {
      const n = z(this.headingEl);
      if (JSON.stringify(n) !== JSON.stringify(t.heading ?? [])) {
        for (; this.headingEl.firstChild; ) this.headingEl.removeChild(this.headingEl.firstChild);
        this.headingEl.appendChild(F(t.heading ?? [], this.headingEl.ownerDocument));
      }
    }
    this.renderChildren();
  }
  /** The header row is a direct child of the container (never a nested toggle's). */
  findCaret() {
    const t = Array.from(this.container.children).find((s) => s.classList.contains("ez-toggle-header"));
    return (t ? Array.from(t.children).find((s) => s.classList.contains("ez-toggle-caret")) : void 0) ?? null;
  }
  focus(t) {
    var s;
    if (!this.nested || this.nested.getBlocks().length === 0 || t === "start") {
      if ((s = this.headingEl) == null || s.focus(), this.headingEl) {
        const n = window.getSelection();
        if (n) {
          const i = this.headingEl.ownerDocument.createRange();
          i.selectNodeContents(this.headingEl), i.collapse(!0), n.removeAllRanges(), n.addRange(i);
        }
      }
      return;
    }
    const e = this.nested.getBlocks()[this.nested.getBlocks().length - 1];
    e && this.nested.focusBlock(e.id, "end");
  }
  getEditable() {
    return this.headingEl;
  }
  destroy() {
    var t;
    for (const e of this.childTools.values())
      try {
        (t = e.destroy) == null || t.call(e);
      } catch {
      }
    this.childTools.clear(), this.childSignatures.clear();
  }
  renderChildren() {
    var s, n, i;
    if (!this.nested || !this.childrenHost) return;
    const t = this.nested.getBlocks(), e = Array.from(this.childrenHost.children).filter(
      (r) => r.hasAttribute("data-ez-nested-id")
    );
    if (e.length === t.length) {
      let r = !0;
      for (let a = 0; a < t.length; a++)
        if (((s = e[a]) == null ? void 0 : s.getAttribute("data-ez-nested-id")) !== t[a].id || ((n = e[a]) == null ? void 0 : n.getAttribute("data-ez-block-type")) !== t[a].type) {
          r = !1;
          break;
        }
      if (r) {
        this.syncChildData();
        return;
      }
    }
    for (const r of Array.from(this.childrenHost.childNodes))
      this.childrenHost.removeChild(r);
    for (const r of this.childTools.values())
      try {
        (i = r.destroy) == null || i.call(r);
      } catch {
      }
    this.childTools.clear(), this.childSignatures.clear(), t.forEach((r, a) => {
      var d;
      const l = p("div", "ez-nested-block");
      if (l.setAttribute("data-ez-nested-id", r.id), l.setAttribute("data-ez-block-type", r.type), l.setAttribute("data-ez-region", `child-${a}`), !this.api.readOnly) {
        const u = E("ez-icon-btn ez-nested-drag", b.grip, "Drag block (Alt+ArrowUp/Down to reorder)");
        u.draggable = !0, u.setAttribute("data-ez-ui", "true"), u.addEventListener("keydown", (h) => {
          var g;
          if (!h.altKey || !["ArrowUp", "ArrowDown"].includes(h.key) || this.api.readOnly) return;
          h.preventDefault(), h.stopPropagation();
          const f = this.nested.getBlocks().findIndex((m) => m.id === r.id);
          this.nested.move(r.id, Math.max(0, f + (h.key === "ArrowUp" ? -1 : 1))), (g = this.childrenHost.querySelector(`[data-ez-nested-id="${CSS.escape(r.id)}"] > .ez-nested-drag`)) == null || g.focus();
        }), l.appendChild(u);
      }
      const c = this.nested.createToolInstance(r, l, this.childApi(r, l));
      l.appendChild(c.render());
      for (const u of l.querySelectorAll("[data-ez-editable]"))
        u.contentEditable = this.api.readOnly ? "false" : "true";
      try {
        (d = c.rendered) == null || d.call(c);
      } catch {
      }
      this.childTools.set(r.id, c), this.childSignatures.set(r.id, JSON.stringify(r)), this.childrenHost.appendChild(l);
    });
  }
  syncChildData() {
    var e, s, n;
    const t = ((e = this.nested) == null ? void 0 : e.getBlocks()) ?? [];
    for (const i of t) {
      const r = this.childTools.get(i.id);
      if (!r) continue;
      const a = JSON.stringify(i);
      if (this.childSignatures.get(i.id) === a) continue;
      this.childSignatures.set(i.id, a);
      const l = Array.from(this.childrenHost.children).find(
        (c) => c.getAttribute("data-ez-nested-id") === i.id
      ) ?? null;
      if (l && !(i.type !== "toggle" && JSON.stringify(r.save(l)) === JSON.stringify(i.data))) {
        r.updated ? r.updated() : ((s = l.lastElementChild) == null || s.replaceWith(r.render()), (n = r.rendered) == null || n.call(r));
        for (const c of l.querySelectorAll("[data-ez-editable]"))
          c.contentEditable = this.api.readOnly ? "false" : "true";
      }
    }
  }
  nestedEditable(t, e) {
    var n;
    const s = (n = e.getEditable) == null ? void 0 : n.call(e);
    return s || (this.childrenHost.querySelector(`[data-ez-nested-id="${CSS.escape(t)}"] [data-ez-editable]`) ?? null);
  }
  saveChild(t) {
    var i;
    const e = this.childTools.get(t.id);
    if (!e) return;
    const s = this.nestedEditable(t.id, e);
    if (!s) return;
    const n = e.save(s);
    (i = this.nested) == null || i.update(t.id, n);
  }
  /**
   * Input flow entry point for nested children (routed from InputManager
   * via the host). Saves direct children; unknown ids delegate to nested
   * toggles among the children so deep grandchildren reach their owner.
   */
  requestSaveChild(t) {
    var e;
    if (this.childTools.has(t)) {
      const s = (e = this.nested) == null ? void 0 : e.getBlocks().find((n) => n.id === t);
      s && this.saveChild(s);
      return;
    }
    for (const s of this.childTools.values()) {
      const n = s.requestSaveChild;
      typeof n == "function" && n.call(s, t);
    }
  }
  /** Nested child BlockAPI routed through the children:update transaction. */
  childApi(t, e) {
    const s = this.nested;
    return {
      id: t.id,
      type: t.type,
      get readOnly() {
        return s.readOnly;
      },
      element: e,
      getData: () => {
        var n;
        return ((n = s.getBlocks().find((i) => i.id === t.id)) == null ? void 0 : n.data) ?? {};
      },
      update: (n) => s.update(t.id, n),
      patch: (n) => {
        var r;
        const i = ((r = s.getBlocks().find((a) => a.id === t.id)) == null ? void 0 : r.data) ?? {};
        s.update(t.id, { ...i, ...n });
      },
      requestSave: () => this.saveChild(t),
      focus: (n) => s.focusBlock(t.id, n),
      remove: () => s.remove(t.id),
      move: (n) => {
        const i = typeof n == "number" ? n : -1;
        s.move(t.id, i);
      },
      duplicate: () => {
        const n = s.getBlocks(), i = n.findIndex((l) => l.id === t.id);
        if (i < 0) return "";
        const r = JSON.parse(JSON.stringify(n[i]));
        return s.insert(r.type, r.data, i + 1);
      },
      convert: (n) => {
        const i = s.getBlocks().find((r) => r.id === t.id);
        i && s.update(t.id, { ...i.data });
      }
    };
  }
};
Yt.toolbox = { icon: j.toggle, title: "Toggle section", category: "Rich blocks" }, Yt.conversion = { to: ["paragraph", "heading"] };
let ze = Yt;
const Fe = "1.0.0", Lr = "ezynota", Dr = 1, dt = "workspaces", ht = "assets";
function ys(o) {
  return new Promise((t, e) => {
    o.onsuccess = () => t(o.result), o.onerror = () => e(o.error ?? new Error("IndexedDB request failed"));
  });
}
function ks() {
  try {
    return typeof indexedDB < "u" && indexedDB !== null;
  } catch {
    return !1;
  }
}
class Nr {
  constructor() {
    this.db = null, this.initPromise = null, this.listeners = /* @__PURE__ */ new Map(), this.channel = null, this.idb = ks(), this.fallback = null;
  }
  get persistent() {
    return this.db !== null && this.fallback === null;
  }
  init() {
    if (this.initPromise) return this.initPromise;
    const t = (async () => {
      if (this.idb)
        try {
          this.db = await Mr();
        } catch {
          this.db = null, this.fallback || (this.fallback = new ws(!1));
        }
      else this.fallback || (this.fallback = new ws(!1));
      !this.channel && typeof BroadcastChannel < "u" && (this.channel = new BroadcastChannel("ezynota:workspace"), this.channel.onmessage = (e) => {
        var n;
        const s = (n = e.data) == null ? void 0 : n.workspaceId;
        s && this.notifyLocal(s);
      });
    })();
    return t.catch(() => {
      this.initPromise === t && (this.initPromise = null);
    }), this.initPromise = t, t;
  }
  ensureDb() {
    if (!this.db)
      throw new k("EZ_UNKNOWN_ERROR", "IndexedDB is not open");
    return this.db;
  }
  async loadWorkspace(t) {
    if (await this.init(), this.fallback) return this.fallback.loadWorkspace(t);
    if (!this.db) return null;
    const e = await this.getRecord(t);
    return e ? { ...Kt(e.envelope), storageRevision: e.revision } : null;
  }
  getRecord(t) {
    const e = this.ensureDb().transaction(dt, "readonly").objectStore(dt);
    return ys(e.get(t));
  }
  async commit(t, e, s) {
    if (await this.init(), this.fallback) return this.fallback.commit(t, e, s);
    if (!this.db) return { ok: !1, reason: "error" };
    try {
      const i = this.ensureDb().transaction(dt, "readwrite"), r = i.objectStore(dt), a = await new Promise((l, c) => {
        let d = 0;
        const u = r.get(t);
        u.onsuccess = () => {
          var g;
          const h = ((g = u.result) == null ? void 0 : g.revision) ?? 0;
          if (h !== s) {
            l({ ok: !1, reason: "stale" });
            return;
          }
          d = h + 1;
          const f = r.put({
            id: t,
            envelope: Kt(e),
            revision: d
          });
          f.onsuccess = () => l({ ok: !0, revision: d }), f.onerror = () => {
            var y;
            (((y = f.error) == null ? void 0 : y.name) ?? "") === "QuotaExceededError" ? l({ ok: !1, reason: "quota" }) : c(f.error);
          };
        }, u.onerror = () => c(u.error ?? new Error("IndexedDB request failed")), i.onabort = () => {
          var f;
          (((f = i.error) == null ? void 0 : f.name) ?? "") === "QuotaExceededError" && l({ ok: !1, reason: "quota" });
        };
      });
      return await vs(i), a.ok && this.broadcast(t), a;
    } catch (n) {
      return { ok: !1, reason: (n == null ? void 0 : n.name) === "QuotaExceededError" ? "quota" : "error" };
    }
  }
  async loadAsset(t, e) {
    if (await this.init(), this.fallback) return this.fallback.loadAsset(t, e);
    if (!this.db) return null;
    const s = Vt(t, e), n = await ys(
      this.ensureDb().transaction(ht, "readonly").objectStore(ht).get(s)
    );
    return n ? Rr(n) : null;
  }
  async saveAsset(t, e) {
    if (await this.init(), this.fallback) return this.fallback.saveAsset(t, e);
    if (!this.db) return !1;
    try {
      const s = this.ensureDb().transaction(ht, "readwrite"), n = s.objectStore(ht), i = { ...e, key: Vt(t, e.id) }, r = await new Promise((a) => {
        const l = n.put(i);
        l.onsuccess = () => a(!0), l.onerror = () => a(!1);
      });
      return await vs(s), r;
    } catch {
      return !1;
    }
  }
  subscribe(t, e) {
    let s = this.listeners.get(t);
    return s || (s = /* @__PURE__ */ new Set(), this.listeners.set(t, s)), s.add(e), () => {
      s.delete(e), s.size === 0 && this.listeners.delete(t);
    };
  }
  notifyLocal(t) {
    for (const e of this.listeners.get(t) ?? []) e();
  }
  broadcast(t) {
    var e;
    try {
      (e = this.channel) == null || e.postMessage({ workspaceId: t });
    } catch {
    }
  }
  async close() {
    var t;
    try {
      (t = this.channel) == null || t.close();
    } catch {
    }
    this.channel = null, this.db && (this.db.close(), this.db = null), this.fallback && (await this.fallback.close(), this.fallback = null, this.idb = ks()), this.initPromise = null;
  }
}
function vs(o) {
  return new Promise((t, e) => {
    o.oncomplete = () => t(), o.onerror = () => e(o.error ?? new Error("transaction failed")), o.onabort = () => e(o.error ?? new Error("transaction aborted"));
  });
}
function Mr() {
  return new Promise((o, t) => {
    const e = indexedDB.open(Lr, Dr);
    e.onupgradeneeded = () => {
      const s = e.result;
      s.objectStoreNames.contains(dt) || s.createObjectStore(dt, { keyPath: "id" }), s.objectStoreNames.contains(ht) || s.createObjectStore(ht, { keyPath: "key" });
    }, e.onsuccess = () => o(e.result), e.onerror = () => t(e.error ?? new Error("IndexedDB open failed")), e.onblocked = () => t(new Error("IndexedDB open blocked (another connection holds this database)"));
  });
}
function Vt(o, t) {
  return `${o}::${t}`;
}
function Kt(o) {
  return JSON.parse(JSON.stringify(o));
}
function Rr(o) {
  return { ...o, bytes: new Uint8Array(o.bytes) };
}
class ws {
  constructor(t = !0) {
    this.persistent = !1, this.workspaces = /* @__PURE__ */ new Map(), this.assets = /* @__PURE__ */ new Map(), this.listeners = /* @__PURE__ */ new Map(), this.channel = null, t && typeof BroadcastChannel < "u" && (this.channel = new BroadcastChannel("ezynota:workspace"), this.channel.onmessage = (e) => {
      var n;
      const s = (n = e.data) == null ? void 0 : n.workspaceId;
      if (s)
        for (const i of this.listeners.get(s) ?? []) i();
    });
  }
  init() {
    return Promise.resolve();
  }
  async loadWorkspace(t) {
    const e = this.workspaces.get(t);
    return e ? { ...Kt(e.envelope), storageRevision: e.revision } : null;
  }
  async commit(t, e, s) {
    var a;
    const n = this.workspaces.get(t), i = (n == null ? void 0 : n.revision) ?? 0;
    if (i !== s) return { ok: !1, reason: "stale" };
    const r = {
      id: t,
      envelope: Kt(e),
      revision: i + 1
    };
    this.workspaces.set(t, r);
    try {
      (a = this.channel) == null || a.postMessage({ workspaceId: t });
    } catch {
    }
    return { ok: !0, revision: r.revision };
  }
  async loadAsset(t, e) {
    return this.assets.get(Vt(t, e)) ?? null;
  }
  async saveAsset(t, e) {
    return this.assets.set(Vt(t, e.id), { ...e, bytes: new Uint8Array(e.bytes) }), !0;
  }
  subscribe(t, e) {
    let s = this.listeners.get(t);
    return s || (s = /* @__PURE__ */ new Set(), this.listeners.set(t, s)), s.add(e), () => {
      s.delete(e), s.size === 0 && this.listeners.delete(t);
    };
  }
  async close() {
    var t;
    try {
      (t = this.channel) == null || t.close();
    } catch {
    }
    this.channel = null;
  }
}
function Vs(o) {
  return {
    workspaceSchemaVersion: Fe,
    id: o,
    name: "Untitled workspace",
    notes: [],
    folders: [],
    savedAt: 0,
    generator: { name: "ezynota", version: Xt }
  };
}
function Or(o) {
  let t = "/default";
  try {
    typeof location < "u" && location.pathname && (t = location.pathname);
  } catch {
  }
  return `${t}#${o ?? "default"}`;
}
class Fr {
  constructor(t) {
    this.envelope = Vs("pending"), this.revision = 0, this.loaded = !1, this.loadError = null, this.listeners = /* @__PURE__ */ new Set(), this.saveQueue = Promise.resolve(), this.saveTimer = null, this.dirty = !1, this.mutationVersion = 0, this.unsavedSnapshot = null, this.unsubscribeCrossTab = null, this.lastStatus = "idle", this.destroyed = !1, this.objectUrls = /* @__PURE__ */ new Map(), this.unloadDisposers = [], this.conflictRemoteRevision = null, this.conflictRetryRevision = null, this.activeNoteId = null, this.activeFolderId = null, this.workspaceId = t.workspaceId, this.storage = t.storage, this.generateId = t.generateId, this.autosaveMs = t.autosaveMs ?? 500, this.activeWorkspaceId = t.workspaceId, this.registerUnloadListeners();
  }
  /* ---------- lifecycle ---------- */
  async load() {
    try {
      await this.storage.init(), this.subscribeCrossTab();
      const t = await this.storage.loadWorkspace(this.activeWorkspaceId);
      this.envelope = Es(t, this.activeWorkspaceId), this.revision = (t == null ? void 0 : t.storageRevision) ?? 0, this.loaded = !0, this.loadError = null, this.emit({ type: "loaded" });
    } catch (t) {
      throw this.loaded = !1, this.loadError = t, this.emit({ type: "loadFailed", error: t }), t instanceof k ? t : new k("EZ_UNKNOWN_ERROR", "Workspace failed to load", { workspaceId: this.workspaceId }, t);
    }
  }
  isLoaded() {
    return this.loaded;
  }
  isPersistent() {
    return this.storage.persistent !== !1;
  }
  getLoadError() {
    return this.loadError;
  }
  /** Explicit recovery path after a failed load. */
  async retryLoad() {
    this.loaded = !1, this.loadError = null, await this.load();
  }
  destroy() {
    var e;
    if (this.destroyed) return;
    this.destroyed = !0, this.cancelSaveTimer();
    for (const s of this.unloadDisposers) s();
    this.unloadDisposers.length = 0, (e = this.unsubscribeCrossTab) == null || e.call(this), this.unsubscribeCrossTab = null;
    const t = this.dirty ? this.enqueue(() => this.persistFinal(Y(this.envelope), this.mutationVersion)) : this.saveQueue;
    this.dirty = !1, this.listeners.clear(), t.catch(() => {
    }).then(() => {
      this.revokeObjectUrls(), this.storage.close();
    });
  }
  /** Final write on destroy — never rolls back and never checks `destroyed`. */
  async persistFinal(t, e) {
    try {
      const s = await this.storage.commit(this.activeWorkspaceId, t, this.revision);
      s.ok ? (this.revision = s.revision, e === this.mutationVersion && (this.unsavedSnapshot = null)) : this.unsavedSnapshot = Y(this.envelope);
    } catch {
      this.unsavedSnapshot = Y(this.envelope);
    }
  }
  /** Best-effort flush on page unload / tab hide. */
  registerUnloadListeners() {
    if (typeof window > "u" || typeof document > "u") return;
    const t = () => this.flushSave(), e = () => {
      document.visibilityState === "hidden" && this.flushSave();
    };
    try {
      window.addEventListener("pagehide", t), document.addEventListener("visibilitychange", e), this.unloadDisposers.push(
        () => window.removeEventListener("pagehide", t),
        () => document.removeEventListener("visibilitychange", e)
      );
    } catch {
    }
  }
  /** (Re)subscribe to cross-tab change notifications for the active id. */
  subscribeCrossTab() {
    var t;
    (t = this.unsubscribeCrossTab) == null || t.call(this), this.unsubscribeCrossTab = null, this.unsubscribeCrossTab = this.storage.subscribe(this.activeWorkspaceId, () => this.handleRemoteChange());
  }
  /**
   * Another tab committed to this workspace. When nothing is dirty, reload
   * the stored envelope and revision so the UI renders fresh data and the
   * next commit is not stale forever. While dirty, keep the local edits
   * (conflict state) but remember the remote revision so an explicit
   * retrySave can succeed.
   */
  handleRemoteChange() {
    if (!this.destroyed) {
      if (!this.dirty) {
        this.reloadFromStorage();
        return;
      }
      this.storage.loadWorkspace(this.activeWorkspaceId).then((t) => {
        this.destroyed || !this.dirty || (this.conflictRemoteRevision = (t == null ? void 0 : t.storageRevision) ?? 0, this.emit({ type: "remoteChange" }));
      }).catch(() => {
        this.emit({ type: "remoteChange" });
      });
    }
  }
  async reloadFromStorage() {
    try {
      const t = await this.storage.loadWorkspace(this.activeWorkspaceId);
      if (this.destroyed || this.dirty) return;
      this.envelope = Es(t, this.activeWorkspaceId), this.revision = (t == null ? void 0 : t.storageRevision) ?? 0, this.emit({ type: "remoteChange" }), this.emit({ type: "notes:changed" });
    } catch {
    }
  }
  /* ---------- events ---------- */
  on(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  emit(t) {
    for (const e of Array.from(this.listeners)) e(t);
  }
  emitStatus(t, e) {
    this.lastStatus === t && t !== "error" || (this.lastStatus = t, this.emit({ type: "saveStatus", status: t, error: e }));
  }
  /* ---------- read access ---------- */
  getEnvelope() {
    return this.envelope;
  }
  /** Editable workspace display name shown in the topbar title field. */
  getWorkspaceName() {
    return this.envelope.name ?? "Untitled workspace";
  }
  /** Rename the workspace (persists via autosave and notifies listeners). */
  renameWorkspace(t) {
    const e = t.trim() || "Untitled workspace";
    this.envelope.name !== e && (this.envelope.name = e, this.markDirty(), this.emit({ type: "workspaceRenamed", name: e }));
  }
  getRevision() {
    return this.revision;
  }
  listNotes(t = !1) {
    return this.envelope.notes.filter((e) => t || !e.trashed);
  }
  listFolders(t = !1) {
    return this.envelope.folders.filter((e) => t || !e.trashed);
  }
  listTrashedNotes() {
    return this.envelope.notes.filter((t) => t.trashed);
  }
  listTrashedFolders() {
    return this.envelope.folders.filter((t) => t.trashed);
  }
  getNote(t) {
    return this.envelope.notes.find((e) => e.id === t);
  }
  getFolder(t) {
    return this.envelope.folders.find((e) => e.id === t);
  }
  /** Folder chain from the root down to the folder (excluding trash filtering). */
  folderPath(t) {
    const e = [];
    let s = t ? this.getFolder(t) : void 0, n = 0;
    for (; s && n++ < 64; )
      e.unshift(s), s = s.parentId ? this.getFolder(s.parentId) : void 0;
    return e;
  }
  /** All note IDs linked from the given note's document. */
  noteLinks(t) {
    const e = this.getNote(t);
    if (!e) return [];
    const s = /* @__PURE__ */ new Set();
    return _t(e.document.blocks, (n) => {
      lt(n.data, s);
    }), Array.from(s);
  }
  /** Notes whose content links to the given note (backlinks). */
  backlinks(t) {
    const e = `note:${t}`;
    return this.listNotes().filter(
      (s) => s.id !== t && this.noteLinks(s.id).some((n) => `note:${n}` === e)
    );
  }
  /* ---------- notes CRUD ---------- */
  createNote(t, e = null, s) {
    const n = Date.now(), i = {
      id: this.generateId(),
      folderId: e,
      title: t,
      document: s ?? { schemaVersion: "1.0.0", blocks: [], createdAt: n, updatedAt: n },
      createdAt: n,
      updatedAt: n,
      revision: 0
    };
    return this.envelope.notes.push(i), this.markDirty(), this.emit({ type: "notes:changed" }), i;
  }
  renameNote(t, e) {
    const s = this.getNote(t);
    !s || s.title === e || (s.title = e, s.updatedAt = Date.now(), s.document = { ...s.document, meta: { ...s.document.meta ?? {}, title: e } }, this.markDirty(), this.emit({ type: "noteRenamed", noteId: t, title: e }), this.emit({ type: "notes:changed" }));
  }
  moveNote(t, e) {
    const s = this.getNote(t);
    !s || s.folderId === e || (s.folderId = e, s.updatedAt = Date.now(), this.markDirty(), this.emit({ type: "notes:changed" }));
  }
  duplicateNote(t) {
    const e = this.getNote(t);
    if (!e) return null;
    const s = Date.now(), n = `${e.title} (copy)`, i = J(e.document);
    i.meta = { ...i.meta ?? {}, title: n };
    const r = {
      ...e,
      id: this.generateId(),
      title: n,
      document: i,
      createdAt: s,
      updatedAt: s,
      revision: 0,
      trashed: !1
    };
    return delete r.trashedAt, this.envelope.notes.push(r), this.markDirty(), this.emit({ type: "notes:changed" }), r;
  }
  /** Replace a note's document (autosave target). Bumps revision only on commit. */
  updateNoteDocument(t, e, s) {
    const n = this.getNote(t);
    n && (n.document = e, n.updatedAt = Date.now(), s !== void 0 && s !== n.title && (n.title = s, n.document = { ...n.document, meta: { ...n.document.meta ?? {}, title: s } }, this.emit({ type: "noteRenamed", noteId: t, title: s })), this.markDirty(), this.emit({ type: "notes:changed" }));
  }
  /* ---------- folders CRUD ---------- */
  createFolder(t, e = null) {
    if (e && !Ur(this.envelope.folders, e) && !this.getFolder(e))
      throw new k("EZ_UNKNOWN_ERROR", `Folder "${e}" not found`);
    const s = Date.now(), n = { id: this.generateId(), name: t, parentId: e, createdAt: s, updatedAt: s };
    return this.envelope.folders.push(n), this.markDirty(), this.emit({ type: "folders:changed" }), n;
  }
  renameFolder(t, e) {
    const s = this.getFolder(t);
    !s || s.name === e || (s.name = e, s.updatedAt = Date.now(), this.markDirty(), this.emit({ type: "folders:changed" }));
  }
  /**
   * Move a folder under a new parent. Folder cycles are prevented: a folder
   * can never become a descendant of itself.
   */
  moveFolder(t, e) {
    const s = this.getFolder(t);
    return !s || e === t || e && it(this.envelope.folders, e, t) ? !1 : (s.parentId = e, s.updatedAt = Date.now(), this.markDirty(), this.emit({ type: "folders:changed" }), !0);
  }
  /* ---------- trash ---------- */
  /** Soft-delete a note (into the trash). */
  trashNote(t) {
    const e = this.getNote(t);
    !e || e.trashed || (e.trashed = !0, e.trashedAt = Date.now(), e.updatedAt = e.trashedAt, this.activeNoteId === t && (this.activeNoteId = null), this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }));
  }
  restoreNote(t) {
    var s;
    const e = this.getNote(t);
    return !e || !e.trashed ? !1 : (e.folderId && ((s = this.getFolder(e.folderId)) != null && s.trashed) && (e.folderId = null), e.trashed = !1, delete e.trashedAt, e.updatedAt = Date.now(), this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }), !0);
  }
  /** Permanently delete a trashed note. */
  deleteNoteForever(t) {
    const e = this.envelope.notes.findIndex((s) => s.id === t);
    e < 0 || !this.envelope.notes[e].trashed || (this.envelope.notes.splice(e, 1), this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }));
  }
  emptyTrash() {
    const t = this.envelope.notes.length, e = this.envelope.folders.length;
    this.envelope.notes = this.envelope.notes.filter((s) => !s.trashed), this.envelope.folders = this.envelope.folders.filter((s) => !s.trashed), (this.envelope.notes.length !== t || this.envelope.folders.length !== e) && (this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }), this.emit({ type: "folders:changed" }));
  }
  trashFolder(t) {
    const e = this.getFolder(t);
    if (!e || e.trashed) return;
    const s = Date.now();
    e.trashed = !0, e.trashedAt = s, e.updatedAt = s;
    for (const n of this.envelope.notes)
      (n.folderId === t || n.folderId && it(this.envelope.folders, n.folderId, t)) && (n.trashed = !0, n.trashedAt = s);
    for (const n of this.envelope.folders)
      (n.parentId === t || n.parentId && it(this.envelope.folders, n.parentId, t)) && (n.trashed = !0, n.trashedAt = s);
    this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }), this.emit({ type: "folders:changed" });
  }
  restoreFolder(t) {
    var n;
    const e = this.getFolder(t);
    if (!e || !e.trashed) return !1;
    e.parentId && ((n = this.getFolder(e.parentId)) != null && n.trashed) && (e.parentId = null), e.trashed = !1, delete e.trashedAt;
    const s = Date.now();
    for (const i of this.envelope.notes)
      i.trashed && i.folderId && it(this.envelope.folders, i.folderId, t) && (i.trashed = !1, i.updatedAt = s);
    for (const i of this.envelope.folders)
      i.trashed && i.parentId && it(this.envelope.folders, i.parentId, t) && (i.trashed = !1, i.updatedAt = s);
    return e.updatedAt = s, this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }), this.emit({ type: "folders:changed" }), !0;
  }
  deleteFolderForever(t) {
    const e = this.envelope.folders.find((s) => s.id === t);
    !e || !e.trashed || (this.envelope.folders = this.envelope.folders.filter((s) => s.id !== t), this.envelope.notes = this.envelope.notes.filter(
      (s) => !(s.trashed && (s.folderId === t || s.folderId && it(this.envelope.folders, s.folderId, t)))
    ), this.markDirty(), this.emit({ type: "trash:changed" }), this.emit({ type: "notes:changed" }), this.emit({ type: "folders:changed" }));
  }
  /* ---------- search ---------- */
  search(t, e) {
    const s = t.trim().toLowerCase();
    if (!s) return [];
    const n = [];
    for (const i of this.listNotes((e == null ? void 0 : e.includeTrash) === !0)) {
      const r = i.title.toLowerCase().indexOf(s);
      if (r >= 0 && n.push({ noteId: i.id, title: i.title, excerpt: i.title, offset: r, inTitle: !0 }), _t(i.document.blocks, (a) => {
        const l = at(a.data);
        if (!l) return;
        const c = l.toLowerCase().indexOf(s);
        if (c < 0) return;
        const d = Math.max(0, c - 30), u = Math.min(l.length, c + s.length + 30);
        n.push({
          noteId: i.id,
          title: i.title,
          excerpt: `${d > 0 ? "…" : ""}${l.slice(d, u)}${u < l.length ? "…" : ""}`,
          offset: c - d,
          blockId: a.id
        });
      }), n.length > 200) return n.slice(0, 200);
    }
    return n;
  }
  /* ---------- persistence ---------- */
  /** Mark state dirty and schedule the 500ms autosave. */
  markDirty() {
    this.destroyed || (this.mutationVersion += 1, this.dirty = !0, this.cancelSaveTimer(), this.conflictRemoteRevision === null && (this.saveTimer = setTimeout(() => {
      this.saveTimer = null, this.flushSave();
    }, this.autosaveMs)));
  }
  cancelSaveTimer() {
    this.saveTimer !== null && (clearTimeout(this.saveTimer), this.saveTimer = null);
  }
  /** Serialize a write immediately (used on unload, backup and restore). */
  flushSave() {
    if (this.saveTimer !== null && (clearTimeout(this.saveTimer), this.saveTimer = null), !this.dirty) return;
    this.dirty = !1;
    const t = Y(this.envelope), e = this.mutationVersion;
    this.unsavedSnapshot = t, this.enqueue(() => this.persist(t, e));
  }
  /**
   * Chain a job onto the serialized save queue. A rejected job must never
   * poison the queue: the chain always resolves so later autosaves (and
   * destroy()'s final write) still run. The job's own error handling decides
   * whether the failure is reported; a rejected promise returned by `job` is
   * re-thrown to the caller of the awaited queue via `result`.
   */
  enqueue(t) {
    const e = this.saveQueue.then(t);
    return this.saveQueue = e.then(
      () => {
      },
      () => {
      }
    ), e;
  }
  async persist(t, e) {
    if (this.destroyed) return;
    this.emitStatus("saving");
    const s = this.conflictRetryRevision ?? this.revision;
    this.conflictRetryRevision = null;
    try {
      const n = await this.storage.commit(this.activeWorkspaceId, t, s);
      if (n.ok) {
        this.revision = n.revision, e === this.mutationVersion && (this.dirty = !1, this.unsavedSnapshot = null, this.emitStatus(this.isPersistent() ? "saved" : "temporary"));
        return;
      }
      const i = n.reason === "stale" ? "Workspace changed in another tab. Export a backup of your edits before reloading." : `Workspace save failed (${n.reason})`;
      this.retainFailedSave(new k("EZ_SAVE_FAILED", i, { reason: n.reason }));
    } catch (n) {
      this.retainFailedSave(new k("EZ_SAVE_FAILED", "Workspace storage could not save your changes", { reason: "error" }, n));
    }
  }
  retainFailedSave(t) {
    this.unsavedSnapshot = Y(this.envelope), this.dirty = !0, this.emitStatus("error", t);
  }
  /** Retry the last failed write. */
  retrySave() {
    this.unsavedSnapshot && (this.dirty = !0), this.conflictRemoteRevision !== null && (this.conflictRetryRevision = this.conflictRemoteRevision, this.conflictRemoteRevision = null), this.flushSave();
  }
  /** Latest pending payload for download recovery. */
  getUnsavedSnapshot() {
    return this.unsavedSnapshot ? Y(this.unsavedSnapshot) : null;
  }
  async flush() {
    this.flushSave(), await this.saveQueue;
  }
  /* ---------- assets ---------- */
  async saveAsset(t) {
    return this.storage.saveAsset(this.activeWorkspaceId, t);
  }
  async loadAsset(t) {
    return this.storage.loadAsset(this.activeWorkspaceId, t);
  }
  /** Asset bytes as an object URL — cached one per asset id and revoked on destroy. */
  async assetObjectUrl(t) {
    const e = this.objectUrls.get(t);
    if (e) return e;
    const s = await this.loadAsset(t);
    if (!s) return null;
    try {
      const n = URL.createObjectURL(new Blob([s.bytes], { type: s.mime }));
      return this.destroyed ? (URL.revokeObjectURL(n), null) : (this.objectUrls.set(t, n), n);
    } catch {
      return null;
    }
  }
  revokeObjectUrls() {
    for (const t of this.objectUrls.values())
      try {
        URL.revokeObjectURL(t);
      } catch {
      }
    this.objectUrls.clear();
  }
  /* ---------- backup / restore ---------- */
  async createBackup() {
    await this.flush();
    const t = await this.collectAssets();
    return { ...Y(this.envelope), savedAt: Date.now(), assets: t };
  }
  async collectAssets() {
    const t = /* @__PURE__ */ new Set();
    for (const s of this.envelope.notes)
      _t(s.document.blocks, (n) => Be(n.data, t));
    const e = [];
    for (const s of t) {
      const n = await this.loadAsset(s);
      n && e.push({ ...n, bytes: new Uint8Array(n.bytes) });
    }
    return e;
  }
  /**
   * Restore a backup. By default a NEW workspace ID is generated so the
   * current workspace is never clobbered: pending autosaves for the current
   * workspace are flushed first and the restored envelope is committed under
   * the target ID through the serialized save queue, so no queued persist
   * can resurrect stale state afterwards. The backup is validated before
   * commit; a malformed or newer envelope is retained for recovery.
   */
  async restoreBackup(t, e) {
    const s = qr(t);
    if (!s.ok)
      throw new k("EZ_IMPORT_FAILED", s.reason, { recovered: !0 });
    const n = s.envelope;
    if (n.workspaceSchemaVersion !== Fe)
      throw new k("EZ_IMPORT_FAILED", `Workspace envelope "${n.workspaceSchemaVersion}" is not supported`, {
        original: t
      });
    const i = (e == null ? void 0 : e.newWorkspaceId) === !1 ? n.id : this.generateId(), r = { ...n, id: i, savedAt: Date.now() };
    delete r.storageRevision, this.cancelSaveTimer(), await this.flush();
    const a = this.enqueue(async () => {
      if ($r(t)) {
        for (const d of t.assets)
          if (!await this.storage.saveAsset(i, { ...d, bytes: Hr(d.bytes) })) throw new k("EZ_IMPORT_FAILED", "Could not restore an image asset. The current workspace was retained.", { assetId: d.id });
      }
      const l = i === this.activeWorkspaceId ? this.revision : 0, c = await this.storage.commit(i, r, l);
      if (!c.ok)
        throw new k("EZ_IMPORT_FAILED", `Restoring the backup failed (${c.reason})`, {
          reason: c.reason,
          workspaceId: i
        });
      this.revision = c.revision, this.activeWorkspaceId = i, this.envelope = r, this.loaded = !0, this.dirty = !1, this.unsavedSnapshot = null, this.subscribeCrossTab();
    });
    try {
      await a;
    } catch (l) {
      throw this.retainFailedSave(
        l instanceof k ? l : new k("EZ_IMPORT_FAILED", "Restoring the backup failed", { workspaceId: i }, l)
      ), l;
    }
    return this.emit({ type: "notes:changed" }), this.emit({ type: "folders:changed" }), { workspaceId: i };
  }
}
function at(o) {
  if (Array.isArray(o))
    return o.map((e) => at(e)).join("");
  if (typeof o != "object" || o === null) return "";
  const t = o;
  return typeof t.code == "string" ? t.code : t.type === "text" ? typeof t.text == "string" ? t.text : "" : Array.isArray(t.content) ? at(t.content) : Array.isArray(t.items) ? t.items.map((e) => at(e)).join(" ") : t.rows ? at(t.rows) : t.heading ? at(t.heading) : "";
}
function Es(o, t) {
  const e = Vs(t);
  return !o || typeof o != "object" ? e : {
    workspaceSchemaVersion: Fe,
    id: t,
    name: typeof o.name == "string" && o.name.trim() ? o.name : e.name,
    notes: Array.isArray(o.notes) ? o.notes : [],
    folders: Array.isArray(o.folders) ? o.folders : [],
    savedAt: typeof o.savedAt == "number" ? o.savedAt : 0,
    generator: o.generator ?? e.generator
  };
}
function Y(o) {
  return JSON.parse(JSON.stringify(o));
}
function $r(o) {
  return typeof o == "object" && o !== null && Array.isArray(o.assets);
}
function Pr(o) {
  let t = "";
  for (let s = 0; s < o.length; s += 32768)
    t += String.fromCharCode(...o.subarray(s, s + 32768));
  return btoa(t);
}
function _r(o) {
  const t = atob(o), e = new Uint8Array(t.length);
  for (let s = 0; s < t.length; s++) e[s] = t.charCodeAt(s);
  return e;
}
function Hr(o) {
  if (o instanceof Uint8Array) return o;
  if (typeof o == "string") return _r(o);
  if (Array.isArray(o)) return new Uint8Array(o);
  throw new k("EZ_IMPORT_FAILED", "Backup asset bytes are malformed");
}
function jr(o) {
  const { assets: t, ...e } = o;
  return {
    ...e,
    assets: t.map((s) => ({
      id: s.id,
      mime: s.mime,
      name: s.name,
      bytes: Pr(s.bytes),
      createdAt: s.createdAt
    }))
  };
}
function _t(o, t) {
  for (const e of o)
    t(e), Array.isArray(e.children) && _t(e.children, t);
}
function lt(o, t) {
  var s;
  if (Array.isArray(o)) {
    for (const n of o) lt(n, t);
    return;
  }
  if (typeof o != "object" || o === null) return;
  const e = o;
  if (Array.isArray(e.marks))
    for (const n of e.marks) {
      const i = (n == null ? void 0 : n.type) === "link" ? (s = n.attrs) == null ? void 0 : s.href : void 0;
      typeof i == "string" && i.startsWith("note:") && t.add(i.slice(5));
    }
  if (e.type === "link" && typeof e.href == "string" && e.href.startsWith("note:") && t.add(e.href.slice(5)), Array.isArray(e.content))
    for (const n of e.content) lt(n, t);
  e.rows && lt(e.rows, t), e.items && lt(e.items, t), e.heading && lt(e.heading, t);
}
function Be(o, t) {
  if (Array.isArray(o)) {
    for (const s of o) Be(s, t);
    return;
  }
  if (typeof o != "object" || o === null) return;
  const e = o;
  typeof e.assetId == "string" && t.add(e.assetId), typeof e.src == "string" && e.src.startsWith("asset:") && t.add(e.src.slice(6));
  for (const s of Object.values(e)) Be(s, t);
}
function it(o, t, e) {
  let s = o.find((i) => i.id === t), n = 0;
  for (; s && n++ < 64; ) {
    if (s.parentId === e) return !0;
    s = s.parentId ? o.find((i) => i.id === s.parentId) : void 0;
  }
  return !1;
}
function Ur(o, t, e) {
  return !!t;
}
function qr(o) {
  if (typeof o != "object" || o === null) return { ok: !1, reason: "Backup must be an object" };
  const t = o;
  if (typeof t.workspaceSchemaVersion != "string") return { ok: !1, reason: "Backup is missing workspaceSchemaVersion" };
  if (!Array.isArray(t.notes) || !Array.isArray(t.folders))
    return { ok: !1, reason: "Backup must contain notes and folders arrays" };
  for (const e of t.notes) {
    if (typeof e != "object" || e === null || typeof e.id != "string")
      return { ok: !1, reason: "Backup contains an invalid note record" };
    const s = e.document;
    if (typeof s != "object" || s === null || typeof s.schemaVersion != "string")
      return { ok: !1, reason: "Backup contains an invalid note document" };
  }
  if (t.assets !== void 0 && !Array.isArray(t.assets))
    return { ok: !1, reason: "Backup assets must be an array" };
  for (const e of t.assets ?? []) {
    if (typeof e != "object" || e === null || typeof e.id != "string")
      return { ok: !1, reason: "Backup contains an invalid asset record" };
    const s = e.bytes;
    if (!(s instanceof Uint8Array) && !Array.isArray(s) && typeof s != "string")
      return { ok: !1, reason: "Backup asset bytes are malformed" };
  }
  return { ok: !0, envelope: t };
}
const Wr = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
function Vr(o, t) {
  const e = t.ownerDocument.defaultView, s = t.getBoundingClientRect();
  o.style.maxHeight = `${Math.max(80, e.innerHeight - 16)}px`, o.style.maxWidth = `${Math.max(0, e.innerWidth - 16)}px`;
  const n = o.getBoundingClientRect();
  o.style.left = `${Math.max(8, Math.min(s.right - n.width, e.innerWidth - n.width - 8))}px`, o.style.top = `${Math.max(8, Math.min(s.bottom + 4, e.innerHeight - n.height - 8))}px`;
}
function As(o) {
  return Array.from(o.querySelectorAll('button:not(:disabled), summary, [role="menuitem"]')).filter((t) => t.getClientRects().length > 0);
}
function Te(o) {
  for (const t of o.querySelectorAll("details[open]")) {
    t.open = !1;
    for (const e of t.querySelectorAll(":popover-open")) e.hidePopover();
  }
}
function Le(o, t) {
  const e = o.ownerDocument, s = e.defaultView, n = o.querySelector("summary");
  t.classList.add("ezy-suite-popup"), t.setAttribute("popover", "manual"), n.setAttribute("aria-expanded", "false");
  const i = () => {
    o.open && Vr(t, n);
  }, r = (h = !1) => {
    o.open && (h && n.focus(), Te(t), o.open = !1, t.matches(":popover-open") && t.hidePopover(), n.setAttribute("aria-expanded", "false"));
  }, a = () => {
    var h;
    n.setAttribute("aria-expanded", String(o.open)), o.open ? (t.showPopover && !t.matches(":popover-open") && t.showPopover(), i(), (h = As(t)[0]) == null || h.focus()) : (Te(t), t.matches(":popover-open") && t.hidePopover());
  }, l = (h) => {
    o.contains(h.target) || r();
  }, c = (h) => {
    var f;
    if (!o.open) {
      h.target === n && ["ArrowDown", "ArrowUp"].includes(h.key) && (h.preventDefault(), o.open = !0);
      return;
    }
    if (h.key === "Escape")
      h.preventDefault(), h.stopPropagation(), r(!0);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(h.key)) {
      const g = As(t), m = g.indexOf(e.activeElement), y = h.key === "Home" ? 0 : h.key === "End" ? g.length - 1 : (m + (h.key === "ArrowUp" ? -1 : 1) + g.length) % g.length;
      (f = g[y]) == null || f.focus(), h.preventDefault(), h.stopPropagation();
    }
  }, d = (h) => {
    const f = h.target.closest("button");
    f && f.closest("details") === o && !f.disabled && r(t.contains(e.activeElement));
  }, u = (h) => {
    o.contains(h.relatedTarget) || r();
  };
  return o.addEventListener("toggle", a), o.addEventListener("keydown", c), o.addEventListener("focusout", u), t.addEventListener("click", d), e.addEventListener("pointerdown", l, !0), e.addEventListener("scroll", i, !0), s.addEventListener("resize", i), () => {
    r(), o.removeEventListener("toggle", a), o.removeEventListener("keydown", c), o.removeEventListener("focusout", u), t.removeEventListener("click", d), e.removeEventListener("pointerdown", l, !0), e.removeEventListener("scroll", i, !0), s.removeEventListener("resize", i);
  };
}
function Kr(o, t, e) {
  var m, y;
  const s = t.ownerDocument;
  o.classList.add("ezy-suite-host"), t.classList.add("ezy-suite-topbar"), e.brand.classList.add("ezy-suite-brand"), e.title.classList.add("ezy-suite-title"), e.exportControl.classList.add("ezy-suite-export");
  const n = e.more ?? s.createElement("details");
  if (n.classList.add("ezy-suite-more"), !e.more) {
    const v = s.createElement("summary");
    v.innerHTML = Wr;
    const w = s.createElement("div");
    n.append(v, w);
  }
  const i = n.querySelector("summary");
  i.setAttribute("aria-label", "More actions"), i.title = "More actions";
  const r = n.children[1];
  r.classList.add("ezy-suite-overflow"), r.setAttribute("aria-label", "More actions");
  const a = s.createElement("div");
  a.className = "ezy-suite-extras", a.append(...Array.from(r.childNodes)), r.append(a);
  const l = [e.history, e.specialist, e.view, e.files].filter((v) => !!v);
  for (const v of l) {
    v.className = "ezy-suite-group", v.setAttribute("role", "group");
    for (const w of v.querySelectorAll("button, summary"))
      w.getAttribute("aria-label") || w.setAttribute("aria-label", w.title || ((m = w.textContent) == null ? void 0 : m.trim()) || "Action"), w.title || (w.title = w.getAttribute("aria-label")), (!((y = w.textContent) != null && y.trim()) || w.querySelector(".ez-visually-hidden")) && w.classList.add("ezy-suite-icon");
  }
  const c = s.createElement("div");
  c.className = "ezy-suite-actions", c.append(e.history), e.specialist && c.append(e.specialist), c.append(e.view, n, e.files, e.exportControl);
  const d = l.map((v) => {
    const w = s.createComment("topbar action group");
    return v.before(w), { group: v, slot: w };
  });
  t.replaceChildren(e.brand, e.title, c);
  const u = Le(n, r);
  let h = "";
  const f = () => {
    const v = o.getBoundingClientRect().width, w = v < 480 ? "small" : v < 800 ? "compact" : v < 1100 ? "medium" : "full";
    if (w === h) return;
    h = w;
    const I = s.activeElement;
    Te(t), n.open = !1, t.dataset.density = w;
    for (const { group: T, slot: $ } of d)
      (T === e.specialist ? v < 1100 : T === e.history ? v < 480 : v < 800) ? r.insertBefore(T, a) : $.after(T);
    n.hidden = r.children.length === 1 && !a.children.length, I && r.contains(I) ? i.focus() : n.hidden && I === i && e.title.focus();
  }, g = new ResizeObserver(f);
  return g.observe(o), f(), () => {
    g.disconnect(), u();
  };
}
const Jr = '<svg viewBox="0 0 455 455" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient cx="4324350" cy="0" r="6108823" gradientUnits="userSpaceOnUse" spreadMethod="pad" id="ezn-logo-fill" gradientTransform="matrix(0.000104987 0 0 0.000104987 1776 2268)"><stop offset="0" stop-color="#EC4899"/><stop offset="0.2" stop-color="#EC4899"/><stop offset="1" stop-color="#7C3AED"/></radialGradient></defs><g transform="translate(-1776 -2267)"><rect x="1776" y="2268" width="454" height="453" fill="url(#ezn-logo-fill)"/><path d="M2154 2646 2063.4 2555.1 2063.4 2433.9 1942.6 2433.9 1852 2343 2154 2343 2154 2646Z" fill="#FFFFFF" fill-rule="evenodd"/><path d="M2064 2646 1852 2434 1942.86 2434 2064 2555.14 2064 2646Z" fill="#FFFFFF" fill-rule="evenodd"/></g></svg>';
function Zr(o, t) {
  var s;
  if (!t) return [];
  const e = [];
  for (const n of o.querySelectorAll("[data-ez-editable]")) {
    if (!((s = n.closest("[data-ez-block-id]")) != null && s.classList.contains("ez-block"))) continue;
    const i = n.ownerDocument.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    let r;
    for (; r = i.nextNode(); ) {
      const a = r.textContent ?? "";
      let l = a.indexOf(t);
      for (; l !== -1; ) {
        const c = n.ownerDocument.createRange();
        c.setStart(r, l), c.setEnd(r, l + t.length), e.push({ range: c, editable: n }), l = a.indexOf(t, l + t.length);
      }
    }
  }
  return e;
}
const Gr = { light: "Light", dark: "Dark", system: "System" };
function Yr(o) {
  const t = o;
  return t.type === "importError" ? t.message ?? "Import failed" : null;
}
function Xr(o, t) {
  var e;
  switch (o) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "temporary":
      return "Stored in this tab only";
    case "error": {
      const s = t instanceof k ? (e = t.context) == null ? void 0 : e.reason : void 0;
      return s === "stale" ? "Save conflict — export a backup before reloading" : s === "quota" ? "Browser storage full — click to retry" : "Browser save failed — click to retry";
    }
    default:
      return "Ready";
  }
}
class Qr {
  constructor(t, e, s, n = !0) {
    this.compactSidebar = !1, this.desktopSidebarCollapsed = !1, this.sidebar = null, this.sidebarToggle = null, this.notesTree = null, this.noteCount = null, this.searchInput = null, this.searchResults = null, this.titleInput = null, this.workspaceTitle = null, this.breadcrumbs = null, this.saveStatusEl = null, this.saveStatusDot = null, this.wordCountEl = null, this.outlinePanel = null, this.fullscreenBtn = null, this.undoButton = null, this.redoButton = null, this.themeMenu = null, this.docMenu = null, this.exportMenu = null, this.importInput = null, this.errorPanel = null, this.legacyPanel = null, this.noticeEl = null, this.storageNoticeEl = null, this.noticeTimer = null, this.findDialog = null, this.findReturnFocus = null, this.findInput = null, this.replaceInput = null, this.findReturnRange = null, this.findMatches = [], this.findIndex = 0, this.findCounter = null, this.findNavigation = [], this.replaceButtons = [], this.findHighlightName = `ezynota-find-${++eo}`, this.disposers = [], this.expandedFolders = /* @__PURE__ */ new Set(), this.refreshTimer = null, this.treeDrag = null, this.treeDropHighlight = null, this.root = t, this.state = e, this.deps = s, this.showSidebar = n;
  }
  mount() {
    this.buildShell(), this.observeContainer(), this.refreshHistory();
    const t = this.state.on((e) => this.handleEvent(e));
    this.disposers.push(t), this.renderSidebar(), this.updateHeader(), this.maybeShowLegacyDraft(), this.updateStorageNotice();
  }
  destroy() {
    this.clearFindHighlights(), this.findMatches = [], this.setDrawerOpen(!1), this.root.classList.remove("ez-workspace-compact", "ez-workspace-narrow"), this.root.dispatchEvent(new Event("ez-close-popovers"));
    for (const t of this.disposers) t();
    this.disposers.length = 0, this.refreshTimer && clearTimeout(this.refreshTimer), this.noticeTimer && clearTimeout(this.noticeTimer);
  }
  /** Public event entry point used by the controller. */
  notifyEvent(t) {
    this.handleEvent(t);
  }
  refreshHistory() {
    const { canUndo: t, canRedo: e } = this.deps.getHistoryState();
    this.undoButton && (this.undoButton.disabled = !t), this.redoButton && (this.redoButton.disabled = !e);
  }
  /** Highlight and expand a folder in the sidebar tree. */
  highlightFolder(t) {
    this.expandedFolders.add(t), this.renderSidebar();
  }
  handleEvent(t) {
    const e = Yr(t);
    if (e !== null) {
      this.showNotice(e);
      return;
    }
    if (t.type === "loadFailed") {
      this.showErrorPanel();
      return;
    }
    if (t.type === "loaded" && this.hideErrorPanel(), t.type === "saveStatus") {
      this.updateSaveStatus(t.status, t.error);
      return;
    }
    if (t.type === "remoteChange") {
      this.renderSidebar(), this.updateHeader();
      return;
    }
    if (t.type === "noteRenamed") {
      this.scheduleHeaderRefresh();
      return;
    }
    if (t.type === "workspaceRenamed") {
      this.scheduleHeaderRefresh();
      return;
    }
    this.scheduleSidebarRefresh(), this.scheduleHeaderRefresh();
  }
  scheduleSidebarRefresh() {
    this.refreshTimer || (this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null, this.renderSidebar(), this.updateHeader();
    }, 50));
  }
  scheduleHeaderRefresh() {
    this.scheduleSidebarRefresh();
  }
  /* ---------- shell ---------- */
  buildShell() {
    this.root.classList.add("ez-workspace-root"), this.showSidebar || this.root.classList.add("ez-mode-document");
    const t = this.buildTopbar(), e = p("div", "ez-workspace");
    e.setAttribute("data-ez-workspace", "true"), this.sidebar = p("aside", "ez-sidebar"), this.sidebar.setAttribute("aria-label", "Notes"), this.buildSidebarContent();
    const s = p("div", "ez-main");
    s.appendChild(this.buildSidebarToggle());
    const n = this.buildHeader();
    this.errorPanel = this.buildErrorPanel(), this.legacyPanel = this.buildLegacyPanel(), this.noticeEl = p("p", "ez-workspace-notice"), this.noticeEl.setAttribute("role", "status"), this.noticeEl.setAttribute("aria-live", "polite"), this.noticeEl.hidden = !0;
    const i = p("div", "ez-doc-wrap"), r = this.root.querySelector(".ez-editor"), a = A("ez-sidebar-backdrop", "", "Close notes sidebar");
    a.tabIndex = -1, a.addEventListener("click", () => this.closeMobileSidebar());
    const l = (u) => {
      var h;
      if (u.key === "Escape" && this.root.classList.contains("ez-sidebar-open") && (u.preventDefault(), u.stopPropagation(), this.closeMobileSidebar()), u.key === "Tab" && this.root.classList.contains("ez-sidebar-open")) {
        const f = Array.from(((h = this.sidebar) == null ? void 0 : h.querySelectorAll("button, input, summary")) ?? []).filter((y) => y.getClientRects().length > 0 && !y.hasAttribute("disabled")), g = f[0], m = f[f.length - 1];
        u.shiftKey && document.activeElement === g ? (u.preventDefault(), m == null || m.focus()) : !u.shiftKey && document.activeElement === m && (u.preventDefault(), g == null || g.focus());
      }
    };
    this.root.addEventListener("keydown", l), this.disposers.push(() => this.root.removeEventListener("keydown", l));
    const c = p("div", "ez-header-row");
    c.append(n);
    const d = p("div", "ez-document-column");
    d.append(c, this.noticeEl, this.errorPanel, this.legacyPanel, i), s.appendChild(d), r ? i.appendChild(r) : i.appendChild(p("div", "ez-editor")), e.append(a, this.sidebar, s), this.root.append(t, e, this.buildStatusbar()), this.applyTheme(this.state ? this.root.getAttribute("data-ez-theme") ?? "system" : "system"), this.outlinePanel = this.buildOutline(), s.appendChild(this.outlinePanel), this.findDialog = this.buildFindDialog(), s.insertBefore(this.findDialog, d), this.buildHiddenImportInput();
  }
  buildSidebarToggle() {
    return this.sidebarToggle = E("ez-icon-btn ez-sidebar-toggle", b.panelLeft, "Toggle notes sidebar"), this.sidebarToggle.setAttribute("aria-expanded", "true"), this.sidebarToggle.addEventListener("click", () => {
      var t, e;
      if (this.compactSidebar) {
        const s = !this.root.classList.contains("ez-sidebar-open");
        this.setDrawerOpen(s), s && ((t = this.searchInput) == null || t.focus());
      } else
        this.desktopSidebarCollapsed = this.root.classList.toggle("ez-sidebar-collapsed"), (e = this.sidebarToggle) == null || e.setAttribute("aria-expanded", String(!this.desktopSidebarCollapsed));
    }), this.sidebarToggle;
  }
  observeContainer() {
    const t = (s = this.root.getBoundingClientRect().width || window.innerWidth) => {
      var r, a;
      this.root.classList.toggle("ez-workspace-narrow", s <= 600);
      const n = s <= 900;
      if (n === this.compactSidebar) return;
      const i = n && ((r = this.sidebar) == null ? void 0 : r.contains(document.activeElement));
      this.compactSidebar = n, this.root.classList.toggle("ez-workspace-compact", n), this.root.classList.toggle("ez-sidebar-collapsed", !n && this.desktopSidebarCollapsed), this.setDrawerOpen(!1), i && ((a = this.sidebarToggle) == null || a.focus());
    };
    if (t(), typeof ResizeObserver < "u") {
      const s = new ResizeObserver((n) => {
        const i = n.find((r) => r.target === this.root);
        i && t(i.contentRect.width);
      });
      s.observe(this.root), this.disposers.push(() => s.disconnect());
    }
    const e = () => t();
    window.addEventListener("resize", e), this.disposers.push(() => window.removeEventListener("resize", e));
  }
  setDrawerOpen(t) {
    var e, s;
    this.root.classList.toggle("ez-sidebar-open", t), (e = this.sidebarToggle) == null || e.setAttribute("aria-expanded", String(this.showSidebar && (this.compactSidebar ? t : !this.desktopSidebarCollapsed))), (s = this.sidebar) == null || s.setAttribute("aria-hidden", String(!this.showSidebar || this.compactSidebar && !t)), this.sidebar && (t ? (this.sidebar.setAttribute("role", "dialog"), this.sidebar.setAttribute("aria-modal", "true")) : (this.sidebar.removeAttribute("role"), this.sidebar.removeAttribute("aria-modal")));
    for (const n of this.root.querySelectorAll(".ez-main, .ezy-suite-topbar, .ez-statusbar")) n.inert = t;
  }
  /** Suite-standard topbar: brand + document actions, shared with the shell. */
  buildTopbar() {
    var $;
    const t = p("header", "ez-topbar"), e = p("div", "ez-brand"), s = p("span", "ez-brand-mark");
    s.innerHTML = Jr, e.append(s, p("span", "ez-brand-name", "Ezynota")), this.workspaceTitle = p("input", "ez-topbar-title"), this.workspaceTitle.type = "text", this.workspaceTitle.spellcheck = !1, this.workspaceTitle.placeholder = this.showSidebar ? "Untitled workspace" : "Untitled", this.workspaceTitle.setAttribute("aria-label", this.showSidebar ? "Workspace name" : "Document name");
    const n = () => {
      var C, B;
      const S = ((C = this.workspaceTitle) == null ? void 0 : C.value) ?? "";
      this.showSidebar ? this.state.getWorkspaceName() !== S && this.deps.renameWorkspace(S) : this.state.activeNoteId && ((B = this.state.getNote(this.state.activeNoteId)) == null ? void 0 : B.title) !== S && this.deps.renameNote(this.state.activeNoteId, S);
    };
    this.workspaceTitle.addEventListener("change", n), this.workspaceTitle.addEventListener("keydown", (S) => {
      var C;
      S.isComposing || S.keyCode === 229 || S.key === "Enter" && (S.preventDefault(), n(), (C = this.workspaceTitle) == null || C.blur());
    });
    const i = p("div", "ez-topbar-group ez-history-actions");
    i.setAttribute("role", "group"), i.setAttribute("aria-label", "Edit history"), i.setAttribute("data-ez-ui", "true"), this.undoButton = E("ez-icon-btn", b.undo, "Undo"), this.redoButton = E("ez-icon-btn", b.redo, "Redo");
    for (const S of [this.undoButton, this.redoButton])
      ($ = S.querySelector("svg")) == null || $.setAttribute("aria-hidden", "true"), S.addEventListener("mousedown", (C) => C.preventDefault());
    this.undoButton.addEventListener("click", () => {
      this.deps.undo(), this.refreshHistory();
    }), this.redoButton.addEventListener("click", () => {
      this.deps.redo(), this.refreshHistory();
    }), i.append(this.undoButton, this.redoButton);
    const r = p("div", "ez-topbar-group ez-document-actions"), a = E("ez-icon-btn", b.outline, "Toggle heading outline");
    a.setAttribute("aria-expanded", "false");
    const l = () => {
      const S = this.root.classList.toggle("ez-outline-open");
      a.setAttribute("aria-expanded", String(S));
    };
    a.addEventListener("click", l);
    const c = E("ez-icon-btn", b.search, "Find in document");
    c.addEventListener("click", () => this.openFindDialog()), r.append(a, c), this.fullscreenBtn = E("ez-icon-btn", b.maximize, "Enter fullscreen"), this.fullscreenBtn.addEventListener("click", () => this.deps.toggleFullscreen()), this.docMenu = p("details", "ez-doc-menu");
    const d = p("summary", "ez-icon-btn ez-doc-menu-btn");
    d.appendChild(D(b.ellipsis)), d.setAttribute("aria-label", "Document menu");
    const u = p("div", "ez-doc-menu-panel");
    u.setAttribute("data-ez-ui", "true");
    const h = (S, C, B = this.docMenu) => {
      const qe = A("ez-doc-menu-item", S);
      return qe.addEventListener("click", () => {
        var We;
        B.contains(document.activeElement) && ((We = B.querySelector("summary")) == null || We.focus()), B.open = !1, C();
      }), qe;
    };
    u.append(
      h("Print document", () => this.deps.printActiveNote()),
      h("Restore workspace backup…", () => this.pickBackupFile())
    ), this.docMenu.append(d, u), this.exportMenu = p("details", "ez-doc-menu ez-export-menu");
    const f = p("summary", "ez-export-btn");
    f.setAttribute("aria-label", "Export document"), f.append(D(b.download), p("span", "", "Export"), D(b.down));
    const g = p("div", "ez-doc-menu-panel");
    g.setAttribute("data-ez-ui", "true"), g.append(
      h("Download JSON", () => this.deps.exportActiveNote("json"), this.exportMenu),
      h("Export Markdown", () => this.deps.exportActiveNote("md"), this.exportMenu),
      h("Export HTML", () => this.deps.exportActiveNote("html"), this.exportMenu),
      h("Export plain text", () => this.deps.exportActiveNote("txt"), this.exportMenu)
    ), this.exportMenu.append(f, g), this.themeMenu = p("details", "ez-theme-menu");
    const m = p("summary", "ez-icon-btn");
    m.appendChild(D(b.sun)), m.setAttribute("aria-label", "Theme");
    const y = p("div", "ez-theme-panel");
    y.setAttribute("data-ez-ui", "true");
    for (const S of ["light", "dark", "system"]) {
      const C = A("ez-theme-item", Gr[S]);
      C.setAttribute("data-ez-theme-choice", S), C.addEventListener("click", () => {
        var B;
        (B = this.themeMenu) != null && B.contains(document.activeElement) && m.focus(), this.deps.setTheme(S), this.themeMenu && (this.themeMenu.open = !1);
      }), y.appendChild(C);
    }
    this.themeMenu.append(m, y);
    const v = p("div");
    v.setAttribute("aria-label", "View"), v.append(this.themeMenu, this.fullscreenBtn);
    const w = p("div");
    w.setAttribute("aria-label", "Files");
    const I = E("ez-icon-btn", b.folderOpen, "Import file");
    I.addEventListener("click", () => {
      var S;
      return (S = this.importInput) == null ? void 0 : S.click();
    });
    const T = E("ez-icon-btn", b.save, "Download workspace backup");
    return T.addEventListener("click", () => this.deps.createBackup()), w.append(I, T), r.setAttribute("aria-label", "Document tools"), this.disposers.push(Kr(this.root, t, {
      brand: e,
      title: this.workspaceTitle,
      history: i,
      specialist: r,
      view: v,
      files: w,
      exportControl: this.exportMenu,
      more: this.docMenu
    })), this.disposers.push(Le(this.themeMenu, y)), this.disposers.push(Le(this.exportMenu, g)), t;
  }
  buildSidebarContent() {
    if (!this.sidebar) return;
    N(this.sidebar);
    const t = p("div", "ez-sidebar-search-row"), e = p("div", "ez-sidebar-search");
    this.searchInput = p("input", "ez-sidebar-search-input"), this.searchInput.type = "search", this.searchInput.placeholder = "Search notes…", this.searchInput.setAttribute("aria-label", "Search workspace");
    let s = null;
    this.disposers.push(() => {
      s && clearTimeout(s);
    }), this.searchInput.addEventListener("input", () => {
      s && clearTimeout(s), s = setTimeout(() => {
        var u;
        return this.renderSearchResults(((u = this.searchInput) == null ? void 0 : u.value) ?? "");
      }, 200);
    });
    const n = p("span", "ez-sidebar-search-icon");
    n.innerHTML = b.search, n.setAttribute("aria-hidden", "true"), e.append(n, this.searchInput);
    const i = E("ez-icon-btn ez-sidebar-close", b.x, "Close notes sidebar");
    i.addEventListener("click", () => this.closeMobileSidebar()), t.append(e, i), this.searchResults = p("div", "ez-search-results"), this.searchResults.setAttribute("role", "listbox"), this.searchResults.setAttribute("aria-label", "Search results");
    const r = p("div", "ez-sidebar-actions"), a = A("ez-sidebar-btn ez-new-note", "New note");
    a.prepend(D(b.plus)), a.addEventListener("click", () => {
      this.deps.createNote(), this.closeMobileSidebar(!1);
    });
    const l = E("ez-sidebar-btn ez-new-folder", b.folderPlus, "New folder");
    l.addEventListener("click", () => this.deps.createFolder()), r.append(a, l), this.notesTree = p("nav", "ez-notes-tree"), this.notesTree.setAttribute("aria-label", "Folders and notes");
    const c = this.buildTrashSection(), d = p("div", "ez-sidebar-section-label");
    this.noteCount = p("span", "ez-note-count", "0"), d.append(p("span", "", "Your notes"), this.noteCount), this.setupTreeDragAndDrop(this.notesTree, d), this.sidebar.append(t, this.searchResults, r, d, this.notesTree, c);
  }
  closeMobileSidebar(t = !0) {
    var e;
    this.setDrawerOpen(!1), this.compactSidebar && t && ((e = this.sidebarToggle) == null || e.focus());
  }
  /* ---------- sidebar rendering ---------- */
  renderSidebar() {
    if (!this.notesTree) return;
    N(this.notesTree);
    const t = this.state.listFolders(), e = this.state.listNotes();
    this.noteCount && (this.noteCount.textContent = String(e.length));
    const s = t.filter((i) => !i.parentId);
    for (const i of s) this.renderFolder(i, t, e, 0);
    const n = e.filter((i) => !i.folderId);
    for (const i of n) this.renderNote(i, 0);
    if (t.length === 0 && e.length === 0) {
      const i = p("div", "ez-notes-empty");
      i.textContent = "No notes yet — create one to start writing.", this.notesTree.appendChild(i);
    }
  }
  /**
   * Native drag & drop inside the sidebar tree: notes and folders can be
   * dragged onto a folder row (moved into it) or onto the tree background /
   * the "Your notes" section label (moved back to the workspace root).
   */
  setupTreeDragAndDrop(t, e) {
    const s = "text/x-ezynota-tree", n = () => {
      var u;
      (u = this.treeDropHighlight) == null || u.classList.remove("ez-drop-target"), this.treeDropHighlight = null;
    }, i = () => {
      this.treeDrag = null, n();
    }, r = (u) => {
      var m;
      const h = u, f = (m = h.target) == null ? void 0 : m.closest(".ez-tree-row");
      if (!f || !h.dataTransfer) return;
      const g = f.dataset.noteId ?? f.dataset.folderId;
      g && (this.treeDrag = { kind: f.dataset.noteId ? "note" : "folder", id: g }, f.classList.add("ez-dragging"), h.dataTransfer.effectAllowed = "move", h.dataTransfer.setData(s, JSON.stringify(this.treeDrag)), h.dataTransfer.setData("text/plain", g));
    }, a = (u) => {
      var f, g, m;
      (m = (g = (f = u.target) == null ? void 0 : f.closest) == null ? void 0 : g.call(f, ".ez-tree-row")) == null || m.classList.remove("ez-dragging"), i();
    }, l = (u) => {
      var g, m;
      const h = u;
      if (!this.treeDrag || !h.dataTransfer) return;
      const f = (m = (g = h.target) == null ? void 0 : g.closest) == null ? void 0 : m.call(g, ".ez-tree-row");
      if (!f)
        e.contains(h.target) ? this.treeDropHighlight !== e && (n(), e.classList.add("ez-drop-target"), this.treeDropHighlight = e) : n();
      else if (f.dataset.folderId) {
        if (this.treeDrag.kind === "folder" && (f.dataset.folderId === this.treeDrag.id || this.isFolderDescendant(f.dataset.folderId, this.treeDrag.id)))
          return;
        this.treeDropHighlight !== f && (n(), f.classList.add("ez-drop-target"), this.treeDropHighlight = f);
      } else return;
      h.preventDefault(), h.dataTransfer.dropEffect = "move";
    }, c = (u) => {
      var y, v;
      const h = u;
      if (!this.treeDrag) return;
      const f = this.treeDrag;
      i(), h.preventDefault();
      const g = (v = (y = h.target) == null ? void 0 : y.closest) == null ? void 0 : v.call(y, ".ez-tree-row");
      if (g && !g.dataset.folderId) return;
      const m = (g == null ? void 0 : g.dataset.folderId) ?? null;
      f.kind === "note" ? (this.deps.moveNote(f.id, m), m && this.expandedFolders.add(m)) : this.deps.moveFolder(f.id, m) && m && this.expandedFolders.add(m);
    }, d = (u) => {
      u.target === t && n();
    };
    for (const u of [t, e])
      u.addEventListener("dragstart", r), u.addEventListener("dragend", a), u.addEventListener("dragover", l), u.addEventListener("drop", c), u.addEventListener("dragleave", d);
    this.disposers.push(() => {
      for (const u of [t, e])
        u.removeEventListener("dragstart", r), u.removeEventListener("dragend", a), u.removeEventListener("dragover", l), u.removeEventListener("drop", c), u.removeEventListener("dragleave", d);
    });
  }
  /** True when `folderId` sits anywhere inside `ancestorId`'s subtree. */
  isFolderDescendant(t, e) {
    let s = this.state.getFolder(t);
    for (; s != null && s.parentId; ) {
      if (s.parentId === e) return !0;
      s = this.state.getFolder(s.parentId);
    }
    return !1;
  }
  renderFolder(t, e, s, n) {
    if (!this.notesTree) return;
    const i = this.expandedFolders.has(t.id), r = p("div", "ez-tree-row ez-tree-folder");
    r.style.paddingInlineStart = `${n * 14}px`, r.dataset.folderId = t.id, r.draggable = !0;
    const a = E("ez-tree-caret", i ? b.caretDown : b.caretRight, `Expand ${t.name}`);
    a.setAttribute("aria-expanded", String(i)), a.addEventListener("click", (d) => {
      d.stopPropagation(), this.expandedFolders.has(t.id) ? this.expandedFolders.delete(t.id) : this.expandedFolders.add(t.id), this.renderSidebar();
    });
    const l = A("ez-tree-label", t.name);
    l.prepend(D(i ? b.folderOpen : b.folder)), l.setAttribute("data-folder-id", t.id), l.addEventListener("click", () => {
      this.expandedFolders.add(t.id), this.deps.openFolder(t.id), this.renderSidebar();
    });
    const c = E("ez-tree-action", b.ellipsis, `Folder actions for ${t.name}`);
    if (c.addEventListener("click", (d) => {
      d.stopPropagation(), this.folderActions(t, c);
    }), r.append(a, l, c), this.state.activeFolderId === t.id && r.classList.add("ez-active"), this.notesTree.appendChild(r), !!i) {
      for (const d of e.filter((u) => u.parentId === t.id))
        this.renderFolder(d, e, s, n + 1);
      for (const d of s.filter((u) => u.folderId === t.id))
        this.renderNote(d, n + 1);
    }
  }
  renderNote(t, e) {
    if (!this.notesTree) return;
    const s = p("div", "ez-tree-row ez-tree-note");
    s.style.paddingInlineStart = `${e * 14 + 4}px`, s.dataset.noteId = t.id, s.draggable = !0;
    const n = A("ez-tree-label", t.title || "Untitled");
    n.setAttribute("data-note-id", t.id), n.title = t.title || "Untitled", n.prepend(D(b.file)), this.state.activeNoteId === t.id && n.setAttribute("aria-current", "page"), n.addEventListener("click", () => {
      this.deps.openNote(t.id), this.closeMobileSidebar(!1);
    });
    const i = E("ez-tree-action", b.ellipsis, `Note actions for ${t.title || "Untitled"}`);
    i.addEventListener("click", (r) => {
      r.stopPropagation(), this.noteActions(t, i);
    }), s.append(n, i), this.state.activeNoteId === t.id && s.classList.add("ez-active"), this.notesTree.appendChild(s);
  }
  noteActions(t, e) {
    Ss([
      { label: "Rename…", run: () => {
        const s = prompt("Rename note", t.title || "Untitled");
        s !== null && this.deps.renameNote(t.id, s.trim());
      } },
      { label: "Duplicate", run: () => this.deps.duplicateNote(t.id) },
      { label: "New note in folder", run: () => this.deps.createNote(void 0, t.folderId) },
      { label: "New folder inside", run: () => this.deps.createFolder(void 0, t.folderId) },
      { label: "Move to trash", danger: !0, run: () => this.deps.trashNote(t.id) }
    ], e);
  }
  folderActions(t, e) {
    Ss([
      { label: "Rename…", run: () => {
        const s = prompt("Rename folder", t.name);
        s !== null && this.deps.renameFolder(t.id, s.trim());
      } },
      { label: "New folder inside", run: () => this.deps.createFolder(void 0, t.id) },
      { label: "Move to trash", danger: !0, run: () => this.deps.trashFolder(t.id) }
    ], e);
  }
  renderSearchResults(t) {
    if (!this.searchResults) return;
    N(this.searchResults);
    const e = t.trim();
    if (!e) return;
    const s = this.deps.searchWorkspace(e);
    if (s.length === 0) {
      const n = p("div", "ez-search-empty");
      n.textContent = "No matches", this.searchResults.appendChild(n);
      return;
    }
    for (const n of s.slice(0, 40)) {
      const i = p("button", "ez-search-hit");
      i.type = "button", i.setAttribute("role", "option");
      const r = p("span", "ez-search-hit-title");
      r.textContent = n.title || "Untitled";
      const a = p("span", "ez-search-hit-excerpt");
      a.textContent = n.excerpt, i.append(r, a), i.addEventListener("click", () => {
        const l = this.deps.openNote(n.noteId);
        this.closeMobileSidebar(!1), Promise.resolve(l).then(() => {
          n.blockId && this.deps.goToBlock(n.blockId);
        }), this.searchInput && (this.searchInput.value = ""), this.searchResults && N(this.searchResults);
      }), this.searchResults.appendChild(i);
    }
  }
  buildTrashSection() {
    const t = p("details", "ez-trash-section"), e = p("summary", "ez-trash-summary");
    e.appendChild(D(b.trash));
    const s = p("span");
    s.textContent = "Trash", e.appendChild(s);
    const n = p("div", "ez-trash-list"), i = () => {
      N(n);
      const r = this.state.listTrashedNotes(), a = this.state.listTrashedFolders();
      if (r.length === 0 && a.length === 0) {
        n.appendChild(p("div", "ez-trash-empty", "Trash is empty"));
        return;
      }
      for (const l of a) {
        const c = p("div", "ez-trash-row"), d = p("span", "ez-trash-label");
        d.textContent = `${l.name} (folder)`;
        const u = E("ez-icon-btn", b.restore, `Restore ${l.name}`);
        u.addEventListener("click", () => this.deps.restoreFolder(l.id));
        const h = E("ez-icon-btn", b.x, `Delete ${l.name} forever`);
        h.addEventListener("click", () => this.deps.deleteFolderForever(l.id)), c.append(d, u, h), n.appendChild(c);
      }
      for (const l of r) {
        const c = p("div", "ez-trash-row"), d = p("span", "ez-trash-label");
        d.textContent = l.title || "Untitled";
        const u = E("ez-icon-btn", b.restore, `Restore ${l.title}`);
        u.addEventListener("click", () => this.deps.restoreNote(l.id));
        const h = E("ez-icon-btn", b.x, `Delete ${l.title} forever`);
        h.addEventListener("click", () => this.deps.deleteNoteForever(l.id)), c.append(d, u, h), n.appendChild(c);
      }
      if (r.length + a.length > 1) {
        const l = A("ez-trash-empty-btn", "Empty trash");
        l.addEventListener("click", () => {
          confirm("Permanently delete everything in the trash?") && this.deps.emptyTrash();
        }), n.appendChild(l);
      }
    };
    return t.addEventListener("toggle", () => {
      t.open && i();
    }), t.append(e, n), t;
  }
  /* ---------- header ---------- */
  buildHeader() {
    const t = p("header", "ez-doc-header");
    this.breadcrumbs = p("nav", "ez-breadcrumbs"), this.breadcrumbs.setAttribute("aria-label", "Folder path");
    const e = p("div", "ez-title-row");
    this.titleInput = p("input", "ez-doc-title"), this.titleInput.type = "text", this.titleInput.placeholder = "Untitled", this.titleInput.setAttribute("aria-label", "Note title"), this.titleInput.addEventListener("input", () => {
      var i;
      const n = this.state.activeNoteId;
      n && this.deps.renameNote(n, ((i = this.titleInput) == null ? void 0 : i.value) ?? "");
    }), e.appendChild(this.titleInput);
    const s = p("div", "ez-document-navigation");
    return s.append(this.breadcrumbs), t.append(s, e), t;
  }
  buildStatusbar() {
    const t = p("footer", "ez-statusbar");
    t.setAttribute("aria-label", "Document status"), this.saveStatusDot = p("span", "ez-status-dot"), this.saveStatusEl = p("span", "ez-status-text"), this.saveStatusEl.setAttribute("role", "status"), this.saveStatusEl.setAttribute("aria-live", "polite"), this.saveStatusEl.textContent = "Ready";
    const e = p("button", "ez-save-state");
    return e.type = "button", e.append(this.saveStatusDot, this.saveStatusEl), e.addEventListener("click", () => this.deps.retrySave()), this.wordCountEl = p("span", "ez-word-count"), this.wordCountEl.textContent = "0 words", t.append(e, this.wordCountEl), t;
  }
  updateHeader() {
    const t = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null;
    if (this.workspaceTitle && document.activeElement !== this.workspaceTitle && (this.workspaceTitle.value = this.showSidebar ? this.state.getWorkspaceName() : (t == null ? void 0 : t.title) ?? ""), this.titleInput && (document.activeElement !== this.titleInput && (this.titleInput.value = (t == null ? void 0 : t.title) ?? ""), this.titleInput.disabled = !t), this.breadcrumbs) {
      if (N(this.breadcrumbs), t) {
        const s = this.state.folderPath(t.folderId);
        if (s.length > 0)
          for (const n of s) {
            const i = p("span", "ez-crumb-sep", "/");
            i.setAttribute("aria-hidden", "true");
            const r = A("ez-crumb", n.name);
            r.addEventListener("click", () => this.deps.openFolder(n.id)), this.breadcrumbs.append(i, r);
          }
      }
      const e = A("ez-crumb ez-crumb-root", "Notes");
      e.addEventListener("click", () => this.deps.openFolder(null)), this.breadcrumbs.prepend(e);
    }
    if (this.wordCountEl) {
      const e = this.deps.getWordCount();
      this.wordCountEl.textContent = `${e} ${e === 1 ? "word" : "words"}`;
    }
    this.refreshThemeIcons();
  }
  refreshThemeIcons() {
    if (!this.themeMenu) return;
    const t = this.root.getAttribute("data-ez-theme"), e = t === "dark" ? b.moon : t === "light" ? b.sun : b.monitor, s = this.themeMenu.querySelector(".ez-icon-btn");
    s && (N(s), s.appendChild(D(e)), s.appendChild(p("span", "ez-visually-hidden", "Theme")));
    for (const n of Array.from(this.themeMenu.querySelectorAll(".ez-theme-item")))
      n.setAttribute("aria-pressed", String(n.getAttribute("data-ez-theme-choice") === t));
  }
  updateSaveStatus(t, e) {
    if (this.updateStorageNotice(), !this.saveStatusEl || !this.saveStatusDot) return;
    this.saveStatusEl.textContent = Xr(t, e);
    const s = this.saveStatusEl.closest(".ez-save-state");
    s && s.setAttribute("data-ez-save-status", t);
  }
  updateStorageNotice() {
    var t;
    if (!this.storageNoticeEl) {
      this.storageNoticeEl = p("div", "ez-workspace-storage-notice"), this.storageNoticeEl.setAttribute("role", "status");
      const e = p("p", "", "Changes are stored only in this tab. Back up before closing or reloading."), s = A("ez-btn", "Download workspace backup");
      s.addEventListener("click", () => this.deps.createBackup()), this.storageNoticeEl.append(e, s), (t = this.noticeEl) == null || t.before(this.storageNoticeEl);
    }
    this.storageNoticeEl.hidden = this.state.isPersistent();
  }
  applyTheme(t) {
    var s;
    this.root.setAttribute("data-ez-theme", t);
    const e = Ks(t);
    this.root.setAttribute("data-ez-resolved-theme", e), (s = this.root.querySelector(".ez-editor")) == null || s.setAttribute("data-ez-theme", e), this.refreshThemeIcons();
  }
  setFullscreen(t) {
    this.root.classList.toggle("ez-fullscreen", t), this.fullscreenBtn && (N(this.fullscreenBtn), this.fullscreenBtn.appendChild(D(t ? b.minimize : b.maximize)), this.fullscreenBtn.setAttribute("aria-label", t ? "Exit fullscreen" : "Enter fullscreen"));
  }
  /* ---------- outline ---------- */
  buildOutline() {
    const t = p("aside", "ez-outline");
    t.setAttribute("aria-label", "Heading outline");
    const e = p("h2", "ez-outline-title", "Outline"), s = p("nav", "ez-outline-list");
    s.id = `ez-outline-${++to}`, t.append(e, s);
    const n = () => {
      N(s);
      const r = this.collectHeadings();
      if (r.length === 0) {
        s.appendChild(p("div", "ez-outline-empty", "No headings yet"));
        return;
      }
      for (const a of r) {
        const l = A("ez-outline-item", a.text || "Empty heading");
        l.style.paddingInlineStart = `${(a.level - 1) * 12 + 8}px`, l.addEventListener("click", () => this.deps.goToBlock(a.blockId)), s.appendChild(l);
      }
    }, i = new MutationObserver(() => n());
    return i.observe(this.root.querySelector(".ez-editor") ?? this.root, { childList: !0, subtree: !0, characterData: !0 }), this.disposers.push(() => i.disconnect()), n(), t;
  }
  collectHeadings() {
    const t = [];
    return this.root.querySelectorAll(".ez-blocks > .ez-block[data-ez-block-type='heading']").forEach((e) => {
      const s = e.getAttribute("data-ez-block-id") ?? "", n = e.querySelector("h1, h2, h3, h4, h5, h6");
      if (!n || !s) return;
      const i = Number(n.tagName.slice(1)) || 1;
      t.push({ blockId: s, level: i, text: n.textContent ?? "" });
    }), t;
  }
  /* ---------- find & replace ---------- */
  buildFindDialog() {
    const t = p("div", "ez-find-bar");
    t.setAttribute("role", "search"), t.setAttribute("aria-label", "Find and replace"), this.findInput = p("input", "ez-find-input"), this.findInput.type = "search", this.findInput.placeholder = "Find", this.findInput.setAttribute("aria-label", "Find"), this.findInput.title = "Find exact text (case-sensitive)", this.findInput.addEventListener("input", () => {
      this.findIndex = 0, this.refreshFindMatches(!0);
    });
    const e = E("ez-icon-btn", b.up, "Previous match"), s = E("ez-icon-btn", b.down, "Next match");
    e.addEventListener("click", () => this.navigateFind(-1)), s.addEventListener("click", () => this.navigateFind(1)), this.findNavigation = [e, s], this.findCounter = p("span", "ez-find-counter"), this.findCounter.setAttribute("role", "status"), this.findCounter.setAttribute("aria-live", "polite"), this.replaceInput = p("input", "ez-find-input"), this.replaceInput.type = "text", this.replaceInput.placeholder = "Replace with", this.replaceInput.setAttribute("aria-label", "Replace with");
    const n = A("ez-btn", "Replace");
    n.addEventListener("click", () => this.runReplace(!1));
    const i = A("ez-btn", "Replace all");
    i.addEventListener("click", () => this.runReplace(!0));
    const r = E("ez-icon-btn", b.x, "Close find and replace");
    r.addEventListener("click", () => this.closeFindDialog()), this.replaceButtons = [n, i];
    const a = p("style");
    a.textContent = `::highlight(${this.findHighlightName}) { background-color: var(--ez-hover); color: var(--ez-text); }
      ::highlight(${this.findHighlightName}-active) { background-color: var(--ez-selected); color: var(--ez-text); }`, t.append(this.findInput, e, s, this.findCounter, this.replaceInput, n, i, r, a), t.addEventListener("keydown", (c) => {
      c.isComposing || c.keyCode === 229 || (c.key === "Escape" && (c.preventDefault(), c.stopPropagation(), this.closeFindDialog()), c.key === "Enter" && c.target === this.findInput ? (c.preventDefault(), this.navigateFind(c.shiftKey ? -1 : 1)) : c.key === "Enter" && c.target === this.replaceInput && (c.preventDefault(), this.runReplace(!1)), te(c, t));
    });
    const l = new MutationObserver(() => this.refreshFindMatches());
    return l.observe(this.root.querySelector(".ez-editor") ?? this.root, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["contenteditable"] }), this.disposers.push(() => l.disconnect()), t.hidden = !0, t;
  }
  openFindDialog() {
    var t, e;
    if (this.findDialog) {
      if (this.findDialog.hidden) {
        this.findReturnFocus = document.activeElement;
        const s = window.getSelection(), n = s != null && s.rangeCount ? s.getRangeAt(0) : null;
        this.findReturnRange = n && ((t = this.root.querySelector(".ez-editor")) != null && t.contains(n.commonAncestorContainer)) ? n.cloneRange() : null;
      }
      this.findDialog.hidden = !1, this.refreshFindMatches(), (e = this.findInput) == null || e.focus();
    }
  }
  closeFindDialog() {
    var e, s, n;
    if (!this.findDialog) return;
    const t = this.findDialog.contains(document.activeElement);
    if (this.findDialog.hidden = !0, this.clearFindHighlights(), this.findMatches = [], t) {
      const i = (e = this.findReturnFocus) != null && e.getClientRects().length ? this.findReturnFocus : (s = this.docMenu) == null ? void 0 : s.querySelector("summary");
      if (i == null || i.focus(), (n = this.findReturnRange) != null && n.startContainer.isConnected && (i != null && i.matches("[data-ez-editable]"))) {
        const r = window.getSelection();
        r == null || r.removeAllRanges(), r == null || r.addRange(this.findReturnRange);
      }
    }
    this.findReturnFocus = null, this.findReturnRange = null;
  }
  runReplace(t) {
    var e, s, n, i;
    !this.findMatches.length || (e = this.replaceButtons[0]) != null && e.disabled || (this.deps.findInDocument(((s = this.findInput) == null ? void 0 : s.value) ?? "", ((n = this.replaceInput) == null ? void 0 : n.value) ?? "", t, this.findIndex), this.refreshFindMatches(!0), (i = this.replaceInput) == null || i.focus());
  }
  navigateFind(t) {
    this.findMatches.length && (this.findIndex = (this.findIndex + t + this.findMatches.length) % this.findMatches.length, this.renderFindMatches(!0));
  }
  refreshFindMatches(t = !1) {
    var s;
    if (!this.findDialog || this.findDialog.hidden) return;
    this.clearFindHighlights();
    const e = this.root.querySelector(".ez-editor");
    this.findMatches = e ? Zr(e, ((s = this.findInput) == null ? void 0 : s.value) ?? "") : [], this.findIndex = Math.min(this.findIndex, Math.max(0, this.findMatches.length - 1)), this.renderFindMatches(t);
  }
  clearFindHighlights() {
    for (const t of this.root.querySelectorAll(".ez-find-hit")) t.classList.remove("ez-find-hit");
    typeof CSS < "u" && CSS.highlights && (CSS.highlights.delete(this.findHighlightName), CSS.highlights.delete(`${this.findHighlightName}-active`));
  }
  renderFindMatches(t) {
    var n;
    this.clearFindHighlights();
    const e = this.findMatches[this.findIndex];
    this.findCounter && (this.findCounter.textContent = (n = this.findInput) != null && n.value ? e ? `${this.findIndex + 1} of ${this.findMatches.length}` : "No matches" : "Enter text to find");
    for (const i of this.findNavigation) i.disabled = !e;
    const s = !!this.root.querySelector(".ez-editor.ez-readonly");
    for (const i of this.replaceButtons) i.disabled = !e || s;
    if (typeof Highlight < "u" && typeof CSS < "u" && CSS.highlights) {
      const i = new Highlight();
      for (const r of this.findMatches) i.add(r.range);
      CSS.highlights.set(this.findHighlightName, i), e && CSS.highlights.set(`${this.findHighlightName}-active`, new Highlight(e.range));
    }
    e && (e.editable.classList.add("ez-find-hit"), t && e.editable.scrollIntoView({ block: "nearest", inline: "nearest" }));
  }
  /* ---------- recovery & legacy draft ---------- */
  buildErrorPanel() {
    const t = p("section", "ez-recovery-panel");
    t.setAttribute("role", "alert");
    const e = p("h2", "ez-recovery-title", "Your workspace needs attention"), s = p("p", "ez-recovery-message");
    s.textContent = "Notes could not be loaded from this browser. Your content stays safe — retry loading or download the stored data.";
    const n = p("div", "ez-recovery-actions"), i = A("ez-btn ez-btn-primary", "Retry loading");
    i.addEventListener("click", () => this.deps.retryLoad());
    const r = A("ez-btn", "Download stored data");
    return r.addEventListener("click", () => this.deps.downloadOriginal()), n.append(i, r), t.append(e, s, n), t.hidden = !0, t;
  }
  showErrorPanel() {
    this.errorPanel && (this.errorPanel.hidden = !1);
  }
  /** Public entry point used when a load fails before the UI listener exists. */
  showLoadError() {
    this.showErrorPanel();
  }
  /** Transient status/banner message (e.g. import failures). */
  showNotice(t) {
    this.noticeEl && (this.noticeTimer && clearTimeout(this.noticeTimer), this.noticeEl.textContent = t, this.noticeEl.hidden = !t, t && (this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null, this.noticeEl && (this.noticeEl.hidden = !0);
    }, 6e3)));
  }
  hideErrorPanel() {
    this.errorPanel && (this.errorPanel.hidden = !0);
  }
  buildLegacyPanel() {
    const t = p("section", "ez-legacy-panel"), e = p("p", "ez-legacy-text");
    e.textContent = "A draft saved by an older version of Ezynota was found in this browser. Import it as a new note?";
    const s = A("ez-btn ez-btn-primary", "Import draft");
    s.addEventListener("click", () => {
      const r = this.deps.getLegacyDraft();
      r && this.deps.importLegacyDraft(r), this.deps.dismissLegacyDraft(), this.legacyPanel && (this.legacyPanel.hidden = !0);
    });
    const n = A("ez-btn", "Not now");
    n.addEventListener("click", () => {
      this.deps.dismissLegacyDraft(), this.legacyPanel && (this.legacyPanel.hidden = !0);
    });
    const i = p("div", "ez-legacy-actions");
    return i.append(s, n), t.append(e, i), t.hidden = !0, t;
  }
  maybeShowLegacyDraft() {
    this.deps.getLegacyDraft() && this.legacyPanel && (this.legacyPanel.hidden = !1);
  }
  buildHiddenImportInput() {
    this.importInput = p("input", "ez-visually-hidden"), this.importInput.type = "file", this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json", this.importInput.setAttribute("aria-hidden", "true"), this.importInput.tabIndex = -1, this.importInput.addEventListener("change", () => {
      var e;
      const t = Array.from(((e = this.importInput) == null ? void 0 : e.files) ?? []);
      t.length > 0 && this.deps.importFiles(t), this.importInput && (this.importInput.value = "");
    }), this.root.appendChild(this.importInput);
  }
  pickBackupFile() {
    this.importInput && (this.importInput.accept = ".json,application/json", this.importInput.dataset.eznPurpose = "backup", this.importInput.click(), this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json", delete this.importInput.dataset.eznPurpose);
  }
}
let to = 0, eo = 0;
function Ks(o) {
  if (o === "system")
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  return o;
}
let vt = null;
function Ss(o, t) {
  var a;
  vt == null || vt();
  const e = p("div", "ez-popover ez-sidebar-menu");
  e.setAttribute("role", "menu"), e.setAttribute("data-ez-ui", "true");
  for (const l of o) {
    const c = A("ez-menu-item", l.label);
    c.setAttribute("role", "menuitem"), l.danger && c.classList.add("ez-danger"), c.addEventListener("click", () => {
      n(), l.run();
    }), e.appendChild(c);
  }
  const s = t == null ? void 0 : t.closest(".ez-workspace-root");
  (s ?? document.body).appendChild(e), t == null || t.setAttribute("aria-expanded", "true"), t == null || t.setAttribute("aria-haspopup", "menu"), t && _(e, t.getBoundingClientRect());
  const n = () => {
    e.contains(document.activeElement) && (t == null || t.focus()), e.remove(), document.removeEventListener("keydown", i, !0), document.removeEventListener("mousedown", r, !0), s == null || s.removeEventListener("ez-close-popovers", n), window.removeEventListener("resize", n), t == null || t.setAttribute("aria-expanded", "false"), vt = null;
  }, i = (l) => {
    if (l.key === "Escape") {
      l.preventDefault(), l.stopImmediatePropagation(), n(), t == null || t.focus();
      return;
    }
    l.key === "Tab" && n(), te(l, e);
  }, r = (l) => {
    e.contains(l.target) || n();
  };
  document.addEventListener("keydown", i, !0), document.addEventListener("mousedown", r, !0), s == null || s.addEventListener("ez-close-popovers", n), window.addEventListener("resize", n), vt = n, (a = e.querySelector("button")) == null || a.focus();
}
function Lt(o) {
  return o.replace(/([\\`*_[\]])/g, "\\$1");
}
function Jt(o) {
  return /[\s()<>]/.test(o) ? o.replace(/%/g, "%25").replace(/[\s()<>]/g, (t) => `%${t.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`) : o;
}
const so = /* @__PURE__ */ new Set(["info", "warning", "success", "danger"]);
function no(o, t) {
  var s, n;
  let e = Lt(t);
  for (const i of o)
    switch (i.type) {
      case "bold":
        e = `**${e}**`;
        break;
      case "italic":
        e = `*${e}*`;
        break;
      case "code":
        e = `\`${e}\``;
        break;
      case "strike":
        e = `~~${e}~~`;
        break;
      case "mark":
        e = `==${e}==`;
        break;
      case "link": {
        const r = String(((s = i.attrs) == null ? void 0 : s.href) ?? "");
        e = `[${e}](${Jt(r)})`;
        break;
      }
      case "color": {
        e = `{${String(((n = i.attrs) == null ? void 0 : n.color) ?? "")}|${e}}`;
        break;
      }
    }
  return e;
}
function X(o, t) {
  if (!o) return "";
  let e = "";
  for (const s of o)
    if (H(s))
      e += s.text.split(`
`).map((n) => no(s.marks ?? [], n)).join(`
`);
    else if (Dt(s)) {
      const n = s.href, i = s.content.map((r) => r.text).join("");
      if (n.startsWith("note:")) {
        const r = n.slice(5), a = (t == null ? void 0 : t.get(r)) ?? i;
        e += `[${a}](${Jt(`note:${r}`)})`;
      } else G(n) ? e += `[${Lt(i)}](${Jt(n)})` : e += Lt(i);
    }
  return e;
}
function $e(o, t) {
  const e = (t == null ? void 0 : t.indent) ?? "", s = [];
  for (const n of o) {
    const i = n.data;
    switch (n.type) {
      case "heading": {
        const r = Math.min(6, Math.max(1, Number(i.level) || 1));
        s.push(`${e}${"#".repeat(r)} ${X(i.content, t == null ? void 0 : t.noteLinkTitles)}`);
        break;
      }
      case "paragraph":
        s.push(...X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`).map((r) => `${e}${r}`));
        break;
      case "quote":
        for (const r of X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`))
          s.push(`${e}> ${r}`);
        break;
      case "code":
        s.push(`${e}\`\`\``);
        for (const r of String(i.code ?? "").split(`
`)) s.push(`${e}${r}`);
        s.push(`${e}\`\`\``);
        break;
      case "delimiter":
        s.push(`${e}---`);
        break;
      case "list": {
        const r = i.style === "ordered" ? "ordered" : i.style === "task" ? "task" : "unordered", a = i.items;
        (Array.isArray(a) ? a : []).forEach((c, d) => {
          const u = r === "ordered" ? `${d + 1}. ` : r === "task" ? c.checked ? "- [x] " : "- [ ] " : "- ";
          s.push(`${e}${u}${X(c.content, t == null ? void 0 : t.noteLinkTitles)}`);
        });
        break;
      }
      case "table": {
        const r = i, a = r.rows, l = Array.isArray(a) ? a : [];
        l.length > 0 && l.forEach((c, d) => {
          const u = c.map((h) => X(h.content, t == null ? void 0 : t.noteLinkTitles));
          s.push(`${e}| ${u.join(" | ")} |`), d === 0 && r.header !== !1 && s.push(`${e}|${u.map(() => " --- ").join("|")}|`);
        });
        break;
      }
      case "image": {
        const r = String(i.src ?? ""), a = String(i.alt ?? "");
        (Z(r) || r.startsWith("asset:")) && s.push(`${e}![${Lt(a)}](${Jt(r)})`), typeof i.caption == "string" && i.caption !== "" && s.push(`${e}*${Lt(i.caption)}*`);
        break;
      }
      case "callout": {
        const r = String(i.variant ?? "info"), a = so.has(r) ? r : "info";
        s.push(`${e}> [!${a.toUpperCase()}]`);
        for (const l of X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`))
          s.push(`${e}> ${l}`);
        break;
      }
      case "toggle": {
        if (s.push(`${e}### ${X(i.heading, t == null ? void 0 : t.noteLinkTitles)}`), Array.isArray(n.children)) {
          const r = $e(n.children, { ...t, indent: `${e}  ` });
          r !== "" && s.push(r);
        }
        break;
      }
    }
  }
  return s.join(`
`).replace(/\n{3,}/g, `

`).trim();
}
function K(o, t) {
  var n;
  const e = io(o), s = [];
  for (const i of e)
    if (i.marks.some((r) => r.type === "link")) {
      const r = i.marks.find((d) => d.type === "link"), a = String(((n = r.attrs) == null ? void 0 : n.href) ?? ""), l = i.marks.filter((d) => d !== r), c = { type: "text", text: i.text };
      l.length > 0 && (c.marks = l), G(xs(a, t)) ? s.push({ type: "link", href: xs(a, t), content: [c] }) : s.push(st(i.text, l.length > 0 ? l : void 0));
    } else
      s.push(st(i.text, i.marks.length > 0 ? i.marks : void 0));
  return s;
}
function xs(o, t) {
  if (o.startsWith("note:") || !t) return o;
  try {
    return new URL(o, t).toString();
  } catch {
    return o;
  }
}
function io(o) {
  const t = [];
  let e = "", s = [];
  const n = () => {
    e !== "" && (t.push({ text: e, marks: s }), e = "", s = []);
  };
  let i = 0;
  for (; i < o.length; ) {
    const r = o.slice(i);
    if (r.startsWith("**")) {
      const a = o.indexOf("**", i + 2);
      if (a > i) {
        n(), t.push({ text: o.slice(i + 2, a), marks: [{ type: "bold" }] }), i = a + 2;
        continue;
      }
    }
    if (o[i] === "*" && !r.startsWith("* ")) {
      const a = o.indexOf("*", i + 1);
      if (a > i) {
        n(), t.push({ text: o.slice(i + 1, a), marks: [{ type: "italic" }] }), i = a + 1;
        continue;
      }
    }
    if (r.startsWith("~~")) {
      const a = o.indexOf("~~", i + 2);
      if (a > i) {
        n(), t.push({ text: o.slice(i + 2, a), marks: [{ type: "strike" }] }), i = a + 2;
        continue;
      }
    }
    if (r.startsWith("==")) {
      const a = o.indexOf("==", i + 2);
      if (a > i) {
        n(), t.push({ text: o.slice(i + 2, a), marks: [{ type: "mark" }] }), i = a + 2;
        continue;
      }
    }
    if (o[i] === "`") {
      const a = o.indexOf("`", i + 1);
      if (a > i) {
        n(), t.push({ text: o.slice(i + 1, a), marks: [{ type: "code" }] }), i = a + 1;
        continue;
      }
    }
    if (r.startsWith("[!")) {
      e += o[i], i++;
      continue;
    }
    if (o[i] === "[") {
      const a = o.indexOf("]", i + 1);
      if (a > i && o[a + 1] === "(") {
        const l = o.indexOf(")", a + 2);
        if (l > a) {
          const c = o.slice(i + 1, a), d = o.slice(a + 2, l);
          c.startsWith("!") ? (n(), t.push({ text: c.slice(1), marks: [] })) : (n(), t.push({ text: c, marks: [{ type: "link", attrs: { href: d } }] })), i = l + 1;
          continue;
        }
      }
    }
    if (r.startsWith("\\[")) {
      e += "[", i += 2;
      continue;
    }
    e += o[i], i++;
  }
  return n(), t;
}
function ro(o, t) {
  const e = o.replace(/\r\n?/g, `
`).split(`
`), s = [];
  let n = 0;
  for (; n < e.length; ) {
    const i = e[n], r = i.trim();
    if (r.startsWith("```")) {
      const d = [];
      for (n++; n < e.length && !e[n].trim().startsWith("```"); )
        d.push(e[n]), n++;
      n++, s.push({ type: "code", data: { code: d.join(`
`) } });
      continue;
    }
    const a = /^(#{1,6})\s+(.*)$/.exec(r);
    if (a) {
      s.push({ type: "heading", data: { level: a[1].length, content: K(a[2], t) } }), n++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(r)) {
      s.push({ type: "delimiter", data: {} }), n++;
      continue;
    }
    if (r.startsWith(">")) {
      const d = /^>\s*\[!(\w+)\]/.exec(r), u = [];
      if (d) {
        for (n++; n < e.length && e[n].trim().startsWith(">"); )
          u.push(e[n].trim().replace(/^>\s?/, "")), n++;
        s.push({ type: "callout", data: { variant: d[1].toLowerCase(), content: u.flatMap((h) => K(h, t)) } });
        continue;
      }
      for (; n < e.length && e[n].trim().startsWith(">"); )
        u.push(e[n].trim().replace(/^>\s?/, "")), n++;
      s.push({ type: "quote", data: { content: K(u.join(" "), t) } });
      continue;
    }
    if (r.startsWith("|") && r.endsWith("|")) {
      const d = [];
      for (; n < e.length && e[n].trim().startsWith("|"); )
        d.push(e[n].trim()), n++;
      const u = oo(d, t);
      u && s.push(u);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(i) || /^\s*[-*+]\s+\[[ xX]\]\s+/.test(i)) {
      const d = (m) => m.length - m.trimStart().length, u = d(i), h = [];
      let f = !1, g = !1;
      for (; n < e.length && /^\s*([-*+]|\d+[.)])\s+/.test(e[n]) && d(e[n]) >= u; ) {
        const m = e[n], y = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(m);
        if (y) {
          g = !0, h.push({ content: K(y[2], t), checked: y[1] !== " " }), n++;
          continue;
        }
        const v = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(m);
        /\d/.test(v[1]) && (f = !0), h.push({ content: K(v[2], t) }), n++;
      }
      h.length > 0 && s.push({ type: "list", data: { style: g ? "task" : f ? "ordered" : "unordered", items: h } });
      continue;
    }
    const l = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(r);
    if (l) {
      s.push({ type: "image", data: { alt: l[1], src: l[2] } }), n++;
      continue;
    }
    if (r === "") {
      n++;
      continue;
    }
    const c = [];
    for (; n < e.length && e[n].trim() !== "" && !/^\s*([-*+]|\d+[.)]|>|#{1,6}\s|```|\|)/.test(e[n]); )
      c.push(e[n].trim()), n++;
    c.length === 0 && (c.push(r), n++), c.length > 0 && s.push({ type: "paragraph", data: { content: K(c.join(" "), t) } });
  }
  return s;
}
function oo(o, t) {
  if (o.length === 0) return null;
  const e = (l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()), s = e(o[0]), n = o.length > 1 && /^[\s|:-]+$/.test(o[1] ?? ""), i = n ? o.slice(2) : o.slice(1), r = [], a = s.map((l) => ({ content: K(l, t) }));
  r.push(a);
  for (const l of i)
    r.push(e(l).map((c) => ({ content: K(c, t) })));
  return { type: "table", data: { header: n, rows: r } };
}
const ao = /* @__PURE__ */ new Set(["info", "warning", "success", "danger"]);
async function Js(o, t) {
  const e = /* @__PURE__ */ new Map(), s = o.blocks.map((l) => Zs(l, t, e)), n = await Promise.all(s), i = await Promise.all(
    Array.from(e.keys()).map(async (l) => ({ id: l, asset: await t(l) }))
  ), r = { ...o, blocks: n }, a = i.filter((l) => !!l.asset);
  return a.length > 0 && (r.assets = a.map(({ id: l, asset: c }) => ({
    id: l,
    mime: c.mime,
    dataUrl: Gs(c)
  }))), r;
}
async function Zs(o, t, e) {
  const s = { ...o, data: o.data };
  if (o.type === "image" && typeof o.data.src == "string") {
    const n = String(o.data.src);
    if (n.startsWith("asset:")) {
      const i = n.slice(6), r = await t(i);
      if (r) {
        const a = Gs(r);
        e.set(i, a), s.data = { ...o.data, src: a };
      }
    }
  }
  return Array.isArray(o.children) && (s.children = await Promise.all(o.children.map((n) => Zs(n, t, e)))), s;
}
function Gs(o) {
  const t = lo(o.bytes);
  return `data:${o.mime};base64,${t}`;
}
function lo(o) {
  let t = "";
  for (let s = 0; s < o.length; s += 32768)
    t += String.fromCharCode(...o.subarray(s, s + 32768));
  return btoa(t);
}
function Pe(o) {
  const t = [];
  return Ys(o, t), t.join(`
`);
}
function Ys(o, t) {
  for (const e of o) {
    const s = e.data;
    switch (e.type) {
      case "heading": {
        const n = Math.min(6, Math.max(1, Number(s.level) || 1));
        t.push(`<h${n}>${V(s.content)}</h${n}>`);
        break;
      }
      case "paragraph":
        t.push(`<p>${V(s.content)}</p>`);
        break;
      case "quote":
        t.push(`<blockquote>${V(s.content)}</blockquote>`);
        break;
      case "code": {
        const n = document.createElement("pre"), i = document.createElement("code");
        i.textContent = String(s.code ?? ""), n.appendChild(i), t.push(n.outerHTML);
        break;
      }
      case "delimiter":
        t.push("<hr>");
        break;
      case "list": {
        const n = s.style === "ordered" ? "ordered" : s.style === "task" ? "task" : "unordered", i = s.items, r = Array.isArray(i) ? i : [], a = n === "ordered" ? "ol" : "ul", l = r.map((c) => {
          const d = V(c.content);
          return n === "task" ? `<li class="ez-md-task${c.checked ? " checked" : ""}"><input type="checkbox" disabled${c.checked ? " checked" : ""}/> ${d}</li>` : `<li>${d}</li>`;
        }).join(`
`);
        t.push(`<${a}>${l}</${a}>`);
        break;
      }
      case "table": {
        const n = s.rows, i = Array.isArray(n) ? n : [], r = s.header !== !1, a = i.map((l, c) => {
          const d = r && c === 0 ? "th" : "td";
          return `<tr>${l.map((u) => `<${d}>${V(u.content)}</${d}>`).join("")}</tr>`;
        }).join(`
`);
        t.push(`<table class="ez-md-table">${a}</table>`);
        break;
      }
      case "image": {
        const n = String(s.src ?? ""), i = String(s.alt ?? ""), r = document.createElement("img");
        r.alt = i, (Z(n) || n.startsWith("asset:")) && r.setAttribute("src", n), t.push(r.outerHTML), typeof s.caption == "string" && s.caption !== "" && t.push(`<figcaption>${W(s.caption)}</figcaption>`);
        break;
      }
      case "callout": {
        const n = String(s.variant ?? "info"), i = ao.has(n) ? n : "info";
        t.push(`<div class="ez-md-callout" data-ezn-variant="${W(i)}">${V(s.content)}</div>`);
        break;
      }
      case "toggle": {
        const n = V(s.heading), i = [];
        Array.isArray(e.children) && Ys(e.children, i), t.push(`<details class="ez-md-toggle"${s.open !== !1 ? " open" : ""}><summary>${n}</summary>${i.join(`
`)}</details>`);
        break;
      }
    }
  }
}
function V(o) {
  if (!Array.isArray(o)) return "";
  let t = "";
  for (const e of o)
    e.type === "text" ? t += co(e.text ?? "", e.marks ?? []) : e.type === "link" && (t += `<a href="${W(e.href ?? "")}" rel="noopener noreferrer">${V(e.content)}</a>`);
  return t;
}
function co(o, t) {
  var s, n, i;
  let e = W(o);
  for (const r of t)
    switch (r.type) {
      case "bold":
        e = `<strong>${e}</strong>`;
        break;
      case "italic":
        e = `<em>${e}</em>`;
        break;
      case "underline":
        e = `<u>${e}</u>`;
        break;
      case "code":
        e = `<code>${e}</code>`;
        break;
      case "mark":
        e = `<mark>${e}</mark>`;
        break;
      case "strike":
        e = `<s>${e}</s>`;
        break;
      case "link":
        e = `<a href="${W(((s = r.attrs) == null ? void 0 : s.href) ?? "")}" rel="noopener noreferrer">${e}</a>`;
        break;
      case "color":
        e = `<span style="color:${W(((n = r.attrs) == null ? void 0 : n.color) ?? "")}">${e}</span>`;
        break;
      case "background":
        e = `<span style="background:${W(((i = r.attrs) == null ? void 0 : i.color) ?? "")}">${e}</span>`;
        break;
    }
  return e;
}
function W(o) {
  return o.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t] ?? t);
}
function ho(o) {
  return $e(o).replace(/([*_~`=]{1,3}|==)/g, "");
}
async function uo(o, t, e) {
  var s;
  switch (t) {
    case "json": {
      const n = await Js(o, e);
      return JSON.stringify(n, null, 2);
    }
    case "md":
      return $e(o.blocks);
    case "html": {
      const n = String(((s = o.meta) == null ? void 0 : s.title) ?? "Document"), i = Pe(o.blocks);
      return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${W(n)}</title>
</head>
<body>
<h1>${W(n)}</h1>
${i}
</body>
</html>`;
    }
    case "txt":
      return ho(o.blocks);
  }
}
function Ot(o, t, e) {
  const s = new Blob([t], { type: e }), n = URL.createObjectURL(s), i = document.createElement("a");
  i.href = n, i.download = o, document.body.appendChild(i), i.click(), i.remove(), setTimeout(() => URL.revokeObjectURL(n), 1e3);
}
function fo(o, t) {
  return o.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || t;
}
const Is = 10 * 1024 * 1024;
function po(o, t) {
  const e = o.toLowerCase();
  return e.endsWith(".json") || t === "application/json" ? "json" : e.endsWith(".md") || e.endsWith(".markdown") ? "md" : e.endsWith(".html") || e.endsWith(".htm") || t === "text/html" ? "html" : "txt";
}
async function go(o) {
  if (o.size > Is)
    throw new k(
      "EZ_IMPORT_FAILED",
      `File is larger than the ${Is / (1024 * 1024)} MB import limit`,
      { size: o.size }
    );
  const t = po(o.name, o.type), e = await o.text();
  switch (t) {
    case "json": {
      let s;
      try {
        s = JSON.parse(e);
      } catch {
        throw new k("EZ_IMPORT_FAILED", "File is not valid JSON", { original: e });
      }
      if (bo(s)) {
        const n = s;
        if (typeof n.workspaceSchemaVersion != "string")
          throw new k("EZ_IMPORT_FAILED", "Backup is missing workspaceSchemaVersion", { original: s });
        return { format: t, result: { kind: "backup", backup: n } };
      }
      if (yo(s)) {
        const n = s;
        if (n.schemaVersion !== P)
          throw new k("EZ_IMPORT_FAILED", `Document schema "${n.schemaVersion}" is not supported`, { original: s });
        const i = jt(n, Qt());
        return { format: t, result: { kind: "document", document: i } };
      }
      throw new k("EZ_IMPORT_FAILED", "JSON is not an Ezynota document or workspace backup", { original: s });
    }
    case "md":
      return { format: t, result: { kind: "blocks", blocks: ro(e), suggestedTitle: oe(o.name) } };
    case "html":
      return { format: t, result: { kind: "blocks", blocks: js(e), suggestedTitle: oe(o.name) } };
    case "txt":
      return { format: t, result: { kind: "blocks", blocks: Us(e), suggestedTitle: oe(o.name) } };
  }
}
function mo(o, t) {
  const e = Date.now();
  return {
    schemaVersion: P,
    blocks: o.map((s) => ({ ...s, id: Qt()() })),
    createdAt: e,
    updatedAt: e,
    meta: t ? { title: t } : void 0
  };
}
function oe(o) {
  return o.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}
function bo(o) {
  return typeof o == "object" && o !== null && !Array.isArray(o) && "workspaceSchemaVersion" in o && Array.isArray(o.notes);
}
function yo(o) {
  return typeof o == "object" && o !== null && !Array.isArray(o) && typeof o.schemaVersion == "string" && Array.isArray(o.blocks);
}
function ko(o) {
  var a;
  const t = window.open("", "_blank");
  if (!t) return;
  const e = t.document, s = String(((a = o.meta) == null ? void 0 : a.title) ?? "Ezynota document");
  e.title = s;
  const n = e.createElement("style");
  n.textContent = `
    body { font-family: Georgia, "Times New Roman", serif; color: #111; max-width: 720px; margin: 40px auto; line-height: 1.6; }
    h1, h2, h3, h4 { line-height: 1.25; }
    blockquote { border-inline-start: 3px solid #888; margin-inline: 0; padding-inline-start: 16px; color: #444; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 6px 10px; text-align: start; }
    img { max-width: 100%; }
    .ez-md-callout { border: 1px solid #bbb; border-inline-start: 4px solid #ec4899; padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
    .ez-md-task { list-style: none; margin-inline-start: -1.4em; }
  `, e.head.appendChild(n);
  const i = e.createElement("h1");
  i.textContent = s, e.body.appendChild(i);
  const r = e.createElement("div");
  vo(r, Pe(o.blocks)), e.body.appendChild(r), t.focus(), t.print();
}
function vo(o, t) {
  const e = new DOMParser().parseFromString(t, "text/html");
  for (const s of Array.from(e.body.querySelectorAll("*"))) {
    const n = s.tagName;
    if (n === "SCRIPT" || n === "STYLE" || n === "IFRAME" || n === "OBJECT" || n === "EMBED" || n === "LINK" || n === "META" || n === "FORM") {
      s.remove();
      continue;
    }
    if (n === "IMG") {
      const i = s.getAttribute("src") ?? "";
      if (!(Z(i) || i.startsWith("asset:"))) {
        s.remove();
        continue;
      }
    }
    if (n === "A") {
      const i = s.getAttribute("href") ?? "";
      !G(i) && !i.startsWith("note:") && s.removeAttribute("href");
    }
    for (const i of Array.from(s.attributes)) {
      const r = i.name.toLowerCase();
      if (/^on/i.test(r) || r === "style" || r === "formaction" || r === "xlink:href") {
        s.removeAttribute(i.name);
        continue;
      }
      n !== "IMG" && /^\s*(?:data|javascript|vbscript):/i.test(i.value) && s.removeAttribute(i.name);
    }
  }
  for (const s of Array.from(e.body.childNodes))
    o.appendChild(o.ownerDocument.importNode(s, !0));
}
class wo {
  constructor(t, e) {
    this.popover = null, this.query = "", this.range = null, this.blockId = "", this.disposers = [], this.items = [], this.focusedIndex = 0, this.surface = t, this.deps = e;
    const s = (r) => {
      const a = r;
      a.isComposing || this.popover && this.handleKey(a);
    }, n = (r) => {
      r.isComposing || this.checkCaret();
    };
    this.surface.addEventListener("keydown", s, !0), this.surface.addEventListener("input", n, !0);
    const i = (r) => {
      var c, d, u;
      const a = (d = (c = r.target) == null ? void 0 : c.closest) == null ? void 0 : d.call(c, "a[href^='note:']");
      if (!a) return;
      const l = a.getAttribute("data-ezn-note") ?? ((u = a.getAttribute("href")) == null ? void 0 : u.slice(5));
      !l || !this.deps.openNote || (r.preventDefault(), this.deps.openNote(l));
    };
    this.surface.addEventListener("click", i, !0), this.disposers.push(
      () => this.surface.removeEventListener("keydown", s, !0),
      () => this.surface.removeEventListener("input", n, !0),
      () => this.surface.removeEventListener("click", i, !0)
    );
  }
  destroy() {
    for (const t of this.disposers) t();
    this.disposers.length = 0, this.closePopover();
  }
  checkCaret() {
    var a, l, c;
    const t = window.getSelection();
    if (!t || t.rangeCount === 0 || !t.isCollapsed) {
      this.closePopover();
      return;
    }
    const e = t.getRangeAt(0), s = (l = e.startContainer instanceof Element ? e.startContainer : (a = e.startContainer) == null ? void 0 : a.parentElement) == null ? void 0 : l.closest("[data-ez-editable]");
    if (!s || !this.surface.contains(s)) {
      this.closePopover();
      return;
    }
    const n = s.ownerDocument.createRange();
    n.selectNodeContents(s);
    try {
      n.setEnd(e.startContainer, e.startOffset);
    } catch {
      this.closePopover();
      return;
    }
    const i = n.toString(), r = /\[\[([^\][]*)$/.exec(i);
    if (!r) {
      this.closePopover();
      return;
    }
    this.query = r[1] ?? "", this.range = e.cloneRange(), this.blockId = ((c = s.closest("[data-ez-block-id]")) == null ? void 0 : c.getAttribute("data-ez-block-id")) ?? "", this.openPopover();
  }
  handleKey(t) {
    if (this.popover)
      switch (t.key) {
        case "ArrowDown":
          this.focusedIndex = (this.focusedIndex + 1) % this.items.length, this.highlightFocused(), t.preventDefault(), t.stopPropagation();
          break;
        case "ArrowUp":
          this.focusedIndex = (this.focusedIndex - 1 + this.items.length) % this.items.length, this.highlightFocused(), t.preventDefault(), t.stopPropagation();
          break;
        case "Enter":
          t.preventDefault(), t.stopPropagation(), this.items[this.focusedIndex] && this.accept(this.items[this.focusedIndex]);
          break;
        case "Escape":
          t.preventDefault(), t.stopPropagation(), this.closePopover();
          break;
      }
  }
  openPopover() {
    var n, i;
    const t = ((i = (n = this.deps).getActiveNoteId) == null ? void 0 : i.call(n)) ?? this.blockId, e = this.deps.listNotes().filter((r) => r.id !== t), s = this.query.toLowerCase();
    if (this.items = (s ? e.filter((r) => r.title.toLowerCase().includes(s)) : e).slice(0, 8), this.focusedIndex = 0, !this.popover) {
      this.popover = p("div", "ez-popover ez-note-suggest"), this.popover.setAttribute("role", "listbox"), this.popover.setAttribute("aria-label", "Link to note"), this.popover.setAttribute("data-ez-ui", "true");
      const r = (l) => {
        this.popover && !this.popover.contains(l.target) && this.closePopover();
      };
      document.addEventListener("mousedown", r, !0), this.disposers.push(() => document.removeEventListener("mousedown", r, !0));
      const a = () => this.closePopover();
      this.surface.addEventListener("ez-close-popovers", a), this.disposers.push(() => this.surface.removeEventListener("ez-close-popovers", a)), this.surface.appendChild(this.popover);
    }
    for (const r of Array.from(this.popover.childNodes))
      this.popover.removeChild(r);
    if (this.items.length === 0) {
      this.popover.appendChild(p("div", "ez-menu-empty", "No notes to link"));
      return;
    }
    this.items.forEach((r) => {
      var l;
      const a = p("button", "ez-menu-item");
      a.type = "button", a.setAttribute("role", "option"), a.textContent = r.title || "Untitled", a.addEventListener("click", () => this.accept(r)), (l = this.popover) == null || l.appendChild(a);
    }), this.highlightFocused(), this.range && _(this.popover, this.range.getBoundingClientRect());
  }
  highlightFocused() {
    if (!this.popover) return;
    Array.from(this.popover.querySelectorAll(".ez-menu-item")).forEach((e, s) => e.classList.toggle("ez-focused", s === this.focusedIndex));
  }
  closePopover() {
    var t;
    (t = this.popover) == null || t.remove(), this.popover = null, this.range = null, this.query = "";
  }
  accept(t) {
    var a;
    if (!this.range) return;
    const e = this.range;
    this.closePopover();
    const s = (a = e.startContainer.parentElement) == null ? void 0 : a.closest("[data-ez-editable]"), n = this.findTokenStart(e, s);
    if (n >= 0)
      try {
        const c = (e.startContainer.ownerDocument ?? document).createRange();
        c.setStart(e.startContainer, Math.max(0, n)), c.setEnd(e.startContainer, e.startOffset), c.deleteContents();
      } catch {
      }
    const i = ((s == null ? void 0 : s.ownerDocument) ?? document).createElement("a");
    i.setAttribute("href", `note:${t.id}`), i.setAttribute("data-ezn-note", t.id), i.setAttribute("rel", "noopener noreferrer"), i.textContent = t.title || "Untitled", e.insertNode(i);
    const r = window.getSelection();
    if (r) {
      const l = (i.ownerDocument ?? document).createRange();
      l.setStartAfter(i), l.collapse(!0), r.removeAllRanges(), r.addRange(l);
    }
    s == null || s.dispatchEvent(new Event("input", { bubbles: !0 }));
  }
  /** Character offset of the "[[" token start within the caret text node. */
  findTokenStart(t, e) {
    if (!e || t.startContainer.nodeType !== Node.TEXT_NODE) return -1;
    const i = (t.startContainer.nodeValue ?? "").slice(0, t.startOffset).lastIndexOf("[[");
    return i >= 0 ? i : -1;
  }
}
class Eo {
  constructor(t, e, s) {
    this.ui = null, this.suggester = null, this.histories = /* @__PURE__ */ new Map(), this.disposers = [], this.destroyed = !1, this.themeMedia = null, this.fullscreenOn = !1, this.fullscreenPending = !1, this.lastFocus = null, this.switching = !1, this.depsBridge = null, this.loadGeneration = 0, this.onFullscreenChange = () => {
      var c, d, u, h;
      if (this.destroyed) return;
      const l = this.surface.ownerDocument.fullscreenElement === this.surface;
      l !== this.fullscreenOn && (this.fullscreenOn = l, (c = this.ui) == null || c.setFullscreen(l), l ? this.host.announce("Fullscreen enabled. Press Escape to exit.") : (this.surface.ownerDocument.fullscreenElement || (d = this.lastFocus) == null || d.focus(), this.lastFocus = null), (h = (u = this.options).onEvent) == null || h.call(u, { type: "fullscreen", on: l }));
    }, this.findEngine = null, this.host = t, this.surface = e, this.options = s, this.theme = s.theme ?? "system";
    const n = s.storage ? typeof s.storage == "function" ? s.storage() : s.storage : new Nr(), i = s.explicitWorkspaceId ?? Or(s.targetId);
    this.state = new Fr({ workspaceId: i, storage: n, generateId: Cs }), this.disposers.push(
      t.on("change", (l) => {
        var c;
        (c = this.ui) == null || c.refreshHistory(), !this.switching && l.origin !== "migration" && this.persistActiveNote();
      }),
      t.on("history:changed", () => {
        var l;
        return (l = this.ui) == null ? void 0 : l.refreshHistory();
      }),
      t.on("readOnly:changed", () => {
        var l;
        return (l = this.ui) == null ? void 0 : l.refreshHistory();
      }),
      t.on("ready", () => {
        var l;
        return (l = this.ui) == null ? void 0 : l.refreshHistory();
      })
    );
    const r = this.buildDeps();
    this.depsBridge = r, this.ui = new Qr(e, this.state, r, s.showSidebar !== !1), e.ownerDocument.addEventListener("fullscreenchange", this.onFullscreenChange), this.suggester = new wo(e, {
      listNotes: () => this.state.listNotes().map((l) => ({ id: l.id, title: l.title })),
      openNote: (l) => {
        var c;
        return ((c = this.depsBridge) == null ? void 0 : c.openNote(l)) ?? void this.loadNoteIntoEditor(l);
      },
      getActiveNoteId: () => this.state.activeNoteId
    });
    const a = t.target ?? e;
    this.disposers.push(Cr(this.storeFile.bind(this), a)), this.disposers.push(zr((l) => this.state.loadAsset(l), a)), this.disposers.push(
      this.state.on((l) => {
        var c;
        (c = s.onEvent) == null || c.call(s, l);
      })
    );
  }
  /** Store a file as a workspace asset; resolves to `asset:<id>`. */
  async storeFile(t) {
    try {
      const e = new Uint8Array(await t.arrayBuffer()), s = { id: Cs(), mime: t.type, name: t.name, bytes: e, createdAt: Date.now() };
      return await this.state.saveAsset(s) ? `asset:${s.id}` : null;
    } catch {
      return null;
    }
  }
  /** Load stored notes and open the first one. Resolves when the workspace is usable. */
  async start() {
    var s, n, i;
    try {
      await this.state.load();
    } catch (r) {
      throw (s = this.ui) == null || s.mount(), (n = this.ui) == null || n.showLoadError(), r;
    }
    if (this.destroyed) return;
    (i = this.ui) == null || i.mount();
    const t = this.options.initialData ?? null;
    let e = this.state.activeNoteId;
    if (t)
      e = this.state.createNote(this.noteTitleOf(t) || "Imported note", null, rt(t)).id;
    else if (e === null) {
      const r = this.state.listNotes()[0];
      r ? e = r.id : e = this.state.createNote("Untitled", null).id;
    }
    e && await this.loadNoteIntoEditor(e, !1);
  }
  destroy() {
    var t, e;
    this.destroyed = !0;
    for (const s of this.disposers) s();
    this.disposers.length = 0, (t = this.ui) == null || t.destroy(), (e = this.suggester) == null || e.destroy(), this.removeFullscreenListeners(), this.state.destroy();
  }
  /* =================== note sessions =================== */
  persistActiveNote() {
    const t = this.state.activeNoteId;
    if (!t) return;
    const e = this.host.getSnapshot(), s = this.noteTitleOf(e);
    this.state.updateNoteDocument(t, rt(e), s);
  }
  /** Serialize writes: one async save at a time, then autosave on idle. */
  async saveActiveNote() {
    this.persistActiveNote(), await this.state.flush();
  }
  async loadNoteIntoEditor(t, e = !0) {
    var i, r;
    const s = this.state.getNote(t);
    if (!s) return;
    const n = ++this.loadGeneration;
    this.switching = !0, (i = this.ui) == null || i.refreshHistory();
    try {
      const a = this.state.activeNoteId;
      if (a && (this.persistActiveNote(), this.histories.set(a, this.host.exportHistoryState())), await this.host.render(rt(s.document)), n !== this.loadGeneration) return;
      const l = this.histories.get(t);
      l && this.host.importHistoryState(l), this.state.activeNoteId = t, s.folderId && (this.state.activeFolderId = s.folderId), e && this.host.focus({ at: "start" }), this.emit({ type: "activeNote:changed", noteId: t });
    } finally {
      n === this.loadGeneration && (this.switching = !1, (r = this.ui) == null || r.refreshHistory());
    }
  }
  noteTitleOf(t) {
    const e = t.meta ?? {}, s = typeof e.title == "string" ? e.title : "";
    if (s) return s;
    const n = t.blocks.find((i) => i.type === "heading");
    if (n) {
      const r = (n.data.content ?? []).map((a) => a.text ?? "").join("").trim();
      if (r) return r;
    }
    return "";
  }
  /* =================== editor-bridge helpers =================== */
  emit(t) {
    var e;
    (e = this.ui) == null || e.notifyEvent(t);
  }
  /* =================== fullscreen =================== */
  async toggleFullscreen(t) {
    var i, r;
    if (this.destroyed || this.fullscreenPending) return;
    const e = this.surface.ownerDocument, s = e.fullscreenElement === this.surface, n = t ?? !s;
    if (n !== s) {
      this.fullscreenPending = !0;
      try {
        if (n) {
          if (!this.surface.requestFullscreen) {
            (i = this.ui) == null || i.showNotice("Fullscreen is unavailable in this browser.");
            return;
          }
          if (this.lastFocus = e.activeElement instanceof HTMLElement ? e.activeElement : null, await this.surface.requestFullscreen(), this.destroyed) {
            e.fullscreenElement === this.surface && await e.exitFullscreen();
            return;
          }
        } else
          await e.exitFullscreen();
        this.onFullscreenChange();
      } catch {
        this.destroyed || (r = this.ui) == null || r.showNotice("Unable to change fullscreen. Check your browser's fullscreen permissions and try again.");
      } finally {
        this.fullscreenPending = !1;
      }
    }
  }
  isFullscreen() {
    return this.fullscreenOn;
  }
  removeFullscreenListeners() {
    var e;
    const t = this.surface.ownerDocument;
    t.removeEventListener("fullscreenchange", this.onFullscreenChange), t.fullscreenElement === this.surface && t.exitFullscreen().catch(() => {
    }), this.fullscreenOn = !1, this.lastFocus = null, (e = this.ui) == null || e.setFullscreen(!1);
  }
  /* =================== theme =================== */
  setTheme(t) {
    var e;
    if (this.theme = t, (e = this.ui) == null || e.applyTheme(t), t === "system" && this.themeMedia === null && typeof matchMedia < "u") {
      this.themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      const s = () => {
        var n;
        return (n = this.ui) == null ? void 0 : n.applyTheme("system");
      };
      try {
        this.themeMedia.addEventListener("change", s), this.disposers.push(() => {
          var n;
          return (n = this.themeMedia) == null ? void 0 : n.removeEventListener("change", s);
        });
      } catch {
      }
    }
  }
  getTheme() {
    return this.theme;
  }
  resolvedTheme() {
    return Ks(this.theme);
  }
  /* =================== deps for the UI =================== */
  buildDeps() {
    return {
      undo: () => {
        this.host.readOnly || this.switching || !this.host.canUndo() || (this.host.undo(), this.persistActiveNote());
      },
      redo: () => {
        this.host.readOnly || this.switching || !this.host.canRedo() || (this.host.redo(), this.persistActiveNote());
      },
      getHistoryState: () => ({
        canUndo: !this.host.readOnly && !this.switching && this.host.canUndo(),
        canRedo: !this.host.readOnly && !this.switching && this.host.canRedo()
      }),
      createNote: (t, e) => {
        const s = this.state.createNote(t ?? "Untitled", e ?? null);
        return this.loadNoteIntoEditor(s.id), s.id;
      },
      createFolder: (t, e) => {
        const s = this.state.createFolder(t ?? "New folder", e ?? null);
        return this.state.activeFolderId = s.id, s.id;
      },
      renameNote: (t, e) => {
        this.state.activeNoteId === t ? (this.host.setDocumentTitle(e), this.persistActiveNote()) : this.state.renameNote(t, e);
      },
      renameWorkspace: (t) => this.state.renameWorkspace(t),
      duplicateNote: (t) => {
        const e = this.state.duplicateNote(t);
        e && this.loadNoteIntoEditor(e.id);
      },
      trashNote: (t) => {
        if (this.state.trashNote(t), this.state.activeNoteId === null) {
          const e = this.state.listNotes()[0];
          if (e) this.loadNoteIntoEditor(e.id);
          else {
            const s = this.state.createNote("Untitled", null);
            this.loadNoteIntoEditor(s.id);
          }
        }
      },
      trashFolder: (t) => this.state.trashFolder(t),
      restoreNote: (t) => this.state.restoreNote(t),
      deleteNoteForever: (t) => this.state.deleteNoteForever(t),
      restoreFolder: (t) => this.state.restoreFolder(t),
      deleteFolderForever: (t) => this.state.deleteFolderForever(t),
      emptyTrash: () => this.state.emptyTrash(),
      retrySave: () => this.state.retrySave(),
      renameFolder: (t, e) => this.state.renameFolder(t, e),
      moveNote: (t, e) => this.state.moveNote(t, e),
      moveFolder: (t, e) => this.state.moveFolder(t, e),
      openNote: (t) => {
        if (t !== this.state.activeNoteId)
          return this.loadNoteIntoEditor(t);
      },
      openFolder: (t) => {
        var e;
        this.state.activeFolderId = t, t && ((e = this.ui) == null || e.highlightFolder(t)), this.emit({ type: "activeFolder:changed", folderId: t });
      },
      searchWorkspace: (t) => this.state.search(t),
      exportActiveNote: (t) => {
        this.exportActiveNote(t);
      },
      printActiveNote: () => {
        const t = this.host.getSnapshot();
        ko(rt(t));
      },
      importFiles: (t) => {
        this.importFiles(t);
      },
      createBackup: () => {
        this.createBackup();
      },
      restoreBackupFile: (t) => {
        this.restoreBackupFile(t);
      },
      setTheme: (t) => this.setTheme(t),
      toggleFullscreen: () => this.toggleFullscreen(),
      retryLoad: () => {
        this.retryLoad();
      },
      downloadOriginal: () => this.downloadStoredData(),
      findInDocument: (t, e, s, n) => {
        t && this.findInDocument(t, e, s, n);
      },
      goToBlock: (t) => {
        this.host.focusBlock(t, "start");
      },
      getWordCount: () => this.wordCount(),
      getLegacyDraft: () => this.legacyDraft(),
      importLegacyDraft: (t) => {
        this.importLegacyDraft(t);
      },
      dismissLegacyDraft: () => {
        try {
          localStorage.setItem("ezynota:legacy-draft-dismissed", "1");
        } catch {
        }
      }
    };
  }
  /* =================== public API used by deps + editor.workspace =================== */
  getActiveNoteId() {
    return this.state.activeNoteId;
  }
  async openNoteById(t) {
    await this.loadNoteIntoEditor(t);
  }
  async exportActiveNote(t) {
    const e = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null, s = this.host.getSnapshot(), n = (e == null ? void 0 : e.title) || this.noteTitleOf(s) || "note", i = await uo(
      rt(s),
      t,
      (l) => this.state.loadAsset(l)
    ), r = t === "json" ? "application/json" : t === "md" ? "text/markdown" : t === "html" ? "text/html" : "text/plain", a = t === "json" ? "json" : t === "md" ? "md" : t === "html" ? "html" : "txt";
    Ot(`${fo(n, "note")}.${a}`, i, r);
  }
  async importFiles(t) {
    for (const e of t)
      try {
        const s = await go(e);
        if (s.result.kind === "backup") {
          await this.restoreBackup(s.result.backup);
          continue;
        }
        if (s.result.kind === "document") {
          const r = s.result.document, a = this.state.createNote(this.noteTitleOf(r) || "Imported note", this.state.activeFolderId, r);
          await this.loadNoteIntoEditor(a.id);
          continue;
        }
        const n = mo(s.result.blocks, s.result.suggestedTitle), i = this.state.createNote(s.result.suggestedTitle ?? "Imported note", this.state.activeFolderId, n);
        await this.loadNoteIntoEditor(i.id);
      } catch (s) {
        this.reportImportError(s);
      }
  }
  reportImportError(t) {
    const e = t instanceof Error ? t.message : "Import failed";
    this.reportRuntimeError(e, t);
  }
  /** Report a runtime failure to the UI banner and the host event listener. */
  reportRuntimeError(t, e) {
    var n, i, r;
    const s = { type: "importError", message: t, cause: e };
    (n = this.ui) == null || n.notifyEvent(s), (r = (i = this.options).onEvent) == null || r.call(i, s);
  }
  async createBackup() {
    try {
      await this.saveActiveNote();
      const t = await this.state.createBackup(), e = jr(t);
      Ot(`ezynota-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, JSON.stringify(e, null, 2), "application/json");
    } catch (t) {
      this.reportRuntimeError("Could not create the workspace backup.", t);
    }
  }
  async restoreBackupFile(t) {
    let e = "";
    try {
      e = await t.text();
      const s = JSON.parse(e);
      await this.restoreBackup(s);
    } catch (s) {
      if (s instanceof SyntaxError) {
        Ot("malformed-backup.json", e, "application/json"), this.reportRuntimeError("Backup file is not valid JSON; the original was downloaded for recovery", s);
        return;
      }
      this.reportRuntimeError("Could not restore the workspace backup.", s);
    }
  }
  /** Restore a workspace backup under a new workspace ID by default. */
  async restoreBackup(t) {
    await this.saveActiveNote(), this.histories.clear();
    const e = await this.state.restoreBackup(t, { newWorkspaceId: !0 }), s = this.state.listNotes()[0];
    return s ? await this.loadNoteIntoEditor(s.id, !1) : await this.host.render({ schemaVersion: "1.0.0", blocks: [] }), e;
  }
  async retryLoad() {
    try {
      await this.state.retryLoad();
    } catch (e) {
      this.reportRuntimeError("The workspace still could not be loaded.", e);
      return;
    }
    const t = this.state.listNotes()[0];
    t && await this.loadNoteIntoEditor(t.id, !1);
  }
  /** Recovery download: retain the last known stored payload. */
  downloadStoredData() {
    const t = this.state.getUnsavedSnapshot();
    t && Ot("ezynota-stored-workspace.json", JSON.stringify(t, null, 2), "application/json");
  }
  async findInDocument(t, e, s, n = 0) {
    var i;
    (i = this.findEngine) == null || i.call(this, t, e, s, n);
  }
  wordCount() {
    const t = Ao(this.host.getSnapshot().blocks);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }
  legacyDraft() {
    try {
      return localStorage.getItem("ezynota:legacy-draft-dismissed") ? null : localStorage.getItem("ezynota:draft:v1");
    } catch {
      return null;
    }
  }
  async importLegacyDraft(t) {
    try {
      const e = JSON.parse(t);
      if (!e || !Array.isArray(e.blocks)) return;
      const s = this.state.createNote("Imported draft", null, e);
      await this.loadNoteIntoEditor(s.id);
    } catch {
    }
  }
  /** Search across titles and text (public API). */
  search(t) {
    return this.state.search(t);
  }
  /** Notes linking to the given note. */
  backlinks(t) {
    return this.state.backlinks(t);
  }
  /** Read-only projection of workspace notes (public API). */
  listNotes(t = !1) {
    return this.state.listNotes(t);
  }
  listFolders(t = !1) {
    return this.state.listFolders(t);
  }
  /** Resolve the active note document into a portable HTML string. */
  async activeNoteHtml() {
    return Pe(this.host.getSnapshot().blocks);
  }
  /** Resolve assets to data URLs for external consumers. */
  async portableSnapshot() {
    await this.saveActiveNote();
    const t = this.host.getSnapshot();
    return Js(rt(t), (e) => this.state.loadAsset(e));
  }
  get generatorVersion() {
    return Xt;
  }
}
function Ao(o) {
  let t = "";
  const e = (s) => {
    for (const n of s) {
      const i = n.data.content;
      Array.isArray(i) && (t += `${i.map((r) => r.text ?? "").join("")}
`), n.type === "code" && (t += `${String(n.data.code ?? "")}
`), Array.isArray(n.children) && e(n.children);
    }
  };
  return e(o), t;
}
function rt(o) {
  return JSON.parse(JSON.stringify(o));
}
function Cs() {
  return Qt()();
}
const _e = /* @__PURE__ */ new Set();
function So(o) {
  _e.add(o);
}
function xo(o) {
  _e.delete(o);
}
function Zt() {
  return Array.from(_e);
}
const Gt = "data-ezn-mounted", He = "data-ezn-destroyed", Io = /* @__PURE__ */ new Set(["workspace", "document", "embedded", "headless"]), Co = /* @__PURE__ */ new Set(["light", "dark", "system"]);
let Ft = null, zs = !1, ae = null;
function zo(o) {
  const t = { target: o }, e = o.getAttribute("data-ezn-mode");
  e && Io.has(e) && (t.mode = e);
  const s = o.getAttribute("data-ezn-workspace");
  s && s.trim() !== "" && (t.workspace = s.trim());
  const n = o.getAttribute("data-ezn-theme");
  n && Co.has(n) && (t.theme = n);
  const i = o.getAttribute("data-ezn-readonly");
  i === "true" ? t.readOnly = !0 : i === "false" && (t.readOnly = !1);
  const r = o.getAttribute("data-ezn-placeholder");
  return r && r.trim() !== "" && (t.placeholder = r), o.getAttribute("data-ezn-autofocus") === "true" && (t.autofocus = !0), t;
}
function Bo(o) {
  if (o.hasAttribute(Gt) || o.hasAttribute(He)) return;
  const t = Zt().find((n) => n.targetEl === o);
  if (t) return t;
  const e = zo(o), s = new Mo(e);
  return s.declarative = !0, o.setAttribute(Gt, ""), s;
}
function Xs(o) {
  try {
    return Bo(o);
  } catch (t) {
    To(o, t);
    return;
  }
}
function To(o, t) {
  const e = t instanceof Error ? t.message : String(t);
  console.error(`[ezynota] Failed to mount [data-ezn-editor] element: ${e}`, t);
  try {
    const s = { payload: { message: e } };
    o.dispatchEvent(new CustomEvent("ezn:error", { bubbles: !0, composed: !0, detail: s }));
  } catch {
  }
}
function je(o) {
  Do();
  const t = o ?? document, e = [];
  for (const s of Array.from(t.querySelectorAll("[data-ezn-editor]"))) {
    const n = Xs(s);
    n && e.push(n);
  }
  return e;
}
function _o() {
  typeof document > "u" || je();
}
function Lo(o) {
  const t = typeof o == "string" ? document.querySelector(o) : o;
  if (!t) return;
  const e = Zt().find((s) => s.targetEl === t);
  if (e) return e;
  if (t instanceof Element) {
    for (const s of Zt())
      if (s.target.contains(t)) return s;
  }
}
function Do() {
  if (!(zs || typeof MutationObserver > "u") && (zs = !0, Ft = new MutationObserver((o) => {
    const t = [];
    for (const e of o)
      for (const s of Array.from(e.addedNodes))
        if (s instanceof HTMLElement) {
          s.matches("[data-ezn-editor]") && t.push(s);
          for (const n of Array.from(s.querySelectorAll("[data-ezn-editor]"))) t.push(n);
        }
    for (const e of t)
      !e.hasAttribute(Gt) && !e.hasAttribute(He) && Xs(e);
    No();
  }), !(typeof document > "u"))) {
    if (document.readyState === "loading" || !document.body) {
      document.addEventListener("DOMContentLoaded", () => {
        Ft && document.body && Ft.observe(document.body, { childList: !0, subtree: !0 }), je();
      });
      return;
    }
    Ft.observe(document.body, { childList: !0, subtree: !0 });
  }
}
function No() {
  ae === null && (ae = setTimeout(() => {
    ae = null;
    for (const o of Array.from(Zt())) {
      if (!o.declarative || o.isDestroyed()) continue;
      const t = o.targetEl;
      t.isConnected || setTimeout(() => {
        t.isConnected || o.isDestroyed() || (o.destroy(), t.removeAttribute(Gt), t.removeAttribute(He));
      }, 100);
    }
  }, 200));
}
class Mo {
  constructor(t) {
    var s;
    if (this.ready = Promise.resolve(), this.bus = new tn(), this.commands = new In(), this.registry = new Cn(), this.migrations = new Dn(), this.dragManager = null, this.blockToolbar = null, this.inlineToolbar = null, this.documentToolbar = null, this.slashMenu = null, this.announcerEl = null, this.destroyed = !1, this.disposers = [], this.recoveryMode = !1, this.originalDocument = null, this.recoveryLocked = !1, this.preRecoveryReadOnly = !1, this.blockSaveVersions = /* @__PURE__ */ new Map(), this.workspaceController = null, this.editingLocked = !1, this.themeListenerDisposer = null, this.declarative = !1, this.findReplaceEngine = null, typeof document > "u")
      throw new k("EZ_RENDER_FAILED", "Ezynota requires a DOM environment (SSR-safe: construct inside useEffect/onMounted)");
    if (this.config = t, this.mode = Fo(t), this.targetEl = this.resolveTarget(t.target), this.i18nInstance = new Mn(t.locale ?? "en", ((s = t.i18n) == null ? void 0 : s.messages) ?? {}), this.defaultBlockName = t.defaultBlock ?? "paragraph", this.registerBuiltinTools(), this.registerUserTools(t), !this.registry.has(this.defaultBlockName))
      throw tt(this.defaultBlockName);
    const e = this.mode === "workspace" || this.mode === "document" ? null : t.data;
    this.state = this.createState(this.migrateInitialData(e)), this.recoveryMode && this.latchRecoveryReadOnly(), this.tm = new yn(this.state, (n) => this.handleCommit(n)), this.blockManager = new wn(this.tm, M(t.idGenerator), { onBatch: () => {
    } }), this.history = new Sn(this.tm, {
      onRestoreSelection: (n) => this.restoreHistorySelection(n)
    }), this.registerBuiltinCommands(), this.setupDom(), this.renderer = new sr(this, this.surfaceEl), this.renderer.renderAll(this.state.get().blocks), this.config.readOnly && this.renderer.setReadOnly(!0), this.wireFindReplace(), this.setupMarkdownShortcuts(), this.selectionManager = new ir(this, this.surfaceEl), this.selectionManager.start(), this.inputManager = new or(this, this.surfaceEl), this.inputManager.start(), this.keyboardManager = new dr(this, this.surfaceEl), this.keyboardManager.start(), this.clipboardManager = new kr(this, this.surfaceEl), this.clipboardManager.start(), this.uiEnabled() && !t.readOnly && (this.dragManager = new fs(this, this.surfaceEl), this.dragManager.start()), this.setupDefaultUi(), this.wireEvents(), this.renderer.startObserver((n) => {
      this.inputManager.wasInputRecently(n) || this.requestSaveBlock(n, "user");
    }), So(this), this.mode === "workspace" || this.mode === "document" ? (this.editingLocked = !0, this.targetEl.classList.add("ez-loading"), this.initializeWorkspace()) : (this.ready = new Promise((n) => {
      this.resolveReady = n;
    }), this.resolveReady(), this.bus.emit("ready"), this.emitDomEvent("ezn:ready"), this.fireReady(), t.autofocus && !t.readOnly && queueMicrotask(() => this.focus({ at: "end" })));
  }
  /** Run the consumer onReady callback without letting it break the boot. */
  fireReady() {
    var t, e;
    try {
      (e = (t = this.config).onReady) == null || e.call(t, this);
    } catch (s) {
      this.bus.emit("error", new k("EZ_UNKNOWN_ERROR", "An onReady handler threw", void 0, s));
    }
  }
  /** Map workspace lifecycle events onto the public event bus. */
  onWorkspaceEvent(t) {
    if (!this.destroyed)
      switch (t.type) {
        case "loaded":
          this.bus.emit("workspace:changed", { kind: "loaded" });
          break;
        case "loadFailed":
          this.bus.emit("workspace:changed", { kind: "loadFailed", detail: t.error });
          break;
        case "notes:changed":
          this.bus.emit("workspace:changed", { kind: "notes" });
          break;
        case "folders:changed":
          this.bus.emit("workspace:changed", { kind: "folders" });
          break;
        case "trash:changed":
          this.bus.emit("workspace:changed", { kind: "trash" });
          break;
        case "activeNote:changed":
          this.bus.emit("workspace:changed", { kind: "activeNote", detail: t.noteId });
          break;
        case "activeFolder:changed":
          this.bus.emit("workspace:changed", { kind: "activeFolder", detail: t.folderId });
          break;
        case "saveStatus":
          this.bus.emit("workspace:changed", { kind: "saveStatus", detail: t.status });
          break;
        case "remoteChange":
          this.bus.emit("workspace:changed", { kind: "remoteChange" });
          break;
        case "noteRenamed":
          this.bus.emit("workspace:changed", { kind: "noteRenamed", detail: t.noteId });
          break;
        case "fullscreen":
          this.bus.emit("fullscreen:changed", t.on);
          break;
      }
  }
  /** Async workspace boot: load notes, then unlock editing and fire ready. */
  initializeWorkspace() {
    const t = this.targetEl.id || null;
    this.workspaceController = new Eo(
      this,
      this.targetEl,
      {
        targetId: t,
        explicitWorkspaceId: this.config.workspace,
        storage: this.config.storage,
        theme: this.config.theme,
        initialData: this.config.data ?? null,
        showSidebar: this.mode === "workspace",
        onEvent: (e) => this.onWorkspaceEvent(e)
      }
    ), this.workspaceController.findEngine = (e, s, n, i) => {
      var r;
      return (r = this.findReplaceEngine) == null ? void 0 : r.call(this, e, s, n, i);
    }, this.ready = new Promise((e) => {
      this.resolveReady = e;
    }), this.workspaceController.start().catch((e) => {
      this.bus.emit(
        "error",
        e instanceof k ? e : new k("EZ_UNKNOWN_ERROR", "Workspace failed to load", void 0, e)
      );
    }).finally(() => {
      this.destroyed || (this.editingLocked = !1, this.renderer.renderAll(this.state.get().blocks), this.targetEl.classList.remove("ez-loading"), this.config.theme && this.applyTheme(this.config.theme), this.resolveReady(), this.bus.emit("ready"), this.emitDomEvent("ezn:ready"), this.fireReady(), this.config.autofocus && !this.config.readOnly && queueMicrotask(() => this.focus({ at: "end" })));
    });
  }
  /* ===================== Public API (spec §8) ===================== */
  /**
   * Mutations are rejected while the initial workspace load is still in
   * flight: anything committed before the note render would be silently
   * wiped by the document replacement. Await `editor.ready` first.
   */
  assertEditable() {
    if (this.editingLocked)
      throw new k(
        "EZ_EDITING_LOCKED",
        "Editing is locked until the initial workspace load completes; await editor.ready first"
      );
  }
  async save() {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    if (this.recoveryMode && this.originalDocument)
      return x(this.originalDocument);
    const t = [];
    let e = 0;
    for (const n of this.state.get().blocks) {
      const i = this.renderer.getTool(n.id);
      let r = n.data;
      if (i)
        try {
          if (r = await i.save(this.toolElement(n.id)), i.validate && !await i.validate(r)) {
            e++, this.bus.emit("error", new k("EZ_INVALID_DATA", `Block "${n.id}" produced invalid data`, { blockId: n.id, tool: n.type }));
            continue;
          }
        } catch (a) {
          throw new k("EZ_SAVE_FAILED", `Failed to save block "${n.id}"`, { blockId: n.id }, a);
        }
      t.push({ ...n, data: r });
    }
    if (e > 0)
      throw new k("EZ_INVALID_DATA", `Save rejected: ${e} block(s) produced invalid data`, { count: e });
    return { ...this.state.get(), blocks: t, updatedAt: Date.now(), schemaVersion: P, generator: { name: "ezynota", version: Xt } };
  }
  getSnapshot() {
    return this.state.snapshot();
  }
  /** True when an unsupported document is open in protected read-only mode. */
  isRecoveryMode() {
    return this.recoveryMode;
  }
  /** The untouched payload of a document that could not be migrated. */
  getOriginalDocument() {
    return this.originalDocument ? x(this.originalDocument) : null;
  }
  async render(t) {
    const e = this.migrateDocument(t);
    this.blockManagerReplaceAll(e), this.recoveryMode ? (this.latchRecoveryReadOnly(), this.targetEl.classList.add("ez-readonly"), this.renderer.setReadOnly(!0), this.closeMenus()) : this.clearRecoveryLock(), this.history.clear(), this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }
  /** Force readOnly for recovery mode, remembering the user's own setting. */
  latchRecoveryReadOnly() {
    this.recoveryLocked || (this.recoveryLocked = !0, this.preRecoveryReadOnly = this.config.readOnly === !0, this.config = { ...this.config, readOnly: !0 });
  }
  /** Undo a recovery read-only latch once a valid document is rendered. */
  clearRecoveryLock() {
    this.recoveryLocked && (this.recoveryLocked = !1, this.targetEl.classList.remove("ez-readonly"), this.config.readOnly !== this.preRecoveryReadOnly && this.setReadOnly(this.preRecoveryReadOnly));
  }
  clear() {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const t = this.state.get().blocks.slice();
    if (t.length === 0) return;
    const e = t.map((s) => ({ type: "block:remove", id: s.id, index: 0, block: s }));
    this.tm.commit("api", e);
  }
  focus(t) {
    if (this.destroyed || this.readOnly) return;
    const e = t == null ? void 0 : t.at, s = e === "default" ? void 0 : e;
    if (t != null && t.blockId) {
      this.focusBlock(t.blockId, s);
      return;
    }
    const n = this.state.get().blocks[0];
    if (n) {
      this.focusBlock(n.id, s);
      return;
    }
    this.insertBlock(this.defaultBlockName, void 0, { focus: !0 });
  }
  setReadOnly(t) {
    var e;
    this.config.readOnly !== t && (this.config = { ...this.config, readOnly: t }, this.surfaceEl.classList.toggle("ez-readonly", t), this.renderer.setReadOnly(t), t && this.closeMenus(), !t && this.uiEnabled() && !this.dragManager && (this.dragManager = new fs(this, this.surfaceEl), this.dragManager.start()), (e = this.documentToolbar) == null || e.refresh(), this.bus.emit("readOnly:changed", t));
  }
  insertBlock(t, e, s) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    if (this.assertEditable(), !this.registry.has(t)) throw tt(t);
    const n = (s == null ? void 0 : s.index) !== void 0 ? s.index : (s == null ? void 0 : s.before) !== void 0 ? Math.max(0, this.blockManager.getIndex(s.before)) : (s == null ? void 0 : s.after) !== void 0 ? this.blockManager.getIndex(s.after) + 1 : -1, i = this.blockManager.insert(t, e ?? Bs(t), "api", n);
    return (s == null ? void 0 : s.focus) !== !1 && !this.readOnly && queueMicrotask(() => this.focusBlock(i, "start")), i;
  }
  updateBlock(t, e) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable(), this.blockManager.update(t, e, "api");
  }
  removeBlock(t) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable(), this.blockManager.remove(t, "api");
  }
  moveBlock(t, e) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable(), this.blockManager.move(t, e, "api");
  }
  duplicateBlock(t) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    return this.assertEditable(), this.blockManager.duplicate(t, "api");
  }
  convertBlock(t, e) {
    var a, l;
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const s = this.blockManager.getById(t);
    if (!s) return;
    if (!this.registry.has(e)) throw tt(e);
    const n = this.registry.get(e), i = (l = (a = n == null ? void 0 : n.toolClass.conversion) == null ? void 0 : a.from) == null ? void 0 : l[s.type], r = i ? i(s.data) : ar(e, s.data);
    this.blockManager.convert(t, e, r, "api");
  }
  getBlockById(t) {
    return this.blockRef(t);
  }
  getBlocks() {
    return this.state.get().blocks.map((t) => this.blockRef(t.id)).filter(Boolean);
  }
  getBlockIndex(t) {
    return this.blockManager.getIndex(t);
  }
  undo() {
    this.history.undo(), this.refreshAfterHistory();
  }
  redo() {
    this.history.redo(), this.refreshAfterHistory();
  }
  refreshAfterHistory() {
    var t, e;
    if (this.selectionManager.refresh(), !this.getSelectionInfo() && this.surfaceEl.contains(document.activeElement) && !this.readOnly) {
      const s = this.blocks.blocks[0];
      s && this.focusBlock(s.id, "end");
    }
    (t = this.documentToolbar) == null || t.refresh(), (e = this.inlineToolbar) == null || e.refresh(), this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }
  canUndo() {
    return this.history.canUndo();
  }
  canRedo() {
    return this.history.canRedo();
  }
  on(t, e) {
    return this.bus.on(t, e);
  }
  /** Public actions go through commands — no event impersonation (spec §8.2). */
  dispatch(t, e) {
    this.commands.dispatch(t, e, this);
  }
  destroy() {
    var e;
    if (this.destroyed) return;
    this.destroyed = !0;
    try {
      (e = this.resolveReady) == null || e.call(this);
    } catch {
    }
    const t = (s) => {
      try {
        s();
      } catch (n) {
        this.bus.emit("error", new k("EZ_UNKNOWN_ERROR", "Cleanup failed during destroy", void 0, n));
      }
    };
    t(() => {
      var s;
      return (s = this.keyboardManager) == null ? void 0 : s.stop();
    }), t(() => {
      var s;
      return (s = this.inputManager) == null ? void 0 : s.stop();
    }), t(() => {
      var s;
      return (s = this.selectionManager) == null ? void 0 : s.stop();
    }), t(() => {
      var s;
      return (s = this.clipboardManager) == null ? void 0 : s.stop();
    }), t(() => {
      var s;
      return (s = this.dragManager) == null ? void 0 : s.stop();
    }), t(() => {
      var s;
      return (s = this.surfaceEl) == null ? void 0 : s.dispatchEvent(new Event("ez-close-popovers"));
    }), t(() => {
      var s;
      return (s = this.slashMenu) == null ? void 0 : s.destroy();
    }), t(() => {
      var s;
      return (s = this.blockToolbar) == null ? void 0 : s.destroy();
    }), t(() => {
      var s;
      return (s = this.inlineToolbar) == null ? void 0 : s.destroy();
    }), t(() => {
      var s;
      return (s = this.documentToolbar) == null ? void 0 : s.destroy();
    }), t(() => {
      var s;
      return (s = this.renderer) == null ? void 0 : s.destroy();
    }), t(() => {
      var s;
      return (s = this.workspaceController) == null ? void 0 : s.destroy();
    }), this.workspaceController = null, t(() => {
      var s;
      return (s = this.themeListenerDisposer) == null ? void 0 : s.call(this);
    }), this.themeListenerDisposer = null;
    for (const s of this.disposers) s();
    this.disposers.length = 0, this.blockSaveVersions.clear(), xo(this), this.declarative && this.targetEl.setAttribute("data-ezn-destroyed", ""), this.bus.emit("destroyed"), this.bus.destroy(), this.targetEl.classList.remove("ez-editor-mount", "ez-editor", "ez-readonly", "ez-has-block-toolbar", "ez-loading"), this.targetEl.removeAttribute("data-ezynota-root"), this.targetEl.removeAttribute("data-ez-mode"), this.targetEl.removeAttribute("data-ez-theme"), this.targetEl.innerHTML = "";
  }
  /* ===================== Host implementation ===================== */
  get target() {
    return this.surfaceEl;
  }
  /** Editing stays locked until the initial workspace load completes. */
  get readOnly() {
    return this.config.readOnly === !0 || this.editingLocked;
  }
  get i18n() {
    return this.i18nInstance;
  }
  get blocks() {
    return this.blockManager;
  }
  get defaultBlock() {
    return this.defaultBlockName;
  }
  get placeholder() {
    return this.config.placeholder ?? this.i18n.t("core.placeholder");
  }
  /** Resolved lifecycle mode. */
  getMode() {
    return this.mode;
  }
  /**
   * Workspace note management (workspace/document modes): note/folder CRUD,
   * navigation, search, trash, backup/restore, fullscreen and themes.
   */
  get workspace() {
    return this.workspaceController;
  }
  openBlockPicker(t, e = !1) {
    var n, i;
    if (this.readOnly) return;
    let s = t ?? ((n = this.getSelectionInfo()) == null ? void 0 : n.blockId) ?? ((i = this.blocks.blocks[this.blocks.length - 1]) == null ? void 0 : i.id);
    if (!this.slashMenu) {
      this.insertBlock(this.defaultBlock, void 0, { after: s, focus: !0 });
      return;
    }
    s || (s = this.insertBlock(this.defaultBlock, void 0, { focus: !1 })), this.slashMenu.open(s, e);
  }
  isDestroyed() {
    return this.destroyed;
  }
  getBlockData(t) {
    var e;
    return (e = this.blockManager.getById(t)) == null ? void 0 : e.data;
  }
  getBlockType(t) {
    var e;
    return (e = this.blockManager.getById(t)) == null ? void 0 : e.type;
  }
  updateBlockData(t, e, s = "api") {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable(), this.invalidatePendingSave(t), this.blockManager.update(t, e, s);
  }
  /** Commit raw changes as one transaction (used by typed internal modules). */
  commitChanges(t, e) {
    this.destroyed || e.length === 0 || (this.assertEditable(), this.tm.commit(t, e));
  }
  mergeBlocks(t, e, s = "user") {
    this.assertEditable();
    const n = this.blockManager.getById(t), i = this.blockManager.getById(e);
    if (!n || !i || !Se(n.type, i.type)) return;
    const r = JSON.parse(JSON.stringify(n.data)), a = cr(n.type, n.data, i.type, i.data), l = this.blockManager.getIndex(e), c = JSON.parse(JSON.stringify(i));
    this.tm.commit(s, [
      { type: "block:update", id: t, previous: r, current: a },
      { type: "block:remove", id: e, index: l, block: c }
    ]);
    const d = this.blockManager.getById(t);
    d && this.renderer.convert(t, d), this.focusBlock(t, "end");
  }
  /**
   * Split a block in ONE transaction: `before` replaces the block data,
   * `after` becomes a new block of the same type directly below. A single
   * history entry means one undo restores the pre-split block completely.
   */
  splitBlock(t, e, s) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const n = this.blockManager.getById(t);
    if (!n) return "";
    const i = x(n.data), r = this.blockManager.getIndex(t), a = M(this.config.idGenerator)(), l = { id: a, type: n.type, data: x(s) };
    this.tm.commit("user", [
      { type: "block:update", id: t, previous: i, current: x(e) },
      { type: "block:insert", block: l, index: r + 1 }
    ]);
    const c = this.blockManager.getById(t);
    return c && this.renderer.convert(t, c), a;
  }
  /**
   * Paste pasted content relative to the caret as ONE transaction:
   * - empty anchor block → the block is replaced by the pasted content;
   * - non-collapsed selection → replaced by the pasted content;
   * - caret mid-content → the anchor block splits around the paste;
   * - otherwise → content is inserted after the anchor block.
   */
  pasteBlocks(t, e, s = "paste") {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    this.assertEditable();
    const n = t.filter((h) => this.registry.has(h.type));
    if (n.length === 0) return;
    const i = [], r = () => {
      const h = i.find((f) => f.type === "block:insert");
      return h ? h.block.id : "";
    }, a = () => {
      for (let h = i.length - 1; h >= 0; h--) {
        const f = i[h];
        if (f && f.type === "block:insert") return f.block.id;
      }
      return "";
    }, l = this.state.get().blocks, c = this.blockManager.getById(e);
    let d = null;
    if (c)
      if (yt(c.type, c.data)) {
        const h = this.blockManager.getIndex(c.id), f = x(c);
        i.push({ type: "block:remove", id: c.id, index: h, block: f }), n.forEach((g, m) => {
          i.push({ type: "block:insert", block: this.shapedBlock(g).block, index: h + m });
        }), d = { id: r(), at: "start" };
      } else {
        const h = this.renderer.getTool(c.id), f = this.getSelectionInfo(), g = h, m = (f == null ? void 0 : f.blockId) === c.id;
        let y = null;
        if (m && typeof g.splitAtRange == "function") {
          const w = this.getRange();
          if (w)
            try {
              y = g.splitAtRange(w);
            } catch {
              y = null;
            }
        }
        const v = this.blockManager.getIndex(c.id);
        if (y) {
          const [w, I] = y, T = x(c.data), $ = yt(c.type, w), S = yt(c.type, I);
          if ($)
            n.forEach((C, B) => {
              i.push({ type: "block:insert", block: this.shapedBlock(C).block, index: v + B });
            }), i.push({ type: "block:update", id: c.id, previous: T, current: x(I) }), d = { id: r(), at: "start" };
          else {
            i.push({ type: "block:update", id: c.id, previous: T, current: x(w) });
            let C = v + 1;
            for (const B of n)
              i.push({ type: "block:insert", block: this.shapedBlock(B).block, index: C }), C++;
            if (S)
              d = { id: a(), at: "end" };
            else {
              const B = M(this.config.idGenerator)();
              i.push({
                type: "block:insert",
                block: { id: B, type: c.type, data: x(I) },
                index: C
              }), d = { id: B, at: "start" };
            }
          }
        } else {
          let w = x(c.data);
          if (m && f && !f.collapsed) {
            const T = this.getRange();
            if (T) {
              T.deleteContents();
              try {
                const $ = h == null ? void 0 : h.save(this.toolElement(c.id));
                $ && !($ instanceof Promise) && (w = $);
              } catch {
              }
            }
          }
          i.push({ type: "block:update", id: c.id, previous: x(c.data), current: w });
          let I = v + 1;
          for (const T of n)
            i.push({ type: "block:insert", block: this.shapedBlock(T).block, index: I }), I++;
        }
      }
    else {
      let h = l.length;
      for (const f of n)
        i.push({ type: "block:insert", block: this.shapedBlock(f).block, index: h }), h++;
      d = { id: r(), at: "start" };
    }
    this.tm.commit(s, i);
    const u = i.find((h) => h.type === "block:update");
    if (u && u.type === "block:update") {
      const h = this.blockManager.getById(u.id);
      h && this.renderer.convert(u.id, h);
    }
    d != null && d.id && this.focusBlock(d.id, d.at), this.announce("Pasted content inserted");
  }
  shapedBlock(t) {
    return {
      block: { id: M(this.config.idGenerator)(), type: t.type, data: x(t.data) }
    };
  }
  focusBlock(t, e) {
    if (!this.destroyed) {
      if (!this.blockManager.getById(t)) {
        const s = this.target.querySelector(`[data-ez-nested-id="${CSS.escape(t)}"]`), n = s == null ? void 0 : s.querySelectorAll("[data-ez-editable]"), i = e === "end" ? n == null ? void 0 : n[n.length - 1] : n == null ? void 0 : n[0];
        i == null || i.focus();
        return;
      }
      this.renderer.focus(t, e);
    }
  }
  focusNextBlock(t, e) {
    const s = this.blockManager.getIndex(t), n = this.state.get().blocks[s + 1];
    return n ? (this.focusBlock(n.id, e), !0) : !1;
  }
  focusPrevBlock(t, e) {
    const s = this.blockManager.getIndex(t), n = this.state.get().blocks[s - 1];
    return n ? (this.focusBlock(n.id, e), !0) : !1;
  }
  requestSaveBlock(t, e = "user") {
    if (this.destroyed || this.editingLocked) return;
    const s = this.blockManager.getById(t), n = this.renderer.getTool(t);
    if (!s || !n) return;
    const i = this.invalidatePendingSave(t);
    try {
      const r = this.toolElement(t), a = n.save(r);
      if (a instanceof Promise) {
        a.then(
          (l) => this.applySavedBlock(t, l, n, e, i),
          (l) => {
            this.destroyed || this.bus.emit("error", new k("EZ_SAVE_FAILED", `Save failed for block "${t}"`, { blockId: t }, l));
          }
        );
        return;
      }
      this.applySavedBlock(t, a, n, e, i);
    } catch (r) {
      this.bus.emit("error", new k("EZ_SAVE_FAILED", `Save failed for block "${t}"`, { blockId: t }, r));
    }
  }
  /** Bump the save epoch for a block; returns the new epoch. */
  invalidatePendingSave(t) {
    const e = (this.blockSaveVersions.get(t) ?? 0) + 1;
    return this.blockSaveVersions.set(t, e), e;
  }
  /** Route a nested child save (e.g. toggle children) to the owning tool. */
  requestSaveNestedChild(t, e) {
    if (this.destroyed || this.editingLocked) return;
    const s = this.renderer.getTool(t), n = s.requestSaveChild;
    if (typeof n == "function")
      try {
        n.call(s, e);
      } catch (i) {
        this.bus.emit("error", new k("EZ_SAVE_FAILED", `Save failed for nested block "${e}"`, { blockId: e }, i));
      }
  }
  applySavedBlock(t, e, s, n, i) {
    if (!(this.destroyed || this.blockSaveVersions.get(t) !== i || !this.blockManager.getById(t)))
      try {
        if (s.validate) {
          const a = s.validate(e);
          if (a === !1) {
            this.bus.emit("error", new k("EZ_INVALID_DATA", `Invalid data in block "${t}"`, { blockId: t }));
            return;
          }
          if (a instanceof Promise) {
            Promise.resolve(a).then((l) => {
              l && !this.destroyed && this.blockSaveVersions.get(t) === i && this.blockManager.getById(t) && this.blockManager.update(t, e, n);
            });
            return;
          }
        }
        this.blockManager.update(t, e, n);
      } catch (a) {
        this.bus.emit("error", new k("EZ_SAVE_FAILED", `Save failed for block "${t}"`, { blockId: t }, a));
      }
  }
  getEditableElement(t) {
    return this.renderer.getEditableElement(t);
  }
  getTool(t) {
    return this.renderer.getTool(t);
  }
  /** Nested child-block operations for tools hosting collapsible sections. */
  nestedHost(t) {
    return {
      getBlocks: () => {
        var e;
        return x(((e = this.blockManager.getByIdRecursive(t)) == null ? void 0 : e.children) ?? []);
      },
      insert: (e, s, n) => this.insertNestedBlock(t, e, s, n),
      update: (e, s) => this.updateNestedBlock(t, e, s),
      remove: (e) => this.removeNestedBlock(t, e),
      move: (e, s) => this.moveNestedBlock(t, e, s),
      createToolInstance: (e, s, n) => this.renderer.createToolInstancePublic(e, s, t, n),
      focusBlock: (e, s) => this.focusBlock(e, s),
      readOnly: this.readOnly
    };
  }
  commitChildren(t, e) {
    if (this.editingLocked) return;
    const s = this.blockManager.getById(t);
    if (!s) {
      for (const i of this.blockManager.blocks) {
        const r = x(i.children ?? []), a = (l) => {
          for (const c of l) {
            if (c.id === t)
              return c.children = e, !0;
            if (a(c.children ?? [])) return !0;
          }
          return !1;
        };
        if (a(r)) {
          this.commitChildren(i.id, r);
          return;
        }
      }
      return;
    }
    const n = x(s.children ?? []);
    this.tm.commit("user", [{ type: "children:update", id: t, previous: n, current: e }]);
  }
  insertNestedBlock(t, e, s, n) {
    var l;
    if (!this.registry.has(e)) throw tt(e);
    const i = x(((l = this.blockManager.getByIdRecursive(t)) == null ? void 0 : l.children) ?? []), r = { id: M(this.config.idGenerator)(), type: e, data: s ?? Bs(e) }, a = n === void 0 ? i.length : Math.max(0, Math.min(n, i.length));
    return i.splice(a, 0, r), this.commitChildren(t, i), r.id;
  }
  updateNestedBlock(t, e, s) {
    var r;
    const n = x(((r = this.blockManager.getByIdRecursive(t)) == null ? void 0 : r.children) ?? []), i = n.find((a) => a.id === e);
    i && (i.data = s, this.commitChildren(t, n));
  }
  removeNestedBlock(t, e) {
    var i;
    const s = x(((i = this.blockManager.getByIdRecursive(t)) == null ? void 0 : i.children) ?? []), n = s.findIndex((r) => r.id === e);
    n < 0 || (s.splice(n, 1), this.commitChildren(t, s));
  }
  moveNestedBlock(t, e, s) {
    var a;
    const n = x(((a = this.blockManager.getByIdRecursive(t)) == null ? void 0 : a.children) ?? []), i = n.findIndex((l) => l.id === e);
    if (i < 0) return;
    const [r] = n.splice(i, 1);
    r && (n.splice(Math.max(0, Math.min(s, n.length)), 0, r), this.commitChildren(t, n));
  }
  getRange() {
    return this.selectionManager.getRange();
  }
  getSelectionInfo() {
    return this.selectionManager.getSelection();
  }
  setSelectionFromRange(t) {
    this.selectionManager.setRange(t);
  }
  announce(t) {
    this.announcerEl && (this.announcerEl.textContent = t);
  }
  closeMenus() {
    var t, e, s;
    (t = this.slashMenu) == null || t.close(), this.blockToolbar && this.blockToolbar.hide(), (e = this.inlineToolbar) == null || e.hide(), (s = this.documentToolbar) == null || s.hide(), this.surfaceEl.dispatchEvent(new Event("ez-close-popovers")), this.targetEl !== this.surfaceEl && this.targetEl.dispatchEvent(new Event("ez-close-popovers"));
  }
  undoInternal() {
    this.undo();
  }
  redoInternal() {
    this.redo();
  }
  dispatchInlineTool(t) {
    var e, s;
    qs(this, t), (e = this.inlineToolbar) == null || e.refresh(), (s = this.documentToolbar) == null || s.refresh();
  }
  /* ===================== Workspace host bridge ===================== */
  /** Title changes route through an undoable transaction (document metadata). */
  setDocumentTitle(t) {
    if (this.destroyed || this.editingLocked) return;
    const e = this.currentTitle();
    e !== t && this.tm.commit("user", [{ type: "title:update", previous: e, current: t }]);
  }
  currentTitle() {
    const t = this.state.get().meta ?? {};
    return typeof t.title == "string" ? t.title : "";
  }
  /** Per-note undo/redo isolation: snapshot or restore in-memory history. */
  exportHistoryState() {
    return this.history.exportState();
  }
  importHistoryState(t) {
    this.history.importState(t), this.bus.emit("history:changed", { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }
  /** Find/replace across blocks of the active document. */
  findReplace(t, e, s) {
    var n;
    (n = this.findReplaceEngine) == null || n.call(this, t, e, s);
  }
  /** Register the find/replace engine once loaded (called during setup). */
  wireFindReplace() {
    this.findReplaceEngine = dn(this, this.surfaceEl);
  }
  /** Markdown typing shortcuts (headings, lists, quotes, inline marks). */
  setupMarkdownShortcuts() {
    if (this.mode === "headless" || this.config.readOnly) return;
    const t = new ln(this, this.surfaceEl);
    t.start(), this.disposers.push(() => t.stop());
  }
  /* ===================== Internals ===================== */
  toolElement(t) {
    return this.renderer.getBlockElement(t) ?? this.targetEl;
  }
  /** Emit a bubbling, composed DOM event carrying the instance + payload. */
  emitDomEvent(t, e) {
    const s = { instance: this, ...e !== void 0 ? { payload: e } : {} };
    this.targetEl.dispatchEvent(new CustomEvent(t, { bubbles: !0, composed: !0, detail: s }));
  }
  /** Apply the UI theme (light/dark/system) and track system changes. */
  applyTheme(t) {
    var s;
    this.targetEl.setAttribute("data-ez-theme", t);
    let e = t === "dark" ? "dark" : "light";
    try {
      if (t === "system") {
        const n = window.matchMedia("(prefers-color-scheme: dark)");
        e = n.matches ? "dark" : "light";
        const i = () => {
          const r = n.matches ? "dark" : "light";
          this.targetEl.setAttribute("data-ez-resolved-theme", r);
        };
        n.addEventListener("change", i), (s = this.themeListenerDisposer) == null || s.call(this), this.themeListenerDisposer = () => n.removeEventListener("change", i);
      }
    } catch {
    }
    this.targetEl.setAttribute("data-ez-resolved-theme", e);
  }
  resolveTarget(t) {
    const e = typeof t == "string" ? document.querySelector(t) : t;
    if (!e)
      throw new k("EZ_RENDER_FAILED", `Target not found: ${typeof t == "string" ? t : "element"}`);
    return e;
  }
  registerBuiltinTools() {
    this.registry.registerBlockTool("paragraph", ge, !0), this.registry.registerBlockTool("heading", me), this.registry.registerBlockTool("list", ve), this.registry.registerBlockTool("quote", be), this.registry.registerBlockTool("code", ye), this.registry.registerBlockTool("delimiter", ke), this.registry.registerBlockTool("table", xe), this.registry.registerBlockTool("image", Ie), this.registry.registerBlockTool("callout", Ce), this.registry.registerBlockTool("toggle", ze);
  }
  registerUserTools(t) {
    for (const [e, s] of Object.entries(t.tools ?? {}))
      this.registry.registerBlockTool(e, s, e === t.defaultBlock);
    for (const e of t.inlineTools ?? []) {
      const s = Ro(e);
      this.registry.registerInlineTool(s, e);
    }
    if ((t.inlineTools ?? []).length === 0 && this.uiEnabled())
      for (const [e, s] of Object.entries(_s))
        this.registry.registerInlineTool(e, s);
    for (const e of t.tunes ?? []) {
      const s = Oo(e);
      this.registry.registerTune(s, e);
    }
    (t.tunes ?? []).length === 0 && this.registry.registerTune("alignment", Bt);
  }
  registerBuiltinCommands() {
    const t = [
      [O.INSERT_BLOCK, (e) => {
        const { type: s, data: n, index: i } = e;
        this.insertBlock(s, n, { index: i, focus: !0 });
      }],
      [O.DELETE_BLOCK, (e) => this.removeBlock(e.id)],
      [O.MOVE_BLOCK, (e) => {
        const { id: s, to: n } = e;
        this.moveBlock(s, n);
      }],
      [O.DUPLICATE_BLOCK, (e) => this.duplicateBlock(e.id)],
      [O.CONVERT_BLOCK, (e) => {
        const { id: s, type: n } = e;
        this.convertBlock(s, n);
      }],
      [O.UPDATE_BLOCK, (e) => {
        const { id: s, data: n } = e;
        this.updateBlock(s, n);
      }],
      [O.FOCUS_BLOCK, (e) => {
        const { id: s, at: n } = e;
        this.focusBlock(s, n);
      }],
      [O.UNDO, () => this.undo()],
      [O.REDO, () => this.redo()],
      [O.OPEN_SLASH_MENU, (e) => {
        var i, r;
        const s = e.blockId, n = this.getSelectionInfo();
        s ? (i = this.slashMenu) == null || i.open(s) : n && ((r = this.slashMenu) == null || r.open(n.blockId));
      }],
      [O.SET_READ_ONLY, (e) => this.setReadOnly(e.value)]
    ];
    for (const [e, s] of t)
      this.commands.register({ name: e, run: (n) => s(n) });
  }
  migrateInitialData(t) {
    return t ? this.migrateDocument(t) : null;
  }
  /**
   * Build the document state without letting malformed payloads crash the
   * host application: invalid blocks are salvaged into read-only
   * "unknown" placeholders (or the editor starts empty when the envelope
   * itself is unusable) instead of throwing out of the constructor.
   */
  createState(t) {
    try {
      return new se(t, M(this.config.idGenerator));
    } catch (e) {
      const s = he(t, M(this.config.idGenerator));
      return s.document ? (this.bus.emit(
        "error",
        new k("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: s.dropped }, e)
      ), new se(s.document, M(this.config.idGenerator))) : (this.bus.emit("error", new k("EZ_INVALID_DOCUMENT", "The document payload is unusable; the editor started empty", void 0, e)), new se(null, M(this.config.idGenerator)));
    }
  }
  migrateDocument(t) {
    const e = t == null ? void 0 : t.schemaVersion;
    return !e || e === P ? (this.recoveryMode = !1, this.originalDocument = null, t) : Q(e, P) < 0 && this.migrations.canMigrate(e, P) ? (this.recoveryMode = !1, this.originalDocument = null, this.migrations.migrate(t, P)) : (this.recoveryMode = !0, this.originalDocument = x(t), this.bus.emit(
      "error",
      new k("EZ_MIGRATION_FAILED", `Document schema "${e}" is not supported; opened in read-only recovery mode`, { schemaVersion: e })
    ), t);
  }
  setupDom() {
    this.targetEl.classList.add("ez-editor-mount"), this.targetEl.setAttribute("data-ezynota-root", ""), this.mode === "workspace" || this.mode === "document" ? (this.targetEl.setAttribute("data-ez-mode", this.mode), this.surfaceEl = document.createElement("div"), this.surfaceEl.className = "ez-editor", this.surfaceEl.setAttribute("data-ezynota-root", ""), this.targetEl.appendChild(this.surfaceEl)) : (this.targetEl.classList.add("ez-editor"), this.targetEl.setAttribute("data-ez-mode", this.mode), this.surfaceEl = this.targetEl), this.config.readOnly && this.surfaceEl.classList.add("ez-readonly"), this.config.minHeight && (this.surfaceEl.style.minHeight = `${this.config.minHeight}px`), this.surfaceEl.setAttribute("dir", document.body.getAttribute("dir") ?? (this.config.locale === "he" || this.config.locale === "ar" || this.config.locale === "fa" || this.config.locale === "ur" ? "rtl" : "ltr")), this.announcerEl = document.createElement("div"), this.announcerEl.className = "ez-visually-hidden", this.announcerEl.setAttribute("aria-live", "polite"), this.announcerEl.setAttribute("role", "status"), this.surfaceEl.appendChild(this.announcerEl);
  }
  setupDefaultUi() {
    if (!this.uiEnabled()) return;
    const t = this.config.ui, e = typeof t == "object" ? t : {};
    e.blockToolbar !== !1 && (this.blockToolbar = new Sr(this), this.surfaceEl.appendChild(this.blockToolbar.getElement()), this.surfaceEl.classList.add("ez-has-block-toolbar")), e.inlineToolbar !== !1 && (this.inlineToolbar = new ds(this), this.inlineToolbar.getElement().style.display = "none", this.surfaceEl.appendChild(this.inlineToolbar.getElement())), e.slashMenu !== !1 && (this.slashMenu = new xr(this), this.surfaceEl.appendChild(this.slashMenu.getElement())), e.documentToolbar === !0 && (this.documentToolbar = new ds(this, !0), this.surfaceEl.prepend(this.documentToolbar.getElement()));
  }
  uiEnabled() {
    return this.config.ui !== !1;
  }
  wireEvents() {
    const t = this.bus.on("error", (r) => {
      this.emitDomEvent("ezn:error", { message: r.message, code: r.code });
    }), e = this.selectionManager.on("selection", (r) => {
      var a, l, c, d;
      r && this.slashMenu && this.getBlockType(r.blockId) === "paragraph" && ((a = this.getEditableElement(r.blockId)) == null || a.setAttribute("data-ez-writing-hint", this.i18n.t("core.blockHint"))), (l = this.inlineToolbar) == null || l.updateSelection(r), (c = this.documentToolbar) == null || c.updateSelection(r), this.bus.emit("selection:changed", r), r && !r.collapsed ? this.blockToolbar && this.blockToolbar.hide() : r && ((d = this.blockToolbar) == null || d.showFor(r.blockId));
    }), s = this.selectionManager.on("focus", () => this.bus.emit("focus")), n = this.selectionManager.on("blur", () => {
      this.closeMenus(), this.bus.emit("blur");
    }), i = this.inputManager.onBlockInput((r) => {
      var l;
      if (!this.slashMenu) return;
      const a = (((l = this.getEditableElement(r)) == null ? void 0 : l.textContent) ?? "").trim();
      a === "/" ? this.slashMenu.open(r, !1, !0) : this.slashMenu.isOpenMenu() && (a === "" || a.startsWith("/") ? this.slashMenu.setQuery(a.replace(/^\//, "")) : this.slashMenu.close());
    });
    this.disposers.push(t, e, s, n, i);
  }
  /** Single post-commit path: history + DOM sync + events. */
  handleCommit(t) {
    var n, i, r, a, l;
    if (t.origin === "history")
      for (const c of t.changes)
        (c.type === "block:update" || c.type === "block:remove" || c.type === "children:update") && this.invalidatePendingSave(c.id);
    for (const c of t.changes)
      c.type === "block:remove" && this.blockSaveVersions.delete(c.id);
    const e = t.changes.length > 0 && t.changes.every((c) => c.type === "document:replace");
    let s = !1;
    t.origin !== "history" && !e && (this.history.record({ origin: t.origin, changes: t.changes, timestamp: t.timestamp }, this.getSelectionInfo()), s = !0);
    for (const c of t.changes)
      this.applyToDom(c, t.origin);
    s && this.history.updatePostSelection(this.getSelectionInfo()), this.bus.emit("change", t), this.emitDomEvent("ezn:change", { origin: t.origin, batchId: t.id });
    for (const c of t.changes)
      switch (c.type) {
        case "block:insert":
          this.bus.emit("block:inserted", { id: c.block.id, index: c.index });
          break;
        case "block:remove":
          this.bus.emit("block:removed", { id: c.id, index: c.index });
          break;
        case "block:move":
          this.bus.emit("block:moved", { id: c.id, from: c.from, to: c.to });
          break;
        case "block:update":
          this.bus.emit("block:updated", { id: c.id });
          break;
        case "block:convert":
          this.bus.emit("block:updated", { id: c.id });
          break;
        case "tune:update":
          this.bus.emit("block:updated", { id: c.id });
          break;
        case "title:update":
          (n = this.documentToolbar) == null || n.refresh(), this.bus.emit("block:updated", { id: "title" });
          break;
        case "children:update":
          this.bus.emit("block:updated", { id: c.id });
          break;
      }
    try {
      (r = (i = this.config).onChange) == null || r.call(i, this, t);
    } catch (c) {
      this.bus.emit("error", new k("EZ_UNKNOWN_ERROR", "An onChange handler threw", void 0, c));
    }
    (a = this.documentToolbar) == null || a.refresh(), (l = this.inlineToolbar) == null || l.refresh();
  }
  applyToDom(t, e) {
    switch (t.type) {
      case "block:insert": {
        const s = this.blockManager.getById(t.block.id);
        s && this.renderer.insert(s, t.index, e);
        break;
      }
      case "block:remove":
        this.renderer.remove(t.id);
        break;
      case "block:move":
        this.renderer.move(t.id, t.to);
        break;
      case "block:update": {
        this.blockManager.getById(t.id) && this.renderer.update(t.id, e);
        break;
      }
      case "block:convert": {
        const s = this.blockManager.getById(t.id);
        s && this.renderer.convert(t.id, s);
        break;
      }
      case "tune:update": {
        const s = this.blockManager.getById(t.id);
        s && this.renderer.convert(t.id, s);
        break;
      }
      case "children:update": {
        this.blockManager.getById(t.id) && this.renderer.update(t.id, e);
        break;
      }
    }
  }
  /** Full document replace. The caller owns history reset (undoable or not). */
  blockManagerReplaceAll(t) {
    try {
      this.state.replace(t, M(this.config.idGenerator));
    } catch (e) {
      const s = he(t, M(this.config.idGenerator));
      if (!s.document) throw e;
      this.bus.emit(
        "error",
        new k("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: s.dropped }, e)
      ), this.state.replace(s.document, M(this.config.idGenerator));
    }
    this.tm.commit("api", [{ type: "document:replace" }]), this.renderer.renderAll(this.state.get().blocks), this.blockSaveVersions.clear();
  }
  /** Restore the caret recorded with a history entry (undo/redo). */
  restoreHistorySelection(t) {
    if (!t || this.readOnly) return;
    const e = this.getEditableElement(t.blockId);
    e && (e.focus(), rr(e, t.focusOffset > t.anchorOffset ? t.focusOffset : t.anchorOffset));
  }
  /* ===================== Declarative initialization ===================== */
  /** Initialize every `[data-ezn-editor]` under `root` (default: document). */
  static initAll(t) {
    return je(t);
  }
  /** Look up the instance for an element or selector. */
  static getInstance(t) {
    return Lo(t);
  }
  blockRef(t) {
    const e = this.blockManager.getById(t);
    if (this.blockManager.getIndex(t) < 0 || !e) return;
    const s = () => {
      var r;
      return ((r = this.blockManager.getById(t)) == null ? void 0 : r.type) ?? "";
    }, n = () => this.blockManager.getIndex(t);
    return {
      id: t,
      get type() {
        return s();
      },
      get index() {
        return n();
      },
      getData: () => {
        const r = this.blockManager.getById(t) ?? e;
        return JSON.parse(JSON.stringify(r.data));
      },
      update: (r) => this.updateBlock(t, r),
      patch: (r) => {
        const a = this.getBlockData(t) ?? {};
        this.updateBlock(t, { ...a, ...r });
      },
      remove: () => this.removeBlock(t),
      move: (r) => this.moveBlock(t, r),
      duplicate: () => this.duplicateBlock(t),
      convert: (r) => this.convertBlock(t, r)
    };
  }
}
function x(o) {
  return JSON.parse(JSON.stringify(o));
}
function Bs(o) {
  switch (o) {
    case "paragraph":
    case "quote":
      return { content: [] };
    case "heading":
      return { level: 2, content: [] };
    case "list":
      return { style: "unordered", items: [{ content: [] }] };
    case "code":
      return { code: "" };
    case "delimiter":
      return {};
    default:
      return {};
  }
}
function Ro(o) {
  var n;
  const t = o.class ?? o, e = Object.entries(_s).find(([, i]) => i === t);
  if (e) return e[0];
  const s = o;
  return (((n = s.class) == null ? void 0 : n.name) ?? s.name ?? `inline-${Math.random().toString(36).slice(2, 8)}`).toLowerCase();
}
function Oo(o) {
  var e;
  if (o === Bt || o.class === Bt) return "alignment";
  const t = o;
  return ((e = t.class) == null ? void 0 : e.name) ?? t.name ?? `tune-${Math.random().toString(36).slice(2, 8)}`;
}
function Fo(o) {
  return o.mode ? o.mode : o.ui === !1 ? "headless" : "workspace";
}
export {
  R as $,
  Bt as A,
  _s as B,
  Ce as C,
  ke as D,
  O as E,
  Ot as F,
  Xt as G,
  me as H,
  Mn as I,
  Vs as J,
  uo as K,
  Xi as L,
  U as M,
  js as N,
  F as O,
  ge as P,
  be as Q,
  Po as R,
  P as S,
  xe as T,
  qi as U,
  Z as V,
  Fe as W,
  G as X,
  ro as Y,
  De as Z,
  jt as _,
  Yi as a,
  go as a0,
  K as a1,
  ko as a2,
  Js as a3,
  he as a4,
  $o as a5,
  $n as a6,
  st as a7,
  Us as a8,
  ji as b,
  Wi as c,
  ye as d,
  Gi as e,
  tn as f,
  Mo as g,
  k as h,
  Ie as i,
  Nr as j,
  Ui as k,
  ve as l,
  Vi as m,
  ws as n,
  Dn as o,
  Ki as p,
  Mt as q,
  ze as r,
  _o as s,
  Cn as t,
  Fr as u,
  mo as v,
  Pe as w,
  $e as x,
  po as y,
  z
};
//# sourceMappingURL=core-entry-a3M6h9FE.js.map
