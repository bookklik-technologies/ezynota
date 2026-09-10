import type { InlineContent } from "../types";
import { TextBlockTool } from "./text-tools";
import { inlineToDom, domToInline, isEmptyInlineValue } from "../rich-text/dom";
import { TOOL_ICONS } from "../ui/icons";
import type { ConversionConfig } from "../types";

export type CalloutVariant = "info" | "warning" | "success" | "danger";

export type CalloutData = {
  variant: CalloutVariant;
  content: InlineContent[];
};

const VARIANTS: CalloutVariant[] = ["info", "warning", "success", "danger"];

const VARIANT_ICONS: Record<CalloutVariant, string> = {
  info: "ℹ",
  warning: "⚠",
  success: "✓",
  danger: "✕"
};

/**
 * Callout block: rich-text content inside a colored container with an
 * emoji/variant selector. Rendering and typing behave like a text block;
 * the container styling communicates the variant.
 */
export class CalloutTool extends TextBlockTool<CalloutData> {
  static toolbox = { icon: TOOL_ICONS.callout, title: "Callout", category: "Rich blocks" };
  static enableInlineTools = true;
  static conversion: ConversionConfig = { to: ["paragraph", "quote"] };

  private variant: CalloutVariant = "info";
  private containerEl: HTMLElement | null = null;

  constructor(options: { api: import("../types").BlockAPI; config: Record<string, unknown> }) {
    super(options, "Write something...", false);
    const data = this.api.getData() as unknown as CalloutVariant | CalloutData;
    if (typeof data === "string" && VARIANTS.includes(data)) {
      this.variant = data;
    } else if (data && typeof data === "object" && typeof (data as CalloutData).variant === "string" && VARIANTS.includes((data as CalloutData).variant)) {
      this.variant = (data as CalloutData).variant;
    }
  }

  tag(): string {
    return "div";
  }

  render(): HTMLElement {
    const doc = this.editable?.ownerDocument ?? document;
    const container = doc.createElement("div");
    container.className = `ez-callout ez-callout-${this.variant}`;
    container.setAttribute("data-ez-callout", this.variant);
    const badge = doc.createElement("span");
    badge.className = "ez-callout-badge";
    badge.textContent = VARIANT_ICONS[this.variant];
    badge.setAttribute("aria-hidden", "true");
    const editable = doc.createElement("div");
    editable.classList.add("ez-text-input");
    editable.contentEditable = "true";
    editable.setAttribute("data-ez-editable", "true");
    editable.setAttribute("data-ez-region", "callout-content");
    if (this.placeholder) editable.setAttribute("data-ez-placeholder", this.placeholder);
    const data = this.api.getData() as unknown as CalloutData;
    if (data?.content && !isEmptyInlineValue(data.content)) {
      editable.appendChild(inlineToDom(data.content, doc));
    }
    this.editable = editable;
    this.containerEl = container;
    container.append(badge, editable);
    return container;
  }

  save(_element: HTMLElement): CalloutData {
    return { variant: this.variant, content: domToInline(this.editable) };
  }

  updated(): void {
    const data = this.api.getData() as unknown as CalloutData;
    const variant = VARIANTS.includes(data?.variant) ? data!.variant : this.variant;
    if (variant !== this.variant) {
      this.variant = variant;
      this.refreshElement();
      return;
    }
    super.updated();
  }

  renderSettings(): HTMLElement | null {
    const wrap = document.createElement("div");
    wrap.className = "ez-inline-group";
    for (const variant of VARIANTS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ez-inline-btn" + (variant === this.variant ? " ez-active" : "");
      btn.textContent = `${VARIANT_ICONS[variant]} ${variant}`;
      btn.setAttribute("aria-pressed", String(variant === this.variant));
      btn.addEventListener("click", () => {
        if (this.api.readOnly) return;
        this.variant = variant;
        this.api.update(this.save(this.editable) as never);
        this.refreshElement();
        this.api.focus("end");
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  private refreshElement(): void {
    if (!this.containerEl?.parentElement) return;
    const previous = this.containerEl;
    const next = this.render();
    previous.replaceWith(next);
    this.containerEl = next;
    this.editable = next.querySelector("[data-ez-editable]") as HTMLElement;
  }
}
