# Development skills

Ezynota provides seven repository skills for developers using AI coding agents. Each skill covers a focused block-editor workflow using the current public APIs and source.

An **Ezynota tool, tune or storage adapter** is JavaScript used by the editor at runtime. An **agent skill** is a `SKILL.md` instruction file that helps a coding agent author those extensions or create document data. Skills do not add runtime capabilities, and Ezynota does not expose a general plugin object API.

## Repository setup

Clone the Ezynota repository and open the checkout in your coding agent. The skills are versioned under `.agents/skills/`; they are not included in the npm package and require no personal installation.

Codex discovers repository skills from `.agents/skills` between the working directory and repository root. It can select a skill from its description or you can invoke one explicitly. If a newly added skill does not appear, restart Codex. See [OpenAI's skill documentation](https://learn.chatgpt.com/docs/build-skills) for discovery and client-specific invocation details.

In Codex CLI or the IDE extension, use `/skills` or type `$` to select a skill. Other agents may have different discovery rules. Keep the repository layout intact because each skill links to local documentation and source files.

## Skill catalog

| Skill | Use it for | Guide |
| --- | --- | --- |
| [`ezynota-document-creation`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-document-creation/SKILL.md) | Documents, blocks, rich text, mutations and save behavior | [Editing and block API](/guide/editing) |
| [`ezynota-block-tool-development`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-block-tool-development/SKILL.md) | Custom block types, rendering, conversion, paste and lifecycle | [Custom tools](/guide/custom-tools) |
| [`ezynota-inline-tool-development`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-inline-tool-development/SKILL.md) | Inline marks, selections, shortcuts and popovers | [Inline tools](/api/inline-tools) |
| [`ezynota-tune-development`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-tune-development/SKILL.md) | Undoable block-wide settings and wrappers | [Tunes](/api/tunes) |
| [`ezynota-workspace-storage`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-workspace-storage/SKILL.md) | Notes, folders, assets, backups and storage adapters | [Workspace](/guide/workspace) |
| [`ezynota-interchange-migrations`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-interchange-migrations/SKILL.md) | Import, export, normalization, salvage and schema upgrades | [Interchange](/guide/interchange) |
| [`ezynota-ui-customization`](https://github.com/bookklik-technologies/ezynota/blob/main/.agents/skills/ezynota-ui-customization/SKILL.md) | Modes, UI visibility, themes, localization and RTL | [Theming](/guide/theming) |

## Example requests

Include the intended document or extension, persisted data shape, editing behavior, mode and host constraints.

```text
Use $ezynota-document-creation to create an editable project brief with structured headings and rich-text blocks.
```

```text
Use $ezynota-block-tool-development to build a rich-text hint block with conversion and read-only support.
```

```text
Use $ezynota-inline-tool-development to create a keyboard-accessible small-caps mark tool.
```

```text
Use $ezynota-tune-development to create an accessible normal-or-wide block tune with undo support.
```

```text
Use $ezynota-workspace-storage to add a custom workspace backend with conflict-safe commits and asset support.
```

```text
Use $ezynota-interchange-migrations to migrate an older document and export it to Markdown with clear fidelity limits.
```

```text
Use $ezynota-ui-customization to configure a localized RTL document editor with a system-aware theme.
```

## Choosing and combining skills

Use document creation for built-in editable content. Use block-tool development only when a new block type is needed, inline-tool development for selection-level marks, and tune development for settings that apply to whole blocks.

Workspace storage owns multi-note persistence and assets. Interchange and migrations own document conversion, validation and version changes. UI customization covers modes, themes and host controls without inventing plugin registration.

```text
Use $ezynota-block-tool-development and $ezynota-inline-tool-development to
create a custom hint block with a new inline mark.
Use $ezynota-ui-customization for its localized labels and scoped styles.
```

## Development contracts

- **Readiness:** Await `editor.ready` before mutations; workspace loading temporarily locks editing.
- **Content:** Persist JSON-compatible block data, inline nodes and tune values. Build DOM safely and keep the document model authoritative.
- **Tools:** Block and inline tools own their listeners and cleanup. Failed lazy block tools preserve content through unknown placeholders.
- **Tunes:** Commit values through `onChange` so they participate in transactions and undo.
- **Storage:** Respect `storageRevision`, reject stale commits, preserve assets and release subscriptions on close.
- **Interchange:** Normalize untrusted data, sanitize HTML and URLs, state fidelity loss, and keep migrations pure.
- **UI:** Use documented modes, configuration, commands and CSS tokens. Ezynota has no general plugin object lifecycle.

## Skill structure and maintenance

Each folder contains:

```text
ezynota-<workflow>/
  SKILL.md
  agents/
    openai.yaml
```

`SKILL.md` contains YAML `name` and `description`, focused implementation guidance, source links, an example and verification scenarios. `agents/openai.yaml` supplies display metadata and a default prompt; automatic invocation remains enabled.

When a public contract changes, update its guide and affected skills together. Keep detailed API documentation in the guides and link to it from skills instead of duplicating manuals.

For a new or revised skill:

1. Check its description against a representative request and nearby requests that belong to another skill.
2. Verify examples against current implementation and exported types.
3. Run the skill-creator `quick_validate.py` against the skill folder.
4. Inspect metadata, relative links and unfinished placeholders separately.
5. Run `pnpm docs:build` and keep dead-link checking enabled.

**Ask before running any unit tests.** Skill validation and the documentation build are not the unit suite.
