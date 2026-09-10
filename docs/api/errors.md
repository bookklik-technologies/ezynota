# Errors

Ezynota fails loudly and typed. Every error thrown by the editor is an `EzynotaError` with a stable `code` you can switch on.

## EzynotaError

```ts
class EzynotaError extends Error {
  readonly code: EzynotaErrorCode;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;
}
```

```ts
try {
  await editor.save();
} catch (e) {
  if (e instanceof EzynotaError) {
    switch (e.code) {
      case "EZ_INVALID_DATA":
        console.error("A block failed validation:", e.context);
        break;
      default:
        throw e;
    }
  }
}
```

The `error` event carries the same instances for recoverable (non-throwing) failures:

```ts
editor.on("error", (err) => {
  reportToTelemetry(err.code, err.context);
});
```

## Error codes

| Code | Thrown when |
| --- | --- |
| `EZ_RENDER_FAILED` | Constructor ran without a DOM (SSR), or surface rendering failed. |
| `EZ_EDITING_LOCKED` | A mutation was attempted before `ready` resolved. |
| `EZ_DESTROYED` | A method was called after `destroy()`. |
| `EZ_INVALID_DOCUMENT` | `normalizeDocument` rejected a document. |
| `EZ_INVALID_BLOCK` | `normalizeBlock` rejected a block. |
| `EZ_INVALID_DATA` | `save()` failed because a block tool's data didn't validate. |
| `EZ_BLOCK_NOT_FOUND` | A block id doesn't exist. |
| `EZ_UNKNOWN_TOOL` | Referenced block type has no registered tool and no fallback. |
| `EZ_STORAGE_ERROR` | Storage adapter failed to load or commit. |

::: note
The exact set of codes can grow between minor versions. Treat unknown codes as failures and surface `err.message` — codes are for matching known cases, not exhaustive enums.
:::

## Recovery states vs. throws

Not every failure throws. Some become **recoverable UI states** instead:

| Situation | Behavior |
| --- | --- |
| Workspace load failed | Recovery panel; `retryLoad()` re-attempts; `getLoadError()` explains. |
| Save conflict (newer revision exists) | Recovery state, no silent overwrite; `retrySave()`. |
| Corrupt note document | `salvageDocument` renders `unknown` placeholders preserving raw data. |
| Broken lazy tool loader | Falls back to `UnknownBlockTool`. |
| Save with invalid block data | **Throws** `EZ_INVALID_DATA` — validation errors must not be swallowed. |

## Design rules

1. **Never swallow** — invalid input either throws a typed error or becomes an explicit, visible recovery state.
2. **Rich context** — `context` carries ids, indices, and payloads to make bugs diagnosable from logs alone.
3. **Cause chains** — internal exceptions are attached as `cause`, never discarded.
