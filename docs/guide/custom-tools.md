# Custom tools

Ezynota is a toolkit, not a closed box. This tutorial builds three extensions end-to-end: a **block tool**, an **inline tool**, and a **tune** — using only the public SDK.

## 1. A custom block tool

Goal: a "hint" block — a highlighted tip with an icon, full inline formatting inside.

### Data shape

Decide the JSON first (it's what gets persisted):

```ts
interface HintData {
  content: InlineContent[]; // rich text, like paragraph
}
```

### Implement the tool

The easiest path is extending `TextBlockTool`, which already implements rendering plumbing, saving, merging, splitting, and focus for rich-text blocks:

```ts
import { TextBlockTool } from "@bookklik/ezynota";
import type { InlineContent } from "@bookklik/ezynota";

class HintTool extends TextBlockTool {
  static toolbox = {
    title: "Hint",
    icon: "💡",
    category: "Basic blocks",
  };
  static conversion = { to: ["paragraph", "callout"] };
  static enableInlineTools = true;

  render(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "my-hint";

    const icon = document.createElement("span");
    icon.className = "my-hint-icon";
    icon.textContent = "💡";

    // The base class provides the contenteditable region:
    wrap.append(icon, this.editable);
    return wrap;
  }

  save(): HintData {
    return { content: this.content }; // base class reads the editable for you
  }

  static hint(data: HintData) {
    return data;
  }
}
```

::: tip
`TextBlockTool` stores its content in `data.content: InlineContent[]` — the same shape as `paragraph` and `quote`. That means conversions, clipboard, and undo work with zero extra code.
:::

### Style it

```css
.my-hint {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--ez-selected);
  border-inline-start: 3px solid var(--ez-accent);
  border-radius: var(--ez-radius-md);
}
```

### Register it

```ts
const editor = new Ezynota({
  target: "#app",
  tools: {
    hint: HintTool,
  },
});

// Now available everywhere:
editor.insertBlock("hint", { content: [{ type: "text", text: "Try this!" }] });
```

The tool automatically appears in the slash menu (type `/hint`), the block picker, and — thanks to `static conversion` — the "convert to" menu of paragraphs and callouts.

### Static config cheat-sheet

| Static | What it gives you |
| --- | --- |
| `toolbox` | Slash-menu entry (`title`, `icon`, `category`) |
| `shortcut` | e.g. `"CMD+SHIFT+H"` — global block shortcut |
| `conversion.to` | Convert-to entries in other tools' menus |
| `conversion.from` | Mappers that produce your data from other types |
| `paste.tags` | Claim pasted tags, e.g. `["HINT", "ASIDE"]` |
| `paste.files` | Claim dropped/pasted files by MIME, e.g. `["application/pdf"]` |
| `paste.patterns` | Claim text patterns (regex), e.g. `/^hint:\s/i` |
| `enterKey` | `"split"` \| `"newline"` \| `"ignore"` |
| `enableInlineTools` | Floating inline toolbar inside the block |
| `supportsReadOnly` | Render correctly in read-only mode |

### Lifecycle hooks

Implement only what you need:

```ts
class MyTool extends TextBlockTool {
  render() { /* required */ }
  save() { /* required */ }
  validate(data) { return !!data; }     // gate save output
  merge(incoming) { /* Backspace-merge */ }
  renderSettings() { /* extra menu items */ }
  onPaste(event) { /* custom paste */ }
  rendered() { /* DOM attached */ }
  updated() { /* data replaced */ }
  moved({ from, to }) { /* repositioned */ }
  removed() { /* deleted */ }
  destroy() { /* clean up listeners */ }
}
```

## 2. A custom inline tool

Goal: a "small caps" toggle that stores a `smallcaps` mark.

```ts
import { MarkInlineTool } from "@bookklik/ezynota";

class SmallCapsTool extends MarkInlineTool {
  static isInline = true;
  static title = "Small caps";
  static icon = "type"; // built-in icon name

  // MarkInlineTool subclasses declare the mark type they toggle:
  // "smallcaps" renders as <span data-ez-mark="smallcaps">
}
```

If you need a popover (like the link tool), use `InlineToolOptions.onActivate()` — the editor hands you the **preserved selection** captured before the toolbar click stole focus:

```ts
const editor = new Ezynota({
  target: "#app",
  inlineTools: [
    SmallCapsTool,
    // append to or replace the built-ins as you like
  ],
});
```

The mark persists in JSON as `{ type: "smallcaps" }` and normalizes deterministically alongside the built-in marks.

## 3. A custom tune

Goal: a width tune that lets any block render "normal" or "wide".

```ts
import type { BlockTune, BlockTuneOptions } from "@bookklik/ezynota/types";

class WidthTune implements BlockTune {
  constructor(private options: BlockTuneOptions) {}

  render() {
    const btn = document.createElement("button");
    btn.textContent = "Toggle width";
    btn.addEventListener("click", () => {
      const next = this.options.value === "wide" ? "normal" : "wide";
      this.options.onChange(next); // undoable, emits tune:update
    });
    return [btn]; // MenuItem-style entries
  }

  save() {
    return this.options.value;
  }
}

const editor = new Ezynota({
  target: "#app",
  tunes: [AlignmentTune, WidthTune],
});
```

Blocks now persist:

```json
{ "tunes": { "width": "wide" } }
```

Style the wrapped block accordingly (check `data-ez-tunes` / the block's tune data in your renderer CSS).

## 4. Testing your tool

```ts
import { Ezynota } from "@bookklik/ezynota";
import "@bookklik/ezynota/dist/ezynota.css";

const editor = new Ezynota({
  target: document.body.appendChild(document.createElement("div")),
  tools: { hint: HintTool },
});

await editor.ready;
const id = editor.insertBlock("hint", { content: [{ type: "text", text: "hello" }] });
editor.updateBlock(id, { content: [{ type: "text", text: "changed" }] });
editor.undo();

const saved = await editor.save();
console.log(JSON.stringify(saved, null, 2));
```

Also worth covering:

- **Round-trip** — `save()` output re-`render()`s identically.
- **Clipboard** — copy a hint block, paste into another editor.
- **Undo** — every interaction collapses into sane undo steps.
- **Malformed data** — feed `salvageDocument`-style garbage and confirm the fallback.
