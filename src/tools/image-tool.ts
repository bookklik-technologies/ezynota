import type { BlockAPI, BlockTool, ConversionConfig, JsonValue } from "../types";
import { isSafeImageUrl } from "../core/url";
import { ICONS, TOOL_ICONS, renderIcon } from "../ui/icons";
import { button, el } from "../ui/dom";
import { resolveAssetSrc, storeFileAsset, hasAssetStore } from "../workspace/asset-registry";

export type ImageData = {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
};

/**
 * Image block: upload, clipboard paste, drag & drop, external URLs,
 * resizing, captions and alt text. Uploaded files persist as workspace
 * assets when storage is configured; temporary object URLs are used for
 * rendering only, and portable saves resolve assets to data URLs.
 */
export class ImageTool implements BlockTool<ImageData> {
  static toolbox = { icon: TOOL_ICONS.image, title: "Image", category: "Rich blocks" };
  static conversion: ConversionConfig = { to: ["paragraph"] };
  static paste = { files: { mimeTypes: ["image/*"] } };

  /** Files → image block data (used by the clipboard router for new blocks). */
  static readonly filesToBlockDataAsync = async (files: File[]): Promise<{ type: string; data: JsonValue }[]> => {
    const out: { type: string; data: JsonValue }[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const src = hasAssetStore() ? await storeFileAsset(file) : await fileToDataUrl(file);
      if (src) {
        out.push({ type: "image", data: { src, alt: file.name.replace(/\.[^.]+$/, "") } as JsonValue });
      }
    }
    return out;
  };

  private api: BlockAPI;
  private figure!: HTMLElement;
  private img!: HTMLImageElement;
  private resizeInput: HTMLInputElement | null = null;
  private resizeValue: HTMLElement | null = null;
  private editPanel: HTMLElement | null = null;
  private panelTrigger: HTMLButtonElement | null = null;
  private uploadButton: HTMLButtonElement | null = null;
  private feedback: HTMLElement | null = null;

  constructor(options: { api: BlockAPI }) {
    this.api = options.api;
  }

