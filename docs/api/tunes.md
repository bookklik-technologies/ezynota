# Tunes

Tunes are per-block plugins that add behavior or settings without changing the block's data type — things like alignment. They contribute entries to the block settings menu and persist through undoable transactions.

## Built-in tune: AlignmentTune

```ts
import { AlignmentTune } from "ezynota";
```

- Adds left / center / right actions to the block settings menu (and the document toolbar's alignment buttons).
- Stores `tunes: { alignment: "left" | "center" | "right" }` on the block.
- Applies `ez-align-left|center|right` classes to the rendered block.
- Default registered tune for every editor.

Resulting document fragment:

```json
{
  "id": "b1",
  "type": "paragraph",
  "data": { "content": [] },
  "tunes": { "alignment": "center" }
}
```

## BlockTune interface

```ts
interface BlockTune {
  render(): HTMLElement | MenuItem[];  // menu content / wrapper element
  save?(): JsonValue;                  // current value for persistence
  wrap?(element: HTMLElement): HTMLElement; // optionally wrap the block DOM
  destroy?(): void;
}
```

Construction receives `BlockTuneOptions`, which includes:

- the block reference and current tune value
- **`onChange(value)`** — persist a new value through an undoable transaction (never mutate the DOM state alone)

## Writing a tune

```ts
import type { BlockTune, BlockTuneOptions } from "ezynota/types";

class WidthTune implements BlockTune {
  private value = "normal";

  constructor(private options: BlockTuneOptions) {
    this.value = this.options.value ?? "normal";
  }

  render(): MenuItem[] {
    const item = (label: string, v: string) => ({
      title: label,
      isActive: () => this.value === v,
      onClick: () => {
        this.value = v;
        this.options.onChange(v); // undoable + emits tune:update
      },
    });
    return [item("Normal", "normal"), item("Wide", "wide")];
  }

  save() {
    return this.value;
  }
}
```

Register it:

```ts
const editor = new Ezynota({
  target: "#app",
  tunes: [AlignmentTune, WidthTune],
});
```

## Notes

- Tune changes emit `tune:update` changes inside `change` batches — they participate in undo/redo like any other edit.
- Tunes apply to **every** block type by default; check `options.block.type` inside your tune if you want to scope it.
- Custom tune strings are namespaced under `tune.<name>.*` in [i18n](/guide/i18n).
