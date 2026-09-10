import type { EzynotaErrorCode } from "./types";

export class EzynotaError extends Error {
  readonly code: EzynotaErrorCode;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(code: EzynotaErrorCode, message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message);
    this.name = "EzynotaError";
    this.code = code;
    if (context !== undefined) this.context = context;
    if (cause !== undefined) this.cause = cause;
  }
}

export function toolNotFound(type: string): EzynotaError {
  return new EzynotaError("EZ_TOOL_NOT_FOUND", `Tool "${type}" is not registered`, { tool: type });
}

export function invalidDocument(reason: string, context?: Record<string, unknown>): EzynotaError {
  return new EzynotaError("EZ_INVALID_DOCUMENT", `Invalid document: ${reason}`, context);
}

export function invalidBlock(reason: string, context?: Record<string, unknown>): EzynotaError {
  return new EzynotaError("EZ_INVALID_BLOCK", `Invalid block: ${reason}`, context);
}