  render(): HTMLElement {
    const doc = document;
    const data = this.api.getData() as unknown as ImageData;
    this.figure = doc.createElement("figure");
    this.figure.className = "ez-image";
    const frame = doc.createElement("div");
    frame.className = "ez-image-frame";
    frame.style.width = `${this.currentWidth()}%`;
    this.img = doc.createElement("img");
    this.img.alt = typeof data?.alt === "string" ? data.alt : "";
    this.applySrcToImg(data?.src ?? "");
    if (!this.api.readOnly) {
      this.img.addEventListener("dblclick", () => this.pickFile());
      this.figure.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
      });
      this.figure.addEventListener("drop", (event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          void this.storeFile(files[0] as File);
        }
      });
    }
    frame.appendChild(this.img);
    this.figure.appendChild(frame);

    const caption = doc.createElement("figcaption");
    caption.className = "ez-text-input ez-image-caption";
    caption.contentEditable = this.api.readOnly ? "false" : "true";
    caption.setAttribute("data-ez-editable", "true");
    caption.setAttribute("data-ez-placeholder", "Add a caption...");
    caption.setAttribute("data-ez-region", "caption");
    caption.setAttribute("aria-label", "Image caption");
    caption.textContent = typeof data?.caption === "string" ? data.caption : "";
    this.figure.appendChild(caption);

    if (!this.api.readOnly) {
      this.figure.appendChild(this.buildToolbar());
      this.editPanel = el("div", "ez-image-edit-panel");
      this.editPanel.setAttribute("data-ez-ui", "true");
      this.editPanel.hidden = true;
      this.feedback = el("p", "ez-image-feedback");
      this.feedback.setAttribute("role", "status");
      this.feedback.hidden = true;
      this.figure.append(this.editPanel, this.feedback);
    }
    return this.figure;
  }

  save(_element: HTMLElement): ImageData {
    const caption = this.figure?.querySelector<HTMLElement>(".ez-image-caption");
    const data = this.api.getData() as unknown as ImageData;
    return {
      src: typeof data?.src === "string" ? data.src : "",
      alt: this.img?.alt ?? "",
      caption: caption?.textContent ?? "",
      width: this.currentWidth()
    };
  }

  validate(data: ImageData): boolean {
    return !!data && typeof data.src === "string";
  }

  /** Files pasted into this block replace the image. */
  onPaste(event: { files?: File[] }): void {
    const file = event.files?.[0];
    if (file) void this.storeFile(file);
  }

  updated(): void {
    const data = this.api.getData() as unknown as ImageData;
    if (!this.figure || !data) return;
    this.applySrcToImg(data.src);
    const alt = typeof data.alt === "string" ? data.alt : "";
    if (this.img && this.img.alt !== alt) this.img.alt = alt;
    const width = this.currentWidth();
    const frame = this.figure.querySelector<HTMLElement>(".ez-image-frame");
    if (frame) frame.style.width = `${width}%`;
    if (this.resizeInput) this.resizeInput.value = String(width);
    this.updateWidthLabel(width);
    const caption = this.figure.querySelector<HTMLElement>(".ez-image-caption");
    if (caption && document.activeElement !== caption && (caption.textContent ?? "") !== (data.caption ?? "")) {
      caption.textContent = data.caption ?? "";
    }
  }

  focus(): void {
    this.figure?.querySelector<HTMLElement>(".ez-image-caption")?.focus();
  }

  getEditable(): HTMLElement | undefined {
    return this.figure?.querySelector<HTMLElement>(".ez-image-caption") ?? undefined;
  }

  destroy(): void {}

  /* ---------- implementation ---------- */

  private applySrcToImg(src: string): void {
    if (!this.img) return;
    if (typeof src !== "string" || src === "") return;
    if (src.startsWith("asset:")) {
      void resolveAssetSrc(src).then((url) => {
        if (url && this.img?.isConnected) this.img.src = url;
      });
      return;
    }
    if (isSafeImageUrl(src) || src.startsWith("data:image/")) {
      this.img.src = src;
    }
  }

  private buildToolbar(): HTMLElement {
    const bar = el("div", "ez-image-toolbar");
    bar.setAttribute("data-ez-ui", "true");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Image controls");
    const actions = el("div", "ez-image-actions");
    const makeAction = (label: string, icon: string, description: string): HTMLButtonElement => {
      const action = button("ez-image-action", label, description);
      action.prepend(renderIcon(icon));
      action.title = description;
      return action;
    };
    const upload = makeAction("Replace", ICONS.upload, "Upload or replace image");
    this.uploadButton = upload;
    upload.addEventListener("click", () => this.pickFile());
    const urlBtn = makeAction("Image URL", ICONS.link, "Insert image from URL");
    urlBtn.setAttribute("aria-expanded", "false");
    urlBtn.addEventListener("click", () => this.openEditPanel("url", urlBtn));
    const altBtn = makeAction("Alt text", ICONS.info, "Edit image description for screen readers");
    altBtn.setAttribute("aria-expanded", "false");
    altBtn.addEventListener("click", () => this.openEditPanel("alt", altBtn));
    const size = el("label", "ez-image-size");
    size.appendChild(el("span", "ez-image-size-label", "Width"));
    const resize = el("input", "ez-image-resize") as HTMLInputElement;
    this.resizeInput = resize;
    resize.type = "range";
    resize.min = "10";
    resize.max = "100";
    resize.value = String(this.currentWidth());
    resize.setAttribute("aria-label", "Image width");
    this.resizeValue = el("output", "ez-image-size-value");
    this.updateWidthLabel(this.currentWidth());
    resize.addEventListener("input", () => {
      const frame = this.figure.querySelector<HTMLElement>(".ez-image-frame");
      if (frame) frame.style.width = `${resize.value}%`;
      this.updateWidthLabel(Number(resize.value));
    });
    resize.addEventListener("change", () => {
      this.api.update({ ...this.save(this.figure), width: Number(resize.value) } as never);
    });
    actions.append(upload, urlBtn, altBtn);
    size.append(resize, this.resizeValue);
    bar.append(actions, size);
    return bar;
  }

  private updateWidthLabel(width: number): void {
    if (this.resizeValue) this.resizeValue.textContent = `${width}%`;
    this.resizeInput?.setAttribute("aria-valuetext", `${width} percent`);
  }

  private currentWidth(): number {
    const data = this.api.getData() as unknown as ImageData;
    return typeof data?.width === "number" && Number.isFinite(data.width) && data.width > 0
      ? Math.max(10, Math.min(100, data.width)) : 100;
  }

  private pickFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void this.storeFile(file);
    });
    input.click();
  }

  private async storeFile(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) {
      this.showFeedback("Choose an image file to upload.");
      return;
    }
    if (this.uploadButton?.disabled) return;
    if (this.uploadButton) this.uploadButton.disabled = true;
    this.figure.setAttribute("aria-busy", "true");
    this.showFeedback("Adding image…");
    try {
      if (hasAssetStore()) {
        const src = await storeFileAsset(file);
        if (src) {
          this.applyImage(src, file.name.replace(/\.[^.]+$/, ""));
          this.showFeedback("");
          return;
        }
      }
      // No asset storage: inline the image as a data URL.
      const dataUrl = await fileToDataUrl(file);
      this.applyImage(dataUrl, file.name.replace(/\.[^.]+$/, ""));
      this.showFeedback("");
    } catch {
      this.showFeedback("Could not add this image. Try another file.");
    } finally {
      if (this.uploadButton) this.uploadButton.disabled = false;
      this.figure.removeAttribute("aria-busy");
    }
  }

  private applyImage(src: string, alt: string): void {
    const current = this.save(this.figure);
    this.api.update({ ...current, src, alt } as never);
    const data = this.api.getData() as unknown as ImageData;
    this.applySrcToImg(data.src);
  }

  private showFeedback(message: string): void {
    if (!this.feedback) return;
    this.feedback.textContent = message;
    this.feedback.hidden = !message;
  }

  private closeEditPanel(): void {
    if (this.editPanel) this.editPanel.hidden = true;
    this.panelTrigger?.setAttribute("aria-expanded", "false");
    this.panelTrigger?.focus();
    this.panelTrigger = null;
  }

  private openEditPanel(kind: "url" | "alt", trigger: HTMLButtonElement): void {
    const panel = this.editPanel;
    if (!panel) return;
    const wasOpen = this.panelTrigger === trigger && !panel.hidden;
    this.closeEditPanel();
    if (wasOpen) return;
    panel.replaceChildren();
    this.panelTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    const label = el("label", "ez-image-field");
    label.appendChild(el("span", "ez-image-field-title", kind === "url" ? "Image URL" : "Image description"));
    const input = el("input", "ez-image-field-input");
    input.type = "text";
    input.placeholder = kind === "url" ? "https://example.com/image.jpg" : "Describe what’s in the image…";
    const data = this.api.getData() as unknown as ImageData;
    input.value = kind === "alt" ? data.alt ?? "" : /^https?:\/\//i.test(data.src) ? data.src : "";
    if (kind === "url") input.inputMode = "url";
    label.appendChild(input);
    const hint = el("p", "ez-image-field-hint", kind === "url"
      ? "Paste a direct link to an image."
      : "Help people using screen readers understand this image. Leave blank for a decorative image.");
    const error = el("p", "ez-image-field-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = el("div", "ez-image-panel-actions");
    const cancel = button("ez-image-action", "Cancel");
    cancel.addEventListener("click", () => this.closeEditPanel());
    const apply = button("ez-image-action ez-image-action-primary", kind === "url" ? "Use image" : "Save description");
    const submit = (): void => {
      if (kind === "url") {
        const url = input.value.trim();
        if (!url || !isSafeImageUrl(url)) {
          error.textContent = "Enter a valid image URL.";
          error.hidden = false;
          input.setAttribute("aria-invalid", "true");
          input.focus();
          return;
        }
        this.applyImage(url, "");
      } else {
        this.api.update({ ...this.save(this.figure), alt: input.value } as never);
        this.img.alt = input.value;
      }
      this.closeEditPanel();
    };
    apply.addEventListener("click", submit);
    input.addEventListener("input", () => {
      error.hidden = true;
      input.removeAttribute("aria-invalid");
    });
    panel.onkeydown = (event: KeyboardEvent): void => {
      // These fields are image controls, not document editing commands.
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeEditPanel();
      } else if (event.key === "Enter" && event.target === input && !event.isComposing) {
        event.preventDefault();
        submit();
      }
    };
    actions.append(cancel, apply);
    panel.append(label, hint, error, actions);
    panel.hidden = false;
    input.focus();
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}
