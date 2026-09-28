class Us {
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
class qs {
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
class k extends Error {
  constructor(t, e, s, n) {
    super(e), this.name = "EzynotaError", this.code = t, s !== void 0 && (this.context = s), n !== void 0 && (this.cause = n);
  }
}
function tt(r) {
  return new k("EZ_TOOL_NOT_FOUND", `Tool "${r}" is not registered`, { tool: r });
}
function q(r, t) {
  return new k("EZ_INVALID_DOCUMENT", `Invalid document: ${r}`, t);
}
const Ws = ["http:", "https:", "mailto:", "tel:"];
function G(r) {
  if (typeof r != "string") return !1;
  const t = r.trim();
  if (t === "") return !1;
  if (t.startsWith("#") || t.startsWith("./") || t.startsWith("../"))
    return !0;
  if (/^[\\/][\\/]/.test(t))
    return !1;
  try {
    const e = new URL(t, "https://ezynota.invalid");
    return Ws.includes(e.protocol);
  } catch {
    return !1;
  }
}
function Z(r) {
  if (typeof r != "string") return !1;
  const t = r.trim();
  return t === "" ? !1 : t.startsWith("data:image/") ? /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i.test(t) : G(t);
}
function wo(r) {
  if (typeof r != "string") return null;
  const t = r.trim();
  return G(t) ? t : null;
}
const $ = "1.0.0", Gt = "0.1.1", U = 200, Vs = /* @__PURE__ */ new Set(["id", "type", "data", "tunes", "meta", "children"]);
function B(r) {
  var e;
  if (r === null || typeof r != "object" || Array.isArray(r)) return !1;
  const t = Object.getPrototypeOf(r);
  return t === null ? !0 : t === Object.prototype || ((e = t.constructor) == null ? void 0 : e.name) === "Object";
}
function mt(r) {
  return r === null || typeof r == "string" || typeof r == "number" || typeof r == "boolean" ? !0 : Array.isArray(r) ? r.every((t) => mt(t)) : B(r) ? Object.values(r).every((t) => mt(t)) : !1;
}
function Ks(r) {
  let t = 0;
  const e = [{ v: r, d: 0 }];
  for (; e.length > 0; ) {
    const { v: s, d: n } = e.pop();
    if (n > t && (t = n), t > U) return t;
    if (Array.isArray(s))
      for (const i of s) e.push({ v: i, d: n + 1 });
    else if (B(s))
      for (const i of Object.values(s)) e.push({ v: i, d: n + 1 });
  }
  return t;
}
function wt(r) {
  return Ks(r) > U;
}
function et(r, t = 0) {
  if (t > U)
    throw q(`value exceeds the maximum nesting depth of ${U}`);
  if (Array.isArray(r))
    return r.map((e) => et(e, t + 1));
  if (B(r)) {
    const e = {};
    for (const [s, n] of Object.entries(r))
      s === "__proto__" || s === "constructor" || s === "prototype" || (e[s] = et(n, t + 1));
    return e;
  }
  return r;
}
function ot(r) {
  if (Array.isArray(r)) {
    const t = [];
    for (const e of r) {
      if (B(e) && e.type === "link") {
        const s = e;
        if (_e(s.href) === null) {
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
  if (B(r)) {
    const t = {};
    for (const [e, s] of Object.entries(r)) {
      if (e === "marks" && Array.isArray(s)) {
        t[e] = s.filter((n) => {
          if (!B(n) || n.type !== "link") return !0;
          const i = n.attrs, o = n.href ?? (i == null ? void 0 : i.href);
          return typeof o == "string" && _e(o) !== null;
        }).map((n) => ot(n));
        continue;
      }
      t[e] = ot(s);
    }
    return t;
  }
  return r;
}
function Ce(r, t, e = 0) {
  if (e > U)
    throw q(`block nesting exceeds ${U} levels`);
  if (!B(r))
    throw new k("EZ_INVALID_BLOCK", "Block must be an object", { received: typeof r });
  if (typeof r.type != "string" || r.type === "")
    throw new k("EZ_INVALID_BLOCK", 'Block is missing a valid "type"', { id: String(r.id ?? "") });
  const s = r.data;
  if (s === void 0)
    throw new k("EZ_INVALID_BLOCK", 'Block is missing "data"', { type: r.type });
  if (wt(s))
    throw q(`block data exceeds the maximum nesting depth of ${U}`, { type: r.type });
  if (!mt(s))
    throw new k("EZ_INVALID_BLOCK", "Block data is not JSON-serializable", { type: r.type });
  const n = typeof r.id == "string" && r.id !== "" ? r.id : t(), i = {
    id: n,
    type: r.type,
    data: ot(et(s))
  }, o = r.tunes;
  if (B(o)) {
    if (wt(o))
      throw q(`block tunes exceed the maximum nesting depth of ${U}`, { id: n });
    mt(o) && (i.tunes = et(o));
  }
  const a = r.meta;
  if (B(a)) {
    const c = {};
    typeof a.createdAt == "number" && (c.createdAt = a.createdAt), typeof a.updatedAt == "number" && (c.updatedAt = a.updatedAt), (c.createdAt !== void 0 || c.updatedAt !== void 0) && (i.meta = c);
  }
  const l = r.children;
  Array.isArray(l) && (i.children = l.map((c) => Ce(c, t, e + 1)));
  for (const c of Object.keys(r)) {
    if (Vs.has(c) || c === "__proto__" || c === "constructor" || c === "prototype") continue;
    const d = r[c];
    if (wt(d))
      throw q(`block field "${c}" exceeds the maximum nesting depth of ${U}`, { id: n });
    mt(d) && (i[c] = et(d));
  }
  return i;
}
function Js() {
  let r = 0;
  return () => `ez_salvaged_${(++r).toString(36)}`;
}
function oe(r, t) {
  let e = `${r}_2`;
  for (let s = 2; t.has(e); s++) e = `${r}_${s}`;
  return e;
}
function Zs(r) {
  try {
    const t = JSON.parse(JSON.stringify(r));
    return wt(t) ? null : et(t);
  } catch {
    return null;
  }
}
function vs(r, t) {
  let e = 0;
  const s = (n) => {
    if (Array.isArray(n.children))
      for (const i of n.children)
        t.has(i.id) && (i.id = oe(i.id, t), e++), t.add(i.id), s(i);
  };
  for (const n of r) s(n);
  return e;
}
function ws(r, t) {
  const s = { schemaVersion: typeof r.schemaVersion == "string" ? r.schemaVersion : $, blocks: t }, n = r.meta;
  if (B(n)) {
    if (wt(n))
      throw q("document meta exceeds the maximum nesting depth");
    mt(n) && (s.meta = et(n));
  }
  typeof r.createdAt == "number" && (s.createdAt = r.createdAt), typeof r.updatedAt == "number" && (s.updatedAt = r.updatedAt);
  const i = r.generator;
  return B(i) && i.name === "ezynota" && typeof i.version == "string" && (s.generator = { name: "ezynota", version: i.version }), s;
}
function _t(r, t) {
  if (r == null) {
    const i = Date.now();
    return { schemaVersion: $, blocks: [], createdAt: i, updatedAt: i, generator: { name: "ezynota", version: Gt } };
  }
  if (!B(r))
    throw q("expected an object", { received: typeof r });
  const e = r.blocks;
  if (!Array.isArray(e))
    throw q('"blocks" must be an array');
  const s = /* @__PURE__ */ new Set(), n = e.map((i) => {
    const o = Ce(i, t);
    if (s.has(o.id))
      throw q(`duplicate block id "${o.id}"`);
    return s.add(o.id), o;
  });
  return vs(n, s), ws(r, n);
}
function ae(r, t) {
  const e = t ?? Js();
  if (r == null)
    return { document: _t(null, e), salvaged: !1, dropped: [] };
  if (!B(r))
    return { document: null, salvaged: !1, dropped: [] };
  const s = r.blocks;
  if (!Array.isArray(s))
    return { document: null, salvaged: !1, dropped: [] };
  const n = [], i = /* @__PURE__ */ new Set(), o = [];
  let a = !1;
  for (let c = 0; c < s.length; c++) {
    const d = s[c];
    try {
      const h = Ce(d, e);
      i.has(h.id) && (h.id = oe(h.id, i), a = !0), i.add(h.id), o.push(h);
    } catch {
      a = !0;
      const h = B(d) && typeof d.id == "string" ? d.id : "";
      n.push(h !== "" ? h : `#${c}`);
      const u = Zs(d);
      if (u === null) continue;
      const p = B(u) ? u.id : void 0;
      let g = typeof p == "string" && p !== "" ? p : e();
      i.has(g) && (g = oe(g, i)), i.add(g), o.push({ id: g, type: "unknown", data: { raw: u } });
    }
  }
  vs(o, i) > 0 && (a = !0);
  let l;
  try {
    l = ws(r, o);
  } catch {
    l = { schemaVersion: $, blocks: o };
  }
  return { document: l, salvaged: a, dropped: n };
}
function J(r) {
  return typeof structuredClone == "function" ? structuredClone(r) : JSON.parse(JSON.stringify(r));
}
function Gs(r) {
  const t = Object.freeze(r.blocks.map((e) => Object.freeze({ ...e })));
  return Object.freeze({ ...r, blocks: t });
}
function _e(r) {
  if (typeof r != "string") return null;
  const t = r.trim();
  return t !== "" && G(t) ? t : null;
}
class te {
  constructor(t, e) {
    this.version = 0, this.document = _t(t ?? null, e);
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
    return Gs(J(this.document));
  }
  replace(t, e) {
    this.document = _t(t, e), this.version++;
  }
  updatedAt() {
    this.document.updatedAt = Date.now();
  }
  clone() {
    return J(this.document);
  }
}
let He = 0;
class Ys {
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
      for (const o of e)
        this.applyChange(s, o);
    } catch (o) {
      throw s.blocks = n.blocks, s.meta = n.meta ?? void 0, o instanceof k ? o : new k("EZ_UNKNOWN_ERROR", "Transaction failed and was rolled back", { origin: t, changes: e.length }, o);
    }
    this.state.updatedAt(), this.state.bump();
    const i = {
      id: `ch_${Date.now().toString(36)}_${(He++).toString(36)}`,
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
        t.blocks.splice(Math.max(0, Math.min(e.index, t.blocks.length)), 0, Xs(e.block));
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
        Qs(t.blocks, e.id, e.to);
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
    return { id: `ch_${Date.now().toString(36)}_${(He++).toString(36)}`, origin: t, timestamp: Date.now(), changes: [] };
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
function Xs(r) {
  return J(r);
}
function Qs(r, t, e) {
  const s = r.findIndex((o) => o.id === t);
  if (s < 0) return;
  const [n] = r.splice(s, 1);
  if (!n) return;
  const i = Math.max(0, Math.min(e, r.length));
  r.splice(i, 0, n);
}
class tn {
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
    const o = this.blocks;
    let a = (i == null ? void 0 : i.withId) ?? this.generateId();
    if (o.some((d) => d.id === a)) {
      const d = a;
      let h = 2;
      for (; o.some((u) => u.id === `${d}_${h}`); ) h++;
      a = `${d}_${h}`;
    }
    const l = { id: a, type: t, data: e }, c = n >= 0 ? Math.max(0, Math.min(n, o.length)) : o.length;
    return this.run(s, () => [{ type: "block:insert", block: l, index: c }]), a;
  }
  update(t, e, s = "api") {
    const n = this.getById(t);
    if (!n || ct(n.data) === ct(e)) return;
    const i = nt(n.data), o = nt(e);
    this.run(s, () => [{ type: "block:update", id: t, previous: i, current: o }]);
  }
  remove(t, e = "api") {
    const s = this.blocks, n = s.findIndex((o) => o.id === t);
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
    let o;
    if (typeof e == "number")
      o = e;
    else if ("before" in e) {
      const a = n.findIndex((l) => l.id === e.before);
      if (a < 0) return;
      o = a > i ? a - 1 : a;
    } else if ("after" in e) {
      const a = n.findIndex((l) => l.id === e.after);
      if (a < 0) return;
      o = a > i ? a : a + 1;
    } else
      o = e.at === "start" ? 0 : n.length;
    o = Math.max(0, Math.min(o, n.length)), o !== i && this.run(s, () => [{ type: "block:move", id: t, from: i, to: o }]);
  }
  /** Move between root and nested lists atomically, preserving the whole subtree. */
  relocate(t, e, s, n = "user") {
    var p;
    if (t === e) return;
    const i = this.blocks, o = JSON.parse(JSON.stringify(i)), a = (g, m) => {
      for (let y = 0; y < g.length; y++) {
        const v = g[y];
        if (v.id === m) return { block: v, siblings: g, index: y };
        const w = a(v.children ?? [], m);
        if (w) return w;
      }
    }, l = a(o, t), c = a(o, e);
    if (!l || !c || a(l.block.children ?? [], e) || s === "inside" && c.block.type !== "toggle") return;
    if (s !== "inside" && l.siblings === o && c.siblings === o) {
      this.move(t, s === "before" ? { before: e } : { after: e }, n);
      return;
    }
    l.siblings.splice(l.index, 1);
    const d = s === "inside" ? (p = c.block).children ?? (p.children = []) : c.siblings, h = s === "inside" ? d.length : d.indexOf(c.block) + (s === "after" ? 1 : 0);
    d.splice(h, 0, l.block), s === "inside" && (c.block.data = { ...c.block.data, open: !0 });
    const u = [];
    for (let g = 0; g < i.length; g++) {
      const m = i[g];
      o.some((y) => y.id === m.id) || u.push({ type: "block:remove", id: m.id, index: g, block: m });
    }
    for (const g of o) {
      const m = i.find((y) => y.id === g.id);
      m && (JSON.stringify(m.data) !== JSON.stringify(g.data) && u.push({ type: "block:update", id: g.id, previous: m.data, current: g.data }), JSON.stringify(m.children ?? []) !== JSON.stringify(g.children ?? []) && u.push({ type: "children:update", id: g.id, previous: m.children ?? [], current: g.children ?? [] }));
    }
    o.forEach((g, m) => {
      i.some((y) => y.id === g.id) || u.push({ type: "block:insert", block: g, index: m });
    }), this.run(n, () => u);
  }
  duplicate(t, e = "api") {
    const s = this.getIndex(t), n = this.getById(t);
    if (s < 0 || !n) return "";
    const i = this.generateId(), o = JSON.parse(JSON.stringify(n));
    return o.id = i, o.meta = {}, Es(o, this.generateId), this.run(e, () => [{ type: "block:insert", block: o, index: s + 1 }]), i;
  }
  convert(t, e, s, n = "api") {
    const i = this.getById(t);
    if (!i) return;
    const o = i.type;
    if (o === e) return;
    const a = nt(i.data), l = nt(s);
    this.run(n, () => [
      { type: "block:update", id: t, previous: a, current: l },
      { type: "block:convert", id: t, fromType: o, toType: e }
    ]);
  }
  setTune(t, e, s, n = "user") {
    var a;
    const i = this.getById(t);
    if (!i) return;
    const o = nt(((a = i.tunes) == null ? void 0 : a[e]) ?? null);
    ct(o) !== ct(s) && this.run(n, () => [{ type: "tune:update", id: t, tune: e, previous: o, value: nt(s) }]);
  }
}
function nt(r) {
  return JSON.parse(JSON.stringify(r));
}
function ct(r) {
  return r === null || typeof r != "object" ? JSON.stringify(r) ?? "null" : Array.isArray(r) ? `[${r.map(ct).join(",")}]` : `{${Object.keys(r).sort().map((e) => `${JSON.stringify(e)}:${ct(r[e])}`).join(",")}}`;
}
function Es(r, t) {
  if (Array.isArray(r.children))
    for (const e of r.children)
      e.id = t(), Es(e, t);
}
const en = 50, sn = 2e4;
class nn {
  constructor(t, e = {}, s = 900) {
    this.tm = t, this.callbacks = e, this.undoStack = [], this.redoStack = [], this.coalesceWindowMs = s;
  }
  record(t, e) {
    if (t.changes.length === 0 || t.origin === "remote") return;
    const s = this.tm.invert(t.changes), n = this.callbacks.onCaptureSelection ? this.callbacks.onCaptureSelection() : e ?? null, i = this.undoStack[this.undoStack.length - 1], o = t.changes.every(
      (d) => d.type === "block:update" || d.type === "tune:update" || d.type === "title:update"
    ), a = (i == null ? void 0 : i.groupStart) ?? (i == null ? void 0 : i.time) ?? 0, l = ((i == null ? void 0 : i.changes.length) ?? 0) + t.changes.length > en, c = t.timestamp - a >= sn;
    if (i && o && !l && !c && i.origin === "user" && t.origin === "user" && t.timestamp - i.time < this.coalesceWindowMs && rn(i.changes, t.changes)) {
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
function rn(r, t) {
  const e = (s) => Array.from(
    new Set(
      s.map((n) => n.type === "title:update" ? "title" : "id" in n ? n.id : "block" in n ? n.block.id : "")
    )
  ).sort().join("|");
  return e(r) === e(t);
}
class on {
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
const R = {
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
class an {
  constructor() {
    this.blockTools = /* @__PURE__ */ new Map(), this.blockToolLoaders = /* @__PURE__ */ new Map(), this.inlineTools = [], this.tunes = [], this.defaultBlock = "paragraph";
  }
  registerBlockTool(t, e, s = !1) {
    const n = ln(e);
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
    const s = cn(e);
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
    const s = dn(e);
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
function ln(r) {
  if (typeof r == "function") return { cls: r, config: void 0 };
  const t = r;
  if (!t || typeof t.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Tool definition must be a class or { class, config }");
  return { cls: t.class, config: t.config, shortcut: t.shortcut };
}
function cn(r) {
  if (typeof r == "function") return { cls: r, config: void 0 };
  if (!r || typeof r.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Inline tool definition must be a class or { class, config }");
  return { cls: r.class, config: r.config };
}
function dn(r) {
  if (typeof r == "function") return { cls: r, config: void 0 };
  if (!r || typeof r.class != "function")
    throw new k("EZ_TOOL_LOAD_FAILED", "Tune definition must be a class or { class, config }");
  return { cls: r.class, config: r.config };
}
function je(r) {
  const t = r.indexOf("-"), e = t >= 0 ? r.slice(0, t) : r, s = t >= 0 ? r.slice(t + 1) : null, n = e.split(".").map((i) => parseInt(i, 10) || 0);
  for (; n.length < 3; ) n.push(0);
  return { core: n.slice(0, 3), pre: s };
}
function hn(r, t) {
  const e = r.split("."), s = t.split("."), n = Math.max(e.length, s.length);
  for (let i = 0; i < n; i++) {
    const o = e[i], a = s[i];
    if (o === void 0) return -1;
    if (a === void 0) return 1;
    const l = /^\d+$/.test(o) ? parseInt(o, 10) : null, c = /^\d+$/.test(a) ? parseInt(a, 10) : null;
    if (l !== null && c !== null) {
      if (l !== c) return l - c;
    } else {
      if (l !== null)
        return -1;
      if (c !== null)
        return 1;
      if (o !== a)
        return o < a ? -1 : 1;
    }
  }
  return 0;
}
function Q(r, t) {
  const e = je(r), s = je(t);
  for (let n = 0; n < 3; n++)
    if (e.core[n] !== s.core[n]) return e.core[n] - s.core[n];
  return e.pre === null && s.pre === null ? 0 : e.pre === null ? 1 : s.pre === null ? -1 : hn(e.pre, s.pre);
}
class un {
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
      } catch (o) {
        throw new k("EZ_MIGRATION_FAILED", `Migration ${i.from} -> ${i.to} failed`, { from: i.from, to: i.to }, o);
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
      for (const o of this.migrations) {
        if (o.from !== i.version || n.has(o.to)) continue;
        const a = [...i.path, o];
        if (Q(o.to, e) === 0) return a;
        Q(o.to, e) < 0 && (n.add(o.to), s.push({ version: o.to, path: a }));
      }
    }
    throw new k("EZ_MIGRATION_FAILED", `No migration path from "${t}" to "${e}"`, { from: t, to: e });
  }
}
const pn = {
  "core.placeholder": "Start writing...",
  "core.emptyDocument": "This document is empty.",
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
class fn {
  constructor(t = "en", e = {}) {
    this.messages = {}, this.locale = t, this.messages.en = { ...pn };
    for (const [s, n] of Object.entries(e))
      this.messages[s] = { ...this.messages[s] ?? {}, ...n };
  }
  t(t, e) {
    var i, o, a;
    const s = Object.keys(this.messages).sort((l, c) => c.length - l.length);
    for (const l of s)
      if (l !== "en" && t.startsWith(`${l}.`)) {
        const c = ((i = this.messages[l]) == null ? void 0 : i[t.slice(l.length + 1)]) ?? ((o = this.messages[l]) == null ? void 0 : o[t]);
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
const Ue = "abcdefghijklmnopqrstuvwxyz0123456789";
function gn() {
  let r = "ez_";
  for (let t = 0; t < 12; t++)
    r += Ue[Math.floor(Math.random() * Ue.length)];
  return r;
}
function Yt() {
  const r = typeof crypto < "u" ? crypto : void 0;
  return r && typeof r.randomUUID == "function" ? () => r.randomUUID() : gn;
}
function N(r) {
  const t = Yt();
  return r ? () => {
    const e = r();
    return typeof e == "string" && e !== "" ? e : t();
  } : t;
}
function st(r, t) {
  const e = { type: "text", text: r };
  return t && t.length > 0 && (e.marks = t), e;
}
function _(r) {
  return r.type === "text";
}
function Lt(r) {
  return r.type === "link" && Array.isArray(r.content);
}
const qe = ["bold", "italic", "underline", "strike", "code", "mark", "link", "color", "background"];
function le(r) {
  return r.attrs ? `${r.type}:${JSON.stringify(r.attrs)}` : r.type;
}
function O(r) {
  if (!r) return [];
  const t = [];
  for (const e of r) {
    if (Lt(e)) {
      const i = O(e.content);
      if (i.length === 0 || i.every((o) => o.text === "")) continue;
      t.push({ type: "link", href: e.href, content: i });
      continue;
    }
    const s = e;
    if (typeof s.text != "string" || s.text === "") continue;
    const n = t[t.length - 1];
    if (n && _(n) && _(s) && bn(n.marks, s.marks))
      n.text += s.text;
    else if (_(s)) {
      const i = { type: "text", text: s.text }, o = mn(s.marks);
      o && (i.marks = o), t.push(i);
    } else
      t.push(s);
  }
  return t;
}
function mn(r) {
  if (!r || r.length === 0) return;
  const t = /* @__PURE__ */ new Set(), e = [];
  for (const s of r) {
    const n = le(s);
    t.has(n) || (t.add(n), e.push(s));
  }
  return e.sort((s, n) => qe.indexOf(s.type) - qe.indexOf(n.type)), e;
}
function bn(r, t) {
  const e = (r ?? []).map(le).sort().join(","), s = (t ?? []).map(le).sort().join(",");
  return e === s;
}
function yn(r, t) {
  if (t <= 0) return [[], O(r)];
  const e = [], s = [];
  let n = 0;
  for (const i of r) {
    const o = _(i) ? i.text : i.content.map((l) => l.text).join("");
    if (n >= t) {
      s.push(i);
      continue;
    }
    if (n + o.length <= t) {
      e.push(i), n += o.length;
      continue;
    }
    const a = t - n;
    if (_(i))
      e.push(st(i.text.slice(0, a), i.marks)), s.push(st(i.text.slice(a), i.marks));
    else {
      const [l, c] = yn(i.content, a);
      l.length > 0 && e.push({ type: "link", href: i.href, content: l }), c.length > 0 && s.push({ type: "link", href: i.href, content: c });
    }
    n += o.length;
  }
  return [O(e), O(s)];
}
const We = {
  bold: "strong",
  italic: "em",
  underline: "u",
  code: "code",
  mark: "mark",
  strike: "s"
}, kn = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
  CODE: "code",
  MARK: "mark",
  S: "strike",
  DEL: "strike"
}, vn = /* @__PURE__ */ new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE", "UL", "OL"]);
function Ht(r) {
  return typeof r == "string" && (G(r) || r.startsWith("note:"));
}
function ce(r) {
  var e, s;
  if (!r) return [];
  const t = [];
  for (const n of r) {
    if (Lt(n)) {
      Ht(n.href) ? t.push({ type: "link", href: n.href, content: ce(n.content) }) : t.push(...ce(n.content));
      continue;
    }
    if (_(n)) {
      const i = (e = n.marks) == null ? void 0 : e.filter((o) => {
        var l;
        if (o.type !== "link") return !0;
        const a = ((l = o.attrs) == null ? void 0 : l.href) ?? o.href;
        return Ht(a);
      });
      if (i && i.length !== (((s = n.marks) == null ? void 0 : s.length) ?? 0)) {
        const o = { type: "text", text: n.text };
        i.length > 0 && (o.marks = i), t.push(o);
        continue;
      }
    }
    t.push(n);
  }
  return t;
}
function F(r, t = document) {
  const e = t.createDocumentFragment();
  if (!r) return e;
  for (const s of O(ce(r)))
    if (_(s))
      e.appendChild(Ft(s, s.marks ?? [], t));
    else if (Lt(s)) {
      if (!Ht(s.href)) {
        for (const i of s.content)
          e.appendChild(Ft(i, i.marks ?? [], t));
        continue;
      }
      const n = t.createElement("a");
      n.setAttribute("href", s.href), n.setAttribute("rel", "noopener noreferrer");
      for (const i of s.content)
        n.appendChild(Ft(i, i.marks ?? [], t));
      e.appendChild(n);
    }
  return e;
}
function Ft(r, t, e) {
  if (t.length === 0)
    return e.createTextNode(r.text);
  const [s, ...n] = t, i = We[s.type] ?? "span", o = e.createElement(i);
  if (!We[s.type]) {
    o.setAttribute("data-ez-mark", s.type);
    const a = s.attrs;
    if (a)
      for (const [l, c] of Object.entries(a))
        (typeof c == "string" || typeof c == "number") && (o.setAttribute(`data-ez-${wn(l)}`, String(c)), s.type === "color" && l === "color" && (o.style.color = String(c)), s.type === "background" && l === "color" && (o.style.backgroundColor = String(c)));
  }
  return n && n.length > 0 ? o.appendChild(Ft(r, n, e)) : o.textContent = r.text, o;
}
function wn(r) {
  return r.replace(/[A-Z]/g, (t) => `-${t.toLowerCase()}`);
}
function C(r) {
  const t = [];
  return As(r, [], t), O(En(t));
}
function En(r) {
  var s, n;
  const t = [];
  let e = null;
  for (const i of r) {
    if (_(i) && ((s = i.marks) != null && s.some((o) => o.type === "link"))) {
      const o = i.marks.find((d) => d.type === "link"), a = String(((n = o.attrs) == null ? void 0 : n.href) ?? ""), l = i.marks.filter((d) => d !== o), c = { type: "text", text: i.text };
      l.length > 0 && (c.marks = l), (!e || e.href !== a) && (e = { type: "link", href: a, content: [] }, t.push(e)), e.content.push(c);
      continue;
    }
    e = null, t.push(i);
  }
  return t;
}
function As(r, t, e) {
  if (r.nodeType === Node.TEXT_NODE) {
    const o = r.nodeValue ?? "";
    o !== "" && e.push(st(o, t.length ? t : void 0));
    return;
  }
  if (r.nodeType !== Node.ELEMENT_NODE) return;
  const s = r, n = s.tagName;
  if (n === "BR") {
    e.push(st(`
`, t.length ? t : void 0));
    return;
  }
  vn.has(n) && (s.textContent ?? "").trim() !== "" && e.length > 0 && e.push(st(`
`, void 0));
  const i = An(s, t);
  for (const o of Array.from(s.childNodes))
    As(o, i, e);
}
function An(r, t) {
  const e = r.tagName;
  let s = t;
  const n = kn[e];
  if (n && (s = [...s, { type: n }]), e === "A") {
    const o = r.getAttribute("href") ?? "";
    Ht(o) && (s = [...s, { type: "link", attrs: { href: o } }]);
  }
  const i = r.getAttribute("data-ez-mark");
  if (i) {
    const o = {};
    for (const a of Array.from(r.attributes))
      a.name.startsWith("data-ez-") && a.name !== "data-ez-mark" && (o[Sn(a.name.slice(8))] = a.value);
    s = [...s, { type: i, attrs: Object.keys(o).length > 0 ? o : void 0 }];
  }
  return s;
}
function Sn(r) {
  return r.replace(/-([a-z])/g, (t, e) => e.toUpperCase());
}
function Eo(r) {
  if (typeof document > "u" || !r) return "";
  const t = document.createElement("div");
  return t.appendChild(F(r, document)), t.innerHTML;
}
function xn(r, t) {
  const e = r.ownerDocument ?? document, s = e.createRange();
  s.setStart(t.endContainer, t.endOffset), s.setEndAfter(r);
  const n = s.extractContents(), i = e.createElement("div");
  i.appendChild(n);
  const o = C(i);
  return { before: C(r), after: o };
}
function Dt(r) {
  return r ? r.map((e) => _(e) ? e.text : Lt(e) ? e.content.map((s) => s.text).join("") : "").join("").replace(/\u200B/g, "").trim() === "" : !0;
}
const In = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Cn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, zn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Bn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Tn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Ln = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Ve = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Dn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Mn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Nn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, On = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Ss = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Rn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Fn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, $n = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Pn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, _n = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Hn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, jn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Un = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, qn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Wn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Vn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Kn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Jn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Zn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Gn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, xs = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Yn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Xn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Qn = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ti = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ei = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, si = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ni = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ii = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ri = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, oi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ai = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, li = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="11" rx="2" />
  <path d="M3 8h18M12 3v11M9 20h6M12 17v6" />
</svg>
`, ci = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="11" height="18" rx="2" />
  <path d="M8 3v18M3 12h11M17 12h6M20 9v6" />
</svg>
`, di = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="11" rx="2" />
  <path d="M3 8h18M12 3v11M9 20h6" />
</svg>
`, hi = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="11" height="18" rx="2" />
  <path d="M8 3v18M3 12h11M17 12h6" />
</svg>
`, ui = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, pi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, Is = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, fi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, gi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, mi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, bi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, yi = `<!-- @license lucide-static v1.43.0 - ISC -->
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
`, ki = `<!-- @license lucide-static v1.43.0 - ISC -->
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
  save: In,
  plus: Cn,
  grip: zn,
  trash: Bn,
  copy: Tn,
  up: Ln,
  down: Ve,
  alignLeft: Fn,
  alignCenter: $n,
  alignRight: Pn,
  search: _n,
  file: Hn,
  folder: jn,
  folderOpen: Un,
  folderPlus: qn,
  moon: Wn,
  sun: Vn,
  monitor: Kn,
  maximize: Jn,
  minimize: Zn,
  x: Gn,
  undo: Yn,
  redo: Xn,
  download: Qn,
  upload: ti,
  restore: ei,
  outline: si,
  strikethrough: ni,
  highlighter: ii,
  code: Ss,
  textColor: ri,
  backgroundColor: oi,
  tableRowAdd: li,
  tableColumnAdd: ci,
  tableRowDelete: di,
  tableColumnDelete: hi,
  tableHeader: ui,
  info: Is,
  caretRight: xs,
  caretDown: Ve,
  panelLeft: fi,
  link: gi,
  ellipsis: mi,
  bold: bi,
  italic: yi,
  underline: ki
}, H = {
  paragraph: Dn,
  heading: Mn,
  list: Nn,
  quote: On,
  code: Ss,
  delimiter: Rn,
  table: ai,
  image: pi,
  callout: Is,
  toggle: xs
};
function Cs(r) {
  return typeof r == "string" && /^(?:\s|<!--[\s\S]*?-->)*<svg(?:\s|>)/i.test(r);
}
function L(r) {
  const t = document.createElement("span");
  t.className = "ez-menu-icon", t.innerHTML = r, t.setAttribute("aria-hidden", "true");
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
    return s != null && s.content && !Dt(s.content) && e.appendChild(F(s.content, t)), this.editable = e, e;
  }
  validate(t) {
    return !!t;
  }
  merge(t) {
    var o;
    const e = ((o = this.api.getData()) == null ? void 0 : o.content) ?? [], s = (t == null ? void 0 : t.content) ?? [], n = O([...e, ...s]), i = { content: n };
    return this.replaceEditableContent(this.editable, F(n, this.editable.ownerDocument)), this.api.update(i), i;
  }
  /** Sync the DOM after an external transaction updated this block. */
  updated() {
    const t = this.api.getData();
    if (!this.editable) return;
    const e = C(this.editable);
    JSON.stringify(O(e)) !== JSON.stringify(O((t == null ? void 0 : t.content) ?? [])) && this.replaceEditableContent(this.editable, F((t == null ? void 0 : t.content) ?? [], this.editable.ownerDocument));
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
    const { before: e, after: s } = xn(this.editable, t), n = this.tagDataShape(), i = { ...n, content: e }, o = { ...n, content: s };
    return [i, o];
  }
  /** Extra fields kept on split (e.g. heading level). */
  tagDataShape() {
    return {};
  }
  destroy() {
  }
}
const Et = class Et extends Mt {
  constructor(t) {
    var s;
    const e = (s = t.config) == null ? void 0 : s.placeholder;
    super(t, typeof e == "string" ? e : "", !1);
  }
  tag() {
    return "p";
  }
  save(t) {
    return { content: C(this.editable) };
  }
};
Et.toolbox = { icon: H.paragraph, title: "Paragraph", category: "Basic blocks" }, Et.conversion = { to: ["heading", "list", "quote", "code", "delimiter"] }, Et.enableInlineTools = !0;
let de = Et;
const ut = class ut extends Mt {
  constructor(t) {
    var i;
    super(t, "", !1), this.levels = [1, 2, 3], this.level = 2;
    const e = (i = t.config) == null ? void 0 : i.levels;
    if (Array.isArray(e)) {
      const o = e.filter((a) => typeof a == "number" && a >= 1 && a <= 6);
      o.length > 0 && (this.levels = o);
    }
    const s = this.api.getData(), n = Number(s == null ? void 0 : s.level);
    this.level = this.levels.includes(n) ? n : this.levels[0] ?? 2;
  }
  tag() {
    return `h${this.level}`;
  }
  save(t) {
    return { level: this.level, content: C(this.editable) };
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
        this.api.readOnly || (this.level = e, this.api.update({ level: this.level, content: C(this.editable) }), this.refreshElement(), this.api.focus("end"));
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
ut.toolbox = { icon: H.heading, title: "Heading", category: "Basic blocks" }, ut.shortcut = "CMD+SHIFT+2", ut.conversion = { to: ["paragraph", "list", "quote"] }, ut.enableInlineTools = !0;
let he = ut;
const At = class At extends Mt {
  constructor(t) {
    super(t, "", !1);
  }
  tag() {
    return "blockquote";
  }
  save(t) {
    return { content: C(this.editable) };
  }
};
At.toolbox = { icon: H.quote, title: "Quote", category: "Basic blocks" }, At.conversion = { to: ["paragraph", "heading", "list"] }, At.enableInlineTools = !0;
let ue = At;
const pt = class pt extends Mt {
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
pt.toolbox = { icon: H.code, title: "Code", category: "Basic blocks" }, pt.shortcut = "CMD+SHIFT+C", pt.enterKey = "newline", pt.conversion = { to: ["paragraph", "delimiter"] };
let pe = pt;
const St = class St {
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
St.toolbox = { icon: H.delimiter, title: "Divider", category: "Basic blocks" }, St.enterKey = "ignore", St.conversion = { to: ["paragraph"] };
let fe = St;
const ft = class ft {
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
    var o;
    const t = ((o = this.editable) == null ? void 0 : o.ownerDocument) ?? document, e = t.createElement("div");
    e.classList.add("ez-text-input", "ez-list"), e.contentEditable = "true", e.setAttribute("data-ez-editable", "true"), e.setAttribute("data-ez-multiline", "true");
    const s = t.createElement(this.tag()), n = this.api.getData();
    return (Array.isArray(n == null ? void 0 : n.items) && n.items.length > 0 ? n.items : [{ content: [] }]).forEach((a, l) => {
      const c = t.createElement("li");
      this.style === "task" && (c.appendChild(this.createCheckbox((a == null ? void 0 : a.checked) === !0, l, c)), c.classList.toggle("ez-task-checked", (a == null ? void 0 : a.checked) === !0)), a != null && a.content && !Dt(a.content) && c.appendChild(F(a.content, t)), s.appendChild(c);
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
      const n = { content: C(s) };
      if (this.style === "task") {
        const i = s.querySelector(".ez-task-checkbox");
        n.checked = (i == null ? void 0 : i.checked) === !0;
      }
      e.push(n);
    }
    return e.length === 0 && e.push({ content: [] }), { style: this.style, items: Ke(e) };
  }
  validate(t) {
    return !!t && Array.isArray(t.items);
  }
  merge(t) {
    var i;
    const e = ((i = this.api.getData()) == null ? void 0 : i.items) ?? [], s = Ke([...e, ...(t == null ? void 0 : t.items) ?? []]), n = { style: this.style, items: s };
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
    var i, o;
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
      const l = s[a], c = ((i = n[a]) == null ? void 0 : i.content) ?? [], d = C(l);
      if (JSON.stringify(O(d)) !== JSON.stringify(O(c))) {
        for (; l.firstChild; ) l.removeChild(l.firstChild);
        l.appendChild(F(c, l.ownerDocument));
      }
      if (this.style === "task") {
        const h = l.querySelector(".ez-task-checkbox");
        if (h) {
          const u = ((o = n[a]) == null ? void 0 : o.checked) === !0;
          h.checked !== u && (h.checked = u, l.classList.toggle("ez-task-checked", u));
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
    const s = Array.from(this.listEl.children).filter((o) => o.tagName === "LI"), n = t === "end" ? s[s.length - 1] : s[0];
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
ft.toolbox = { icon: H.list, title: "List", category: "Basic blocks" }, ft.shortcut = "CMD+SHIFT+L", ft.conversion = { to: ["paragraph", "quote", "heading"] }, ft.enableInlineTools = !0;
let ge = ft;
function Ke(r) {
  return r.map((t) => {
    const e = { content: O((t == null ? void 0 : t.content) ?? []) };
    return (t == null ? void 0 : t.checked) !== void 0 && (e.checked = t.checked), e;
  });
}
function f(r, t, e) {
  const s = document.createElement(r);
  return t && (s.className = t), e !== void 0 && (s.textContent = e), s;
}
function S(r, t, e) {
  const s = f("button", r);
  return s.type = "button", s.textContent = t, s.setAttribute("aria-label", e ?? t), s;
}
function E(r, t, e) {
  const s = f("button", r);
  s.type = "button", s.setAttribute("aria-label", e), s.title = e, s.innerHTML = t;
  for (const n of Array.from(s.querySelectorAll("svg")))
    n.setAttribute("stroke-width", "1.8");
  return s;
}
function D(r) {
  for (; r.firstChild; ) r.removeChild(r.firstChild);
}
function vi(r, t = 8) {
  r.style.maxWidth = `calc(100vw - ${t * 2}px)`, r.style.maxHeight = `calc(100dvh - ${t * 2}px)`;
  const e = r.getBoundingClientRect(), s = Math.max(t, Math.min(e.left, window.innerWidth - t - e.width)), n = Math.max(t, Math.min(e.top, window.innerHeight - t - e.height));
  r.style.transform = "none", r.style.position = "fixed", r.style.left = `${s}px`, r.style.top = `${n}px`;
}
function P(r, t) {
  r.style.position = "fixed", r.style.transform = "none", r.style.left = `${t.left}px`, r.style.top = `${t.bottom + 6}px`;
  const e = r.getBoundingClientRect().height;
  t.bottom + 6 + e > window.innerHeight - 8 && t.top > e + 8 && (r.style.top = `${t.top - e - 6}px`), vi(r);
}
function Xt(r, t) {
  var i;
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(r.key) || r.target.matches("input, select, textarea")) return;
  const e = Array.from(t.querySelectorAll("button:not(:disabled), select:not(:disabled)")), s = e.indexOf(document.activeElement), n = r.key === "Home" ? 0 : r.key === "End" ? e.length - 1 : (s + (r.key === "ArrowDown" ? 1 : -1) + e.length) % e.length;
  (i = e[n]) == null || i.focus(), r.preventDefault();
}
function ze(r, t, e) {
  var s;
  try {
    (s = r.ownerDocument) == null || s.execCommand(t, !1, e);
  } catch {
  }
}
function bt(r, t) {
  var e;
  try {
    return ((e = r.ownerDocument) == null ? void 0 : e.queryCommandState(t)) ?? !1;
  } catch {
    return !1;
  }
}
function Qt(r, t, e) {
  let s = r.startContainer;
  for (; s && s !== t; ) {
    if (s.nodeType === Node.ELEMENT_NODE && e(s))
      return s;
    s = s.parentNode;
  }
  return null;
}
function wi(r) {
  const t = window.getSelection(), e = /* @__PURE__ */ new Set();
  if (!t || t.rangeCount === 0) return e;
  const s = t.getRangeAt(0);
  if (!r.contains(s.commonAncestorContainer)) return e;
  bt(r, "bold") && e.add("bold"), bt(r, "italic") && e.add("italic"), bt(r, "underline") && e.add("underline");
  let n = s.startContainer;
  for (; n && n !== r; ) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const i = n.tagName;
      i === "CODE" && e.add("code"), i === "MARK" && e.add("mark"), i === "A" && e.add("link"), i === "SPAN" && n.hasAttribute("data-ez-mark") && e.add(n.getAttribute("data-ez-mark"));
    }
    n = n.parentNode;
  }
  return e;
}
function Ct(r, t) {
  const e = r.startContainer.ownerDocument ?? t.ownerDocument, s = r.extractContents();
  t.appendChild(s), r.insertNode(t);
  const n = window.getSelection();
  if (n) {
    const i = e.createRange();
    i.selectNodeContents(t), n.removeAllRanges(), n.addRange(i);
  }
}
function me(r) {
  const t = r.parentNode;
  if (!t) return;
  const e = r.ownerDocument, s = r.firstChild, n = r.lastChild, i = e.createDocumentFragment();
  for (; r.firstChild; ) i.appendChild(r.firstChild);
  t.insertBefore(i, r);
  const o = window.getSelection();
  if (o && s && n) {
    const a = e.createRange();
    a.setStartBefore(s), a.setEndAfter(n), o.removeAllRanges(), o.addRange(a);
  }
  t.removeChild(r);
}
function Be(r, t) {
  const e = r.parentNode;
  if (!e) return;
  const s = r.ownerDocument, n = r.contains(t.startContainer), i = r.contains(t.endContainer), o = n ? t.startContainer : r, a = n ? t.startOffset : 0, l = i ? t.endContainer : r, c = i ? t.endOffset : r.childNodes.length, d = !n || o === r && a === 0, h = !i || l === r && c === r.childNodes.length;
  if (d && h) {
    me(r);
    return;
  }
  try {
    const u = s.createRange();
    u.setStart(r, 0), u.setEnd(o, a);
    const p = s.createRange();
    p.setStart(o, a), p.setEnd(l, c);
    const g = s.createRange();
    g.setStart(l, c), g.setEnd(r, r.childNodes.length);
    const m = u.extractContents(), y = p.extractContents(), v = g.extractContents(), w = m.firstChild ? r.cloneNode(!1) : null, I = v.firstChild ? r.cloneNode(!1) : null;
    w && (w.appendChild(m), e.insertBefore(w, r)), e.insertBefore(y, r), I && (I.appendChild(v), e.insertBefore(I, r)), e.removeChild(r);
  } catch {
    me(r);
  }
}
function zs(r, t, e, s) {
  var m, y;
  const n = t instanceof HTMLElement ? t : t.commonAncestorContainer, o = (((m = n instanceof Element ? n : n.parentElement) == null ? void 0 : m.ownerDocument) ?? document).createElement("div");
  o.className = "ez-popover ez-inline-popover", o.setAttribute("role", "dialog"), o.setAttribute("aria-label", r.getAttribute("aria-label") ?? "Link"), o.setAttribute("data-ez-ui", "true"), o.appendChild(r);
  const a = ((y = n instanceof Element ? n : n.parentElement) == null ? void 0 : y.closest(".ez-editor")) ?? document.body;
  a.appendChild(o);
  const l = () => {
    const v = s != null && s.isConnected && s.getClientRects().length ? s : t;
    P(o, v.getBoundingClientRect());
  };
  l();
  let c = !1;
  const d = (v) => {
    v.key === "Escape" && (v.preventDefault(), v.stopPropagation(), p());
  }, h = (v) => {
    o.contains(v.target) || p(!1);
  }, u = (v) => {
    o.contains(v.target) || p(!1);
  };
  function p(v = !0) {
    c || (c = !0, document.removeEventListener("keydown", d, !0), document.removeEventListener("mousedown", h, !0), document.removeEventListener("focusin", u), window.removeEventListener("resize", l), document.removeEventListener("scroll", l, !0), a.removeEventListener("ez-close-popovers", g), o.remove(), v && (e == null || e()));
  }
  const g = () => p(!1);
  return document.addEventListener("keydown", d, !0), document.addEventListener("mousedown", h, !0), document.addEventListener("focusin", u), window.addEventListener("resize", l), document.addEventListener("scroll", l, !0), a.addEventListener("ez-close-popovers", g), { close: p };
}
class kt {
  constructor(t) {
    this.node = null, this.options = t;
  }
  render() {
    var s;
    const t = this.options.t(this.labelKey), e = this.icon ? E("ez-inline-tool-btn", this.icon, t) : S("ez-inline-tool-btn", t, t);
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
class Te extends kt {
  constructor(t, e, s) {
    super(t), this.markType = e, this.tag = s;
  }
  get labelKey() {
    return `inline.${this.markType}`;
  }
  apply(t, e) {
    const s = Qt(
      t,
      e.blockElement,
      (n) => {
        var i;
        return n.tagName === this.tag.toUpperCase() || ((i = n.getAttribute) == null ? void 0 : i.call(n, "data-ez-mark")) === this.markType;
      }
    );
    if (s)
      Be(s, t);
    else if (this.markType === "code" || this.markType === "mark") {
      const n = e.blockElement.ownerDocument.createElement(this.tag);
      Ct(t, n);
    } else {
      const n = e.blockElement.ownerDocument.createElement("span");
      n.setAttribute("data-ez-mark", this.markType), Ct(t, n);
    }
    e.requestSave();
  }
}
class Ei extends kt {
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
    ze(e.blockElement, "bold"), e.requestSave();
  }
  isActive() {
    return bt(document, "bold");
  }
}
class Ai extends kt {
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
    ze(e.blockElement, "italic"), e.requestSave();
  }
  isActive() {
    return bt(document, "italic");
  }
}
class Si extends kt {
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
    ze(e.blockElement, "underline"), e.requestSave();
  }
  isActive() {
    return bt(document, "underline");
  }
}
class xi extends Te {
  constructor(t) {
    super(t, "code", "code");
  }
  get icon() {
    return b.code;
  }
}
class Ii extends Te {
  constructor(t) {
    super(t, "mark", "mark");
  }
  get icon() {
    return b.highlighter;
  }
}
class Ci extends Te {
  constructor(t) {
    super(t, "strike", "s");
  }
  get icon() {
    return b.strikethrough;
  }
  apply(t, e) {
    const s = Qt(t, e.blockElement, (n) => {
      var i;
      return n.tagName === "S" || ((i = n.getAttribute) == null ? void 0 : i.call(n, "data-ez-mark")) === "strike";
    });
    if (s)
      Be(s, t);
    else {
      const n = e.blockElement.ownerDocument.createElement("s");
      Ct(t, n);
    }
    e.requestSave();
  }
}
const zi = [
  "var(--ez-text)",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#ec4899",
  "#7c3aed",
  "transparent"
];
class Bs extends kt {
  get labelKey() {
    return `inline.${this.markType}`;
  }
  apply(t, e) {
    t.collapsed || this.promptForColor(t, e);
  }
  promptForColor(t, e) {
    const s = f("div", "ez-color-form");
    s.setAttribute("aria-label", this.options.t(this.labelKey));
    const n = () => {
      if (!t.startContainer.isConnected || e.blockElement.contentEditable === "false") return;
      e.blockElement.focus();
      const o = window.getSelection();
      o == null || o.removeAllRanges(), o == null || o.addRange(t);
    };
    for (const o of zi) {
      const a = f("button", "ez-color-swatch");
      a.type = "button", a.setAttribute("aria-label", o === "transparent" ? "Remove color" : `Set ${this.markType} color ${o}`), a.style.background = o, a.title = o, a.addEventListener("click", () => {
        n();
        const l = Bi(t, e.blockElement, this.markType);
        if (l && Be(l, t), o !== "transparent") {
          const c = e.blockElement.ownerDocument.createElement("span");
          c.setAttribute("data-ez-mark", this.markType), c.setAttribute(`data-ez-${this.markType}`, o), c.style.setProperty(this.markType === "color" ? "color" : "background-color", o), Ct(t, c);
        }
        e.requestSave(), i(), e.closeToolbar();
      }), s.appendChild(a);
    }
    const { close: i } = zs(s, t.cloneRange(), n, this.node ?? void 0);
  }
}
function Bi(r, t, e) {
  var n;
  let s = r.startContainer;
  for (; s && s !== t; ) {
    if (s.nodeType === Node.ELEMENT_NODE) {
      const i = s;
      if (((n = i.getAttribute) == null ? void 0 : n.call(i, "data-ez-mark")) === e) return i;
    }
    s = s.parentNode;
  }
  return null;
}
class Ti extends Bs {
  constructor() {
    super(...arguments), this.markType = "color";
  }
  get icon() {
    return b.textColor;
  }
}
class Li extends Bs {
  constructor() {
    super(...arguments), this.markType = "background";
  }
  get icon() {
    return b.backgroundColor;
  }
}
class Di extends kt {
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
    const s = Qt(t, e.blockElement, (n) => n.tagName === "A");
    this.promptForUrl(t.cloneRange(), e, s);
  }
  isActive(t) {
    return !1;
  }
  promptForUrl(t, e, s) {
    const n = f("form", "ez-link-form");
    n.setAttribute("aria-label", this.options.t("inline.link"));
    const i = f("input", "ez-link-input");
    i.type = "text", i.inputMode = "url", i.placeholder = "https://", i.value = (s == null ? void 0 : s.getAttribute("href")) ?? "", i.setAttribute("aria-label", this.options.t("inline.linkUrl"));
    const o = S("ez-btn ez-btn-primary", this.options.t("inline.linkApply")), a = S("ez-btn", this.options.t("inline.linkRemove"));
    a.disabled = !s;
    const l = S("ez-btn", this.options.t("inline.linkCancel")), c = f("div", "ez-field-error");
    c.id = `ez-link-error-${++Mi}`, c.setAttribute("role", "alert"), i.setAttribute("aria-describedby", c.id);
    const d = f("div", "ez-link-actions");
    d.append(o, a, l), n.append(i, c, d);
    const h = () => {
      if (!t.startContainer.isConnected || e.blockElement.contentEditable === "false") return;
      e.blockElement.focus();
      const g = window.getSelection();
      g == null || g.removeAllRanges(), g == null || g.addRange(t);
    }, { close: u } = zs(n, t, h, this.node ?? void 0), p = () => {
      const g = i.value.trim();
      if (!g || !Ni(g)) {
        i.setAttribute("aria-invalid", "true"), c.textContent = this.options.t("inline.linkInvalid"), i.focus();
        return;
      }
      if (h(), s)
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
          Ct(t, m);
      }
      e.requestSave(), u(), e.closeToolbar();
    };
    o.addEventListener("click", p), a.addEventListener("click", () => {
      s && (h(), me(s), e.requestSave()), u(), e.closeToolbar();
    }), l.addEventListener("click", () => u()), i.addEventListener("input", () => {
      i.removeAttribute("aria-invalid"), c.textContent = "";
    }), n.addEventListener("submit", (g) => {
      g.preventDefault(), p();
    }), i.focus();
  }
}
let Mi = 0;
function Ni(r) {
  try {
    const t = new URL(r, "https://ezynota.invalid");
    return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
  } catch {
    return !1;
  }
}
const Ts = {
  bold: Ei,
  italic: Ai,
  underline: Si,
  strike: Ci,
  code: xi,
  mark: Ii,
  color: Ti,
  background: Li,
  link: Di
}, ee = ["left", "center", "right"], Oi = {
  left: b.alignLeft,
  center: b.alignCenter,
  right: b.alignRight
}, $e = class $e {
  constructor(t) {
    this.value = "left", this.api = t.api, this.t = t.t, this.onChange = t.onChange;
    const e = t.value;
    this.value = ee.includes(e) ? e : "left";
  }
  render() {
    const t = document.createElement("div");
    t.className = "ez-inline-group";
    for (const e of ee) {
      const s = this.t(`tune.alignment.${e}`), n = E(
        "ez-inline-btn" + (e === this.value ? " ez-active" : ""),
        Oi[e],
        s
      );
      n.setAttribute("aria-pressed", String(e === this.value)), n.addEventListener("click", () => {
        var i;
        if (!this.api.readOnly) {
          this.value = e, (i = this.onChange) == null || i.call(this, e);
          for (const o of Array.from(t.children))
            o.classList.remove("ez-active"), o.setAttribute("aria-pressed", "false");
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
    this.value = ee.includes(t) ? t : "left";
  }
  applyWrap() {
    this.applyTo(this.api.element);
  }
  destroy() {
  }
};
$e.title = "Alignment";
let zt = $e;
class Je {
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
class Ri {
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
    var s, n, i, o;
    const e = this.rendered.get(t);
    if (e) {
      try {
        (n = (s = e.tool).destroy) == null || n.call(s);
        for (const a of e.tunes) (o = (i = a.instance).destroy) == null || o.call(i);
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
    var n, i, o, a;
    const e = this.rendered.get(t);
    if (!e) return;
    const s = e.tool;
    try {
      (n = s.removed) == null || n.call(s), (i = s.destroy) == null || i.call(s);
      for (const l of e.tunes) (a = (o = l.instance).destroy) == null || a.call(o);
    } catch {
    }
    e.element.remove(), this.rendered.delete(t), this.childrenSignatures.delete(t), this.blockSignatures.delete(t), this.tuneSignatures.delete(t), this.updateEmptyHint(this.rendered.size === 0), this.refreshPlaceholderScope();
  }
  move(t, e) {
    var c;
    const s = this.rendered.get(t);
    if (!s) return;
    const n = Array.from(this.blocksRoot.children).indexOf(s.element), i = Array.from(this.blocksRoot.children).filter((d) => d !== s.element), o = Math.max(0, Math.min(e, i.length)), a = i[o] ?? null;
    this.blocksRoot.insertBefore(s.element, a);
    const l = s.tool;
    try {
      (c = l.moved) == null || c.call(l, { from: n, to: o });
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
    var n, i, o, a;
    const s = this.rendered.get(t);
    if (!(s && this.applyTuneUpdate(t, s, e))) {
      if (s) {
        try {
          (i = (n = s.tool).destroy) == null || i.call(n);
          for (const l of s.tunes) (a = (o = l.instance).destroy) == null || a.call(o);
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
    var o;
    if (this.blockSignatures.get(t) !== Ze(s)) return !1;
    const i = [];
    for (const a of e.tunes) {
      const l = a.instance;
      if (typeof l.setValue != "function" || typeof l.applyTo != "function")
        return !1;
      i.push({ tune: a, setValue: l.setValue, applyTo: l.applyTo });
    }
    for (const a of i)
      a.setValue(((o = s.tunes) == null ? void 0 : o[a.tune.name]) ?? null), a.applyTo(e.host);
    return this.tuneSignatures.set(t, JSON.stringify(s.tunes ?? {})), !0;
  }
  stateIndexOf(t) {
    return this.hostApi.getBlockIndex(t);
  }
  renderBlockInto(t, e) {
    var h, u, p, g, m;
    const s = this.target.ownerDocument, n = this.hostApi.registry.has(t.type), i = n ? this.hostApi.registry.get(t.type) : void 0, o = s.createElement("div");
    o.className = "ez-block", o.setAttribute("data-ez-block-id", t.id), o.setAttribute("data-ez-block-type", t.type), o.setAttribute("role", "group"), o.setAttribute("aria-label", n ? ((h = i == null ? void 0 : i.toolbox) == null ? void 0 : h.title) ?? t.type : `Unsupported block (${t.type})`);
    const a = Fi(s, t.type);
    o.appendChild(a);
    let l;
    try {
      l = n ? this.createToolInstance(t, a) : new Je({ api: this.blockApiForTool(t.id, a) }), a.appendChild(l.render());
    } catch {
      for (; a.firstChild; ) a.removeChild(a.firstChild);
      l = new Je({ api: this.blockApiForTool(t.id, a) }), a.appendChild(l.render());
    }
    const c = Array.from(a.querySelectorAll("[data-ez-editable]"));
    for (const y of c)
      y.contentEditable = this.hostApi.readOnly ? "false" : "true", y.setAttribute("aria-label", n ? ((u = i == null ? void 0 : i.toolbox) == null ? void 0 : u.title) ?? t.type : `Unsupported block (${t.type})`), y.setAttribute("role", "textbox"), y.setAttribute("aria-multiline", "true");
    c.length === 0 && (o.tabIndex = 0, o.addEventListener("focus", () => {
      const y = o.ownerDocument.createRange();
      y.selectNodeContents(o), y.collapse(!0), this.hostApi.setSelectionFromRange(y);
    }));
    try {
      (p = l.rendered) == null || p.call(l);
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
    if (this.rendered.set(t.id, { element: o, host: a, tool: l, tunes: d }), this.childrenSignatures.set(t.id, JSON.stringify(t.children ?? [])), this.blockSignatures.set(t.id, Ze(t)), this.tuneSignatures.set(t.id, JSON.stringify(t.tunes ?? {})), typeof e == "number") {
      const y = this.blocksRoot.children[e] ?? null;
      this.blocksRoot.insertBefore(o, y);
    } else {
      const y = this.stateIndexOf(t.id), v = this.blocksRoot.children[y] ?? null;
      this.blocksRoot.insertBefore(o, v);
    }
    this.refreshEditableFlags(o);
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
    var o, a;
    const i = (a = (o = this.hostApi).nestedHost) == null ? void 0 : a.call(o, t.id);
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
      id: t,
      type: s.getBlockType(t) ?? "",
      get readOnly() {
        return s.readOnly;
      },
      element: e,
      getData: () => s.getBlockData(t),
      update: (n) => s.updateBlockData(t, n, "user"),
      patch: (n) => {
        const o = { ...s.getBlockData(t) ?? {}, ...n };
        s.updateBlockData(t, o);
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
        const o = i instanceof Element ? i : (i == null ? void 0 : i.parentElement) ?? null, a = (c = o == null ? void 0 : o.closest) == null ? void 0 : c.call(o, "[data-ez-block-id]"), l = a == null ? void 0 : a.getAttribute("data-ez-block-id");
        l && s.add(l);
      };
      for (const i of e)
        if (n(i.target), i.type === "childList")
          for (const o of Array.from(i.addedNodes)) n(o);
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
        for (const o of i.tunes) (n = (s = o.instance).destroy) == null || n.call(s);
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
function Ze(r) {
  return JSON.stringify({ type: r.type, data: r.data });
}
function Fi(r, t) {
  const e = r.createElement("div");
  return e.className = "ez-tool-host", e.setAttribute("data-ez-tool", t), e;
}
class $i {
  constructor(t, e) {
    this.bus = new Us(), this.current = null, this.savedRange = null, this.started = !1, this.stopped = !1, this.disposers = [], this.host = t, this.target = e;
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
    const n = t.collapsed, i = t.toString(), o = typeof window < "u" ? window.getSelection() : null, a = o && o.anchorNode ? o.anchorNode : t.startContainer, l = o && o.anchorNode ? o.anchorOffset : t.startOffset, c = o && o.focusNode ? o.focusNode : t.endContainer, d = o && o.focusNode ? o.focusOffset : t.endOffset, h = this.blockForBoundary(a, l), u = this.blockForBoundary(c, d), p = (y = t.commonAncestorContainer instanceof Element ? t.commonAncestorContainer : t.commonAncestorContainer.parentElement) == null ? void 0 : y.closest("[data-ez-region]"), g = {
      blockId: s,
      index: this.host.getBlockIndex(s),
      collapsed: n,
      anchorOffset: Ge(h ?? e, a, l),
      focusOffset: Ge(u ?? e, c, d),
      text: i,
      anchorBlockId: (h == null ? void 0 : h.getAttribute("data-ez-block-id")) ?? s,
      focusBlockId: (u == null ? void 0 : u.getAttribute("data-ez-block-id")) ?? s,
      regionId: (p == null ? void 0 : p.getAttribute("data-ez-region")) ?? void 0
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
function Ge(r, t, e) {
  try {
    const n = r.ownerDocument.createRange();
    return n.selectNodeContents(r.querySelector("[data-ez-editable]") ?? r), n.setEnd(t, e), n.toString().length;
  } catch {
    return 0;
  }
}
function Pi(r, t) {
  var d;
  const e = r.ownerDocument, s = window.getSelection();
  if (!s) return;
  const n = e.createTreeWalker(r, NodeFilter.SHOW_TEXT);
  let i = t, o = n.nextNode(), a = null, l = 0;
  for (; o; ) {
    const h = o, u = ((d = h.data) == null ? void 0 : d.length) ?? 0;
    if (i <= u) {
      a = h, l = i;
      break;
    }
    i -= u, o = n.nextNode();
  }
  const c = e.createRange();
  a ? (c.setStart(a, l), c.collapse(!0)) : (c.selectNodeContents(r), c.collapse(!1)), s.removeAllRanges(), s.addRange(c);
}
let jt = 0, be = 0;
function _i() {
  jt++;
}
function Hi() {
  jt = Math.max(0, jt - 1), be = Date.now();
}
function ji() {
  return jt > 0;
}
function Ui(r = 50) {
  return be !== 0 && Date.now() - be < r;
}
function qi(r) {
  if (ji() || Ui() || r.isComposing) return !0;
  const t = r.keyCode;
  return t === void 0 ? !1 : t === 229;
}
class Wi {
  constructor(t, e) {
    this.disposers = [], this.lastInputAt = /* @__PURE__ */ new Map(), this.composing = !1, this.lastCompositionEndAt = 0, this.lastCompositionBlock = "", this.onInputCallbacks = [], this.host = t, this.target = e;
  }
  start() {
    const t = (i) => {
      var a;
      let o = i;
      for (; o && o !== this.target; ) {
        if (o.nodeType === Node.ELEMENT_NODE) {
          const l = o;
          if ((a = l.hasAttribute) != null && a.call(l, "data-ez-editable")) {
            const c = l.closest("[data-ez-block-id]");
            if (c) {
              const d = l.closest("[data-ez-nested-id]"), h = d && c.contains(d) ? d.getAttribute("data-ez-nested-id") : null;
              return { id: c.getAttribute("data-ez-block-id") ?? "", nestedId: h, editable: l };
            }
          }
        }
        o = o.parentNode;
      }
      return null;
    }, e = (i) => {
      if (this.host.readOnly) return;
      const o = t(i.target);
      o && (this.lastInputAt.set(o.id, Date.now()), o.nestedId && this.lastInputAt.set(o.nestedId, Date.now()), this.updateEmptyState(o.editable), !this.composing && (this.lastCompositionEndAt !== 0 && Date.now() - this.lastCompositionEndAt < 50 && (o.nestedId ?? o.id) === this.lastCompositionBlock || this.emitInput(o.id, o.nestedId)));
    }, s = () => {
      this.composing = !0, _i();
    }, n = (i) => {
      this.composing = !1, Hi(), this.lastCompositionEndAt = Date.now();
      const o = t(i.target);
      this.lastCompositionBlock = o ? o.nestedId ?? o.id : "", o && (this.updateEmptyState(o.editable), this.emitInput(o.id, o.nestedId));
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
    (t.hasAttribute("data-ez-placeholder") || t.hasAttribute("data-ez-note-placeholder")) && t.setAttribute("data-ez-empty", s ? "true" : "false");
  }
  wasInputRecently(t, e = 250) {
    const s = this.lastInputAt.get(t);
    return s !== void 0 && Date.now() - s < e;
  }
}
function Ls(r) {
  if (!r || typeof r != "object") return "";
  const t = r;
  return typeof t.code == "string" ? t.code : Array.isArray(t.items) ? t.items.map((e) => ye((e == null ? void 0 : e.content) ?? [])).join(`
`) : Array.isArray(t.content) ? ye(t.content) : "";
}
function ye(r) {
  let t = "";
  for (const e of r)
    (e == null ? void 0 : e.type) === "text" ? t += e.text ?? "" : (e == null ? void 0 : e.type) === "link" && (t += (e.content ?? []).map((s) => (s == null ? void 0 : s.text) ?? "").join(""));
  return t;
}
function yt(r, t) {
  return !t || typeof t != "object" ? !0 : r === "delimiter" ? !1 : Ls(t).trim() === "";
}
function Vi(r, t) {
  const e = $t(t);
  switch (r) {
    case "paragraph":
      return { content: e };
    case "heading":
      return { level: 2, content: e };
    case "quote":
      return { content: e };
    case "list":
      return { style: "unordered", items: e.length > 0 ? e.map((s) => ({ content: [s] })) : [{ content: [] }] };
    case "code":
      return { code: ye(e) };
    case "delimiter":
      return {};
    default:
      return {};
  }
}
function $t(r) {
  if (!r || typeof r != "object") return [];
  const t = r;
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
function Ki(r) {
  var e;
  const t = r == null ? void 0 : r.items;
  return ((e = t == null ? void 0 : t[0]) == null ? void 0 : e.content) ?? [];
}
function Ji(r, t, e, s) {
  switch (r) {
    case "paragraph":
    case "heading":
    case "quote": {
      const n = $t(t), i = e === "list" ? Ki(s) : $t(s), l = { content: n.length > 0 && i.length > 0 ? [...n, { type: "text", text: `
` }, ...i] : [...n, ...i] };
      return r === "heading" && (l.level = t.level ?? 2), l;
    }
    case "list": {
      const n = $t(s);
      let i;
      return e === "list" ? i = [...se(t), ...se(s)] : i = [...se(t), ...n.map((o) => ({ content: [o] }))], { style: t.style ?? "unordered", items: i };
    }
    case "code": {
      const n = t.code ?? "", i = Ls(s);
      return { code: `${n}
${i}` };
    }
    default:
      return {};
  }
}
function se(r) {
  return ((r == null ? void 0 : r.items) ?? []).map((e) => ({ content: (e == null ? void 0 : e.content) ?? [] }));
}
function ke(r, t) {
  const e = ["paragraph", "heading", "quote"];
  return r === "list" ? t === "list" || e.includes(t) : r === "code" ? ["paragraph", "heading", "quote", "code"].includes(t) : e.includes(r) ? [...e, "list", "code"].includes(t) : !1;
}
class Zi {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.target = e;
  }
  start() {
    const t = (e) => {
      const s = e;
      this.host.readOnly || this.host.isDestroyed() || qi(s) || s.target.closest("[data-ez-ui]") || this.handle(s) && s.preventDefault();
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
    var o;
    const t = this.host.getSelectionInfo();
    if (!t) return !1;
    const e = this.host.getEditableElement(t.blockId), s = this.host.getBlockType(t.blockId);
    if (!e || !s || s === "code" || this.host.registry.get(s).toolClass.enableInlineTools === !1) return !1;
    const n = (o = this.host.getRange()) == null ? void 0 : o.cloneRange();
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
      const o = e.ownerDocument.createRange();
      o.setStartAfter(n), o.collapse(!0), i.removeAllRanges(), i.addRange(o);
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
    const o = this.host.getBlockData(t);
    if (yt(s, o))
      return this.host.insertBlock(this.host.defaultBlock, void 0, { after: t, focus: !0 }), !0;
    const a = this.host.getRange();
    if (!a) return !1;
    if (!a.collapsed) {
      const p = e.ownerDocument.createRange();
      p.setStart(a.startContainer, a.startOffset), e.contains(a.endContainer) ? p.setEnd(a.endContainer, a.endOffset) : p.setEnd(e, e.childNodes.length), p.deleteContents();
    }
    const l = i.splitAtRange(a);
    if (!l) return !1;
    const [c, d] = l, h = this.host.splitBlock(t, c, d);
    return h ? (this.host.focusBlock(h, "start"), this.host.announce("Block split"), !0) : !1;
  }
  handleBackspace() {
    const t = this.host.getSelectionInfo();
    if (!t || !t.collapsed) return !1;
    const e = this.host.getEditableElement(t.blockId);
    if (!e || !Gi(e, this.host.getRange())) return !1;
    const s = this.host.getBlockIndex(t.blockId);
    if (s <= 0) return !1;
    const n = this.host.blocks.blocks[s - 1];
    if (!n) return !1;
    const i = this.host.getBlockType(t.blockId) ?? "";
    return yt(i, this.host.getBlockData(t.blockId)) ? (this.host.removeBlock(t.blockId, "user"), this.host.focusBlock(n.id, "end"), !0) : ke(n.type, i) ? (this.host.mergeBlocks(n.id, t.blockId, "user"), !0) : !1;
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
    if (!e || !Yi(e, this.host.getRange())) return !1;
    const s = this.host.getBlockIndex(t.blockId);
    if (s < 0) return !1;
    const n = this.host.blocks.blocks[s + 1];
    if (!n) return !1;
    const i = this.host.getBlockType(t.blockId) ?? "";
    return yt(i, this.host.getBlockData(t.blockId)) ? (this.host.removeBlock(t.blockId, "user"), this.host.focusBlock(n.id, "start"), !0) : ke(i, n.type) ? (this.host.mergeBlocks(t.blockId, n.id, "user"), !0) : !1;
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
function Gi(r, t) {
  if (!t || !t.collapsed) return !1;
  const e = r.ownerDocument.createRange();
  e.selectNodeContents(r);
  try {
    e.setEnd(t.startContainer, t.startOffset);
  } catch {
    return !1;
  }
  return e.toString().replace(/\u200B/g, "").length === 0;
}
function Yi(r, t) {
  if (!t || !t.collapsed) return !1;
  const e = r.ownerDocument.createRange();
  e.selectNodeContents(r);
  try {
    e.setStart(t.endContainer, t.endOffset);
  } catch {
    return !1;
  }
  return e.toString().replace(/\u200B/g, "").length === 0;
}
const Xi = /* @__PURE__ */ new Set([
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
]), Qi = /* @__PURE__ */ new Set([
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
]), Ye = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }, tr = {
  A: /* @__PURE__ */ new Set(["href"]),
  IMG: /* @__PURE__ */ new Set(["src", "alt"])
};
function er(r, t, e) {
  var n;
  return ((n = tr[r]) == null ? void 0 : n.has(t)) ?? !1 ? t === "href" ? G(e) || e.startsWith("note:") : t === "src" ? Z(e) : !0 : !1;
}
function sr(r) {
  for (const e of Array.from(r.querySelectorAll("*"))) {
    if (Xi.has(e.tagName)) {
      const s = e.parentNode;
      s && s.removeChild(e);
      continue;
    }
    for (const s of Array.from(e.attributes))
      er(e.tagName, s.name, s.value) || e.removeAttribute(s.name);
  }
  const t = r.ownerDocument.createTreeWalker(r, NodeFilter.SHOW_COMMENT);
  for (; t.nextNode(); ) {
    const e = t.currentNode;
    e.parentNode && e.parentNode.removeChild(e);
  }
}
function Ds(r) {
  const t = new DOMParser().parseFromString(r, "text/html");
  return sr(t.body), nr(t.body);
}
function nr(r) {
  const t = [];
  let e = [];
  const s = () => {
    if (e.length === 0) return;
    const n = r.ownerDocument.createElement("div");
    for (const o of e) n.appendChild(o);
    const i = C(n);
    i.length > 0 && t.push({ type: "paragraph", data: { content: i } }), e = [];
  };
  for (const n of Array.from(r.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      (n.textContent ?? "").trim() !== "" && e.push(n);
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const i = n, o = i.tagName;
    if (Qi.has(o)) {
      e.push(n);
      continue;
    }
    if (s(), o in Ye) {
      const a = Ye[o], l = C(i);
      l.length > 0 && t.push({ type: "heading", data: { level: a, content: l } });
    } else if (o === "UL" || o === "OL") {
      const a = Array.from(i.children).filter((l) => l.tagName === "LI").map((l) => ({ content: C(l) }));
      a.length > 0 && t.push({ type: "list", data: { style: o === "OL" ? "ordered" : "unordered", items: a } });
    } else if (o === "BLOCKQUOTE") {
      const a = C(i);
      a.length > 0 && t.push({ type: "quote", data: { content: a } });
    } else if (o === "PRE") {
      const a = (i.textContent ?? "").replace(/\n$/, "");
      t.push({ type: "code", data: { code: a } });
    } else if (o === "HR")
      t.push({ type: "delimiter", data: {} });
    else if (o === "TABLE")
      for (const a of Array.from(i.querySelectorAll("tr")))
        for (const l of Array.from(a.querySelectorAll("th,td"))) {
          const c = C(l);
          c.length > 0 && t.push({ type: "paragraph", data: { content: c } });
        }
    else if (o === "IMG" || o === "PICTURE") {
      const a = o === "IMG" ? i : i.querySelector("img"), l = (a == null ? void 0 : a.getAttribute("src")) ?? "";
      a && Z(l) && t.push({ type: "image", data: { src: l, alt: a.getAttribute("alt") ?? "" } });
      continue;
    } else {
      const a = C(i);
      a.length > 0 && t.push({ type: "paragraph", data: { content: a } });
      for (const l of Array.from(i.querySelectorAll("img"))) {
        const c = l.getAttribute("src") ?? "";
        Z(c) && t.push({ type: "image", data: { src: c, alt: l.getAttribute("alt") ?? "" } });
      }
    }
  }
  return s(), t;
}
function Ms(r) {
  const t = r.split(/\r?\n/), e = [];
  for (const s of t) {
    if (s.trim() === "") continue;
    const n = [{ type: "text", text: s }];
    e.push({ type: "paragraph", data: { content: n } });
  }
  return e;
}
const ne = "application/x-ezynota+json";
class ir {
  constructor(t, e) {
    this.disposers = [], this.host = t, this.target = e;
  }
  start() {
    const t = (o) => {
      var l;
      const a = o;
      return !!a && this.target.contains(a) && !((l = a.closest) != null && l.call(a, "[data-ez-ui]"));
    }, e = (o) => {
      if (!t(o.target)) return;
      const a = o, l = this.host.getRange();
      if (!l || l.collapsed) return;
      const c = a.clipboardData;
      c && (a.preventDefault(), this.writeClipboard(c, l));
    }, s = (o) => {
      if (!t(o.target)) return;
      const a = o, l = this.host.getRange();
      if (!l || l.collapsed) return;
      const c = a.clipboardData;
      c && this.writeClipboard(c, l);
    }, n = async (o) => {
      const a = o, l = this.host.getSelectionInfo();
      if (!l || this.host.readOnly) return;
      a.preventDefault();
      const c = a.clipboardData;
      c && await this.paste(c, l.blockId);
    }, i = async (o) => {
      const a = o;
      if (this.host.readOnly) return;
      const l = a.dataTransfer, c = l == null ? void 0 : l.files;
      if (!c || c.length === 0) {
        const h = (l == null ? void 0 : l.getData("text/plain")) ?? "", u = (l == null ? void 0 : l.getData("text/html")) ?? "";
        if (h === "" && u === "" || !l) return;
        const p = this.host.getSelectionInfo();
        if (!p) return;
        a.preventDefault(), await this.paste(l, p.blockId);
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
    const i = Array.from(this.target.querySelectorAll("[data-ez-block-id]")), o = [];
    let a = !1;
    for (const c of i)
      if (c === e && (a = !0), a && o.push(c.getAttribute("data-ez-block-id") ?? ""), c === n) break;
    const l = [];
    for (const c of o) {
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
      const i = s.map((o) => or(o)).join(`

`);
      t.setData("text/plain", i), t.setData("text/html", s.map((o) => ar(o)).join(""));
      try {
        t.setData(ne, JSON.stringify({ blocks: s }));
      } catch {
      }
      return;
    }
    const n = e.toString().replace(/\u200B/g, "");
    t.setData("text/plain", n);
    try {
      const i = e.cloneContents();
      t.setData("text/html", lr(i));
    } catch {
    }
    try {
      t.setData(ne, JSON.stringify({ text: n }));
    } catch {
    }
  }
  /** Paste priority: Ezynota JSON → files → sanitized HTML → plain text. */
  async paste(t, e) {
    const s = t.getData(ne);
    if (s)
      try {
        const o = JSON.parse(s);
        if (Array.isArray(o.blocks) && o.blocks.length > 0) {
          const a = rr(o.blocks);
          if (a.length > 0) {
            this.insertClipboardBlocks(a, e);
            return;
          }
        }
        if (typeof o.text == "string" && o.text !== "") {
          this.insertTextAtCaret(o.text, e);
          return;
        }
      } catch {
      }
    if (t.files && t.files.length > 0 && await this.routeFiles(Array.from(t.files), e))
      return;
    const n = t.getData("text/html");
    if (n && n.trim() !== "") {
      const o = Ds(n);
      if (o.length > 0) {
        this.insertParsed(o, e);
        return;
      }
    }
    const i = t.getData("text/plain") ?? "";
    i.trim() !== "" && (i.includes(`
`) ? this.insertParsed(Ms(i), e) : this.insertTextAtCaret(i, e));
  }
  /** Route files to tools that declare matching file paste rules. */
  async routeFiles(t, e) {
    var s;
    for (const n of this.host.registry.listBlockTools()) {
      const i = (s = n.toolClass.paste) == null ? void 0 : s.files;
      if (!i) continue;
      const o = i.mimeTypes ?? [], a = t.filter(
        (d) => o.some(
          (h) => h.endsWith("/*") ? d.type.startsWith(h.slice(0, -1)) : d.type === h
        )
      );
      if (a.length === 0) continue;
      const l = this.host.getTool(e);
      if (l != null && l.onPaste && this.host.getBlockType(e) === n.name)
        return l.onPaste({ files: a }), !0;
      const c = n.toolClass.filesToBlockDataAsync;
      if (typeof c == "function") {
        const d = await c(a);
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
    const s = this.host.getEditableElement(e), n = this.host.getRange(), i = n ? this.closestBlock(n.startContainer) : null, o = (i == null ? void 0 : i.getAttribute("data-ez-block-id")) === e;
    if (!s || !n || !o) {
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
function rr(r) {
  return (ae({ blocks: r }).document ?? { blocks: [] }).blocks.map((s) => ({ type: s.type, data: s.data }));
}
function or(r) {
  const t = r.data;
  return typeof t.code == "string" ? t.code : Array.isArray(t.items) ? t.items.map((e) => Xe((e == null ? void 0 : e.content) ?? [])).join(`
`) : Xe(Array.isArray(t.content) ? t.content : []);
}
function Xe(r) {
  let t = "";
  for (const e of r)
    (e == null ? void 0 : e.type) === "text" ? t += e.text ?? "" : (e == null ? void 0 : e.type) === "link" && (t += (e.content ?? []).map((s) => (s == null ? void 0 : s.text) ?? "").join(""));
  return t;
}
function ar(r) {
  const t = document.implementation.createHTMLDocument("copy"), e = t.createElement("div");
  e.setAttribute("data-ez-block-type", r.type);
  const s = r.data;
  if (typeof s.code == "string") {
    const n = t.createElement("pre");
    n.textContent = s.code, e.appendChild(n);
  } else if (Array.isArray(s.items)) {
    const n = t.createElement(s.style === "ordered" ? "ol" : "ul");
    for (const i of s.items) {
      const o = t.createElement("li");
      o.appendChild(Qe((i == null ? void 0 : i.content) ?? [], t)), n.appendChild(o);
    }
    e.appendChild(n);
  } else if (Array.isArray(s.content)) {
    let n = "p";
    if (r.type === "heading") {
      const o = Number(s.level ?? 2);
      n = Number.isInteger(o) && o >= 1 && o <= 6 ? `h${o}` : "p";
    } else r.type === "quote" && (n = "blockquote");
    const i = t.createElement(n);
    i.appendChild(Qe(s.content, t)), e.appendChild(i);
  } else r.type === "delimiter" && e.appendChild(t.createElement("hr"));
  return e.innerHTML;
}
function lr(r) {
  const t = document.implementation.createHTMLDocument("copy"), e = t.createElement("div");
  return e.appendChild(t.importNode(r, !0)), e.innerHTML;
}
function Qe(r, t) {
  return F(r, t);
}
class ts {
  constructor(t, e = !1) {
    this.host = t, this.documentMode = e, this.tools = [], this.visible = !1, this.savedRange = null, this.settingsKey = "", this.alignmentButtons = [], this.disposers = [], this.root = f("div", e ? "ez-document-toolbar" : "ez-inline-toolbar"), this.root.setAttribute("role", "toolbar"), this.root.setAttribute("data-ez-ui", "true"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.formatting")), this.root.addEventListener("mousedown", (n) => {
      n.target.closest("button") && n.preventDefault();
    }), this.root.addEventListener("keydown", (n) => {
      var i;
      n.key === "Escape" && (n.preventDefault(), (i = this.more) != null && i.open && (this.more.open = !1), this.restoreSelection(), this.documentMode || this.hide()), Xt(n, n.target.closest(".ez-more-panel") ?? this.root), n.stopPropagation();
    }), e && this.buildDocumentControls();
    for (const n of t.registry.listInlineTools()) {
      const i = t.registry.createInlineTool(n.name, {
        config: {},
        closeToolbar: () => {
          this.documentMode || this.hide();
        },
        onActivate: () => {
          this.restoreSelection() && (Ns(t, n.name, i), this.updateSelection(t.getSelectionInfo()));
        },
        t: (l) => t.i18n.t(l)
      }), o = i.render();
      this.tools.push({ name: n.name, instance: i, element: o }), (e && !["bold", "italic", "underline", "link"].includes(n.name) ? this.morePanel : this.root).appendChild(o);
    }
    e ? (this.buildAlignment(), this.root.appendChild(this.more), this.refresh()) : this.root.style.display = "none";
    const s = () => {
      var n, i;
      !this.documentMode && this.visible && ((n = this.savedRange) != null && n.startContainer.isConnected) && P(this.root, this.savedRange.getBoundingClientRect()), (i = this.more) != null && i.open && this.morePanel && P(this.morePanel, this.more.getBoundingClientRect());
    };
    window.addEventListener("resize", s), document.addEventListener("scroll", s, !0), this.disposers.push(() => window.removeEventListener("resize", s), () => document.removeEventListener("scroll", s, !0));
  }
  getElement() {
    return this.root;
  }
  buildDocumentControls() {
    const t = (n) => this.host.i18n.t(n);
    this.undoButton = S("ez-btn", t("toolbar.undo")), this.redoButton = S("ez-btn", t("toolbar.redo")), this.undoButton.addEventListener("click", () => {
      this.host.undo(), this.refresh();
    }), this.redoButton.addEventListener("click", () => {
      this.host.redo(), this.refresh();
    }), this.blockType = f("select", "ez-block-select"), this.blockType.setAttribute("aria-label", t("toolbar.blockType"));
    for (const n of this.host.registry.listBlockTools()) {
      if (!n.toolbox) continue;
      const i = f("option", void 0, n.toolbox.title);
      i.value = n.name, i.disabled = n.name === "delimiter", this.blockType.appendChild(i);
    }
    this.blockType.addEventListener("change", () => {
      var o;
      const n = this.blockType.value;
      if (!this.restoreSelection()) return;
      const i = (o = this.host.getSelectionInfo()) == null ? void 0 : o.blockId;
      i && (this.host.convertBlock(i, n), this.host.focusBlock(i, "end"), this.refresh());
    }), this.settings = f("div", "ez-inline-group ez-type-settings"), this.more = f("details", "ez-more-formatting");
    const e = f("summary", "ez-btn", t("toolbar.more"));
    this.morePanel = f("div", "ez-popover ez-more-panel"), this.morePanel.setAttribute("role", "group"), this.morePanel.setAttribute("aria-label", t("toolbar.more")), this.more.append(e, this.morePanel), this.more.addEventListener("toggle", () => {
      this.more.open && P(this.morePanel, e.getBoundingClientRect());
    });
    const s = (n) => {
      this.more.contains(n.target) || (this.more.open = !1);
    };
    document.addEventListener("pointerdown", s), document.addEventListener("focusin", s), this.disposers.push(() => document.removeEventListener("pointerdown", s), () => document.removeEventListener("focusin", s)), this.root.append(this.undoButton, this.redoButton, this.blockType, this.settings);
  }
  buildAlignment() {
    if (!this.host.registry.listTunes().some((s) => s.name === "alignment")) return;
    const t = { left: b.alignLeft, center: b.alignCenter, right: b.alignRight }, e = f("div", "ez-inline-group");
    e.setAttribute("role", "group"), e.setAttribute("aria-label", this.host.i18n.t("tune.alignment"));
    for (const s of ["left", "center", "right"]) {
      const n = E("ez-inline-btn", t[s] ?? "", this.host.i18n.t(`tune.alignment.${s}`));
      n.dataset.alignment = s, n.addEventListener("click", () => {
        var o;
        if (!this.restoreSelection()) return;
        const i = (o = this.host.getSelectionInfo()) == null ? void 0 : o.blockId;
        i && (this.host.blocks.setTune(i, "alignment", s), this.host.focusBlock(i, "end"), this.refresh());
      }), this.alignmentButtons.push(n), e.appendChild(n);
    }
    this.morePanel.append(f("div", "ez-menu-category", this.host.i18n.t("tune.alignment")), e);
  }
  updateSelection(t) {
    const e = this.host.getRange();
    if (t && e ? this.savedRange = e.cloneRange() : this.root.contains(document.activeElement) || (this.savedRange = null), !this.documentMode) {
      if (!t || t.collapsed || this.host.readOnly || !this.inlineEnabled(t) || !e) {
        this.hide();
        return;
      }
      this.visible = !0, this.root.style.display = "flex", P(this.root, e.getBoundingClientRect());
    }
    this.refresh();
  }
  refresh() {
    var l, c, d, h;
    const t = this.host.getSelectionInfo(), e = t ? this.host.getEditableElement(t.blockId) : null, s = !!t && !this.host.readOnly && this.inlineEnabled(t), n = e ? wi(e) : /* @__PURE__ */ new Set();
    for (const { name: u, instance: p, element: g } of this.tools) {
      let m = n.has(u);
      if (t && !m)
        try {
          m = p.isActive(t);
        } catch {
        }
      (l = p.setActive) == null || l.call(p, m);
      const y = ["mark", "code"].includes(u) || u === "link" && !n.has("link"), v = !s || y && !!(t != null && t.collapsed), w = g.matches("button") ? [g] : Array.from(g.querySelectorAll("button"));
      for (const I of w) I.disabled = v;
    }
    if (!this.documentMode) return;
    this.undoButton.disabled = this.host.readOnly || !this.host.canUndo(), this.redoButton.disabled = this.host.readOnly || !this.host.canRedo(), this.blockType.disabled = !t || this.host.readOnly;
    const i = t ? this.host.blocks.getById(t.blockId) : void 0;
    i && (this.blockType.value = i.type);
    const o = i == null ? void 0 : i.data, a = `${i == null ? void 0 : i.id}:${i == null ? void 0 : i.type}:${o == null ? void 0 : o.level}:${o == null ? void 0 : o.style}:${this.host.readOnly}`;
    if (a !== this.settingsKey && (this.settingsKey = a, D(this.settings), i && !this.host.readOnly)) {
      const u = (d = (c = this.host.getTool(i.id)) == null ? void 0 : c.renderSettings) == null ? void 0 : d.call(c);
      u && this.settings.appendChild(u);
    }
    for (const u of this.alignmentButtons)
      u.disabled = !i || this.host.readOnly, u.setAttribute("aria-pressed", String((((h = i == null ? void 0 : i.tunes) == null ? void 0 : h.alignment) ?? "left") === u.dataset.alignment));
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
    this.more && (this.more.open = !1), !this.documentMode && (this.visible = !1, this.root.style.display = "none");
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
function Ns(r, t, e) {
  var l;
  const s = r.getSelectionInfo();
  if (!s || r.readOnly) return;
  const n = r.getEditableElement(s.blockId), i = (l = r.getRange()) == null ? void 0 : l.cloneRange(), o = r.getBlockType(s.blockId);
  if (!n || !i || !o || o === "code" || !r.registry.has(o) || r.registry.get(o).toolClass.enableInlineTools === !1 || !r.registry.listInlineTools().some((c) => c.name === t) || i.collapsed && ["mark", "code"].includes(t) || i.collapsed && t === "link" && !Qt(i, n, (c) => c.tagName === "A")) return;
  n.focus(), r.setSelectionFromRange(i), (e ?? r.registry.createInlineTool(t, {
    config: {},
    closeToolbar: () => {
    },
    t: (c) => r.i18n.t(c)
  })).apply(i, {
    blockId: s.blockId,
    blockElement: n,
    range: i,
    requestSave: () => r.requestSaveBlock(s.blockId, "user"),
    closeToolbar: () => {
    }
  });
}
class cr {
  constructor(t) {
    this.settingsPopover = null, this.activeBlockId = null, this.open = !1, this.disposers = [], this.menuTunes = [], this.activeBlockElement = null, this.hoveredBlockId = null, this.host = t, this.root = f("div", "ez-block-toolbar"), this.root.setAttribute("role", "toolbar"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.blockActions")), this.root.setAttribute("data-ez-ui", "true"), this.root.hidden = !0, this.root.addEventListener("mousedown", (l) => {
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
        const d = Array.from(this.root.children).filter((p) => p.matches("button") && getComputedStyle(p).display !== "none"), h = (l.key === "ArrowRight" ? 1 : -1) * (this.host.target.getAttribute("dir") === "rtl" ? -1 : 1), u = d.indexOf(document.activeElement);
        (c = d[(u + h + d.length) % d.length]) == null || c.focus(), l.preventDefault();
      }
      if (l.key === "Escape") {
        l.preventDefault();
        const d = this.open;
        this.closeSettings(), d ? this.settingsButton.focus() : this.activeBlockId && this.host.focusBlock(this.activeBlockId, "end");
      }
      Xt(l, this.settingsPopover ?? this.root), l.stopPropagation();
    });
    const n = (l) => {
      this.root.contains(l.target) || this.closeSettings();
    }, i = () => {
      !this.root.hidden && this.activeBlockId && this.showFor(this.activeBlockId), this.settingsPopover && P(this.settingsPopover, this.settingsButton.getBoundingClientRect());
    }, o = () => {
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
        o();
        return;
      }
      if (this.root.contains(document.activeElement)) return;
      const h = c.closest("[data-ez-block-id]");
      if (h && this.host.target.contains(h)) {
        this.hoveredBlockId = h.getAttribute("data-ez-block-id"), this.hoveredBlockId && this.showFor(this.hoveredBlockId);
        return;
      }
      if (this.hoveredBlockId && this.activeBlockElement) {
        const u = this.activeBlockElement.getBoundingClientRect(), p = this.root.getBoundingClientRect();
        if (l.clientY >= p.top && l.clientY <= p.bottom && l.clientX >= Math.min(u.left, p.left) && l.clientX <= Math.max(u.right, p.right)) return;
      }
      o();
    };
    this.host.target.addEventListener("pointermove", a), this.host.target.addEventListener("pointerleave", o), document.addEventListener("pointerdown", n), document.addEventListener("focusin", n), window.addEventListener("resize", i), document.addEventListener("scroll", i, !0), this.disposers.push(
      () => document.removeEventListener("pointerdown", n),
      () => document.removeEventListener("focusin", n),
      () => window.removeEventListener("resize", i),
      () => document.removeEventListener("scroll", i, !0),
      () => this.host.target.removeEventListener("pointermove", a),
      () => this.host.target.removeEventListener("pointerleave", o)
    );
  }
  getElement() {
    return this.root;
  }
  showFor(t) {
    var h;
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
    this.activeBlockElement !== e && ((h = this.activeBlockElement) == null || h.classList.remove("ez-active")), this.activeBlockElement = e, e.classList.add("ez-active"), this.root.hidden = !1;
    const i = this.root.getBoundingClientRect(), o = this.host.getEditableElement(t), a = (o == null ? void 0 : o.querySelector("li")) ?? o, l = (a == null ? void 0 : a.getBoundingClientRect()) ?? n, c = a ? Number.parseFloat(getComputedStyle(a).lineHeight) || 26 : n.height;
    this.root.style.top = `${Math.round(l.top - s.top + this.host.target.scrollTop + (Math.min(c, l.height) - i.height) / 2)}px`;
    const d = this.host.target.getAttribute("dir") === "rtl";
    this.root.style.left = "", this.root.style.right = "", this.root.style[d ? "right" : "left"] = d ? `${Math.max(0, Math.round(s.right - n.right - i.width - 10))}px` : `${Math.max(0, Math.round(n.left - s.left - i.width - 10))}px`, this.root.classList.add("ez-visible"), this.root.classList.toggle("ez-hovered", this.hoveredBlockId === t || e.matches(":hover"));
  }
  hide() {
    var t;
    this.closeSettings(), this.root.hidden = !0, this.root.classList.remove("ez-visible", "ez-hovered"), this.hoveredBlockId = null, (t = this.activeBlockElement) == null || t.classList.remove("ez-active"), this.activeBlockElement = null;
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
    !this.activeBlockId || this.host.readOnly || (this.host.focusBlock(this.activeBlockId, "end"), this.settingsPopover = f("div", "ez-popover"), this.settingsPopover.setAttribute("role", "dialog"), this.settingsPopover.setAttribute("aria-label", this.host.i18n.t("toolbar.settings")), this.settingsPopover.addEventListener("focusout", (s) => {
      const n = s.relatedTarget;
      n && this.root.contains(n) || (this.closeSettings(), n || this.settingsButton.focus());
    }), this.renderSettingsMenu(this.activeBlockId), !this.host.target.querySelector(`[data-ez-block-id="${CSS.escape(this.activeBlockId)}"]`)) || (this.root.appendChild(this.settingsPopover), P(this.settingsPopover, this.settingsButton.getBoundingClientRect()), this.open = !0, this.settingsButton.setAttribute("aria-expanded", "true"), (e = this.settingsPopover.querySelector("button")) == null || e.focus());
  }
  closeSettings() {
    var s;
    const t = this.settingsPopover, e = this.menuTunes;
    this.settingsPopover = null, this.menuTunes = [], this.open = !1, this.settingsButton.setAttribute("aria-expanded", "false"), t == null || t.remove();
    for (const n of e) (s = n.destroy) == null || s.call(n);
  }
  renderSettingsMenu(t) {
    var h, u;
    const e = f("div", "ez-menu"), s = this.host.getBlockType(t) ?? "";
    e.appendChild(this.menuButton(b.plus, this.host.i18n.t("toolbar.addBelow"), () => {
      this.hide(), this.host.openBlockPicker(t, !0);
    }));
    const n = (u = (h = this.host.getTool(t)) == null ? void 0 : h.renderSettings) == null ? void 0 : u.call(h);
    n && e.appendChild(n);
    const i = this.host.registry.listBlockTools().filter((p) => p.name !== s && p.name !== "delimiter");
    if (i.length > 0) {
      e.appendChild(f("div", "ez-menu-category", this.host.i18n.t("settings.convert")));
      for (const p of i) {
        if (!p.toolbox) continue;
        const g = this.menuButton(p.toolbox.icon ?? "•", p.toolbox.title, () => {
          this.closeSettings(), this.hide(), this.host.convertBlock(t, p.name), this.host.focusBlock(t, "end");
        });
        e.appendChild(g);
      }
    }
    e.appendChild(f("div", "ez-menu-category", this.host.i18n.t("toolbar.settings")));
    const o = this.menuButton(b.copy, this.host.i18n.t("settings.duplicate"), () => {
      this.closeSettings(), this.hide();
      const p = this.host.duplicateBlock(t);
      this.host.focusBlock(p, "end");
    }), a = this.menuButton(b.up, this.host.i18n.t("settings.moveUp"), () => {
      this.closeSettings(), this.hide();
      const p = this.host.getBlockIndex(t);
      p > 0 && this.host.moveBlock(t, p - 1), this.host.focusBlock(t, "end");
    }), l = this.menuButton(b.down, this.host.i18n.t("settings.moveDown"), () => {
      this.closeSettings(), this.hide();
      const p = this.host.getBlockIndex(t);
      p >= 0 && p < this.host.blocks.length - 1 && this.host.moveBlock(t, p + 1), this.host.focusBlock(t, "end");
    }), c = this.menuButton(b.trash, this.host.i18n.t("settings.delete"), () => {
      var m;
      this.closeSettings(), this.hide();
      const p = this.host.getBlockIndex(t);
      this.host.removeBlock(t);
      const g = this.host.blocks.blocks[Math.min(p, this.host.blocks.length - 1)];
      g ? this.host.focusBlock(g.id, "end") : (m = this.host.target.querySelector(".ez-empty-input")) == null || m.focus(), this.host.announce(this.host.i18n.t("settings.deleted"));
    });
    c.classList.add("ez-danger"), a.disabled = this.host.getBlockIndex(t) === 0, l.disabled = this.host.getBlockIndex(t) === this.host.blocks.length - 1, e.append(o, a, l, c);
    for (const p of this.host.registry.listTunes()) {
      const g = this.renderTuneMenu(t, p.name);
      g && (e.appendChild(f("div", "ez-menu-category", this.host.i18n.t(`tune.${p.name}`))), e.appendChild(g));
    }
    const d = this.settingsPopover;
    d && (D(d), d.appendChild(e));
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
      }), o = i.render();
      return this.menuTunes.push(i), o.setAttribute("role", "group"), o;
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
    const n = f("button", "ez-menu-item");
    if (n.type = "button", Cs(t))
      n.appendChild(L(t));
    else {
      const o = f("span", "ez-menu-icon", t);
      n.appendChild(o);
    }
    const i = f("span", "ez-menu-label", e);
    return n.appendChild(i), n.addEventListener("click", s), n;
  }
  destroy() {
    this.hide();
    for (const t of this.disposers) t();
    this.root.remove();
  }
}
function es(r, t) {
  if (r === "") return 0;
  const e = r.toLowerCase(), s = t.toLowerCase();
  let n = 0, i = 0, o = 0;
  for (let a = 0; a < s.length && n < e.length; a++)
    s[a] === e[n] ? (o++, i += 1 + o, n++) : o = 0;
  return n === e.length ? i : -1;
}
class dr {
  constructor(t) {
    this.entries = [], this.filtered = [], this.focusedIndex = 0, this.isOpen = !1, this.blockId = null, this.unsubOutside = null, this.insertMode = !1, this.prefix = `ez-slash-${++hr}`, this.host = t, this.root = f("div", "ez-popover ez-slash-menu"), this.root.setAttribute("role", "dialog"), this.root.setAttribute("aria-label", t.i18n.t("toolbar.add")), this.root.setAttribute("data-ez-ui", "true"), this.root.style.display = "none", this.root.addEventListener("mousedown", (e) => {
      e.target.closest("button") && e.preventDefault();
    }), this.root.addEventListener("keydown", (e) => {
      !e.isComposing && this.handleKey(e) && e.preventDefault(), e.stopPropagation();
    });
  }
  getElement() {
    return this.root;
  }
  open(t, e = !1) {
    this.host.readOnly || (this.close(), this.blockId = t, this.insertMode = e, this.entries = this.host.registry.listBlockTools().filter((s) => !!s.toolbox).map((s) => ({ name: s.name, title: s.toolbox.title, icon: s.toolbox.icon ?? "•", category: s.toolbox.category })), this.isOpen = !0, this.buildDom(), this.root.style.display = "block", this.filter(""), this.focusedIndex = 0, this.renderList(), this.position(), this.input.focus());
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
    this.isOpen = !1, this.blockId = null, this.root.style.display = "none", (s = this.unsubOutside) == null || s.call(this), this.input.setAttribute("aria-expanded", "false"), this.unsubOutside = null, t && e && !this.host.readOnly && this.host.focusBlock(e, "end");
  }
  buildDom() {
    D(this.root), this.input = f("input", "ez-menu-search"), this.input.type = "text", this.input.placeholder = this.host.i18n.t("slash.placeholder"), this.input.setAttribute("aria-label", this.host.i18n.t("slash.placeholder")), this.input.setAttribute("role", "combobox"), this.input.setAttribute("aria-expanded", "true"), this.input.setAttribute("aria-autocomplete", "list"), this.input.setAttribute("aria-controls", `${this.prefix}-list`), this.input.addEventListener("input", () => this.setQuery(this.input.value)), this.list = f("div", "ez-menu"), this.list.setAttribute("role", "listbox"), this.list.id = `${this.prefix}-list`, this.list.setAttribute("aria-label", this.host.i18n.t("toolbar.blockType")), this.root.append(this.input, this.list);
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
    this.filtered = this.entries.map((e) => ({ entry: e, score: Math.max(es(t, e.title), es(t, e.name)) })).filter((e) => e.score >= 0).sort((e, s) => s.score - e.score).map((e) => e.entry);
  }
  renderList() {
    if (D(this.list), this.filtered.length === 0) {
      const s = f("div", "ez-menu-empty", this.host.i18n.t("slash.empty"));
      s.setAttribute("role", "status"), this.input.removeAttribute("aria-activedescendant"), this.list.appendChild(s);
      return;
    }
    let t;
    this.filtered.forEach((s, n) => {
      s.category && s.category !== t && (this.list.appendChild(f("div", "ez-menu-category", s.category)), t = s.category);
      const i = f("button", "ez-menu-item" + (n === this.focusedIndex ? " ez-focused" : ""));
      i.type = "button", i.setAttribute("role", "option"), i.setAttribute("aria-selected", n === this.focusedIndex ? "true" : "false"), i.id = `${this.prefix}-option-${n}`, i.tabIndex = -1, Cs(s.icon) ? i.appendChild(L(s.icon)) : i.appendChild(f("span", "ez-menu-icon", s.icon));
      const o = f("span", "ez-menu-label", s.title);
      i.appendChild(o), i.addEventListener("click", () => this.select(s)), this.list.appendChild(i);
    }), this.input.setAttribute("aria-activedescendant", `${this.prefix}-option-${this.focusedIndex}`);
    const e = this.list.querySelector(".ez-focused");
    e == null || e.scrollIntoView({ block: "nearest" });
  }
  select(t) {
    var o;
    const e = this.blockId, s = this.insertMode;
    if (this.close(), !e || this.host.readOnly) return;
    const n = this.host.getBlockData(e), i = ((o = this.host.getEditableElement(e)) == null ? void 0 : o.textContent) ?? "";
    if (i.trim().startsWith("/") && Array.isArray(n == null ? void 0 : n.content) && this.host.updateBlockData(e, { ...n, content: [] }), s && !(this.host.getBlockType(e) === "paragraph" && i.trim() === "")) {
      this.host.insertBlock(t.name, void 0, { after: e, focus: !0 }), this.host.announce(`${t.title} added`);
      return;
    }
    this.host.convertBlock(e, t.name), this.host.focusBlock(e, "end"), this.host.announce(`Converted to ${t.title}`);
  }
  position() {
    if (!this.isOpen || !this.blockId) return;
    const t = this.host.target.querySelector(`[data-ez-block-id="${CSS.escape(this.blockId)}"]`);
    P(this.root, (t ?? this.host.target).getBoundingClientRect());
  }
  destroy() {
    this.close(), this.root.remove();
  }
}
let hr = 0;
const ss = "[data-ez-block-id], [data-ez-nested-id]";
class ns {
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
      var h, u;
      if (this.host.readOnly) {
        a.preventDefault();
        return;
      }
      const l = (h = a.dataTransfer) == null ? void 0 : h.getData("text/x-ezynota-drag"), c = a.target.closest(".ez-nested-drag"), d = l ? this.findBlock(l) : c ? this.blockFromEvent(a) : null;
      d && (this.draggingId = this.blockId(d), (u = a.dataTransfer) == null || u.setData("text/x-ezynota-drag", this.draggingId), a.dataTransfer && (a.dataTransfer.effectAllowed = "move"), d.classList.add("ez-dragging"));
    };
    this.target.addEventListener("dragstart", i);
    const o = (a) => {
      var h, u;
      if (this.host.readOnly || a.pointerType === "mouse" || a.button !== 0 || this.pointerDrag) return;
      const l = (u = (h = a.target).closest) == null ? void 0 : u.call(h, ".ez-block-actions, .ez-nested-drag");
      if (!l) return;
      const c = l.closest("[data-ez-nested-id]") ?? this.target.querySelector(".ez-block.ez-active"), d = c ? this.blockId(c) : null;
      d && (this.pointerDrag = this.beginPointerDrag(d));
    };
    this.target.addEventListener("pointerdown", o), this.disposers.push(() => {
      var a;
      this.target.removeEventListener("dragover", t), this.target.removeEventListener("dragleave", e), this.target.removeEventListener("drop", s), this.target.removeEventListener("dragend", n), this.target.removeEventListener("dragstart", i), this.target.removeEventListener("pointerdown", o), (a = this.pointerDrag) == null || a.cleanup(), this.pointerDrag = null, n();
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
    let o = e > i.top + i.height / 2 ? "after" : "before";
    if (((a = this.host.blocks.getByIdRecursive(s)) == null ? void 0 : a.type) === "toggle") {
      const l = Math.min(8, i.height / 4);
      e >= i.top + l && e <= i.bottom - l && (o = "inside");
    }
    return { element: t, id: s, placement: o };
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
    }, o = () => {
      e.removeEventListener("pointermove", i), e.removeEventListener("pointerup", a), e.removeEventListener("pointercancel", l), s.remove(), this.highlight(null), this.draggingId = null, this.pointerDrag = null;
    }, a = (c) => {
      const d = this.dropTarget(this.blockFromPoint(c.clientX, c.clientY), c.clientY);
      d && this.moveTo(d), o();
    }, l = () => {
      o();
    };
    return this.draggingId = t, e.addEventListener("pointermove", i), e.addEventListener("pointerup", a), e.addEventListener("pointercancel", l), { cleanup: o };
  }
  blockFromEvent(t) {
    let e = t.target;
    for (; e && e !== this.target; ) {
      if (e.nodeType === Node.ELEMENT_NODE && e.matches(ss))
        return e;
      e = e.parentNode;
    }
    return null;
  }
  blockFromPoint(t, e) {
    const n = this.target.ownerDocument.elementFromPoint(t, e);
    if (!n) return null;
    const i = n.closest(ss);
    return i && this.target.contains(i) ? i : null;
  }
}
const xt = class xt {
  constructor(t) {
    this.api = t.api;
  }
  render() {
    var i;
    const t = ((i = this.wrapper) == null ? void 0 : i.ownerDocument) ?? this.api.element.ownerDocument ?? document, e = this.api.getData(), s = (e == null ? void 0 : e.header) !== !1, n = Array.isArray(e == null ? void 0 : e.rows) && e.rows.length > 0 ? e.rows : [[{ content: [] }, { content: [] }], [{ content: [] }, { content: [] }]];
    this.wrapper = f("div", "ez-table-wrap"), this.tableEl = t.createElement("table"), this.tableEl.className = "ez-table";
    for (let o = 0; o < n.length; o++) {
      const a = n[o], l = t.createElement("tr");
      for (let c = 0; c < a.length; c++) {
        const d = a[c] ?? { content: [] }, h = s && o === 0 ? "th" : "td", u = t.createElement(h);
        u.contentEditable = this.api.readOnly ? "false" : "true", u.setAttribute("data-ez-editable", "true"), u.setAttribute("data-ez-region", `r${o}c${c}`), u.setAttribute("role", "textbox"), u.setAttribute("aria-multiline", "true"), d != null && d.content && !Dt(d.content) && u.appendChild(F(d.content, t)), l.appendChild(u);
      }
      this.tableEl.appendChild(l);
    }
    return this.wrapper.appendChild(this.tableEl), this.wrapper.addEventListener("keydown", (o) => this.handleKeydown(o)), this.wrapper;
  }
  save(t) {
    const e = [], s = this.tableEl.querySelector("th") !== null;
    for (const n of Array.from(this.tableEl.rows)) {
      const i = [];
      for (const o of Array.from(n.cells))
        i.push({ content: C(o) });
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
    const t = f("div", "ez-inline-group");
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
      const o = () => {
        if (!n.toggle) return;
        const a = this.tableEl.querySelector("th") !== null;
        i.classList.toggle("ez-active", a), i.setAttribute("aria-pressed", String(a));
      };
      o(), i.addEventListener("click", () => {
        this.api.readOnly || (n.run(), o());
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
      const s = this.tableEl.ownerDocument, n = Array.from(this.tableEl.querySelectorAll("[data-ez-editable]")), i = n.indexOf(s.activeElement), o = t.shiftKey ? i - 1 : i + 1;
      if (o >= 0 && o < n.length)
        n[o].focus();
      else if (!t.shiftKey) {
        this.addRowAt(-1);
        const a = Array.from(this.tableEl.querySelectorAll("[data-ez-editable]"));
        (e = a[a.length - 1]) == null || e.focus();
      }
    }
  }
  /* ---------- structural operations ---------- */
  addRowAt(t) {
    var o;
    const e = this.save(this.wrapper), s = ((o = e.rows[0]) == null ? void 0 : o.length) ?? 2, n = Array.from({ length: s }, () => ({ content: [] })), i = t < 0 ? e.rows.length : Math.max(1, t);
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
      const n = s.querySelectorAll("tr"), i = n[Math.min(e.row, n.length - 1)], o = i ? Array.from(i.querySelectorAll("[data-ez-editable]")) : [], a = o[Math.min(e.column, o.length - 1)];
      if (a) {
        a.focus();
        return;
      }
    }
    this.api.focus("start");
  }
};
xt.toolbox = { icon: H.table, title: "Table", category: "Rich blocks" }, xt.conversion = { to: ["paragraph"] }, xt.enableInlineTools = !0;
let ve = xt;
const Bt = /* @__PURE__ */ new Map(), Ut = /* @__PURE__ */ new WeakMap();
let Os = 1;
function Le(r) {
  let t = null;
  for (const e of Bt.values())
    r(e) && (t = e);
  return t;
}
function ur(r) {
  const t = Os++;
  return Bt.set(t, { storer: r }), () => {
    Bt.delete(t);
  };
}
function pr(r) {
  const t = Os++;
  return Bt.set(t, { loader: r }), () => {
    fr(r), Bt.delete(t);
  };
}
function is() {
  return Le((r) => r.storer !== void 0) !== null;
}
async function rs(r) {
  var e;
  const t = (e = Le((s) => s.storer !== void 0)) == null ? void 0 : e.storer;
  return t ? t(r) : null;
}
function fr(r) {
  const t = Ut.get(r);
  if (t) {
    for (const e of t.values())
      try {
        URL.revokeObjectURL(e);
      } catch {
      }
    Ut.delete(r);
  }
}
async function gr(r) {
  var o;
  if (!r.startsWith("asset:")) return null;
  const t = (o = Le((a) => a.loader !== void 0)) == null ? void 0 : o.loader;
  if (!t) return null;
  const e = r.slice(6);
  let s = Ut.get(t);
  s || (s = /* @__PURE__ */ new Map(), Ut.set(t, s));
  const n = s.get(e);
  if (n) return n;
  const i = await t(e);
  if (!i) return null;
  try {
    const a = URL.createObjectURL(new Blob([i.bytes], { type: i.mime }));
    return s.set(e, a), a;
  } catch {
    return null;
  }
}
const gt = class gt {
  constructor(t) {
    this.resizeInput = null, this.resizeValue = null, this.editPanel = null, this.panelTrigger = null, this.uploadButton = null, this.feedback = null, this.api = t.api;
  }
  render() {
    const t = document, e = this.api.getData();
    this.figure = t.createElement("figure"), this.figure.className = "ez-image";
    const s = t.createElement("div");
    s.className = "ez-image-frame", s.style.width = `${this.currentWidth()}%`, this.img = t.createElement("img"), this.img.alt = typeof (e == null ? void 0 : e.alt) == "string" ? e.alt : "", this.applySrcToImg((e == null ? void 0 : e.src) ?? ""), this.api.readOnly || (this.img.addEventListener("dblclick", () => this.pickFile()), this.figure.addEventListener("dragover", (i) => {
      var o;
      (o = i.dataTransfer) != null && o.types.includes("Files") && i.preventDefault();
    }), this.figure.addEventListener("drop", (i) => {
      var a;
      const o = (a = i.dataTransfer) == null ? void 0 : a.files;
      o && o.length > 0 && (i.preventDefault(), i.stopPropagation(), this.storeFile(o[0]));
    })), s.appendChild(this.img), this.figure.appendChild(s);
    const n = t.createElement("figcaption");
    return n.className = "ez-text-input ez-image-caption", n.contentEditable = this.api.readOnly ? "false" : "true", n.setAttribute("data-ez-editable", "true"), n.setAttribute("data-ez-placeholder", "Add a caption..."), n.setAttribute("data-ez-region", "caption"), n.setAttribute("aria-label", "Image caption"), n.textContent = typeof (e == null ? void 0 : e.caption) == "string" ? e.caption : "", this.figure.appendChild(n), this.api.readOnly || (this.figure.appendChild(this.buildToolbar()), this.editPanel = f("div", "ez-image-edit-panel"), this.editPanel.setAttribute("data-ez-ui", "true"), this.editPanel.hidden = !0, this.feedback = f("p", "ez-image-feedback"), this.feedback.setAttribute("role", "status"), this.feedback.hidden = !0, this.figure.append(this.editPanel, this.feedback)), this.figure;
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
  }
  /* ---------- implementation ---------- */
  applySrcToImg(t) {
    if (this.img && (this.clearBrokenImageState(), !(typeof t != "string" || t === ""))) {
      if (t.startsWith("asset:")) {
        gr(t).then((e) => {
          var s;
          (s = this.img) != null && s.isConnected && (e ? this.img.src = e : this.showBrokenImage("This image could not be loaded."));
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
    const t = f("div", "ez-image-toolbar");
    t.setAttribute("data-ez-ui", "true"), t.setAttribute("role", "group"), t.setAttribute("aria-label", "Image controls");
    const e = f("div", "ez-image-actions"), s = (c, d, h) => {
      const u = S("ez-image-action", c, h);
      return u.prepend(L(d)), u.title = h, u;
    }, n = s("Upload", b.upload, "Upload image");
    this.uploadButton = n, n.addEventListener("click", () => this.pickFile());
    const i = s("Image URL", b.link, "Insert image from URL");
    i.setAttribute("aria-expanded", "false"), i.addEventListener("click", () => this.openEditPanel("url", i));
    const o = s("Alt text", b.info, "Edit image description for screen readers");
    o.setAttribute("aria-expanded", "false"), o.addEventListener("click", () => this.openEditPanel("alt", o));
    const a = f("label", "ez-image-size");
    a.appendChild(f("span", "ez-image-size-label", "Width"));
    const l = f("input", "ez-image-resize");
    return this.resizeInput = l, l.type = "range", l.min = "10", l.max = "100", l.value = String(this.currentWidth()), l.setAttribute("aria-label", "Image width"), this.resizeValue = f("output", "ez-image-size-value"), this.updateWidthLabel(this.currentWidth()), l.addEventListener("input", () => {
      const c = this.figure.querySelector(".ez-image-frame");
      c && (c.style.width = `${l.value}%`), this.updateWidthLabel(Number(l.value));
    }), l.addEventListener("change", () => {
      this.api.update({ ...this.save(this.figure), width: Number(l.value) });
    }), e.append(n, i, o), a.append(l, this.resizeValue), t.append(e, a), t;
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
        if (is()) {
          const n = await rs(t);
          if (n) {
            this.applyImage(n, t.name.replace(/\.[^.]+$/, "")), this.showFeedback("");
            return;
          }
          this.showFeedback("Could not save this image to storage. Free up space and try again.");
          return;
        }
        const s = await os(t);
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
    const i = f("label", "ez-image-field");
    i.appendChild(f("span", "ez-image-field-title", t === "url" ? "Image URL" : "Image description"));
    const o = f("input", "ez-image-field-input");
    o.type = "text", o.placeholder = t === "url" ? "https://example.com/image.jpg" : "Describe what’s in the image…";
    const a = this.api.getData();
    o.value = t === "alt" ? a.alt ?? "" : /^https?:\/\//i.test(a.src) ? a.src : "", t === "url" && (o.inputMode = "url"), i.appendChild(o);
    const l = f("p", "ez-image-field-hint", t === "url" ? "Paste a direct link to an image." : "Help people using screen readers understand this image. Leave blank for a decorative image."), c = f("p", "ez-image-field-error");
    c.setAttribute("role", "alert"), c.hidden = !0;
    const d = f("div", "ez-image-panel-actions"), h = S("ez-image-action", "Cancel");
    h.addEventListener("click", () => this.closeEditPanel());
    const u = S("ez-image-action ez-image-action-primary", t === "url" ? "Use image" : "Save description"), p = () => {
      if (t === "url") {
        const g = o.value.trim();
        if (!g || !Z(g)) {
          c.textContent = "Enter a valid image URL.", c.hidden = !1, o.setAttribute("aria-invalid", "true"), o.focus();
          return;
        }
        this.applyImage(g, this.save(this.figure).alt);
      } else
        this.api.update({ ...this.save(this.figure), alt: o.value }), this.img.alt = o.value;
      this.closeEditPanel();
    };
    u.addEventListener("click", p), o.addEventListener("input", () => {
      c.hidden = !0, o.removeAttribute("aria-invalid");
    }), s.onkeydown = (g) => {
      g.stopPropagation(), g.key === "Escape" ? (g.preventDefault(), this.closeEditPanel()) : g.key === "Enter" && g.target === o && !g.isComposing && (g.preventDefault(), p());
    }, d.append(h, u), s.append(i, l, c, d), s.hidden = !1, o.focus();
  }
};
gt.toolbox = { icon: H.image, title: "Image", category: "Rich blocks" }, gt.conversion = { to: ["paragraph"] }, gt.paste = { files: { mimeTypes: ["image/*"] } }, gt.filesToBlockDataAsync = async (t) => {
  const e = [];
  for (const s of t) {
    if (!s.type.startsWith("image/")) continue;
    const n = is() ? await rs(s) : await os(s);
    n && e.push({ type: "image", data: { src: n, alt: s.name.replace(/\.[^.]+$/, "") } });
  }
  return e;
};
let we = gt;
function os(r) {
  return new Promise((t, e) => {
    const s = new FileReader();
    s.onload = () => t(String(s.result)), s.onerror = () => e(s.error ?? new Error("FileReader failed")), s.readAsDataURL(r);
  });
}
const Nt = ["info", "warning", "success", "danger"], as = {
  info: "ℹ",
  warning: "⚠",
  success: "✓",
  danger: "✕"
}, It = class It extends Mt {
  constructor(t) {
    super(t, "Write something...", !1), this.variant = "info", this.containerEl = null;
    const e = this.api.getData();
    typeof e == "string" && Nt.includes(e) ? this.variant = e : e && typeof e == "object" && typeof e.variant == "string" && Nt.includes(e.variant) && (this.variant = e.variant);
  }
  tag() {
    return "div";
  }
  render() {
    var o;
    const t = ((o = this.editable) == null ? void 0 : o.ownerDocument) ?? document, e = t.createElement("div");
    e.className = `ez-callout ez-callout-${this.variant}`, e.setAttribute("data-ez-callout", this.variant);
    const s = t.createElement("span");
    s.className = "ez-callout-badge", s.textContent = as[this.variant], s.setAttribute("aria-hidden", "true");
    const n = t.createElement("div");
    n.classList.add("ez-text-input"), n.contentEditable = "true", n.setAttribute("data-ez-editable", "true"), n.setAttribute("data-ez-region", "callout-content"), this.placeholder && n.setAttribute("data-ez-placeholder", this.placeholder);
    const i = this.api.getData();
    return i != null && i.content && !Dt(i.content) && n.appendChild(F(i.content, t)), this.editable = n, this.containerEl = e, e.append(s, n), e;
  }
  save(t) {
    return { variant: this.variant, content: C(this.editable) };
  }
  updated() {
    const t = this.api.getData(), e = Nt.includes(t == null ? void 0 : t.variant) ? t.variant : this.variant;
    if (e !== this.variant) {
      this.variant = e, this.refreshElement();
      return;
    }
    super.updated();
  }
  renderSettings() {
    const t = document.createElement("div");
    t.className = "ez-inline-group";
    for (const e of Nt) {
      const s = document.createElement("button");
      s.type = "button", s.className = "ez-inline-btn" + (e === this.variant ? " ez-active" : ""), s.textContent = `${as[e]} ${e}`, s.setAttribute("aria-pressed", String(e === this.variant)), s.addEventListener("click", () => {
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
It.toolbox = { icon: H.callout, title: "Callout", category: "Rich blocks" }, It.enableInlineTools = !0, It.conversion = { to: ["paragraph", "quote"] };
let Ee = It;
const Zt = class Zt {
  constructor(t) {
    this.open = !0, this.childTools = /* @__PURE__ */ new Map(), this.childSignatures = /* @__PURE__ */ new Map(), this.api = t.api, this.nested = t.nested;
    const e = t.api.getData();
    this.open = (e == null ? void 0 : e.open) !== !1;
  }
  render() {
    var l;
    const t = document, e = this.api.getData();
    this.open = (e == null ? void 0 : e.open) !== !1, this.container = f("div", "ez-toggle"), this.container.setAttribute("data-ez-toggle-open", String(this.open));
    const s = f("div", "ez-toggle-header"), n = E("ez-icon-btn ez-toggle-caret", this.open ? b.caretDown : b.caretRight, this.open ? "Collapse section" : "Expand section");
    n.setAttribute("aria-expanded", String(this.open)), n.addEventListener("click", () => {
      this.api.readOnly || (this.open = !this.open, this.api.update({ ...this.save(this.container), open: this.open }), this.container.setAttribute("data-ez-toggle-open", String(this.open)), n.innerHTML = this.open ? b.caretDown : b.caretRight, n.setAttribute("aria-expanded", String(this.open)), n.setAttribute("aria-label", this.open ? "Collapse section" : "Expand section"), n.title = this.open ? "Collapse section" : "Expand section");
    });
    const i = t.createElement("div");
    i.classList.add("ez-text-input", "ez-toggle-heading"), i.contentEditable = this.api.readOnly ? "false" : "true", i.setAttribute("data-ez-editable", "true"), i.setAttribute("data-ez-region", "toggle-heading"), i.setAttribute("data-ez-placeholder", "Section title"), e != null && e.heading && !Dt(e.heading) && i.appendChild(F(e.heading, t)), this.headingEl = i, s.append(n, i), this.childrenHost = f("div", "ez-toggle-children"), this.renderChildren();
    const o = f("div", "ez-toggle-add-row"), a = E("ez-icon-btn ez-toggle-add", b.plus, "Add block inside");
    return a.setAttribute("data-ez-ui", "true"), (l = a.querySelector("svg")) == null || l.setAttribute("aria-hidden", "true"), a.hidden = this.api.readOnly, a.addEventListener("click", () => {
      if (!this.nested || this.nested.readOnly) return;
      const c = this.nested.insert("paragraph", void 0);
      this.nested.focusBlock(c, "start");
    }), o.appendChild(a), this.container.append(s, this.childrenHost, o), this.container;
  }
  save(t) {
    return { open: this.open, heading: C(this.headingEl) };
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
      const n = C(this.headingEl);
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
      (o) => o.hasAttribute("data-ez-nested-id")
    );
    if (e.length === t.length) {
      let o = !0;
      for (let a = 0; a < t.length; a++)
        if (((s = e[a]) == null ? void 0 : s.getAttribute("data-ez-nested-id")) !== t[a].id || ((n = e[a]) == null ? void 0 : n.getAttribute("data-ez-block-type")) !== t[a].type) {
          o = !1;
          break;
        }
      if (o) {
        this.syncChildData();
        return;
      }
    }
    for (const o of Array.from(this.childrenHost.childNodes))
      this.childrenHost.removeChild(o);
    for (const o of this.childTools.values())
      try {
        (i = o.destroy) == null || i.call(o);
      } catch {
      }
    this.childTools.clear(), this.childSignatures.clear(), t.forEach((o, a) => {
      var d;
      const l = f("div", "ez-nested-block");
      if (l.setAttribute("data-ez-nested-id", o.id), l.setAttribute("data-ez-block-type", o.type), l.setAttribute("data-ez-region", `child-${a}`), !this.api.readOnly) {
        const h = E("ez-icon-btn ez-nested-drag", b.grip, "Drag block (Alt+ArrowUp/Down to reorder)");
        h.draggable = !0, h.setAttribute("data-ez-ui", "true"), h.addEventListener("keydown", (u) => {
          var g;
          if (!u.altKey || !["ArrowUp", "ArrowDown"].includes(u.key) || this.api.readOnly) return;
          u.preventDefault(), u.stopPropagation();
          const p = this.nested.getBlocks().findIndex((m) => m.id === o.id);
          this.nested.move(o.id, Math.max(0, p + (u.key === "ArrowUp" ? -1 : 1))), (g = this.childrenHost.querySelector(`[data-ez-nested-id="${CSS.escape(o.id)}"] > .ez-nested-drag`)) == null || g.focus();
        }), l.appendChild(h);
      }
      const c = this.nested.createToolInstance(o, l, this.childApi(o, l));
      l.appendChild(c.render());
      for (const h of l.querySelectorAll("[data-ez-editable]"))
        h.contentEditable = this.api.readOnly ? "false" : "true";
      try {
        (d = c.rendered) == null || d.call(c);
      } catch {
      }
      this.childTools.set(o.id, c), this.childSignatures.set(o.id, JSON.stringify(o)), this.childrenHost.appendChild(l);
    });
  }
  syncChildData() {
    var e, s, n;
    const t = ((e = this.nested) == null ? void 0 : e.getBlocks()) ?? [];
    for (const i of t) {
      const o = this.childTools.get(i.id);
      if (!o) continue;
      const a = JSON.stringify(i);
      if (this.childSignatures.get(i.id) === a) continue;
      this.childSignatures.set(i.id, a);
      const l = Array.from(this.childrenHost.children).find(
        (c) => c.getAttribute("data-ez-nested-id") === i.id
      ) ?? null;
      if (l && !(i.type !== "toggle" && JSON.stringify(o.save(l)) === JSON.stringify(i.data))) {
        o.updated ? o.updated() : ((s = l.lastElementChild) == null || s.replaceWith(o.render()), (n = o.rendered) == null || n.call(o));
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
        var o;
        const i = ((o = s.getBlocks().find((a) => a.id === t.id)) == null ? void 0 : o.data) ?? {};
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
        const o = JSON.parse(JSON.stringify(n[i]));
        return s.insert(o.type, o.data, i + 1);
      },
      convert: (n) => {
        const i = s.getBlocks().find((o) => o.id === t.id);
        i && s.update(t.id, { ...i.data });
      }
    };
  }
};
Zt.toolbox = { icon: H.toggle, title: "Toggle section", category: "Rich blocks" }, Zt.conversion = { to: ["paragraph", "heading"] };
let Ae = Zt;
const De = "1.0.0", mr = "ezynota", br = 1, dt = "workspaces", ht = "assets";
function ls(r) {
  return new Promise((t, e) => {
    r.onsuccess = () => t(r.result), r.onerror = () => e(r.error ?? new Error("IndexedDB request failed"));
  });
}
function cs() {
  try {
    return typeof indexedDB < "u" && indexedDB !== null;
  } catch {
    return !1;
  }
}
class yr {
  constructor() {
    this.db = null, this.initPromise = null, this.listeners = /* @__PURE__ */ new Map(), this.channel = null, this.idb = cs(), this.fallback = null;
  }
  init() {
    if (this.initPromise) return this.initPromise;
    const t = (async () => {
      if (this.idb)
        try {
          this.db = await kr();
        } catch {
          this.db = null, this.fallback || (this.fallback = new hs(!1));
        }
      else this.fallback || (this.fallback = new hs(!1));
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
    return e ? { ...Wt(e.envelope), storageRevision: e.revision } : null;
  }
  getRecord(t) {
    const e = this.ensureDb().transaction(dt, "readonly").objectStore(dt);
    return ls(e.get(t));
  }
  async commit(t, e, s) {
    if (await this.init(), this.fallback) return this.fallback.commit(t, e, s);
    if (!this.db) return { ok: !1, reason: "error" };
    try {
      const i = this.ensureDb().transaction(dt, "readwrite"), o = i.objectStore(dt), a = await new Promise((l, c) => {
        let d = 0;
        const h = o.get(t);
        h.onsuccess = () => {
          var g;
          const u = ((g = h.result) == null ? void 0 : g.revision) ?? 0;
          if (u !== s) {
            l({ ok: !1, reason: "stale" });
            return;
          }
          d = u + 1;
          const p = o.put({
            id: t,
            envelope: Wt(e),
            revision: d
          });
          p.onsuccess = () => l({ ok: !0, revision: d }), p.onerror = () => {
            var y;
            (((y = p.error) == null ? void 0 : y.name) ?? "") === "QuotaExceededError" ? l({ ok: !1, reason: "quota" }) : c(p.error);
          };
        }, h.onerror = () => c(h.error ?? new Error("IndexedDB request failed")), i.onabort = () => {
          var p;
          (((p = i.error) == null ? void 0 : p.name) ?? "") === "QuotaExceededError" && l({ ok: !1, reason: "quota" });
        };
      });
      return await ds(i), a.ok && this.broadcast(t), a;
    } catch (n) {
      return { ok: !1, reason: (n == null ? void 0 : n.name) === "QuotaExceededError" ? "quota" : "error" };
    }
  }
  async loadAsset(t, e) {
    if (await this.init(), this.fallback) return this.fallback.loadAsset(t, e);
    if (!this.db) return null;
    const s = qt(t, e), n = await ls(
      this.ensureDb().transaction(ht, "readonly").objectStore(ht).get(s)
    );
    return n ? vr(n) : null;
  }
  async saveAsset(t, e) {
    if (await this.init(), this.fallback) return this.fallback.saveAsset(t, e);
    if (!this.db) return !1;
    try {
      const s = this.ensureDb().transaction(ht, "readwrite"), n = s.objectStore(ht), i = { ...e, key: qt(t, e.id) }, o = await new Promise((a) => {
        const l = n.put(i);
        l.onsuccess = () => a(!0), l.onerror = () => a(!1);
      });
      return await ds(s), o;
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
    this.channel = null, this.db && (this.db.close(), this.db = null), this.fallback && (await this.fallback.close(), this.fallback = null, this.idb = cs()), this.initPromise = null;
  }
}
function ds(r) {
  return new Promise((t, e) => {
    r.oncomplete = () => t(), r.onerror = () => e(r.error ?? new Error("transaction failed")), r.onabort = () => e(r.error ?? new Error("transaction aborted"));
  });
}
function kr() {
  return new Promise((r, t) => {
    const e = indexedDB.open(mr, br);
    e.onupgradeneeded = () => {
      const s = e.result;
      s.objectStoreNames.contains(dt) || s.createObjectStore(dt, { keyPath: "id" }), s.objectStoreNames.contains(ht) || s.createObjectStore(ht, { keyPath: "key" });
    }, e.onsuccess = () => r(e.result), e.onerror = () => t(e.error ?? new Error("IndexedDB open failed")), e.onblocked = () => t(new Error("IndexedDB open blocked (another connection holds this database)"));
  });
}
function qt(r, t) {
  return `${r}::${t}`;
}
function Wt(r) {
  return JSON.parse(JSON.stringify(r));
}
function vr(r) {
  return { ...r, bytes: new Uint8Array(r.bytes) };
}
class hs {
  constructor(t = !0) {
    this.workspaces = /* @__PURE__ */ new Map(), this.assets = /* @__PURE__ */ new Map(), this.listeners = /* @__PURE__ */ new Map(), this.channel = null, t && typeof BroadcastChannel < "u" && (this.channel = new BroadcastChannel("ezynota:workspace"), this.channel.onmessage = (e) => {
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
    return e ? { ...Wt(e.envelope), storageRevision: e.revision } : null;
  }
  async commit(t, e, s) {
    var a;
    const n = this.workspaces.get(t), i = (n == null ? void 0 : n.revision) ?? 0;
    if (i !== s) return { ok: !1, reason: "stale" };
    const o = {
      id: t,
      envelope: Wt(e),
      revision: i + 1
    };
    this.workspaces.set(t, o);
    try {
      (a = this.channel) == null || a.postMessage({ workspaceId: t });
    } catch {
    }
    return { ok: !0, revision: o.revision };
  }
  async loadAsset(t, e) {
    return this.assets.get(qt(t, e)) ?? null;
  }
  async saveAsset(t, e) {
    return this.assets.set(qt(t, e.id), { ...e, bytes: new Uint8Array(e.bytes) }), !0;
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
function Rs(r) {
  return {
    workspaceSchemaVersion: De,
    id: r,
    name: "Untitled workspace",
    notes: [],
    folders: [],
    savedAt: 0,
    generator: { name: "ezynota", version: Gt }
  };
}
function wr(r) {
  let t = "/default";
  try {
    typeof location < "u" && location.pathname && (t = location.pathname);
  } catch {
  }
  return `${t}#${r ?? "default"}`;
}
class Er {
  constructor(t) {
    this.envelope = Rs("pending"), this.revision = 0, this.loaded = !1, this.loadError = null, this.listeners = /* @__PURE__ */ new Set(), this.saveQueue = Promise.resolve(), this.saveTimer = null, this.dirty = !1, this.mutationVersion = 0, this.unsavedSnapshot = null, this.unsubscribeCrossTab = null, this.lastStatus = "idle", this.destroyed = !1, this.objectUrls = /* @__PURE__ */ new Map(), this.unloadDisposers = [], this.conflictRemoteRevision = null, this.conflictRetryRevision = null, this.activeNoteId = null, this.activeFolderId = null, this.workspaceId = t.workspaceId, this.storage = t.storage, this.generateId = t.generateId, this.autosaveMs = t.autosaveMs ?? 500, this.activeWorkspaceId = t.workspaceId, this.registerUnloadListeners();
  }
  /* ---------- lifecycle ---------- */
  async load() {
    try {
      await this.storage.init(), this.subscribeCrossTab();
      const t = await this.storage.loadWorkspace(this.activeWorkspaceId);
      this.envelope = us(t, this.activeWorkspaceId), this.revision = (t == null ? void 0 : t.storageRevision) ?? 0, this.loaded = !0, this.loadError = null, this.emit({ type: "loaded" });
    } catch (t) {
      throw this.loaded = !1, this.loadError = t, this.emit({ type: "loadFailed", error: t }), t instanceof k ? t : new k("EZ_UNKNOWN_ERROR", "Workspace failed to load", { workspaceId: this.workspaceId }, t);
    }
  }
  isLoaded() {
    return this.loaded;
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
      this.envelope = us(t, this.activeWorkspaceId), this.revision = (t == null ? void 0 : t.storageRevision) ?? 0, this.emit({ type: "remoteChange" }), this.emit({ type: "notes:changed" });
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
    return Pt(e.document.blocks, (n) => {
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
    const o = {
      ...e,
      id: this.generateId(),
      title: n,
      document: i,
      createdAt: s,
      updatedAt: s,
      revision: 0,
      trashed: !1
    };
    return delete o.trashedAt, this.envelope.notes.push(o), this.markDirty(), this.emit({ type: "notes:changed" }), o;
  }
  /** Replace a note's document (autosave target). Bumps revision only on commit. */
  updateNoteDocument(t, e, s) {
    const n = this.getNote(t);
    n && (n.document = e, n.updatedAt = Date.now(), s !== void 0 && s !== n.title && (n.title = s, n.document = { ...n.document, meta: { ...n.document.meta ?? {}, title: s } }, this.emit({ type: "noteRenamed", noteId: t, title: s })), this.markDirty(), this.emit({ type: "notes:changed" }));
  }
  /* ---------- folders CRUD ---------- */
  createFolder(t, e = null) {
    if (e && !zr(this.envelope.folders, e) && !this.getFolder(e))
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
      const o = i.title.toLowerCase().indexOf(s);
      if (o >= 0 && n.push({ noteId: i.id, title: i.title, excerpt: i.title, offset: o, inTitle: !0 }), Pt(i.document.blocks, (a) => {
        const l = at(a.data);
        if (!l) return;
        const c = l.toLowerCase().indexOf(s);
        if (c < 0) return;
        const d = Math.max(0, c - 30), h = Math.min(l.length, c + s.length + 30);
        n.push({
          noteId: i.id,
          title: i.title,
          excerpt: `${d > 0 ? "…" : ""}${l.slice(d, h)}${h < l.length ? "…" : ""}`,
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
        this.revision = n.revision, e === this.mutationVersion && (this.dirty = !1, this.unsavedSnapshot = null, this.emitStatus("saved"));
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
      Pt(s.document.blocks, (n) => Se(n.data, t));
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
    const s = Br(t);
    if (!s.ok)
      throw new k("EZ_IMPORT_FAILED", s.reason, { recovered: !0 });
    const n = s.envelope;
    if (n.workspaceSchemaVersion !== De)
      throw new k("EZ_IMPORT_FAILED", `Workspace envelope "${n.workspaceSchemaVersion}" is not supported`, {
        original: t
      });
    const i = (e == null ? void 0 : e.newWorkspaceId) === !1 ? n.id : this.generateId(), o = { ...n, id: i, savedAt: Date.now() };
    delete o.storageRevision, this.cancelSaveTimer(), await this.flush();
    const a = this.enqueue(async () => {
      if (Ar(t))
        for (const d of t.assets)
          await this.storage.saveAsset(i, { ...d, bytes: Ir(d.bytes) });
      const l = i === this.activeWorkspaceId ? this.revision : 0, c = await this.storage.commit(i, o, l);
      if (!c.ok)
        throw new k("EZ_IMPORT_FAILED", `Restoring the backup failed (${c.reason})`, {
          reason: c.reason,
          workspaceId: i
        });
      this.revision = c.revision, this.activeWorkspaceId = i, this.envelope = o, this.loaded = !0, this.dirty = !1, this.unsavedSnapshot = null, this.subscribeCrossTab();
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
function at(r) {
  if (Array.isArray(r))
    return r.map((e) => at(e)).join("");
  if (typeof r != "object" || r === null) return "";
  const t = r;
  return typeof t.code == "string" ? t.code : t.type === "text" ? typeof t.text == "string" ? t.text : "" : Array.isArray(t.content) ? at(t.content) : Array.isArray(t.items) ? t.items.map((e) => at(e)).join(" ") : t.rows ? at(t.rows) : t.heading ? at(t.heading) : "";
}
function us(r, t) {
  const e = Rs(t);
  return !r || typeof r != "object" ? e : {
    workspaceSchemaVersion: De,
    id: t,
    name: typeof r.name == "string" && r.name.trim() ? r.name : e.name,
    notes: Array.isArray(r.notes) ? r.notes : [],
    folders: Array.isArray(r.folders) ? r.folders : [],
    savedAt: typeof r.savedAt == "number" ? r.savedAt : 0,
    generator: r.generator ?? e.generator
  };
}
function Y(r) {
  return JSON.parse(JSON.stringify(r));
}
function Ar(r) {
  return typeof r == "object" && r !== null && Array.isArray(r.assets);
}
function Sr(r) {
  let t = "";
  for (let s = 0; s < r.length; s += 32768)
    t += String.fromCharCode(...r.subarray(s, s + 32768));
  return btoa(t);
}
function xr(r) {
  const t = atob(r), e = new Uint8Array(t.length);
  for (let s = 0; s < t.length; s++) e[s] = t.charCodeAt(s);
  return e;
}
function Ir(r) {
  if (r instanceof Uint8Array) return r;
  if (typeof r == "string") return xr(r);
  if (Array.isArray(r)) return new Uint8Array(r);
  throw new k("EZ_IMPORT_FAILED", "Backup asset bytes are malformed");
}
function Cr(r) {
  const { assets: t, ...e } = r;
  return {
    ...e,
    assets: t.map((s) => ({
      id: s.id,
      mime: s.mime,
      name: s.name,
      bytes: Sr(s.bytes),
      createdAt: s.createdAt
    }))
  };
}
function Pt(r, t) {
  for (const e of r)
    t(e), Array.isArray(e.children) && Pt(e.children, t);
}
function lt(r, t) {
  var s;
  if (Array.isArray(r)) {
    for (const n of r) lt(n, t);
    return;
  }
  if (typeof r != "object" || r === null) return;
  const e = r;
  if (Array.isArray(e.marks))
    for (const n of e.marks) {
      const i = (n == null ? void 0 : n.type) === "link" ? (s = n.attrs) == null ? void 0 : s.href : void 0;
      typeof i == "string" && i.startsWith("note:") && t.add(i.slice(5));
    }
  if (e.type === "link" && typeof e.href == "string" && e.href.startsWith("note:") && t.add(e.href.slice(5)), Array.isArray(e.content))
    for (const n of e.content) lt(n, t);
  e.rows && lt(e.rows, t), e.items && lt(e.items, t), e.heading && lt(e.heading, t);
}
function Se(r, t) {
  if (Array.isArray(r)) {
    for (const s of r) Se(s, t);
    return;
  }
  if (typeof r != "object" || r === null) return;
  const e = r;
  typeof e.assetId == "string" && t.add(e.assetId), typeof e.src == "string" && e.src.startsWith("asset:") && t.add(e.src.slice(6));
  for (const s of Object.values(e)) Se(s, t);
}
function it(r, t, e) {
  let s = r.find((i) => i.id === t), n = 0;
  for (; s && n++ < 64; ) {
    if (s.parentId === e) return !0;
    s = s.parentId ? r.find((i) => i.id === s.parentId) : void 0;
  }
  return !1;
}
function zr(r, t, e) {
  return !!t;
}
function Br(r) {
  if (typeof r != "object" || r === null) return { ok: !1, reason: "Backup must be an object" };
  const t = r;
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
const Tr = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
function Lr(r, t) {
  const e = t.ownerDocument.defaultView, s = t.getBoundingClientRect();
  r.style.maxHeight = `${Math.max(80, e.innerHeight - 16)}px`, r.style.maxWidth = `${Math.max(0, e.innerWidth - 16)}px`;
  const n = r.getBoundingClientRect();
  r.style.left = `${Math.max(8, Math.min(s.right - n.width, e.innerWidth - n.width - 8))}px`, r.style.top = `${Math.max(8, Math.min(s.bottom + 4, e.innerHeight - n.height - 8))}px`;
}
function ps(r) {
  return Array.from(r.querySelectorAll('button:not(:disabled), summary, [role="menuitem"]')).filter((t) => t.getClientRects().length > 0);
}
function xe(r) {
  for (const t of r.querySelectorAll("details[open]")) {
    t.open = !1;
    for (const e of t.querySelectorAll(":popover-open")) e.hidePopover();
  }
}
function Ie(r, t) {
  const e = r.ownerDocument, s = e.defaultView, n = r.querySelector("summary");
  t.classList.add("ezy-suite-popup"), t.setAttribute("popover", "manual"), n.setAttribute("aria-expanded", "false");
  const i = () => {
    r.open && Lr(t, n);
  }, o = (u = !1) => {
    r.open && (u && n.focus(), xe(t), r.open = !1, t.matches(":popover-open") && t.hidePopover(), n.setAttribute("aria-expanded", "false"));
  }, a = () => {
    var u;
    n.setAttribute("aria-expanded", String(r.open)), r.open ? (t.showPopover && !t.matches(":popover-open") && t.showPopover(), i(), (u = ps(t)[0]) == null || u.focus()) : (xe(t), t.matches(":popover-open") && t.hidePopover());
  }, l = (u) => {
    r.contains(u.target) || o();
  }, c = (u) => {
    var p;
    if (!r.open) {
      u.target === n && ["ArrowDown", "ArrowUp"].includes(u.key) && (u.preventDefault(), r.open = !0);
      return;
    }
    if (u.key === "Escape")
      u.preventDefault(), u.stopPropagation(), o(!0);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(u.key)) {
      const g = ps(t), m = g.indexOf(e.activeElement), y = u.key === "Home" ? 0 : u.key === "End" ? g.length - 1 : (m + (u.key === "ArrowUp" ? -1 : 1) + g.length) % g.length;
      (p = g[y]) == null || p.focus(), u.preventDefault(), u.stopPropagation();
    }
  }, d = (u) => {
    const p = u.target.closest("button");
    p && p.closest("details") === r && !p.disabled && o(t.contains(e.activeElement));
  }, h = (u) => {
    r.contains(u.relatedTarget) || o();
  };
  return r.addEventListener("toggle", a), r.addEventListener("keydown", c), r.addEventListener("focusout", h), t.addEventListener("click", d), e.addEventListener("pointerdown", l, !0), e.addEventListener("scroll", i, !0), s.addEventListener("resize", i), () => {
    o(), r.removeEventListener("toggle", a), r.removeEventListener("keydown", c), r.removeEventListener("focusout", h), t.removeEventListener("click", d), e.removeEventListener("pointerdown", l, !0), e.removeEventListener("scroll", i, !0), s.removeEventListener("resize", i);
  };
}
function Dr(r, t, e) {
  var m, y;
  const s = t.ownerDocument;
  r.classList.add("ezy-suite-host"), t.classList.add("ezy-suite-topbar"), e.brand.classList.add("ezy-suite-brand"), e.title.classList.add("ezy-suite-title"), e.exportControl.classList.add("ezy-suite-export");
  const n = e.more ?? s.createElement("details");
  if (n.classList.add("ezy-suite-more"), !e.more) {
    const v = s.createElement("summary");
    v.innerHTML = Tr;
    const w = s.createElement("div");
    n.append(v, w);
  }
  const i = n.querySelector("summary");
  i.setAttribute("aria-label", "More actions"), i.title = "More actions";
  const o = n.children[1];
  o.classList.add("ezy-suite-overflow"), o.setAttribute("aria-label", "More actions");
  const a = s.createElement("div");
  a.className = "ezy-suite-extras", a.append(...Array.from(o.childNodes)), o.append(a);
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
  const h = Ie(n, o);
  let u = "";
  const p = () => {
    const v = r.getBoundingClientRect().width, w = v < 480 ? "small" : v < 800 ? "compact" : v < 1100 ? "medium" : "full";
    if (w === u) return;
    u = w;
    const I = s.activeElement;
    xe(t), n.open = !1, t.dataset.density = w;
    for (const { group: z, slot: A } of d)
      (z === e.specialist ? v < 1100 : z === e.history ? v < 480 : v < 800) ? o.insertBefore(z, a) : A.after(z);
    n.hidden = o.children.length === 1 && !a.children.length, I && o.contains(I) ? i.focus() : n.hidden && I === i && e.title.focus();
  }, g = new ResizeObserver(p);
  return g.observe(r), p(), () => {
    g.disconnect(), h();
  };
}
const Mr = '<svg viewBox="0 0 455 455" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient cx="4324350" cy="0" r="6108823" gradientUnits="userSpaceOnUse" spreadMethod="pad" id="ezn-logo-fill" gradientTransform="matrix(0.000104987 0 0 0.000104987 1776 2268)"><stop offset="0" stop-color="#EC4899"/><stop offset="0.2" stop-color="#EC4899"/><stop offset="1" stop-color="#7C3AED"/></radialGradient></defs><g transform="translate(-1776 -2267)"><rect x="1776" y="2268" width="454" height="453" fill="url(#ezn-logo-fill)"/><path d="M2154 2646 2063.4 2555.1 2063.4 2433.9 1942.6 2433.9 1852 2343 2154 2343 2154 2646Z" fill="#FFFFFF" fill-rule="evenodd"/><path d="M2064 2646 1852 2434 1942.86 2434 2064 2555.14 2064 2646Z" fill="#FFFFFF" fill-rule="evenodd"/></g></svg>', Nr = { light: "Light", dark: "Dark", system: "System" };
function Or(r) {
  const t = r;
  return t.type === "importError" ? t.message ?? "Import failed" : null;
}
function Rr(r, t) {
  var e;
  switch (r) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error": {
      const s = t instanceof k ? (e = t.context) == null ? void 0 : e.reason : void 0;
      return s === "stale" ? "Save conflict — export a backup before reloading" : s === "quota" ? "Browser storage full — click to retry" : "Browser save failed — click to retry";
    }
    default:
      return "Ready";
  }
}
class Fr {
  constructor(t, e, s, n = !0) {
    this.sidebar = null, this.sidebarToggle = null, this.notesTree = null, this.noteCount = null, this.searchInput = null, this.searchResults = null, this.titleInput = null, this.workspaceTitle = null, this.breadcrumbs = null, this.saveStatusEl = null, this.saveStatusDot = null, this.wordCountEl = null, this.outlinePanel = null, this.fullscreenBtn = null, this.undoButton = null, this.redoButton = null, this.themeMenu = null, this.docMenu = null, this.exportMenu = null, this.importInput = null, this.errorPanel = null, this.legacyPanel = null, this.noticeEl = null, this.noticeTimer = null, this.findDialog = null, this.findReturnFocus = null, this.findInput = null, this.replaceInput = null, this.disposers = [], this.expandedFolders = /* @__PURE__ */ new Set(), this.refreshTimer = null, this.treeDrag = null, this.treeDropHighlight = null, this.root = t, this.state = e, this.deps = s, this.showSidebar = n;
  }
  mount() {
    this.buildShell(), this.refreshHistory();
    const t = this.state.on((e) => this.handleEvent(e));
    this.disposers.push(t), this.renderSidebar(), this.updateHeader(), this.maybeShowLegacyDraft();
  }
  destroy() {
    this.root.dispatchEvent(new Event("ez-close-popovers"));
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
    const e = Or(t);
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
    const t = this.buildTopbar(), e = f("div", "ez-workspace");
    e.setAttribute("data-ez-workspace", "true"), this.sidebar = f("aside", "ez-sidebar"), this.sidebar.setAttribute("aria-label", "Notes"), this.buildSidebarContent();
    const s = f("div", "ez-main");
    s.appendChild(this.buildSidebarToggle());
    const n = this.buildHeader();
    this.errorPanel = this.buildErrorPanel(), this.legacyPanel = this.buildLegacyPanel(), this.noticeEl = f("p", "ez-workspace-notice"), this.noticeEl.setAttribute("role", "status"), this.noticeEl.setAttribute("aria-live", "polite"), this.noticeEl.hidden = !0;
    const i = f("div", "ez-doc-wrap"), o = this.root.querySelector(".ez-editor"), a = S("ez-sidebar-backdrop", "", "Close notes sidebar");
    a.tabIndex = -1, a.addEventListener("click", () => this.closeMobileSidebar());
    const l = (h) => {
      var u;
      if (h.key === "Escape" && this.root.classList.contains("ez-sidebar-open") && (h.preventDefault(), h.stopPropagation(), this.closeMobileSidebar()), h.key === "Tab" && this.root.classList.contains("ez-sidebar-open")) {
        const p = Array.from(((u = this.sidebar) == null ? void 0 : u.querySelectorAll("button, input, summary")) ?? []).filter((y) => y.getClientRects().length > 0 && !y.hasAttribute("disabled")), g = p[0], m = p[p.length - 1];
        h.shiftKey && document.activeElement === g ? (h.preventDefault(), m == null || m.focus()) : !h.shiftKey && document.activeElement === m && (h.preventDefault(), g == null || g.focus());
      }
    };
    this.root.addEventListener("keydown", l), this.disposers.push(() => this.root.removeEventListener("keydown", l));
    const c = f("div", "ez-header-row");
    c.append(n);
    const d = f("div", "ez-document-column");
    d.append(c, this.noticeEl, this.errorPanel, this.legacyPanel, i), s.appendChild(d), o ? i.appendChild(o) : i.appendChild(f("div", "ez-editor")), e.append(a, this.sidebar, s), this.root.append(t, e, this.buildStatusbar()), this.applyTheme(this.state ? this.root.getAttribute("data-ez-theme") ?? "system" : "system"), this.outlinePanel = this.buildOutline(), s.appendChild(this.outlinePanel), this.findDialog = this.buildFindDialog(), s.insertBefore(this.findDialog, d), this.buildHiddenImportInput();
  }
  buildSidebarToggle() {
    return this.sidebarToggle = E("ez-icon-btn ez-sidebar-toggle", b.panelLeft, "Toggle notes sidebar"), this.sidebarToggle.setAttribute("aria-expanded", String(!window.matchMedia("(max-width: 900px)").matches)), this.sidebarToggle.addEventListener("click", () => {
      var t, e, s;
      if (window.matchMedia("(max-width: 900px)").matches) {
        this.root.classList.remove("ez-sidebar-collapsed");
        const n = this.root.classList.toggle("ez-sidebar-open");
        (t = this.sidebarToggle) == null || t.setAttribute("aria-expanded", String(n)), n && ((e = this.searchInput) == null || e.focus());
      } else {
        const n = this.root.classList.toggle("ez-sidebar-collapsed");
        (s = this.sidebarToggle) == null || s.setAttribute("aria-expanded", String(!n));
      }
    }), this.sidebarToggle;
  }
  /** Suite-standard topbar: brand + document actions, shared with the shell. */
  buildTopbar() {
    var z;
    const t = f("header", "ez-topbar"), e = f("div", "ez-brand"), s = f("span", "ez-brand-mark");
    s.innerHTML = Mr, e.append(s, f("span", "ez-brand-name", "Ezynota")), this.workspaceTitle = f("input", "ez-topbar-title"), this.workspaceTitle.type = "text", this.workspaceTitle.spellcheck = !1, this.workspaceTitle.placeholder = "Untitled workspace", this.workspaceTitle.setAttribute("aria-label", "Workspace name"), this.workspaceTitle.addEventListener("change", () => {
      var A;
      this.deps.renameWorkspace(((A = this.workspaceTitle) == null ? void 0 : A.value) ?? "");
    }), this.workspaceTitle.addEventListener("keydown", (A) => {
      var T;
      A.key === "Enter" && ((T = this.workspaceTitle) == null || T.blur());
    });
    const n = f("div", "ez-topbar-group ez-history-actions");
    n.setAttribute("role", "group"), n.setAttribute("aria-label", "Edit history"), n.setAttribute("data-ez-ui", "true"), this.undoButton = E("ez-icon-btn", b.undo, "Undo"), this.redoButton = E("ez-icon-btn", b.redo, "Redo");
    for (const A of [this.undoButton, this.redoButton])
      (z = A.querySelector("svg")) == null || z.setAttribute("aria-hidden", "true"), A.addEventListener("mousedown", (T) => T.preventDefault());
    this.undoButton.addEventListener("click", () => {
      this.deps.undo(), this.refreshHistory();
    }), this.redoButton.addEventListener("click", () => {
      this.deps.redo(), this.refreshHistory();
    }), n.append(this.undoButton, this.redoButton);
    const i = f("div", "ez-topbar-group ez-document-actions"), o = E("ez-icon-btn", b.outline, "Toggle heading outline");
    o.setAttribute("aria-expanded", "false");
    const a = () => {
      const A = this.root.classList.toggle("ez-outline-open");
      o.setAttribute("aria-expanded", String(A));
    };
    o.addEventListener("click", a);
    const l = E("ez-icon-btn", b.search, "Find in document");
    l.addEventListener("click", () => this.openFindDialog()), i.append(o, l), this.fullscreenBtn = E("ez-icon-btn", b.maximize, "Enter fullscreen"), this.fullscreenBtn.addEventListener("click", () => this.deps.toggleFullscreen()), this.docMenu = f("details", "ez-doc-menu");
    const c = f("summary", "ez-icon-btn ez-doc-menu-btn");
    c.appendChild(L(b.ellipsis)), c.setAttribute("aria-label", "Document menu");
    const d = f("div", "ez-doc-menu-panel");
    d.setAttribute("data-ez-ui", "true");
    const h = (A, T, M = this.docMenu) => {
      const j = S("ez-doc-menu-item", A);
      return j.addEventListener("click", () => {
        var Pe;
        M.contains(document.activeElement) && ((Pe = M.querySelector("summary")) == null || Pe.focus()), M.open = !1, T();
      }), j;
    };
    d.append(
      h("Print document", () => this.deps.printActiveNote()),
      h("Restore workspace backup…", () => this.pickBackupFile())
    ), this.docMenu.append(c, d), this.exportMenu = f("details", "ez-doc-menu ez-export-menu");
    const u = f("summary", "ez-export-btn");
    u.setAttribute("aria-label", "Export document"), u.append(L(b.download), f("span", "", "Export"), L(b.down));
    const p = f("div", "ez-doc-menu-panel");
    p.setAttribute("data-ez-ui", "true"), p.append(
      h("Download JSON", () => this.deps.exportActiveNote("json"), this.exportMenu),
      h("Export Markdown", () => this.deps.exportActiveNote("md"), this.exportMenu),
      h("Export HTML", () => this.deps.exportActiveNote("html"), this.exportMenu),
      h("Export plain text", () => this.deps.exportActiveNote("txt"), this.exportMenu)
    ), this.exportMenu.append(u, p), this.themeMenu = f("details", "ez-theme-menu");
    const g = f("summary", "ez-icon-btn");
    g.appendChild(L(b.sun)), g.setAttribute("aria-label", "Theme");
    const m = f("div", "ez-theme-panel");
    m.setAttribute("data-ez-ui", "true");
    for (const A of ["light", "dark", "system"]) {
      const T = S("ez-theme-item", Nr[A]);
      T.setAttribute("data-ez-theme-choice", A), T.addEventListener("click", () => {
        var M;
        (M = this.themeMenu) != null && M.contains(document.activeElement) && g.focus(), this.deps.setTheme(A), this.themeMenu && (this.themeMenu.open = !1);
      }), m.appendChild(T);
    }
    this.themeMenu.append(g, m);
    const y = f("div");
    y.setAttribute("aria-label", "View"), y.append(this.themeMenu, this.fullscreenBtn);
    const v = f("div");
    v.setAttribute("aria-label", "Files");
    const w = E("ez-icon-btn", b.folderOpen, "Import file");
    w.addEventListener("click", () => {
      var A;
      return (A = this.importInput) == null ? void 0 : A.click();
    });
    const I = E("ez-icon-btn", b.save, "Download workspace backup");
    return I.addEventListener("click", () => this.deps.createBackup()), v.append(w, I), i.setAttribute("aria-label", "Document tools"), this.disposers.push(Dr(this.root, t, {
      brand: e,
      title: this.workspaceTitle,
      history: n,
      specialist: i,
      view: y,
      files: v,
      exportControl: this.exportMenu,
      more: this.docMenu
    })), this.disposers.push(Ie(this.themeMenu, m)), this.disposers.push(Ie(this.exportMenu, p)), t;
  }
  buildSidebarContent() {
    if (!this.sidebar) return;
    D(this.sidebar);
    const t = f("div", "ez-sidebar-search-row"), e = f("div", "ez-sidebar-search");
    this.searchInput = f("input", "ez-sidebar-search-input"), this.searchInput.type = "search", this.searchInput.placeholder = "Search notes…", this.searchInput.setAttribute("aria-label", "Search workspace");
    let s = null;
    this.disposers.push(() => {
      s && clearTimeout(s);
    }), this.searchInput.addEventListener("input", () => {
      s && clearTimeout(s), s = setTimeout(() => {
        var h;
        return this.renderSearchResults(((h = this.searchInput) == null ? void 0 : h.value) ?? "");
      }, 200);
    });
    const n = f("span", "ez-sidebar-search-icon");
    n.innerHTML = b.search, n.setAttribute("aria-hidden", "true"), e.append(n, this.searchInput);
    const i = E("ez-icon-btn ez-sidebar-close", b.x, "Close notes sidebar");
    i.addEventListener("click", () => this.closeMobileSidebar()), t.append(e, i), this.searchResults = f("div", "ez-search-results"), this.searchResults.setAttribute("role", "listbox"), this.searchResults.setAttribute("aria-label", "Search results");
    const o = f("div", "ez-sidebar-actions"), a = S("ez-sidebar-btn ez-new-note", "New note");
    a.prepend(L(b.plus)), a.addEventListener("click", () => {
      this.deps.createNote(), this.closeMobileSidebar(!1);
    });
    const l = E("ez-sidebar-btn ez-new-folder", b.folderPlus, "New folder");
    l.addEventListener("click", () => this.deps.createFolder()), o.append(a, l), this.notesTree = f("nav", "ez-notes-tree"), this.notesTree.setAttribute("aria-label", "Folders and notes");
    const c = this.buildTrashSection(), d = f("div", "ez-sidebar-section-label");
    this.noteCount = f("span", "ez-note-count", "0"), d.append(f("span", "", "Your notes"), this.noteCount), this.setupTreeDragAndDrop(this.notesTree, d), this.sidebar.append(t, this.searchResults, o, d, this.notesTree, c);
  }
  closeMobileSidebar(t = !0) {
    var e, s;
    this.root.classList.remove("ez-sidebar-open"), window.matchMedia("(max-width: 900px)").matches && ((e = this.sidebarToggle) == null || e.setAttribute("aria-expanded", "false"), t && ((s = this.sidebarToggle) == null || s.focus()));
  }
  /* ---------- sidebar rendering ---------- */
  renderSidebar() {
    if (!this.notesTree) return;
    D(this.notesTree);
    const t = this.state.listFolders(), e = this.state.listNotes();
    this.noteCount && (this.noteCount.textContent = String(e.length));
    const s = t.filter((i) => !i.parentId);
    for (const i of s) this.renderFolder(i, t, e, 0);
    const n = e.filter((i) => !i.folderId);
    for (const i of n) this.renderNote(i, 0);
    if (t.length === 0 && e.length === 0) {
      const i = f("div", "ez-notes-empty");
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
      var h;
      (h = this.treeDropHighlight) == null || h.classList.remove("ez-drop-target"), this.treeDropHighlight = null;
    }, i = () => {
      this.treeDrag = null, n();
    }, o = (h) => {
      var m;
      const u = h, p = (m = u.target) == null ? void 0 : m.closest(".ez-tree-row");
      if (!p || !u.dataTransfer) return;
      const g = p.dataset.noteId ?? p.dataset.folderId;
      g && (this.treeDrag = { kind: p.dataset.noteId ? "note" : "folder", id: g }, p.classList.add("ez-dragging"), u.dataTransfer.effectAllowed = "move", u.dataTransfer.setData(s, JSON.stringify(this.treeDrag)), u.dataTransfer.setData("text/plain", g));
    }, a = (h) => {
      var p, g, m;
      (m = (g = (p = h.target) == null ? void 0 : p.closest) == null ? void 0 : g.call(p, ".ez-tree-row")) == null || m.classList.remove("ez-dragging"), i();
    }, l = (h) => {
      var g, m;
      const u = h;
      if (!this.treeDrag || !u.dataTransfer) return;
      const p = (m = (g = u.target) == null ? void 0 : g.closest) == null ? void 0 : m.call(g, ".ez-tree-row");
      if (!p)
        e.contains(u.target) ? this.treeDropHighlight !== e && (n(), e.classList.add("ez-drop-target"), this.treeDropHighlight = e) : n();
      else if (p.dataset.folderId) {
        if (this.treeDrag.kind === "folder" && (p.dataset.folderId === this.treeDrag.id || this.isFolderDescendant(p.dataset.folderId, this.treeDrag.id)))
          return;
        this.treeDropHighlight !== p && (n(), p.classList.add("ez-drop-target"), this.treeDropHighlight = p);
      } else return;
      u.preventDefault(), u.dataTransfer.dropEffect = "move";
    }, c = (h) => {
      var y, v;
      const u = h;
      if (!this.treeDrag) return;
      const p = this.treeDrag;
      i(), u.preventDefault();
      const g = (v = (y = u.target) == null ? void 0 : y.closest) == null ? void 0 : v.call(y, ".ez-tree-row");
      if (g && !g.dataset.folderId) return;
      const m = (g == null ? void 0 : g.dataset.folderId) ?? null;
      p.kind === "note" ? (this.deps.moveNote(p.id, m), m && this.expandedFolders.add(m)) : this.deps.moveFolder(p.id, m) && m && this.expandedFolders.add(m);
    }, d = (h) => {
      h.target === t && n();
    };
    for (const h of [t, e])
      h.addEventListener("dragstart", o), h.addEventListener("dragend", a), h.addEventListener("dragover", l), h.addEventListener("drop", c), h.addEventListener("dragleave", d);
    this.disposers.push(() => {
      for (const h of [t, e])
        h.removeEventListener("dragstart", o), h.removeEventListener("dragend", a), h.removeEventListener("dragover", l), h.removeEventListener("drop", c), h.removeEventListener("dragleave", d);
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
    const i = this.expandedFolders.has(t.id), o = f("div", "ez-tree-row ez-tree-folder");
    o.style.paddingInlineStart = `${n * 14}px`, o.dataset.folderId = t.id, o.draggable = !0;
    const a = E("ez-tree-caret", i ? b.caretDown : b.caretRight, `Expand ${t.name}`);
    a.setAttribute("aria-expanded", String(i)), a.addEventListener("click", (d) => {
      d.stopPropagation(), this.expandedFolders.has(t.id) ? this.expandedFolders.delete(t.id) : this.expandedFolders.add(t.id), this.renderSidebar();
    });
    const l = S("ez-tree-label", t.name);
    l.prepend(L(i ? b.folderOpen : b.folder)), l.setAttribute("data-folder-id", t.id), l.addEventListener("click", () => {
      this.expandedFolders.add(t.id), this.deps.openFolder(t.id), this.renderSidebar();
    });
    const c = E("ez-tree-action", b.ellipsis, `Folder actions for ${t.name}`);
    if (c.addEventListener("click", (d) => {
      d.stopPropagation(), this.folderActions(t, c);
    }), o.append(a, l, c), this.state.activeFolderId === t.id && o.classList.add("ez-active"), this.notesTree.appendChild(o), !!i) {
      for (const d of e.filter((h) => h.parentId === t.id))
        this.renderFolder(d, e, s, n + 1);
      for (const d of s.filter((h) => h.folderId === t.id))
        this.renderNote(d, n + 1);
    }
  }
  renderNote(t, e) {
    if (!this.notesTree) return;
    const s = f("div", "ez-tree-row ez-tree-note");
    s.style.paddingInlineStart = `${e * 14 + 4}px`, s.dataset.noteId = t.id, s.draggable = !0;
    const n = S("ez-tree-label", t.title || "Untitled");
    n.setAttribute("data-note-id", t.id), n.title = t.title || "Untitled", n.prepend(L(b.file)), this.state.activeNoteId === t.id && n.setAttribute("aria-current", "page"), n.addEventListener("click", () => {
      this.deps.openNote(t.id), this.closeMobileSidebar(!1);
    });
    const i = E("ez-tree-action", b.ellipsis, `Note actions for ${t.title || "Untitled"}`);
    i.addEventListener("click", (o) => {
      o.stopPropagation(), this.noteActions(t, i);
    }), s.append(n, i), this.state.activeNoteId === t.id && s.classList.add("ez-active"), this.notesTree.appendChild(s);
  }
  noteActions(t, e) {
    fs([
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
    fs([
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
    D(this.searchResults);
    const e = t.trim();
    if (!e) return;
    const s = this.deps.searchWorkspace(e);
    if (s.length === 0) {
      const n = f("div", "ez-search-empty");
      n.textContent = "No matches", this.searchResults.appendChild(n);
      return;
    }
    for (const n of s.slice(0, 40)) {
      const i = f("button", "ez-search-hit");
      i.type = "button", i.setAttribute("role", "option");
      const o = f("span", "ez-search-hit-title");
      o.textContent = n.title || "Untitled";
      const a = f("span", "ez-search-hit-excerpt");
      a.textContent = n.excerpt, i.append(o, a), i.addEventListener("click", () => {
        const l = this.deps.openNote(n.noteId);
        this.closeMobileSidebar(!1), Promise.resolve(l).then(() => {
          n.blockId && this.deps.goToBlock(n.blockId);
        }), this.searchInput && (this.searchInput.value = ""), this.searchResults && D(this.searchResults);
      }), this.searchResults.appendChild(i);
    }
  }
  buildTrashSection() {
    const t = f("details", "ez-trash-section"), e = f("summary", "ez-trash-summary");
    e.appendChild(L(b.trash));
    const s = f("span");
    s.textContent = "Trash", e.appendChild(s);
    const n = f("div", "ez-trash-list"), i = () => {
      D(n);
      const o = this.state.listTrashedNotes(), a = this.state.listTrashedFolders();
      if (o.length === 0 && a.length === 0) {
        n.appendChild(f("div", "ez-trash-empty", "Trash is empty"));
        return;
      }
      for (const l of a) {
        const c = f("div", "ez-trash-row"), d = f("span", "ez-trash-label");
        d.textContent = `${l.name} (folder)`;
        const h = E("ez-icon-btn", b.restore, `Restore ${l.name}`);
        h.addEventListener("click", () => this.deps.restoreFolder(l.id));
        const u = E("ez-icon-btn", b.x, `Delete ${l.name} forever`);
        u.addEventListener("click", () => this.deps.deleteFolderForever(l.id)), c.append(d, h, u), n.appendChild(c);
      }
      for (const l of o) {
        const c = f("div", "ez-trash-row"), d = f("span", "ez-trash-label");
        d.textContent = l.title || "Untitled";
        const h = E("ez-icon-btn", b.restore, `Restore ${l.title}`);
        h.addEventListener("click", () => this.deps.restoreNote(l.id));
        const u = E("ez-icon-btn", b.x, `Delete ${l.title} forever`);
        u.addEventListener("click", () => this.deps.deleteNoteForever(l.id)), c.append(d, h, u), n.appendChild(c);
      }
      if (o.length + a.length > 1) {
        const l = S("ez-trash-empty-btn", "Empty trash");
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
    const t = f("header", "ez-doc-header");
    this.breadcrumbs = f("nav", "ez-breadcrumbs"), this.breadcrumbs.setAttribute("aria-label", "Folder path");
    const e = f("div", "ez-title-row");
    this.titleInput = f("input", "ez-doc-title"), this.titleInput.type = "text", this.titleInput.placeholder = "Untitled", this.titleInput.setAttribute("aria-label", "Note title"), this.titleInput.addEventListener("input", () => {
      var i;
      const n = this.state.activeNoteId;
      n && this.deps.renameNote(n, ((i = this.titleInput) == null ? void 0 : i.value) ?? "");
    }), e.appendChild(this.titleInput);
    const s = f("div", "ez-document-navigation");
    return s.append(this.breadcrumbs), t.append(s, e), t;
  }
  buildStatusbar() {
    const t = f("footer", "ez-statusbar");
    t.setAttribute("aria-label", "Document status"), this.saveStatusDot = f("span", "ez-status-dot"), this.saveStatusEl = f("span", "ez-status-text"), this.saveStatusEl.setAttribute("role", "status"), this.saveStatusEl.setAttribute("aria-live", "polite"), this.saveStatusEl.textContent = "Ready";
    const e = f("button", "ez-save-state");
    return e.type = "button", e.append(this.saveStatusDot, this.saveStatusEl), e.addEventListener("click", () => this.deps.retrySave()), this.wordCountEl = f("span", "ez-word-count"), this.wordCountEl.textContent = "0 words", t.append(e, this.wordCountEl), t;
  }
  updateHeader() {
    const t = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null;
    if (this.workspaceTitle && document.activeElement !== this.workspaceTitle && (this.workspaceTitle.value = this.state.getWorkspaceName()), this.titleInput && (document.activeElement !== this.titleInput && (this.titleInput.value = (t == null ? void 0 : t.title) ?? ""), this.titleInput.disabled = !t), this.breadcrumbs) {
      if (D(this.breadcrumbs), t) {
        const s = this.state.folderPath(t.folderId);
        if (s.length > 0)
          for (const n of s) {
            const i = f("span", "ez-crumb-sep", "/");
            i.setAttribute("aria-hidden", "true");
            const o = S("ez-crumb", n.name);
            o.addEventListener("click", () => this.deps.openFolder(n.id)), this.breadcrumbs.append(i, o);
          }
      }
      const e = S("ez-crumb ez-crumb-root", "Notes");
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
    s && (D(s), s.appendChild(L(e)), s.appendChild(f("span", "ez-visually-hidden", "Theme")));
    for (const n of Array.from(this.themeMenu.querySelectorAll(".ez-theme-item")))
      n.setAttribute("aria-pressed", String(n.getAttribute("data-ez-theme-choice") === t));
  }
  updateSaveStatus(t, e) {
    if (!this.saveStatusEl || !this.saveStatusDot) return;
    this.saveStatusEl.textContent = Rr(t, e);
    const s = this.saveStatusEl.closest(".ez-save-state");
    s && s.setAttribute("data-ez-save-status", t);
  }
  applyTheme(t) {
    var s;
    this.root.setAttribute("data-ez-theme", t);
    const e = Fs(t);
    this.root.setAttribute("data-ez-resolved-theme", e), (s = this.root.querySelector(".ez-editor")) == null || s.setAttribute("data-ez-theme", e), this.refreshThemeIcons();
  }
  setFullscreen(t) {
    this.root.classList.toggle("ez-fullscreen", t), this.fullscreenBtn && (D(this.fullscreenBtn), this.fullscreenBtn.appendChild(L(t ? b.minimize : b.maximize)), this.fullscreenBtn.setAttribute("aria-label", t ? "Exit fullscreen" : "Enter fullscreen"));
  }
  /* ---------- outline ---------- */
  buildOutline() {
    const t = f("aside", "ez-outline");
    t.setAttribute("aria-label", "Heading outline");
    const e = f("h2", "ez-outline-title", "Outline"), s = f("nav", "ez-outline-list");
    s.id = `ez-outline-${++$r}`, t.append(e, s);
    const n = () => {
      D(s);
      const o = this.collectHeadings();
      if (o.length === 0) {
        s.appendChild(f("div", "ez-outline-empty", "No headings yet"));
        return;
      }
      for (const a of o) {
        const l = S("ez-outline-item", a.text || "Empty heading");
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
    const t = f("div", "ez-find-bar");
    t.setAttribute("role", "search"), t.setAttribute("aria-label", "Find and replace"), this.findInput = f("input", "ez-find-input"), this.findInput.type = "search", this.findInput.placeholder = "Find", this.findInput.setAttribute("aria-label", "Find"), this.replaceInput = f("input", "ez-find-input"), this.replaceInput.type = "text", this.replaceInput.placeholder = "Replace with", this.replaceInput.setAttribute("aria-label", "Replace with");
    const e = S("ez-btn", "Replace");
    e.addEventListener("click", () => this.runReplace(!1));
    const s = S("ez-btn", "Replace all");
    s.addEventListener("click", () => this.runReplace(!0));
    const n = E("ez-icon-btn", b.x, "Close find and replace");
    return n.addEventListener("click", () => this.closeFindDialog()), t.append(this.findInput, this.replaceInput, e, s, n), t.addEventListener("keydown", (i) => {
      i.key === "Escape" && (i.stopPropagation(), this.closeFindDialog()), i.key === "Enter" && i.target === this.findInput && this.runReplace(!1), Xt(i, t);
    }), t.hidden = !0, t;
  }
  openFindDialog() {
    var t;
    this.findDialog && (this.findDialog.hidden && (this.findReturnFocus = document.activeElement), this.findDialog.hidden = !1, (t = this.findInput) == null || t.focus());
  }
  closeFindDialog() {
    var e, s;
    if (!this.findDialog) return;
    const t = this.findDialog.contains(document.activeElement);
    if (this.findDialog.hidden = !0, t) {
      const n = (e = this.findReturnFocus) != null && e.getClientRects().length ? this.findReturnFocus : (s = this.docMenu) == null ? void 0 : s.querySelector("summary");
      n == null || n.focus();
    }
    this.findReturnFocus = null, this.root.querySelectorAll(".ez-find-hit").forEach((n) => {
      n.classList.remove("ez-find-hit"), n.removeAttribute("data-ez-find");
    });
  }
  runReplace(t) {
    var e, s;
    this.deps.findInDocument(((e = this.findInput) == null ? void 0 : e.value) ?? "", ((s = this.replaceInput) == null ? void 0 : s.value) ?? "", t);
  }
  /* ---------- recovery & legacy draft ---------- */
  buildErrorPanel() {
    const t = f("section", "ez-recovery-panel");
    t.setAttribute("role", "alert");
    const e = f("h2", "ez-recovery-title", "Your workspace needs attention"), s = f("p", "ez-recovery-message");
    s.textContent = "Notes could not be loaded from this browser. Your content stays safe — retry loading or download the stored data.";
    const n = f("div", "ez-recovery-actions"), i = S("ez-btn ez-btn-primary", "Retry loading");
    i.addEventListener("click", () => this.deps.retryLoad());
    const o = S("ez-btn", "Download stored data");
    return o.addEventListener("click", () => this.deps.downloadOriginal()), n.append(i, o), t.append(e, s, n), t.hidden = !0, t;
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
    const t = f("section", "ez-legacy-panel"), e = f("p", "ez-legacy-text");
    e.textContent = "A draft saved by an older version of Ezynota was found in this browser. Import it as a new note?";
    const s = S("ez-btn ez-btn-primary", "Import draft");
    s.addEventListener("click", () => {
      const o = this.deps.getLegacyDraft();
      o && this.deps.importLegacyDraft(o), this.deps.dismissLegacyDraft(), this.legacyPanel && (this.legacyPanel.hidden = !0);
    });
    const n = S("ez-btn", "Not now");
    n.addEventListener("click", () => {
      this.deps.dismissLegacyDraft(), this.legacyPanel && (this.legacyPanel.hidden = !0);
    });
    const i = f("div", "ez-legacy-actions");
    return i.append(s, n), t.append(e, i), t.hidden = !0, t;
  }
  maybeShowLegacyDraft() {
    this.deps.getLegacyDraft() && this.legacyPanel && (this.legacyPanel.hidden = !1);
  }
  buildHiddenImportInput() {
    this.importInput = f("input", "ez-visually-hidden"), this.importInput.type = "file", this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json", this.importInput.setAttribute("aria-hidden", "true"), this.importInput.tabIndex = -1, this.importInput.addEventListener("change", () => {
      var e;
      const t = Array.from(((e = this.importInput) == null ? void 0 : e.files) ?? []);
      t.length > 0 && this.deps.importFiles(t), this.importInput && (this.importInput.value = "");
    }), this.root.appendChild(this.importInput);
  }
  pickBackupFile() {
    this.importInput && (this.importInput.accept = ".json,application/json", this.importInput.dataset.eznPurpose = "backup", this.importInput.click(), this.importInput.accept = ".json,.md,.markdown,.html,.htm,.txt,text/*,application/json", delete this.importInput.dataset.eznPurpose);
  }
}
let $r = 0;
function Fs(r) {
  if (r === "system")
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  return r;
}
let vt = null;
function fs(r, t) {
  var a;
  vt == null || vt();
  const e = f("div", "ez-popover ez-sidebar-menu");
  e.setAttribute("role", "menu"), e.setAttribute("data-ez-ui", "true");
  for (const l of r) {
    const c = S("ez-menu-item", l.label);
    c.setAttribute("role", "menuitem"), l.danger && c.classList.add("ez-danger"), c.addEventListener("click", () => {
      n(), l.run();
    }), e.appendChild(c);
  }
  const s = t == null ? void 0 : t.closest(".ez-workspace-root");
  (s ?? document.body).appendChild(e), t == null || t.setAttribute("aria-expanded", "true"), t == null || t.setAttribute("aria-haspopup", "menu"), t && P(e, t.getBoundingClientRect());
  const n = () => {
    e.contains(document.activeElement) && (t == null || t.focus()), e.remove(), document.removeEventListener("keydown", i, !0), document.removeEventListener("mousedown", o, !0), s == null || s.removeEventListener("ez-close-popovers", n), window.removeEventListener("resize", n), t == null || t.setAttribute("aria-expanded", "false"), vt = null;
  }, i = (l) => {
    if (l.key === "Escape") {
      l.preventDefault(), l.stopImmediatePropagation(), n(), t == null || t.focus();
      return;
    }
    l.key === "Tab" && n(), Xt(l, e);
  }, o = (l) => {
    e.contains(l.target) || n();
  };
  document.addEventListener("keydown", i, !0), document.addEventListener("mousedown", o, !0), s == null || s.addEventListener("ez-close-popovers", n), window.addEventListener("resize", n), vt = n, (a = e.querySelector("button")) == null || a.focus();
}
function Tt(r) {
  return r.replace(/([\\`*_[\]])/g, "\\$1");
}
function Vt(r) {
  return /[\s()<>]/.test(r) ? r.replace(/%/g, "%25").replace(/[\s()<>]/g, (t) => `%${t.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`) : r;
}
const Pr = /* @__PURE__ */ new Set(["info", "warning", "success", "danger"]);
function _r(r, t) {
  var s, n;
  let e = Tt(t);
  for (const i of r)
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
        const o = String(((s = i.attrs) == null ? void 0 : s.href) ?? "");
        e = `[${e}](${Vt(o)})`;
        break;
      }
      case "color": {
        e = `{${String(((n = i.attrs) == null ? void 0 : n.color) ?? "")}|${e}}`;
        break;
      }
    }
  return e;
}
function X(r, t) {
  if (!r) return "";
  let e = "";
  for (const s of r)
    if (_(s))
      e += s.text.split(`
`).map((n) => _r(s.marks ?? [], n)).join(`
`);
    else if (Lt(s)) {
      const n = s.href, i = s.content.map((o) => o.text).join("");
      if (n.startsWith("note:")) {
        const o = n.slice(5), a = (t == null ? void 0 : t.get(o)) ?? i;
        e += `[${a}](${Vt(`note:${o}`)})`;
      } else G(n) ? e += `[${Tt(i)}](${Vt(n)})` : e += Tt(i);
    }
  return e;
}
function Me(r, t) {
  const e = (t == null ? void 0 : t.indent) ?? "", s = [];
  for (const n of r) {
    const i = n.data;
    switch (n.type) {
      case "heading": {
        const o = Math.min(6, Math.max(1, Number(i.level) || 1));
        s.push(`${e}${"#".repeat(o)} ${X(i.content, t == null ? void 0 : t.noteLinkTitles)}`);
        break;
      }
      case "paragraph":
        s.push(...X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`).map((o) => `${e}${o}`));
        break;
      case "quote":
        for (const o of X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`))
          s.push(`${e}> ${o}`);
        break;
      case "code":
        s.push(`${e}\`\`\``);
        for (const o of String(i.code ?? "").split(`
`)) s.push(`${e}${o}`);
        s.push(`${e}\`\`\``);
        break;
      case "delimiter":
        s.push(`${e}---`);
        break;
      case "list": {
        const o = i.style === "ordered" ? "ordered" : i.style === "task" ? "task" : "unordered", a = i.items;
        (Array.isArray(a) ? a : []).forEach((c, d) => {
          const h = o === "ordered" ? `${d + 1}. ` : o === "task" ? c.checked ? "- [x] " : "- [ ] " : "- ";
          s.push(`${e}${h}${X(c.content, t == null ? void 0 : t.noteLinkTitles)}`);
        });
        break;
      }
      case "table": {
        const o = i, a = o.rows, l = Array.isArray(a) ? a : [];
        l.length > 0 && l.forEach((c, d) => {
          const h = c.map((u) => X(u.content, t == null ? void 0 : t.noteLinkTitles));
          s.push(`${e}| ${h.join(" | ")} |`), d === 0 && o.header !== !1 && s.push(`${e}|${h.map(() => " --- ").join("|")}|`);
        });
        break;
      }
      case "image": {
        const o = String(i.src ?? ""), a = String(i.alt ?? "");
        (Z(o) || o.startsWith("asset:")) && s.push(`${e}![${Tt(a)}](${Vt(o)})`), typeof i.caption == "string" && i.caption !== "" && s.push(`${e}*${Tt(i.caption)}*`);
        break;
      }
      case "callout": {
        const o = String(i.variant ?? "info"), a = Pr.has(o) ? o : "info";
        s.push(`${e}> [!${a.toUpperCase()}]`);
        for (const l of X(i.content, t == null ? void 0 : t.noteLinkTitles).split(`
`))
          s.push(`${e}> ${l}`);
        break;
      }
      case "toggle": {
        if (s.push(`${e}### ${X(i.heading, t == null ? void 0 : t.noteLinkTitles)}`), Array.isArray(n.children)) {
          const o = Me(n.children, { ...t, indent: `${e}  ` });
          o !== "" && s.push(o);
        }
        break;
      }
    }
  }
  return s.join(`
`).replace(/\n{3,}/g, `

`).trim();
}
function K(r, t) {
  var n;
  const e = Hr(r), s = [];
  for (const i of e)
    if (i.marks.some((o) => o.type === "link")) {
      const o = i.marks.find((d) => d.type === "link"), a = String(((n = o.attrs) == null ? void 0 : n.href) ?? ""), l = i.marks.filter((d) => d !== o), c = { type: "text", text: i.text };
      l.length > 0 && (c.marks = l), G(gs(a, t)) ? s.push({ type: "link", href: gs(a, t), content: [c] }) : s.push(st(i.text, l.length > 0 ? l : void 0));
    } else
      s.push(st(i.text, i.marks.length > 0 ? i.marks : void 0));
  return s;
}
function gs(r, t) {
  if (r.startsWith("note:") || !t) return r;
  try {
    return new URL(r, t).toString();
  } catch {
    return r;
  }
}
function Hr(r) {
  const t = [];
  let e = "", s = [];
  const n = () => {
    e !== "" && (t.push({ text: e, marks: s }), e = "", s = []);
  };
  let i = 0;
  for (; i < r.length; ) {
    const o = r.slice(i);
    if (o.startsWith("**")) {
      const a = r.indexOf("**", i + 2);
      if (a > i) {
        n(), t.push({ text: r.slice(i + 2, a), marks: [{ type: "bold" }] }), i = a + 2;
        continue;
      }
    }
    if (r[i] === "*" && !o.startsWith("* ")) {
      const a = r.indexOf("*", i + 1);
      if (a > i) {
        n(), t.push({ text: r.slice(i + 1, a), marks: [{ type: "italic" }] }), i = a + 1;
        continue;
      }
    }
    if (o.startsWith("~~")) {
      const a = r.indexOf("~~", i + 2);
      if (a > i) {
        n(), t.push({ text: r.slice(i + 2, a), marks: [{ type: "strike" }] }), i = a + 2;
        continue;
      }
    }
    if (o.startsWith("==")) {
      const a = r.indexOf("==", i + 2);
      if (a > i) {
        n(), t.push({ text: r.slice(i + 2, a), marks: [{ type: "mark" }] }), i = a + 2;
        continue;
      }
    }
    if (r[i] === "`") {
      const a = r.indexOf("`", i + 1);
      if (a > i) {
        n(), t.push({ text: r.slice(i + 1, a), marks: [{ type: "code" }] }), i = a + 1;
        continue;
      }
    }
    if (o.startsWith("[!")) {
      e += r[i], i++;
      continue;
    }
    if (r[i] === "[") {
      const a = r.indexOf("]", i + 1);
      if (a > i && r[a + 1] === "(") {
        const l = r.indexOf(")", a + 2);
        if (l > a) {
          const c = r.slice(i + 1, a), d = r.slice(a + 2, l);
          c.startsWith("!") ? (n(), t.push({ text: c.slice(1), marks: [] })) : (n(), t.push({ text: c, marks: [{ type: "link", attrs: { href: d } }] })), i = l + 1;
          continue;
        }
      }
    }
    if (o.startsWith("\\[")) {
      e += "[", i += 2;
      continue;
    }
    e += r[i], i++;
  }
  return n(), t;
}
function jr(r, t) {
  const e = r.replace(/\r\n?/g, `
`).split(`
`), s = [];
  let n = 0;
  for (; n < e.length; ) {
    const i = e[n], o = i.trim();
    if (o.startsWith("```")) {
      const d = [];
      for (n++; n < e.length && !e[n].trim().startsWith("```"); )
        d.push(e[n]), n++;
      n++, s.push({ type: "code", data: { code: d.join(`
`) } });
      continue;
    }
    const a = /^(#{1,6})\s+(.*)$/.exec(o);
    if (a) {
      s.push({ type: "heading", data: { level: a[1].length, content: K(a[2], t) } }), n++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(o)) {
      s.push({ type: "delimiter", data: {} }), n++;
      continue;
    }
    if (o.startsWith(">")) {
      const d = /^>\s*\[!(\w+)\]/.exec(o), h = [];
      if (d) {
        for (n++; n < e.length && e[n].trim().startsWith(">"); )
          h.push(e[n].trim().replace(/^>\s?/, "")), n++;
        s.push({ type: "callout", data: { variant: d[1].toLowerCase(), content: h.flatMap((u) => K(u, t)) } });
        continue;
      }
      for (; n < e.length && e[n].trim().startsWith(">"); )
        h.push(e[n].trim().replace(/^>\s?/, "")), n++;
      s.push({ type: "quote", data: { content: K(h.join(" "), t) } });
      continue;
    }
    if (o.startsWith("|") && o.endsWith("|")) {
      const d = [];
      for (; n < e.length && e[n].trim().startsWith("|"); )
        d.push(e[n].trim()), n++;
      const h = Ur(d, t);
      h && s.push(h);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(i) || /^\s*[-*+]\s+\[[ xX]\]\s+/.test(i)) {
      const d = (m) => m.length - m.trimStart().length, h = d(i), u = [];
      let p = !1, g = !1;
      for (; n < e.length && /^\s*([-*+]|\d+[.)])\s+/.test(e[n]) && d(e[n]) >= h; ) {
        const m = e[n], y = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(m);
        if (y) {
          g = !0, u.push({ content: K(y[2], t), checked: y[1] !== " " }), n++;
          continue;
        }
        const v = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(m);
        /\d/.test(v[1]) && (p = !0), u.push({ content: K(v[2], t) }), n++;
      }
      u.length > 0 && s.push({ type: "list", data: { style: g ? "task" : p ? "ordered" : "unordered", items: u } });
      continue;
    }
    const l = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(o);
    if (l) {
      s.push({ type: "image", data: { alt: l[1], src: l[2] } }), n++;
      continue;
    }
    if (o === "") {
      n++;
      continue;
    }
    const c = [];
    for (; n < e.length && e[n].trim() !== "" && !/^\s*([-*+]|\d+[.)]|>|#{1,6}\s|```|\|)/.test(e[n]); )
      c.push(e[n].trim()), n++;
    c.length === 0 && (c.push(o), n++), c.length > 0 && s.push({ type: "paragraph", data: { content: K(c.join(" "), t) } });
  }
  return s;
}
function Ur(r, t) {
  if (r.length === 0) return null;
  const e = (l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()), s = e(r[0]), n = r.length > 1 && /^[\s|:-]+$/.test(r[1] ?? ""), i = n ? r.slice(2) : r.slice(1), o = [], a = s.map((l) => ({ content: K(l, t) }));
  o.push(a);
  for (const l of i)
    o.push(e(l).map((c) => ({ content: K(c, t) })));
  return { type: "table", data: { header: n, rows: o } };
}
const qr = /* @__PURE__ */ new Set(["info", "warning", "success", "danger"]);
async function $s(r, t) {
  const e = /* @__PURE__ */ new Map(), s = r.blocks.map((l) => Ps(l, t, e)), n = await Promise.all(s), i = await Promise.all(
    Array.from(e.keys()).map(async (l) => ({ id: l, asset: await t(l) }))
  ), o = { ...r, blocks: n }, a = i.filter((l) => !!l.asset);
  return a.length > 0 && (o.assets = a.map(({ id: l, asset: c }) => ({
    id: l,
    mime: c.mime,
    dataUrl: _s(c)
  }))), o;
}
async function Ps(r, t, e) {
  const s = { ...r, data: r.data };
  if (r.type === "image" && typeof r.data.src == "string") {
    const n = String(r.data.src);
    if (n.startsWith("asset:")) {
      const i = n.slice(6), o = await t(i);
      if (o) {
        const a = _s(o);
        e.set(i, a), s.data = { ...r.data, src: a };
      }
    }
  }
  return Array.isArray(r.children) && (s.children = await Promise.all(r.children.map((n) => Ps(n, t, e)))), s;
}
function _s(r) {
  const t = Wr(r.bytes);
  return `data:${r.mime};base64,${t}`;
}
function Wr(r) {
  let t = "";
  for (let s = 0; s < r.length; s += 32768)
    t += String.fromCharCode(...r.subarray(s, s + 32768));
  return btoa(t);
}
function Ne(r) {
  const t = [];
  return Hs(r, t), t.join(`
`);
}
function Hs(r, t) {
  for (const e of r) {
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
        const n = s.style === "ordered" ? "ordered" : s.style === "task" ? "task" : "unordered", i = s.items, o = Array.isArray(i) ? i : [], a = n === "ordered" ? "ol" : "ul", l = o.map((c) => {
          const d = V(c.content);
          return n === "task" ? `<li class="ez-md-task${c.checked ? " checked" : ""}"><input type="checkbox" disabled${c.checked ? " checked" : ""}/> ${d}</li>` : `<li>${d}</li>`;
        }).join(`
`);
        t.push(`<${a}>${l}</${a}>`);
        break;
      }
      case "table": {
        const n = s.rows, i = Array.isArray(n) ? n : [], o = s.header !== !1, a = i.map((l, c) => {
          const d = o && c === 0 ? "th" : "td";
          return `<tr>${l.map((h) => `<${d}>${V(h.content)}</${d}>`).join("")}</tr>`;
        }).join(`
`);
        t.push(`<table class="ez-md-table">${a}</table>`);
        break;
      }
      case "image": {
        const n = String(s.src ?? ""), i = String(s.alt ?? ""), o = document.createElement("img");
        o.alt = i, (Z(n) || n.startsWith("asset:")) && o.setAttribute("src", n), t.push(o.outerHTML), typeof s.caption == "string" && s.caption !== "" && t.push(`<figcaption>${W(s.caption)}</figcaption>`);
        break;
      }
      case "callout": {
        const n = String(s.variant ?? "info"), i = qr.has(n) ? n : "info";
        t.push(`<div class="ez-md-callout" data-ezn-variant="${W(i)}">${V(s.content)}</div>`);
        break;
      }
      case "toggle": {
        const n = V(s.heading), i = [];
        Array.isArray(e.children) && Hs(e.children, i), t.push(`<details class="ez-md-toggle"${s.open !== !1 ? " open" : ""}><summary>${n}</summary>${i.join(`
`)}</details>`);
        break;
      }
    }
  }
}
function V(r) {
  if (!Array.isArray(r)) return "";
  let t = "";
  for (const e of r)
    e.type === "text" ? t += Vr(e.text ?? "", e.marks ?? []) : e.type === "link" && (t += `<a href="${W(e.href ?? "")}" rel="noopener noreferrer">${V(e.content)}</a>`);
  return t;
}
function Vr(r, t) {
  var s, n, i;
  let e = W(r);
  for (const o of t)
    switch (o.type) {
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
        e = `<a href="${W(((s = o.attrs) == null ? void 0 : s.href) ?? "")}" rel="noopener noreferrer">${e}</a>`;
        break;
      case "color":
        e = `<span style="color:${W(((n = o.attrs) == null ? void 0 : n.color) ?? "")}">${e}</span>`;
        break;
      case "background":
        e = `<span style="background:${W(((i = o.attrs) == null ? void 0 : i.color) ?? "")}">${e}</span>`;
        break;
    }
  return e;
}
function W(r) {
  return r.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t] ?? t);
}
function Kr(r) {
  return Me(r).replace(/([*_~`=]{1,3}|==)/g, "");
}
async function Jr(r, t, e) {
  var s;
  switch (t) {
    case "json": {
      const n = await $s(r, e);
      return JSON.stringify(n, null, 2);
    }
    case "md":
      return Me(r.blocks);
    case "html": {
      const n = String(((s = r.meta) == null ? void 0 : s.title) ?? "Document"), i = Ne(r.blocks);
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
      return Kr(r.blocks);
  }
}
function Ot(r, t, e) {
  const s = new Blob([t], { type: e }), n = URL.createObjectURL(s), i = document.createElement("a");
  i.href = n, i.download = r, document.body.appendChild(i), i.click(), i.remove(), setTimeout(() => URL.revokeObjectURL(n), 1e3);
}
function Zr(r, t) {
  return r.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || t;
}
const ms = 10 * 1024 * 1024;
function Gr(r, t) {
  const e = r.toLowerCase();
  return e.endsWith(".json") || t === "application/json" ? "json" : e.endsWith(".md") || e.endsWith(".markdown") ? "md" : e.endsWith(".html") || e.endsWith(".htm") || t === "text/html" ? "html" : "txt";
}
async function Yr(r) {
  if (r.size > ms)
    throw new k(
      "EZ_IMPORT_FAILED",
      `File is larger than the ${ms / (1024 * 1024)} MB import limit`,
      { size: r.size }
    );
  const t = Gr(r.name, r.type), e = await r.text();
  switch (t) {
    case "json": {
      let s;
      try {
        s = JSON.parse(e);
      } catch {
        throw new k("EZ_IMPORT_FAILED", "File is not valid JSON", { original: e });
      }
      if (Qr(s)) {
        const n = s;
        if (typeof n.workspaceSchemaVersion != "string")
          throw new k("EZ_IMPORT_FAILED", "Backup is missing workspaceSchemaVersion", { original: s });
        return { format: t, result: { kind: "backup", backup: n } };
      }
      if (to(s)) {
        const n = s;
        if (n.schemaVersion !== $)
          throw new k("EZ_IMPORT_FAILED", `Document schema "${n.schemaVersion}" is not supported`, { original: s });
        const i = _t(n, Yt());
        return { format: t, result: { kind: "document", document: i } };
      }
      throw new k("EZ_IMPORT_FAILED", "JSON is not an Ezynota document or workspace backup", { original: s });
    }
    case "md":
      return { format: t, result: { kind: "blocks", blocks: jr(e), suggestedTitle: ie(r.name) } };
    case "html":
      return { format: t, result: { kind: "blocks", blocks: Ds(e), suggestedTitle: ie(r.name) } };
    case "txt":
      return { format: t, result: { kind: "blocks", blocks: Ms(e), suggestedTitle: ie(r.name) } };
  }
}
function Xr(r, t) {
  const e = Date.now();
  return {
    schemaVersion: $,
    blocks: r.map((s) => ({ ...s, id: Yt()() })),
    createdAt: e,
    updatedAt: e,
    meta: t ? { title: t } : void 0
  };
}
function ie(r) {
  return r.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}
function Qr(r) {
  return typeof r == "object" && r !== null && !Array.isArray(r) && "workspaceSchemaVersion" in r && Array.isArray(r.notes);
}
function to(r) {
  return typeof r == "object" && r !== null && !Array.isArray(r) && typeof r.schemaVersion == "string" && Array.isArray(r.blocks);
}
function eo(r) {
  var a;
  const t = window.open("", "_blank");
  if (!t) return;
  const e = t.document, s = String(((a = r.meta) == null ? void 0 : a.title) ?? "Ezynota document");
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
  const o = e.createElement("div");
  so(o, Ne(r.blocks)), e.body.appendChild(o), t.focus(), t.print();
}
function so(r, t) {
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
      const o = i.name.toLowerCase();
      if (/^on/i.test(o) || o === "style" || o === "formaction" || o === "xlink:href") {
        s.removeAttribute(i.name);
        continue;
      }
      n !== "IMG" && /^\s*(?:data|javascript|vbscript):/i.test(i.value) && s.removeAttribute(i.name);
    }
  }
  for (const s of Array.from(e.body.childNodes))
    r.appendChild(r.ownerDocument.importNode(s, !0));
}
class no {
  constructor(t, e) {
    this.popover = null, this.query = "", this.range = null, this.blockId = "", this.disposers = [], this.items = [], this.focusedIndex = 0, this.surface = t, this.deps = e;
    const s = (o) => {
      const a = o;
      a.isComposing || this.popover && this.handleKey(a);
    }, n = (o) => {
      o.isComposing || this.checkCaret();
    };
    this.surface.addEventListener("keydown", s, !0), this.surface.addEventListener("input", n, !0);
    const i = (o) => {
      var c, d, h;
      const a = (d = (c = o.target) == null ? void 0 : c.closest) == null ? void 0 : d.call(c, "a[href^='note:']");
      if (!a) return;
      const l = a.getAttribute("data-ezn-note") ?? ((h = a.getAttribute("href")) == null ? void 0 : h.slice(5));
      !l || !this.deps.openNote || (o.preventDefault(), this.deps.openNote(l));
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
    const i = n.toString(), o = /\[\[([^\][]*)$/.exec(i);
    if (!o) {
      this.closePopover();
      return;
    }
    this.query = o[1] ?? "", this.range = e.cloneRange(), this.blockId = ((c = s.closest("[data-ez-block-id]")) == null ? void 0 : c.getAttribute("data-ez-block-id")) ?? "", this.openPopover();
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
    const t = ((i = (n = this.deps).getActiveNoteId) == null ? void 0 : i.call(n)) ?? this.blockId, e = this.deps.listNotes().filter((o) => o.id !== t), s = this.query.toLowerCase();
    if (this.items = (s ? e.filter((o) => o.title.toLowerCase().includes(s)) : e).slice(0, 8), this.focusedIndex = 0, !this.popover) {
      this.popover = f("div", "ez-popover ez-note-suggest"), this.popover.setAttribute("role", "listbox"), this.popover.setAttribute("aria-label", "Link to note"), this.popover.setAttribute("data-ez-ui", "true");
      const o = (l) => {
        this.popover && !this.popover.contains(l.target) && this.closePopover();
      };
      document.addEventListener("mousedown", o, !0), this.disposers.push(() => document.removeEventListener("mousedown", o, !0));
      const a = () => this.closePopover();
      this.surface.addEventListener("ez-close-popovers", a), this.disposers.push(() => this.surface.removeEventListener("ez-close-popovers", a)), this.surface.appendChild(this.popover);
    }
    for (const o of Array.from(this.popover.childNodes))
      this.popover.removeChild(o);
    if (this.items.length === 0) {
      this.popover.appendChild(f("div", "ez-menu-empty", "No notes to link"));
      return;
    }
    this.items.forEach((o) => {
      var l;
      const a = f("button", "ez-menu-item");
      a.type = "button", a.setAttribute("role", "option"), a.textContent = o.title || "Untitled", a.addEventListener("click", () => this.accept(o)), (l = this.popover) == null || l.appendChild(a);
    }), this.highlightFocused(), this.range && P(this.popover, this.range.getBoundingClientRect());
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
    const o = window.getSelection();
    if (o) {
      const l = (i.ownerDocument ?? document).createRange();
      l.setStartAfter(i), l.collapse(!0), o.removeAllRanges(), o.addRange(l);
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
class io {
  constructor(t, e, s) {
    this.ui = null, this.suggester = null, this.histories = /* @__PURE__ */ new Map(), this.disposers = [], this.destroyed = !1, this.themeMedia = null, this.fullscreenOn = !1, this.fullscreenPending = !1, this.lastFocus = null, this.switching = !1, this.depsBridge = null, this.loadGeneration = 0, this.onFullscreenChange = () => {
      var l, c, d, h;
      if (this.destroyed) return;
      const a = this.surface.ownerDocument.fullscreenElement === this.surface;
      a !== this.fullscreenOn && (this.fullscreenOn = a, (l = this.ui) == null || l.setFullscreen(a), a ? this.host.announce("Fullscreen enabled. Press Escape to exit.") : (this.surface.ownerDocument.fullscreenElement || (c = this.lastFocus) == null || c.focus(), this.lastFocus = null), (h = (d = this.options).onEvent) == null || h.call(d, { type: "fullscreen", on: a }));
    }, this.findEngine = null, this.host = t, this.surface = e, this.options = s, this.theme = s.theme ?? "system";
    const n = s.storage ? typeof s.storage == "function" ? s.storage() : s.storage : new yr(), i = s.explicitWorkspaceId ?? wr(s.targetId);
    this.state = new Er({ workspaceId: i, storage: n, generateId: bs }), this.disposers.push(
      t.on("change", (a) => {
        var l;
        (l = this.ui) == null || l.refreshHistory(), !this.switching && (a.origin === "history" || a.origin === "migration" || this.persistActiveNote());
      }),
      t.on("history:changed", () => {
        var a;
        return (a = this.ui) == null ? void 0 : a.refreshHistory();
      }),
      t.on("readOnly:changed", () => {
        var a;
        return (a = this.ui) == null ? void 0 : a.refreshHistory();
      }),
      t.on("ready", () => {
        var a;
        return (a = this.ui) == null ? void 0 : a.refreshHistory();
      })
    );
    const o = this.buildDeps();
    this.depsBridge = o, this.ui = new Fr(e, this.state, o, s.showSidebar !== !1), e.ownerDocument.addEventListener("fullscreenchange", this.onFullscreenChange), this.suggester = new no(e, {
      listNotes: () => this.state.listNotes().map((a) => ({ id: a.id, title: a.title })),
      openNote: (a) => {
        var l;
        return ((l = this.depsBridge) == null ? void 0 : l.openNote(a)) ?? void this.loadNoteIntoEditor(a);
      },
      getActiveNoteId: () => this.state.activeNoteId
    }), this.disposers.push(ur(this.storeFile.bind(this))), this.disposers.push(pr((a) => this.state.loadAsset(a))), this.disposers.push(
      this.state.on((a) => {
        var l;
        (l = s.onEvent) == null || l.call(s, a);
      })
    );
  }
  /** Store a file as a workspace asset; resolves to `asset:<id>`. */
  async storeFile(t) {
    try {
      const e = new Uint8Array(await t.arrayBuffer()), s = { id: bs(), mime: t.type, name: t.name, bytes: e, createdAt: Date.now() };
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
    } catch (o) {
      throw (s = this.ui) == null || s.mount(), (n = this.ui) == null || n.showLoadError(), o;
    }
    if (this.destroyed) return;
    (i = this.ui) == null || i.mount();
    const t = this.options.initialData ?? null;
    let e = this.state.activeNoteId;
    if (t)
      e = this.state.createNote(this.noteTitleOf(t) || "Imported note", null, rt(t)).id;
    else if (e === null) {
      const o = this.state.listNotes()[0];
      o ? e = o.id : e = this.state.createNote("Untitled", null).id;
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
    var i, o;
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
      n === this.loadGeneration && (this.switching = !1, (o = this.ui) == null || o.refreshHistory());
    }
  }
  noteTitleOf(t) {
    const e = t.meta ?? {}, s = typeof e.title == "string" ? e.title : "";
    if (s) return s;
    const n = t.blocks.find((i) => i.type === "heading");
    if (n) {
      const o = (n.data.content ?? []).map((a) => a.text ?? "").join("").trim();
      if (o) return o;
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
    var i, o;
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
        this.destroyed || (o = this.ui) == null || o.showNotice("Unable to change fullscreen. Check your browser's fullscreen permissions and try again.");
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
    return Fs(this.theme);
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
        eo(rt(t));
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
      findInDocument: (t, e, s) => {
        t && this.findInDocument(t, e, s);
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
    const e = this.state.activeNoteId ? this.state.getNote(this.state.activeNoteId) : null, s = this.host.getSnapshot(), n = (e == null ? void 0 : e.title) || this.noteTitleOf(s) || "note", i = await Jr(
      rt(s),
      t,
      (l) => this.state.loadAsset(l)
    ), o = t === "json" ? "application/json" : t === "md" ? "text/markdown" : t === "html" ? "text/html" : "text/plain", a = t === "json" ? "json" : t === "md" ? "md" : t === "html" ? "html" : "txt";
    Ot(`${Zr(n, "note")}.${a}`, i, o);
  }
  async importFiles(t) {
    for (const e of t)
      try {
        const s = await Yr(e);
        if (s.result.kind === "backup") {
          await this.restoreBackup(s.result.backup);
          continue;
        }
        if (s.result.kind === "document") {
          const o = s.result.document, a = this.state.createNote(this.noteTitleOf(o) || "Imported note", this.state.activeFolderId, o);
          await this.loadNoteIntoEditor(a.id);
          continue;
        }
        const n = Xr(s.result.blocks, s.result.suggestedTitle), i = this.state.createNote(s.result.suggestedTitle ?? "Imported note", this.state.activeFolderId, n);
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
    var n, i, o;
    const s = { type: "importError", message: t, cause: e };
    (n = this.ui) == null || n.notifyEvent(s), (o = (i = this.options).onEvent) == null || o.call(i, s);
  }
  async createBackup() {
    try {
      await this.saveActiveNote();
      const t = await this.state.createBackup(), e = Cr(t);
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
  async findInDocument(t, e, s) {
    var n;
    (n = this.findEngine) == null || n.call(this, t, e, s);
  }
  wordCount() {
    const t = ro(this.host.getSnapshot().blocks);
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
    return Ne(this.host.getSnapshot().blocks);
  }
  /** Resolve assets to data URLs for external consumers. */
  async portableSnapshot() {
    await this.saveActiveNote();
    const t = this.host.getSnapshot();
    return $s(rt(t), (e) => this.state.loadAsset(e));
  }
  get generatorVersion() {
    return Gt;
  }
}
function ro(r) {
  let t = "";
  const e = (s) => {
    for (const n of s) {
      const i = n.data.content;
      Array.isArray(i) && (t += `${i.map((o) => o.text ?? "").join("")}
`), n.type === "code" && (t += `${String(n.data.code ?? "")}
`), Array.isArray(n.children) && e(n.children);
    }
  };
  return e(r), t;
}
function rt(r) {
  return JSON.parse(JSON.stringify(r));
}
function bs() {
  return Yt()();
}
const Oe = /* @__PURE__ */ new Set();
function oo(r) {
  Oe.add(r);
}
function ao(r) {
  Oe.delete(r);
}
function Kt() {
  return Array.from(Oe);
}
const Jt = "data-ezn-mounted", Re = "data-ezn-destroyed", lo = /* @__PURE__ */ new Set(["workspace", "document", "embedded", "headless"]), co = /* @__PURE__ */ new Set(["light", "dark", "system"]);
let Rt = null, ys = !1, re = null;
function ho(r) {
  const t = { target: r }, e = r.getAttribute("data-ezn-mode");
  e && lo.has(e) && (t.mode = e);
  const s = r.getAttribute("data-ezn-workspace");
  s && s.trim() !== "" && (t.workspace = s.trim());
  const n = r.getAttribute("data-ezn-theme");
  n && co.has(n) && (t.theme = n);
  const i = r.getAttribute("data-ezn-readonly");
  i === "true" ? t.readOnly = !0 : i === "false" && (t.readOnly = !1);
  const o = r.getAttribute("data-ezn-placeholder");
  return o && o.trim() !== "" && (t.placeholder = o), r.getAttribute("data-ezn-autofocus") === "true" && (t.autofocus = !0), t;
}
function uo(r) {
  if (r.hasAttribute(Jt) || r.hasAttribute(Re)) return;
  const t = Kt().find((n) => n.targetEl === r);
  if (t) return t;
  const e = ho(r), s = new bo(e);
  return s.declarative = !0, r.setAttribute(Jt, ""), s;
}
function js(r) {
  try {
    return uo(r);
  } catch (t) {
    po(r, t);
    return;
  }
}
function po(r, t) {
  const e = t instanceof Error ? t.message : String(t);
  console.error(`[ezynota] Failed to mount [data-ezn-editor] element: ${e}`, t);
  try {
    const s = { payload: { message: e } };
    r.dispatchEvent(new CustomEvent("ezn:error", { bubbles: !0, composed: !0, detail: s }));
  } catch {
  }
}
function Fe(r) {
  go();
  const t = r ?? document, e = [];
  for (const s of Array.from(t.querySelectorAll("[data-ezn-editor]"))) {
    const n = js(s);
    n && e.push(n);
  }
  return e;
}
function Ao() {
  Fe();
}
function fo(r) {
  const t = typeof r == "string" ? document.querySelector(r) : r;
  if (!t) return;
  const e = Kt().find((s) => s.targetEl === t);
  if (e) return e;
  if (t instanceof Element) {
    for (const s of Kt())
      if (s.target.contains(t)) return s;
  }
}
function go() {
  if (!(ys || typeof MutationObserver > "u") && (ys = !0, Rt = new MutationObserver((r) => {
    const t = [];
    for (const e of r)
      for (const s of Array.from(e.addedNodes))
        if (s instanceof HTMLElement) {
          s.matches("[data-ezn-editor]") && t.push(s);
          for (const n of Array.from(s.querySelectorAll("[data-ezn-editor]"))) t.push(n);
        }
    for (const e of t)
      !e.hasAttribute(Jt) && !e.hasAttribute(Re) && js(e);
    mo();
  }), !(typeof document > "u"))) {
    if (document.readyState === "loading" || !document.body) {
      document.addEventListener("DOMContentLoaded", () => {
        Rt && document.body && Rt.observe(document.body, { childList: !0, subtree: !0 }), Fe();
      });
      return;
    }
    Rt.observe(document.body, { childList: !0, subtree: !0 });
  }
}
function mo() {
  re === null && (re = setTimeout(() => {
    re = null;
    for (const r of Array.from(Kt())) {
      if (!r.declarative || r.isDestroyed()) continue;
      const t = r.targetEl;
      t.isConnected || setTimeout(() => {
        t.isConnected || r.isDestroyed() || (r.destroy(), t.removeAttribute(Jt), t.removeAttribute(Re));
      }, 100);
    }
  }, 200));
}
class bo {
  constructor(t) {
    var s;
    if (this.ready = Promise.resolve(), this.bus = new qs(), this.commands = new on(), this.registry = new an(), this.migrations = new un(), this.dragManager = null, this.blockToolbar = null, this.inlineToolbar = null, this.documentToolbar = null, this.slashMenu = null, this.announcerEl = null, this.destroyed = !1, this.disposers = [], this.recoveryMode = !1, this.originalDocument = null, this.recoveryLocked = !1, this.preRecoveryReadOnly = !1, this.blockSaveVersions = /* @__PURE__ */ new Map(), this.workspaceController = null, this.editingLocked = !1, this.themeListenerDisposer = null, this.declarative = !1, this.findReplaceEngine = null, typeof document > "u")
      throw new k("EZ_RENDER_FAILED", "Ezynota requires a DOM environment (SSR-safe: construct inside useEffect/onMounted)");
    if (this.config = t, this.mode = vo(t), this.targetEl = this.resolveTarget(t.target), this.i18nInstance = new fn(t.locale ?? "en", ((s = t.i18n) == null ? void 0 : s.messages) ?? {}), this.defaultBlockName = t.defaultBlock ?? "paragraph", this.registerBuiltinTools(), this.registerUserTools(t), !this.registry.has(this.defaultBlockName))
      throw tt(this.defaultBlockName);
    const e = this.mode === "workspace" || this.mode === "document" ? null : t.data;
    this.state = this.createState(this.migrateInitialData(e)), this.recoveryMode && this.latchRecoveryReadOnly(), this.tm = new Ys(this.state, (n) => this.handleCommit(n)), this.blockManager = new tn(this.tm, N(t.idGenerator), { onBatch: () => {
    } }), this.history = new nn(this.tm, {
      onRestoreSelection: (n) => this.restoreHistorySelection(n)
    }), this.registerBuiltinCommands(), this.setupDom(), this.renderer = new Ri(this, this.surfaceEl), this.renderer.renderAll(this.state.get().blocks), this.config.readOnly && this.renderer.setReadOnly(!0), this.wireFindReplace(), this.setupMarkdownShortcuts(), this.selectionManager = new $i(this, this.surfaceEl), this.selectionManager.start(), this.inputManager = new Wi(this, this.surfaceEl), this.inputManager.start(), this.keyboardManager = new Zi(this, this.surfaceEl), this.keyboardManager.start(), this.clipboardManager = new ir(this, this.surfaceEl), this.clipboardManager.start(), this.uiEnabled() && !t.readOnly && (this.dragManager = new ns(this, this.surfaceEl), this.dragManager.start()), this.setupDefaultUi(), this.wireEvents(), this.renderer.startObserver((n) => {
      this.inputManager.wasInputRecently(n) || this.requestSaveBlock(n, "user");
    }), oo(this), this.mode === "workspace" || this.mode === "document" ? (this.editingLocked = !0, this.targetEl.classList.add("ez-loading"), this.initializeWorkspace()) : (this.ready = new Promise((n) => {
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
    this.workspaceController = new io(
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
    ), this.workspaceController.findEngine = (e, s, n) => this.findReplace(e, s, n), this.ready = new Promise((e) => {
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
      let o = n.data;
      if (i)
        try {
          if (o = await i.save(this.toolElement(n.id)), i.validate && !await i.validate(o)) {
            e++, this.bus.emit("error", new k("EZ_INVALID_DATA", `Block "${n.id}" produced invalid data`, { blockId: n.id, tool: n.type }));
            continue;
          }
        } catch (a) {
          throw new k("EZ_SAVE_FAILED", `Failed to save block "${n.id}"`, { blockId: n.id }, a);
        }
      t.push({ ...n, data: o });
    }
    if (e > 0)
      throw new k("EZ_INVALID_DATA", `Save rejected: ${e} block(s) produced invalid data`, { count: e });
    return { ...this.state.get(), blocks: t, updatedAt: Date.now(), schemaVersion: $, generator: { name: "ezynota", version: Gt } };
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
    this.config.readOnly !== t && (this.config = { ...this.config, readOnly: t }, this.surfaceEl.classList.toggle("ez-readonly", t), this.renderer.setReadOnly(t), t && this.closeMenus(), !t && this.uiEnabled() && !this.dragManager && (this.dragManager = new ns(this, this.surfaceEl), this.dragManager.start()), (e = this.documentToolbar) == null || e.refresh(), this.bus.emit("readOnly:changed", t));
  }
  insertBlock(t, e, s) {
    if (this.destroyed) throw new k("EZ_DESTROYED", "Editor is destroyed");
    if (this.assertEditable(), !this.registry.has(t)) throw tt(t);
    const n = (s == null ? void 0 : s.index) !== void 0 ? s.index : (s == null ? void 0 : s.before) !== void 0 ? Math.max(0, this.blockManager.getIndex(s.before)) : (s == null ? void 0 : s.after) !== void 0 ? this.blockManager.getIndex(s.after) + 1 : -1, i = this.blockManager.insert(t, e ?? ks(t), "api", n);
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
    const n = this.registry.get(e), i = (l = (a = n == null ? void 0 : n.toolClass.conversion) == null ? void 0 : a.from) == null ? void 0 : l[s.type], o = i ? i(s.data) : Vi(e, s.data);
    this.blockManager.convert(t, e, o, "api");
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
    this.disposers.length = 0, this.blockSaveVersions.clear(), ao(this), this.declarative && this.targetEl.setAttribute("data-ezn-destroyed", ""), this.bus.emit("destroyed"), this.bus.destroy(), this.targetEl.classList.remove("ez-editor-mount", "ez-editor", "ez-readonly", "ez-has-block-toolbar", "ez-loading"), this.targetEl.removeAttribute("data-ez-mode"), this.targetEl.removeAttribute("data-ez-theme"), this.targetEl.innerHTML = "";
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
    if (!n || !i || !ke(n.type, i.type)) return;
    const o = JSON.parse(JSON.stringify(n.data)), a = Ji(n.type, n.data, i.type, i.data), l = this.blockManager.getIndex(e), c = JSON.parse(JSON.stringify(i));
    this.tm.commit(s, [
      { type: "block:update", id: t, previous: o, current: a },
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
    const i = x(n.data), o = this.blockManager.getIndex(t), a = N(this.config.idGenerator)(), l = { id: a, type: n.type, data: x(s) };
    this.tm.commit("user", [
      { type: "block:update", id: t, previous: i, current: x(e) },
      { type: "block:insert", block: l, index: o + 1 }
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
    const n = t.filter((u) => this.registry.has(u.type));
    if (n.length === 0) return;
    const i = [], o = () => {
      const u = i.find((p) => p.type === "block:insert");
      return u ? u.block.id : "";
    }, a = () => {
      for (let u = i.length - 1; u >= 0; u--) {
        const p = i[u];
        if (p && p.type === "block:insert") return p.block.id;
      }
      return "";
    }, l = this.state.get().blocks, c = this.blockManager.getById(e);
    let d = null;
    if (c)
      if (yt(c.type, c.data)) {
        const u = this.blockManager.getIndex(c.id), p = x(c);
        i.push({ type: "block:remove", id: c.id, index: u, block: p }), n.forEach((g, m) => {
          i.push({ type: "block:insert", block: this.shapedBlock(g).block, index: u + m });
        }), d = { id: o(), at: "start" };
      } else {
        const u = this.renderer.getTool(c.id), p = this.getSelectionInfo(), g = u, m = (p == null ? void 0 : p.blockId) === c.id;
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
          const [w, I] = y, z = x(c.data), A = yt(c.type, w), T = yt(c.type, I);
          if (A)
            n.forEach((M, j) => {
              i.push({ type: "block:insert", block: this.shapedBlock(M).block, index: v + j });
            }), i.push({ type: "block:update", id: c.id, previous: z, current: x(I) }), d = { id: o(), at: "start" };
          else {
            i.push({ type: "block:update", id: c.id, previous: z, current: x(w) });
            let M = v + 1;
            for (const j of n)
              i.push({ type: "block:insert", block: this.shapedBlock(j).block, index: M }), M++;
            if (T)
              d = { id: a(), at: "end" };
            else {
              const j = N(this.config.idGenerator)();
              i.push({
                type: "block:insert",
                block: { id: j, type: c.type, data: x(I) },
                index: M
              }), d = { id: j, at: "start" };
            }
          }
        } else {
          let w = x(c.data);
          if (m && p && !p.collapsed) {
            const z = this.getRange();
            if (z) {
              z.deleteContents();
              try {
                const A = u == null ? void 0 : u.save(this.toolElement(c.id));
                A && !(A instanceof Promise) && (w = A);
              } catch {
              }
            }
          }
          i.push({ type: "block:update", id: c.id, previous: x(c.data), current: w });
          let I = v + 1;
          for (const z of n)
            i.push({ type: "block:insert", block: this.shapedBlock(z).block, index: I }), I++;
        }
      }
    else {
      let u = l.length;
      for (const p of n)
        i.push({ type: "block:insert", block: this.shapedBlock(p).block, index: u }), u++;
      d = { id: o(), at: "start" };
    }
    this.tm.commit(s, i);
    const h = i.find((u) => u.type === "block:update");
    if (h && h.type === "block:update") {
      const u = this.blockManager.getById(h.id);
      u && this.renderer.convert(h.id, u);
    }
    d != null && d.id && this.focusBlock(d.id, d.at), this.announce("Pasted content inserted");
  }
  shapedBlock(t) {
    return {
      block: { id: N(this.config.idGenerator)(), type: t.type, data: x(t.data) }
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
      const o = this.toolElement(t), a = n.save(o);
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
    } catch (o) {
      this.bus.emit("error", new k("EZ_SAVE_FAILED", `Save failed for block "${t}"`, { blockId: t }, o));
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
        const o = x(i.children ?? []), a = (l) => {
          for (const c of l) {
            if (c.id === t)
              return c.children = e, !0;
            if (a(c.children ?? [])) return !0;
          }
          return !1;
        };
        if (a(o)) {
          this.commitChildren(i.id, o);
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
    const i = x(((l = this.blockManager.getByIdRecursive(t)) == null ? void 0 : l.children) ?? []), o = { id: N(this.config.idGenerator)(), type: e, data: s ?? ks(e) }, a = n === void 0 ? i.length : Math.max(0, Math.min(n, i.length));
    return i.splice(a, 0, o), this.commitChildren(t, i), o.id;
  }
  updateNestedBlock(t, e, s) {
    var o;
    const n = x(((o = this.blockManager.getByIdRecursive(t)) == null ? void 0 : o.children) ?? []), i = n.find((a) => a.id === e);
    i && (i.data = s, this.commitChildren(t, n));
  }
  removeNestedBlock(t, e) {
    var i;
    const s = x(((i = this.blockManager.getByIdRecursive(t)) == null ? void 0 : i.children) ?? []), n = s.findIndex((o) => o.id === e);
    n < 0 || (s.splice(n, 1), this.commitChildren(t, s));
  }
  moveNestedBlock(t, e, s) {
    var a;
    const n = x(((a = this.blockManager.getByIdRecursive(t)) == null ? void 0 : a.children) ?? []), i = n.findIndex((l) => l.id === e);
    if (i < 0) return;
    const [o] = n.splice(i, 1);
    o && (n.splice(Math.max(0, Math.min(s, n.length)), 0, o), this.commitChildren(t, n));
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
    (t = this.slashMenu) == null || t.close(), this.blockToolbar && this.blockToolbar.hide(), (e = this.inlineToolbar) == null || e.hide(), (s = this.documentToolbar) == null || s.hide(), this.targetEl.dispatchEvent(new Event("ez-close-popovers"));
  }
  undoInternal() {
    this.undo();
  }
  redoInternal() {
    this.redo();
  }
  dispatchInlineTool(t) {
    var e, s;
    Ns(this, t), (e = this.inlineToolbar) == null || e.refresh(), (s = this.documentToolbar) == null || s.refresh();
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
    import("./find-replace-BLaUbXne.js").then(({ createFindReplace: t }) => {
      this.findReplaceEngine = t(this, this.surfaceEl);
    });
  }
  /** Markdown typing shortcuts (headings, lists, quotes, inline marks). */
  setupMarkdownShortcuts() {
    this.mode === "headless" || this.config.readOnly || import("./markdown-shortcuts-Du4C2zMP.js").then(({ MarkdownShortcuts: t }) => {
      if (this.destroyed) return;
      const e = new t(this, this.surfaceEl);
      e.start(), this.disposers.push(() => e.stop());
    });
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
          const o = n.matches ? "dark" : "light";
          this.targetEl.setAttribute("data-ez-resolved-theme", o);
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
    this.registry.registerBlockTool("paragraph", de, !0), this.registry.registerBlockTool("heading", he), this.registry.registerBlockTool("list", ge), this.registry.registerBlockTool("quote", ue), this.registry.registerBlockTool("code", pe), this.registry.registerBlockTool("delimiter", fe), this.registry.registerBlockTool("table", ve), this.registry.registerBlockTool("image", we), this.registry.registerBlockTool("callout", Ee), this.registry.registerBlockTool("toggle", Ae);
  }
  registerUserTools(t) {
    for (const [e, s] of Object.entries(t.tools ?? {}))
      this.registry.registerBlockTool(e, s, e === t.defaultBlock);
    for (const e of t.inlineTools ?? []) {
      const s = yo(e);
      this.registry.registerInlineTool(s, e);
    }
    if ((t.inlineTools ?? []).length === 0 && this.uiEnabled())
      for (const [e, s] of Object.entries(Ts))
        this.registry.registerInlineTool(e, s);
    for (const e of t.tunes ?? []) {
      const s = ko(e);
      this.registry.registerTune(s, e);
    }
    (t.tunes ?? []).length === 0 && this.registry.registerTune("alignment", zt);
  }
  registerBuiltinCommands() {
    const t = [
      [R.INSERT_BLOCK, (e) => {
        const { type: s, data: n, index: i } = e;
        this.insertBlock(s, n, { index: i, focus: !0 });
      }],
      [R.DELETE_BLOCK, (e) => this.removeBlock(e.id)],
      [R.MOVE_BLOCK, (e) => {
        const { id: s, to: n } = e;
        this.moveBlock(s, n);
      }],
      [R.DUPLICATE_BLOCK, (e) => this.duplicateBlock(e.id)],
      [R.CONVERT_BLOCK, (e) => {
        const { id: s, type: n } = e;
        this.convertBlock(s, n);
      }],
      [R.UPDATE_BLOCK, (e) => {
        const { id: s, data: n } = e;
        this.updateBlock(s, n);
      }],
      [R.FOCUS_BLOCK, (e) => {
        const { id: s, at: n } = e;
        this.focusBlock(s, n);
      }],
      [R.UNDO, () => this.undo()],
      [R.REDO, () => this.redo()],
      [R.OPEN_SLASH_MENU, (e) => {
        var i, o;
        const s = e.blockId, n = this.getSelectionInfo();
        s ? (i = this.slashMenu) == null || i.open(s) : n && ((o = this.slashMenu) == null || o.open(n.blockId));
      }],
      [R.SET_READ_ONLY, (e) => this.setReadOnly(e.value)]
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
      return new te(t, N(this.config.idGenerator));
    } catch (e) {
      const s = ae(t, N(this.config.idGenerator));
      return s.document ? (this.bus.emit(
        "error",
        new k("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: s.dropped }, e)
      ), new te(s.document, N(this.config.idGenerator))) : (this.bus.emit("error", new k("EZ_INVALID_DOCUMENT", "The document payload is unusable; the editor started empty", void 0, e)), new te(null, N(this.config.idGenerator)));
    }
  }
  migrateDocument(t) {
    const e = t == null ? void 0 : t.schemaVersion;
    return !e || e === $ ? (this.recoveryMode = !1, this.originalDocument = null, t) : Q(e, $) < 0 && this.migrations.canMigrate(e, $) ? (this.recoveryMode = !1, this.originalDocument = null, this.migrations.migrate(t, $)) : (this.recoveryMode = !0, this.originalDocument = x(t), this.bus.emit(
      "error",
      new k("EZ_MIGRATION_FAILED", `Document schema "${e}" is not supported; opened in read-only recovery mode`, { schemaVersion: e })
    ), t);
  }
  setupDom() {
    this.targetEl.classList.add("ez-editor-mount"), this.mode === "workspace" || this.mode === "document" ? (this.targetEl.setAttribute("data-ez-mode", this.mode), this.surfaceEl = document.createElement("div"), this.surfaceEl.className = "ez-editor", this.targetEl.appendChild(this.surfaceEl)) : (this.targetEl.classList.add("ez-editor"), this.targetEl.setAttribute("data-ez-mode", this.mode), this.surfaceEl = this.targetEl), this.config.readOnly && this.surfaceEl.classList.add("ez-readonly"), this.config.minHeight && (this.surfaceEl.style.minHeight = `${this.config.minHeight}px`), this.surfaceEl.setAttribute("dir", document.body.getAttribute("dir") ?? (this.config.locale === "he" || this.config.locale === "ar" || this.config.locale === "fa" || this.config.locale === "ur" ? "rtl" : "ltr")), this.announcerEl = document.createElement("div"), this.announcerEl.className = "ez-visually-hidden", this.announcerEl.setAttribute("aria-live", "polite"), this.announcerEl.setAttribute("role", "status"), this.surfaceEl.appendChild(this.announcerEl);
  }
  setupDefaultUi() {
    if (!this.uiEnabled()) return;
    const t = this.config.ui, e = typeof t == "object" ? t : {};
    e.blockToolbar !== !1 && (this.blockToolbar = new cr(this), this.surfaceEl.appendChild(this.blockToolbar.getElement()), this.surfaceEl.classList.add("ez-has-block-toolbar")), e.inlineToolbar !== !1 && (this.inlineToolbar = new ts(this), this.inlineToolbar.getElement().style.display = "none", this.surfaceEl.appendChild(this.inlineToolbar.getElement())), e.slashMenu !== !1 && (this.slashMenu = new dr(this), this.surfaceEl.appendChild(this.slashMenu.getElement())), e.documentToolbar === !0 && (this.documentToolbar = new ts(this, !0), this.surfaceEl.prepend(this.documentToolbar.getElement()));
  }
  uiEnabled() {
    return this.config.ui !== !1;
  }
  wireEvents() {
    const t = this.bus.on("error", (o) => {
      this.emitDomEvent("ezn:error", { message: o.message, code: o.code });
    }), e = this.selectionManager.on("selection", (o) => {
      var a, l, c;
      (a = this.inlineToolbar) == null || a.updateSelection(o), (l = this.documentToolbar) == null || l.updateSelection(o), this.bus.emit("selection:changed", o), o && !o.collapsed ? this.blockToolbar && this.blockToolbar.hide() : o && ((c = this.blockToolbar) == null || c.showFor(o.blockId));
    }), s = this.selectionManager.on("focus", () => this.bus.emit("focus")), n = this.selectionManager.on("blur", () => {
      this.closeMenus(), this.bus.emit("blur");
    }), i = this.inputManager.onBlockInput((o) => {
      var l;
      if (!this.slashMenu) return;
      const a = (((l = this.getEditableElement(o)) == null ? void 0 : l.textContent) ?? "").trim();
      a === "/" ? this.slashMenu.open(o) : this.slashMenu.isOpenMenu() && (a === "" || a.startsWith("/") ? this.slashMenu.setQuery(a.replace(/^\//, "")) : this.slashMenu.close());
    });
    this.disposers.push(t, e, s, n, i);
  }
  /** Single post-commit path: history + DOM sync + events. */
  handleCommit(t) {
    var n, i, o, a, l;
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
      (o = (i = this.config).onChange) == null || o.call(i, this, t);
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
      this.state.replace(t, N(this.config.idGenerator));
    } catch (e) {
      const s = ae(t, N(this.config.idGenerator));
      if (!s.document) throw e;
      this.bus.emit(
        "error",
        new k("EZ_INVALID_DOCUMENT", "Malformed blocks were converted to read-only placeholders", { dropped: s.dropped }, e)
      ), this.state.replace(s.document, N(this.config.idGenerator));
    }
    this.tm.commit("api", [{ type: "document:replace" }]), this.renderer.renderAll(this.state.get().blocks), this.blockSaveVersions.clear();
  }
  /** Restore the caret recorded with a history entry (undo/redo). */
  restoreHistorySelection(t) {
    if (!t || this.readOnly) return;
    const e = this.getEditableElement(t.blockId);
    e && (e.focus(), Pi(e, t.focusOffset > t.anchorOffset ? t.focusOffset : t.anchorOffset));
  }
  /* ===================== Declarative initialization ===================== */
  /** Initialize every `[data-ezn-editor]` under `root` (default: document). */
  static initAll(t) {
    return Fe(t);
  }
  /** Look up the instance for an element or selector. */
  static getInstance(t) {
    return fo(t);
  }
  blockRef(t) {
    const e = this.blockManager.getById(t);
    if (this.blockManager.getIndex(t) < 0 || !e) return;
    const s = () => {
      var o;
      return ((o = this.blockManager.getById(t)) == null ? void 0 : o.type) ?? "";
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
        const o = this.blockManager.getById(t) ?? e;
        return JSON.parse(JSON.stringify(o.data));
      },
      update: (o) => this.updateBlock(t, o),
      patch: (o) => {
        const a = this.getBlockData(t) ?? {};
        this.updateBlock(t, { ...a, ...o });
      },
      remove: () => this.removeBlock(t),
      move: (o) => this.moveBlock(t, o),
      duplicate: () => this.duplicateBlock(t),
      convert: (o) => this.convertBlock(t, o)
    };
  }
}
function x(r) {
  return JSON.parse(JSON.stringify(r));
}
function ks(r) {
  switch (r) {
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
function yo(r) {
  var n;
  const t = r.class ?? r, e = Object.entries(Ts).find(([, i]) => i === t);
  if (e) return e[0];
  const s = r;
  return (((n = s.class) == null ? void 0 : n.name) ?? s.name ?? `inline-${Math.random().toString(36).slice(2, 8)}`).toLowerCase();
}
function ko(r) {
  var e;
  if (r === zt || r.class === zt) return "alignment";
  const t = r;
  return ((e = t.class) == null ? void 0 : e.name) ?? t.name ?? `tune-${Math.random().toString(36).slice(2, 8)}`;
}
function vo(r) {
  return r.mode ? r.mode : r.ui === !1 ? "headless" : "workspace";
}
export {
  _t as $,
  zt as A,
  Ts as B,
  Ee as C,
  fe as D,
  R as E,
  C as F,
  Gt as G,
  he as H,
  fn as I,
  Ot as J,
  Rs as K,
  Di as L,
  U as M,
  Jr as N,
  Ds as O,
  de as P,
  ue as Q,
  F as R,
  $ as S,
  ve as T,
  Si as U,
  Eo as V,
  De as W,
  Z as X,
  G as Y,
  jr as Z,
  Ce as _,
  Li as a,
  O as a0,
  Yr as a1,
  K as a2,
  eo as a3,
  $s as a4,
  ae as a5,
  wo as a6,
  yn as a7,
  st as a8,
  Ms as a9,
  Ei as b,
  xi as c,
  pe as d,
  Ti as e,
  qs as f,
  bo as g,
  k as h,
  qi as i,
  we as j,
  yr as k,
  Ai as l,
  ge as m,
  Ii as n,
  hs as o,
  un as p,
  Ci as q,
  Mt as r,
  Ao as s,
  Ae as t,
  an as u,
  Er as v,
  Xr as w,
  Ne as x,
  Me as y,
  Gr as z
};
//# sourceMappingURL=core-entry-BeXf_jHg.js.map
