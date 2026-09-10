import type { BlockTool, JsonValue } from "../types";
import type { BlockAPI } from "../core/types";

/**
 * UnknownBlockTool: read-only fallback for blocks whose tool is not
 * available (missing plugin, newer schema, recovery mode). It renders the
 * raw data so nothing is lost and `save()` returns the data untouched.
 */
export class UnknownBlockTool implements BlockTool {
  private api: BlockAPI;

  constructor(options: { api: BlockAPI }) {
    this.api = options.api;
  }

  render(): HTMLElement {
    const doc = this.api.element.ownerDocument ?? document;
    const wrap = doc.createElement("div");
    wrap.className = "ez-unknown-block";
    wrap.setAttribute("data-ez-unsupported", "true");
    wrap.setAttribute("tabindex", "0");

    const label = doc.createElement("div");
    label.className = "ez-unknown-block-label";
    label.textContent = `Unsupported block type "${this.api.type}" — content preserved`;

    const pre = doc.createElement("pre");
    pre.className = "ez-unknown-block-data";
    try {
      pre.textContent = JSON.stringify(this.api.getData(), null, 2) ?? "";
    } catch {
      pre.textContent = "";
    }

    wrap.appendChild(label);
    wrap.appendChild(pre);
    return wrap;
  }

  /** Preserve the original data verbatim. */
  save(): JsonValue {
    return JSON.parse(JSON.stringify(this.api.getData())) as JsonValue;
  }
}
