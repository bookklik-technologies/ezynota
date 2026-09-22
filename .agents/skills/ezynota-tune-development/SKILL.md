---
name: ezynota-tune-development
description: "Create or update Ezynota block tunes with persisted values, undoable controls and optional DOM wrapping. Use for block-wide settings, not inline marks or new block types."
---

# Ezynota Tune Development

## Inputs and approach

Identify the per-block setting, JSON value, applicable block types, menu state and visual effect. Keep the value separate from the block's primary data and use `onChange` for every persisted update.

Read [tunes](../../../docs/api/tunes.md), [custom tools](../../../docs/guide/custom-tools.md), [public tune interfaces](../../../src/core/types.ts), [alignment tune](../../../src/tunes/alignment.ts), [renderer](../../../src/render/renderer.ts) and [document format](../../../docs/api/document-format.md).

## Workflow and contracts

- Register tune constructors through `config.tunes`. Providing the list controls which tunes are active; include `AlignmentTune` when the built-in alignment behavior should remain.
- Tune values persist under `block.tunes` and must be valid JSON. Use a stable tune key derived from the constructor/definition registration.
- Call `options.onChange(value)` instead of mutating document state or only changing classes. It creates an undoable `tune:update` change.
- `render` returns an element. Use native controls, accessible labels and current-state indicators such as `aria-pressed`.
- `wrap` may decorate or wrap the block element, but it must not replace block data or interfere with the tool's editable regions.
- Respect `options.api.readOnly`; controls may display state but must not commit changes while editing is locked.
- Remove owned listeners/resources in `destroy`. Scope the tune by `options.block.type` when it does not apply to every block.

## Example

```ts
import { AlignmentTune } from 'ezynota';
import type { BlockTune, BlockTuneOptions } from 'ezynota/types';

class WidthTune implements BlockTune {
  private value: 'normal' | 'wide';
  private button: HTMLButtonElement | null = null;

  constructor(private options: BlockTuneOptions) {
    this.value = options.value === 'wide' ? 'wide' : 'normal';
  }

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.addEventListener('click', this.toggle);
    this.sync();
    return this.button;
  }

  private toggle = () => {
    if (this.options.api.readOnly) return;
    this.value = this.value === 'wide' ? 'normal' : 'wide';
    this.options.onChange?.(this.value);
    this.sync();
  };

  private sync() {
    if (!this.button) return;
    this.button.textContent = this.value === 'wide' ? 'Use normal width' : 'Use wide width';
    this.button.setAttribute('aria-pressed', String(this.value === 'wide'));
  }

  save() { return this.value; }
  destroy() { this.button?.removeEventListener('click', this.toggle); }
}

const tunes = [AlignmentTune, WidthTune];
```

Pass `tunes` to the editor configuration and style the persisted tune state using the renderer's tune attributes or wrapper classes.

## Deliverables and verification

Deliver the tune, registration, persisted value contract and styles. Review default/malformed values, applicable block types, read-only mode, keyboard use, active state, undo/redo, save/render round-trip, rerendering and cleanup. Ask before running unit tests; do not run `pnpm test` or individual Vitest files without permission.
