import { describe, it, expect } from "vitest";
import { I18n } from "../src/i18n/i18n";
import { EN_MESSAGES } from "../src/i18n/messages";

describe("I18n", () => {
  it("falls back to English messages", () => {
    const i18n = new I18n();
    expect(i18n.t("toolbar.add")).toBe(EN_MESSAGES["toolbar.add"]);
    expect(i18n.t("slash.placeholder")).toBe(EN_MESSAGES["slash.placeholder"]);
  });

  it("uses user overrides per namespace", () => {
    const i18n = new I18n("ms", {
      toolbar: { "toolbar.add": "Tambah", "toolbar.delete": "Padam" }
    });
    expect(i18n.t("toolbar.add")).toBe("Tambah");
    expect(i18n.t("toolbar.delete")).toBe("Padam");
    expect(i18n.t("slash.placeholder")).toBe(EN_MESSAGES["slash.placeholder"]);
  });

  it("returns the raw key when missing everywhere", () => {
    const i18n = new I18n();
    expect(i18n.t("tool.image.pick")).toBe("tool.image.pick");
  });

  it("substitutes template variables", () => {
    const i18n = new I18n("en", { toolbar: { "toolbar.count": "{n} blocks" } });
    expect(i18n.t("toolbar.count", { n: 3 })).toBe("3 blocks");
  });

  it("supports tools providing their own namespaces", () => {
    const i18n = new I18n("de", {
      "tool.paragraph": { "tool.paragraph.placeholder": "Schreiben..." }
    });
    expect(i18n.t("tool.paragraph.placeholder")).toBe("Schreiben...");
  });
});
