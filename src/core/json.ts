/**
 * Ezynota JSON types. All tool data persisted in documents must be
 * JSON-serializable — no arbitrary JavaScript objects, classes or DOM nodes.
 */

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
