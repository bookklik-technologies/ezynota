import type { BlockTune, BlockTuneOptions, JsonValue } from "../types";
import { svgButton } from "../ui/dom";
import { ICONS } from "../ui/icons";

const VALID = ["left", "center", "right"] as const;
const ALIGN_ICONS: Record<(typeof VALID)[number], string> = {
  left: ICONS.alignLeft,
  center: ICONS.alignCenter,
  right: ICONS.alignRight
};

/**
 * Alignment tune: stores {"alignment": "left"|"center"|"right"} per block
 * and wraps the rendered block element with the alignment class.
 */
export class AlignmentTune implements BlockTune {
  static title = "Alignment";

  private api: BlockTuneOptions["api"];
  private value: string = "left";
  private t: (key: string) => string;
  private onChange?: (value: JsonValue) => void;

  constructor(options: BlockTuneOptions) {
    this.api = options.api;
    this.t = options.t;
    this.onChange = options.onChange;
    const v = options.value;
    this.value = (VALID as readonly string[]).includes(v as string) ? (v as string) : "left";
  }

  render(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ez-inline-group";
    for (const option of VALID) {
      const label = this.t(`tune.alignment.${option}`);
      const btn = svgButton(
        "ez-inline-btn" + (option === this.value ? " ez-active" : ""),
        ALIGN_ICONS[option],
        label
      );
      btn.setAttribute("aria-pressed", String(option === this.value));
      btn.addEventListener("click", () => {
        if (this.api.readOnly) return;
        this.value = option;
        this.onChange?.(option);
        for (const child of Array.from(wrap.children)) {
          child.classList.remove("ez-active");
          child.setAttribute("aria-pressed", "false");
        }
        btn.classList.add("ez-active");
        btn.setAttribute("aria-pressed", "true");
        this.applyWrap();
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  save(): JsonValue {
    return this.value;
  }

  wrap(element: HTMLElement): HTMLElement {
    this.applyTo(element);
    return element;
  }

  private applyWrap(): void {
    this.applyTo(this.api.element);
  }

  private applyTo(element: HTMLElement): void {
    element.classList.remove("ez-align-left", "ez-align-center", "ez-align-right");
    if (this.value !== "left") {
      element.classList.add(`ez-align-${this.value}`);
    }
  }

  destroy(): void {}
}
