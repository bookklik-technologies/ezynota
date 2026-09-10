import type { I18nMessages } from "../types";
import { EN_MESSAGES } from "./messages";

/**
 * I18n: namespaced keys with English fallback (spec §27).
 * Tool namespaces ("tool.<name>.*", "tune.<name>.*") fall back to English
 * then to the raw key so missing translations never break the UI.
 */
export class I18n {
  private messages: Record<string, I18nMessages> = {};
  private locale: string;

  constructor(locale = "en", userMessages: Record<string, I18nMessages> = {}) {
    this.locale = locale;
    this.messages["en"] = { ...EN_MESSAGES };
    for (const [ns, dict] of Object.entries(userMessages)) {
      this.messages[ns] = { ...(this.messages[ns] ?? {}), ...dict };
    }
  }

  t(key: string, vars?: Record<string, string | number>): string {
    // Match the longest registered namespace prefix (e.g. "tool.paragraph.*").
    const namespaces = Object.keys(this.messages).sort((a, b) => b.length - a.length);
    for (const ns of namespaces) {
      if (ns !== "en" && key.startsWith(`${ns}.`)) {
        const msg = this.messages[ns]?.[key.slice(ns.length + 1)] ?? this.messages[ns]?.[key];
        if (msg !== undefined) return this.substitute(msg, vars);
      }
    }
    const fallback = this.messages["en"]?.[key];
    return this.substitute(fallback ?? key, vars);
  }

  private substitute(message: string, vars?: Record<string, string | number>): string {
    if (!vars) return message;
    return message.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
  }

  getLocale(): string {
    return this.locale;
  }
}
