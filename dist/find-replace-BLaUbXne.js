function k(e, f) {
  return (i, c, n) => {
    if (!i) return;
    let t = n ? Number.POSITIVE_INFINITY : 1, o = 0;
    const r = [];
    for (const s of e.blocks.blocks) {
      if (t <= 0) break;
      const A = p(s.data), l = p(A), u = d(l, i, c, t);
      u > 0 && (t -= u, o += u, r.push({ type: "block:update", id: s.id, previous: A, current: l }));
    }
    if (r.length === 0) {
      e.announce(`No matches for "${i}"`);
      return;
    }
    if (e.commitChanges("user", r), e.announce(n ? `Replaced ${o} match(es)` : "Replaced match"), !n) {
      const s = r[0];
      e.focusBlock(s.id, "start");
    }
  };
}
function d(e, f, i, c) {
  if (!e || typeof e != "object") return 0;
  let n = 0;
  const t = e;
  if (typeof t.code == "string") {
    const { text: o, count: r } = y(t.code, f, i, c);
    t.code = o, n += r;
  }
  if (Array.isArray(t.content) && (n += a(t.content, f, i, c - n)), Array.isArray(t.heading) && (n += a(t.heading, f, i, c - n)), Array.isArray(t.items))
    for (const o of t.items) {
      if (c - n <= 0) break;
      Array.isArray(o == null ? void 0 : o.content) && (n += a(o.content, f, i, c - n));
    }
  if (Array.isArray(t.rows)) {
    for (const o of t.rows)
      if (Array.isArray(o))
        for (const r of o) {
          if (c - n <= 0) break;
          Array.isArray(r == null ? void 0 : r.content) && (n += a(r.content, f, i, c - n));
        }
  }
  if (typeof t.caption == "string") {
    const { text: o, count: r } = y(t.caption, f, i, c - n);
    t.caption = o, n += r;
  }
  return n;
}
function a(e, f, i, c) {
  let n = 0;
  for (const t of e) {
    if (c - n <= 0) break;
    if (!t || typeof t != "object") continue;
    const o = t;
    if (typeof o.text == "string") {
      const { text: r, count: s } = y(o.text, f, i, c - n);
      o.text = r, n += s;
    }
    Array.isArray(o.content) && (n += a(o.content, f, i, c - n));
  }
  return n;
}
function y(e, f, i, c) {
  if (c <= 0) return { text: e, count: 0 };
  let n = e, t = 0, o = 0;
  for (; t < c; ) {
    const r = n.indexOf(f, o);
    if (r < 0) break;
    n = n.slice(0, r) + i + n.slice(r + f.length), t++, o = r + i.length;
  }
  return { text: n, count: t };
}
function p(e) {
  return JSON.parse(JSON.stringify(e));
}
export {
  k as createFindReplace
};
//# sourceMappingURL=find-replace-BLaUbXne.js.map
