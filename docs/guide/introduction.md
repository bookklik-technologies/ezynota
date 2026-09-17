# Introduction

Ezynota is a **free, block-style editor library with portable JSON output**. It is framework-agnostic and built for structured editing experiences — CMS platforms, documentation systems, note-taking apps, comments, and knowledge bases.

It ships as a single ESM bundle, a UMD build, TypeScript types, and one CSS file — with **zero runtime dependencies**.

## Design principles

- **Block-first.** Every paragraph, heading, list, quote, code block, or divider is a typed block in a predictable document tree.
- **JSON-first, never opaque HTML.** Inline rich text is stored as portable, versioned JSON (`schemaVersion` 1.0.0) — never as opaque HTML strings. Lossless Markdown and HTML interchange is built in.
- **Transaction-driven.** Every edit becomes a typed transaction against the document model with all-or-nothing commit and mechanical undo. The DOM is only a view of the document state.
- **Zero runtime dependencies.** A single ESM bundle, a UMD build, types, and one CSS file — drop it anywhere from bundlers to plain script tags.
- **Accessible.** Keyboard-complete operation, ARIA menus and live regions, RTL support, reduced-motion handling, and a WCAG 2.2 AA target.
- **Secure by default.** Pasted HTML is sanitized, dangerous URLs are rejected, prototype-pollution keys are stripped, and the DOM is built without `eval` or untrusted `innerHTML`.

## What's in the box

- Built-in block types: paragraph, headings (H1–H6), lists (bulleted, ordered, tasks), quote, code, delimiter, tables with rich-text cells, images, callouts, and collapsible toggle sections
- Four lifecycle modes: **workspace**, **document**, **embedded**, and **headless**
- Declarative `data-ezn-editor` initialization with `ezn:ready`, `ezn:change`, and `ezn:error` DOM events, plus an `ezynota/core` entry without the auto-scan side effect
- A browser-local workspace: notes, folders, linked notes, trash, search, autosave, and backups on IndexedDB
- Document-level undo/redo, find/replace, slash menu, and Markdown typing shortcuts
- Versioned JSON schema with deterministic offline migrations; unknown schema versions are preserved

## Next steps

- [Getting started](/guide/getting-started) — installation, initialization, and first steps
- [Configuration](/guide/configuration) — every option explained
- [Modes](/guide/modes) — workspace, document, embedded, headless
- [API reference](/api/editor) — the `Ezynota` class, events, and commands
