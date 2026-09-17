import type { Ezynota } from "../editor";

/**
 * Shared instance registry for programmatic and declarative initialization.
 * Scans reuse existing instances; `Ezynota.getInstance` looks one up by
 * element or selector. One registry serves both initialization paths.
 */
const instances = new Set<Ezynota>();

export function registerInstance(instance: Ezynota): void {
  instances.add(instance);
}

export function unregisterInstance(instance: Ezynota): void {
  instances.delete(instance);
}

export function listInstances(): readonly Ezynota[] {
  return Array.from(instances);
}

/** Match an instance by its mount element (target). */
export function getInstanceByTarget(element: Element): Ezynota | undefined {
  for (const instance of instances) {
    if ((instance as unknown as { targetEl: Element }).targetEl === element) return instance;
  }
  return undefined;
}
