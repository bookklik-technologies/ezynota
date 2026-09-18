# Ezynota examples

Build the distribution first, then open any example directly or serve the
repository (with WAMP: `http://localhost/ezynota/examples/`).

```sh
pnpm build
```

Each example is a single self-contained HTML file loading the local UMD bundle
and CSS from `dist/`. The minimal examples use `embedded` mode with in-memory
content; no persistence is configured.

| Example | File | Shows |
| --- | --- | --- |
| Declarative embed | [declarative.html](declarative.html) | Zero-JS startup via `data-ezn-editor` |
| Programmatic embed | [programmatic.html](programmatic.html) | `new Ezynota.Ezynota({ target, mode })` |
| Events | [events.html](events.html) | `ezn:ready` / `ezn:change` / `ezn:error` DOM events |
| Workspace mode | [advanced.html](advanced.html) | Declarative workspace with notes, folders, autosave and fullscreen |
