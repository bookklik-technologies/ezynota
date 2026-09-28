import type { EzynotaEvents } from "./types";
/**
 * Generic typed publish/subscribe bus used internally by subsystems
 * (selection, input). `EzynotaEvents` bus wraps the same mechanics.
 */
export declare class SimpleBus<Events extends Record<string, (...args: never[]) => void>> {
    private listeners;
    private destroyed;
    on<K extends keyof Events>(event: K, handler: Events[K]): () => void;
    emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void;
    destroy(): void;
}
/**
 * Typed publish/subscribe bus. Listeners are never able to emit internal
 * events (see spec §8.2) — only `on`, `off` and internal-only `emit`.
 */
export declare class EventBus {
    private listeners;
    private destroyed;
    on<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): () => void;
    off<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): void;
    /** Internal only — public consumers use `on()` for observation. */
    emit<K extends keyof EzynotaEvents>(event: K, ...args: Parameters<EzynotaEvents[K]>): void;
    destroy(): void;
}
