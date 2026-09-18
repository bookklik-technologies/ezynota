import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"","titleTemplate":false,"description":"","frontmatter":{"layout":"home","titleTemplate":false,"hero":{"name":"Ezynota","text":"A free, block-style editor","tagline":"Portable JSON output, zero dependencies, transaction-driven. Build note apps, writing surfaces, and embedded editors that own their data.","image":"/ezynota/logo.svg","actions":[{"theme":"brand","text":"Get started","link":"/guide/introduction"},{"theme":"alt","text":"API reference","link":"/api/editor"},{"theme":"alt","text":"View on GitHub","link":"https://github.com/bookklik-technologies/ezynota"}]},"features":[{"icon":"🧱","title":"Block-first","details":"Paragraphs, headings, lists, quotes, code, tables, images, callouts, and toggles — every block is a typed node in a predictable document tree."},{"icon":"📦","title":"JSON-first, never opaque HTML","details":"Documents are portable, versioned JSON (schemaVersion 1.0.0). Lossless Markdown and HTML interchange is built in — your content is never locked inside the DOM."},{"icon":"⚡","title":"Transaction-driven","details":"Every edit flows through a single write path with all-or-nothing commit and mechanical undo. The DOM is only a view of the document state."},{"icon":"🪶","title":"Zero dependencies","details":"No runtime dependencies. A single ESM bundle, a UMD build, types, and one CSS file — drop it anywhere from bundlers to plain script tags."},{"icon":"♿","title":"Accessible","details":"Keyboard-complete editing, ARIA menus and live regions, RTL support, reduced-motion handling, and a WCAG 2.2 AA target."},{"icon":"🔒","title":"Secure by default","details":"Sanitized paste and imports, a URL allowlist, prototype-pollution stripping, depth caps, and DOM building without eval or innerHTML of untrusted content."}]},"headers":[],"relativePath":"index.md","filePath":"index.md","lastUpdated":null}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
