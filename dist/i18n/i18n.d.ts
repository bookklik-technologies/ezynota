import type { I18nMessages } from "../types";
/**
 * I18n: namespaced keys with English fallback (spec §27).
 * Tool namespaces ("tool.<name>.*", "tune.<name>.*") fall back to English
 * then to the raw key so missing translations never break the UI.
 */
export declare class I18n {
    private messages;
    private locale;
    constructor(locale?: string, userMessages?: Record<string, I18nMessages>);
    t(key: string, vars?: Record<string, string | number>): string;
    private substitute;
    getLocale(): string;
}
