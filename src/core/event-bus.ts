import type { EzynotaEvents } from "./types";

type Handler = (...args: never[]) => void;

/**
 * Generic typed publish/subscribe bus used internally by subsystems
 * (selection, input). `EzynotaEvents` bus wraps the same mechanics.
 */
export class SimpleBus<Events extends Record<string, (...args: never[]) => void>> {
  private listeners = new Map<string, Set<Handler>>();
  private destroyed = false;

  on<K extends keyof Events>(event: K, handler: Events[K]): () => void {
    const key = event as string;
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    const wrapped = handler as unknown as Handler;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    if (this.destroyed) return;
    for (const handler of Array.from(this.listeners.get(event as string) ?? [])) {
      try {
        (handler as unknown as (...a: unknown[]) => void)(...(args as unknown[]));
      } catch (err) {
        if (typeof console !== "undefined") {
          console.error(`Ezynota: error in "${String(event)}" handler`, err);
        }
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}

/**
 * Typed publish/subscribe bus. Listeners are never able to emit internal
 * events (see spec §8.2) — only `on`, `off` and internal-only `emit`.
 */
export class EventBus {
  private listeners = new Map<string, Set<Handler>>();
  private destroyed = false;

  on<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): () => void {
    const key = event as string;
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    const wrapped = handler as unknown as Handler;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  off<K extends keyof EzynotaEvents>(event: K, handler: EzynotaEvents[K]): void {
    this.listeners.get(event as string)?.delete(handler as unknown as Handler);
  }

  /** Internal only — public consumers use `on()` for observation. */
  emit<K extends keyof EzynotaEvents>(event: K, ...args: Parameters<EzynotaEvents[K]>): void {
    if (this.destroyed) return;
    const set = this.listeners.get(event as string);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        (handler as unknown as (...a: unknown[]) => void)(...(args as unknown[]));
      } catch (err) {
        // Listener errors must never break the editor loop.
        if (typeof console !== "undefined") {
          console.error(`Ezynota: error in "${String(event)}" handler`, err);
        }
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}
