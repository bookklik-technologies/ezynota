import type { EzynotaErrorCode } from "./types";
export declare class EzynotaError extends Error {
    readonly code: EzynotaErrorCode;
    readonly cause?: unknown;
    readonly context?: Record<string, unknown>;
    constructor(code: EzynotaErrorCode, message: string, context?: Record<string, unknown>, cause?: unknown);
}
export declare function toolNotFound(type: string): EzynotaError;
export declare function invalidDocument(reason: string, context?: Record<string, unknown>): EzynotaError;
export declare function invalidBlock(reason: string, context?: Record<string, unknown>): EzynotaError;
