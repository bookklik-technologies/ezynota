---
name: ezynota-ui-customization
description: "Customize Ezynota modes, visible UI, themes, CSS hooks, localization, RTL and accessible host controls. Use for editor presentation, not block or inline tool behavior."
---

# Ezynota UI Customization

## Inputs and approach

Identify the editor mode, required chrome, theme, locale, direction and host controls. Prefer configuration and scoped CSS variables over replacing internal DOM or editor modules.

Read [modes](../../../docs/guide/modes.md), [configuration](../../../docs/guide/configuration.md), [theming](../../../docs/guide/theming.md), [internationalization](../../../docs/guide/i18n.md), [editor implementation](../../../src/editor.ts), [styles](../../../src/styles/ezynota.css) and [workspace UI](../../../src/workspace/ui/workspace-ui.ts).

## Workflow and contracts

- Choose `workspace`, `document`, `embedded` or `headless` based on required chrome and persistence. `ui: false` is shorthand for headless mode.
- Configure built-in UI visibility through `config.ui`; do not remove private DOM nodes after mount or depend on undocumented structure.
- Set `theme` to `light`, `dark` or `system`. Scope CSS tokens beneath `.ez-editor`, `.ez-editor-mount` or `.ez-workspace-root` and preserve focus-visible, reduced-motion and logical-property behavior.
- Use namespaced i18n dictionaries. Missing strings fall back to English or the key, and Arabic, Hebrew, Persian and Urdu locales enable RTL behavior.
- Custom host controls should call public editor methods or commands, reflect read-only/history state, use accessible names and unsubscribe from editor events.
- Fullscreen must be triggered from a user action and may be denied by the browser or iframe policy; surface failures rather than assuming success.
- Ezynota has tools, tunes, commands and storage adapters, not a general plugin object API. Do not invent plugin registration or lifecycle hooks.

## Example

```ts
import { Ezynota } from 'ezynota';

const editor = new Ezynota({
  target: '#app',
  mode: 'document',
  theme: 'system',
  locale: 'ar',
  ui: { blockToolbar: true, inlineToolbar: true, slashMenu: true },
  i18n: {
    messages: {
      ui: { deleteBlock: 'حذف الكتلة' },
    },
  },
});

await editor.ready;
```

Apply brand tokens to the host with scoped CSS rather than embedding presentation values in document data.

## Deliverables and verification

Deliver configuration, scoped CSS and host control wiring. Review all selected modes, light/dark/system, RTL, missing translations, keyboard navigation, focus visibility, read-only/loading state, reduced motion, fullscreen failure and destroy cleanup. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
