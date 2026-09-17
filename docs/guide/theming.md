# Theming

Ezynota ships a single stylesheet (`ezynota.css`) driven by CSS custom properties. There is no CSS-in-JS, no build-time theming, and no preprocessor — you can retheme everything from plain CSS.

## Theme switching

Set the theme via config or at runtime:

```ts
const editor = new Ezynota({ target: "#app", theme: "dark" });

editor.workspace.setTheme("dark");      // workspace mode
editor.workspace.getTheme();            // "light" | "dark" | "system"
editor.workspace.resolvedTheme();       // "light" | "dark"
```

The editor reflects the state on the DOM as data attributes:

- `data-ez-theme="light|dark|system"`
- `data-ez-resolved-theme="light|dark"` (follows `prefers-color-scheme` for `system`)

Dark styles are also mirrored under `@media (prefers-color-scheme: dark)`, so `theme: "system"` works even without JS-driven switching.

Declarative equivalent: `data-ezn-theme="dark"`.

## CSS custom properties

Override the design tokens on `.ez-editor`, `.ez-editor-mount`, or `.ez-workspace-root`:

```css
.ez-editor-mount {
  --ez-bg: #fdf6e3;
  --ez-text: #33322e;
  --ez-muted: #8f8a80;
  --ez-border: #e5dfcf;
  --ez-accent: #b58900;
  --ez-accent-2: #cb4b16;
  --ez-accent-text: #ffffff;
  --ez-danger: #dc322f;
  --ez-hover: rgba(0, 0, 0, 0.04);
  --ez-selected: rgba(181, 137, 0, 0.12);
  --ez-sidebar-bg: #eee8d5;
  --ez-radius-sm: 4px;
  --ez-radius-md: 8px;
  --ez-radius-lg: 14px;
  --ez-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --ez-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.12);
  --ez-font-family: "Iosevka", monospace;
  --ez-font-size: 17px;
}
```

### Token reference

| Token | Purpose |
| --- | --- |
| `--ez-bg` | Editor background |
| `--ez-text` | Primary text color |
| `--ez-muted` | Secondary text, placeholders |
| `--ez-border` | Borders and dividers |
| `--ez-accent` / `--ez-accent-2` | Primary/secondary accent (buttons, focus, links) |
| `--ez-accent-text` | Text on accent surfaces |
| `--ez-danger` | Destructive actions |
| `--ez-hover` / `--ez-selected` | Hover / selection tints |
| `--ez-sidebar-bg` | Workspace sidebar background |
| `--ez-radius-sm/md/lg` | Corner radii |
| `--ez-shadow-sm/md` | Shadows |
| `--ez-font-family` / `--ez-font-size` | Typography |
| `--ez-z-toolbar` | Z-index base for floating UI |

## Class naming

All classes use the `ez-` prefix. Useful groups to know when styling around the editor:

| Group | Classes / attributes |
| --- | --- |
| Mount & surface | `.ez-editor`, `.ez-editor-mount`, `.ez-blocks`, `.ez-block`, `.ez-active`, `.ez-readonly` |
| Editables | `[data-ez-editable]`, `.ez-text-input`, `[data-ez-placeholder]`, `[data-ez-region]` (table cells, captions, toggle headings) |
| Blocks | `.ez-code`, `.ez-delimiter`, `.ez-list`, `.ez-task-checkbox`, `.ez-table-wrap`, `.ez-image`, `.ez-callout.ez-callout-info` (also `warning`/`success`/`danger`), `.ez-toggle`, `.ez-unknown-block` |
| UI | `.ez-block-toolbar`, `.ez-inline-toolbar`, `.ez-document-toolbar`, `.ez-popover`, `.ez-slash-menu`, `.ez-link-form`, `.ez-color-form` |
| Alignment | `.ez-align-left`, `.ez-align-center`, `.ez-align-right` |
| Drag & drop | `.ez-dragging`, `.ez-drop-target`, `.ez-below`, `.ez-drop-placeholder` |
| Workspace shell | `.ez-workspace`, `.ez-sidebar`, save-status, outline, fullscreen styles |

## Accessibility built into the stylesheet

- `:focus-visible` outlines everywhere
- `[aria-pressed]` / `[aria-expanded]` state styling
- `[hidden] { display: none !important }` enforced
- Logical properties (`margin-inline`, `padding-inline-start`) for automatic RTL
- Reduced-motion handling and a `.ez-visually-hidden` utility (used by the ARIA live announcer)

## Color palette (inline tools)

`ColorTool` and `BackgroundColorTool` expose a fixed palette: red `#ef4444`, orange `#f97316`, yellow `#eab308`, green `#22c55e`, pink `#ec4899`, purple `#7c3aed` — plus transparent for background removal.

## Export markers

Exported HTML/Markdown uses stable marker classes you can target in your own rendering pipeline: `.ez-md-table`, `.ez-md-callout` (with `data-ezn-variant`), `.ez-md-toggle`, `.ez-md-task`.
