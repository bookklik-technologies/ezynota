import type { Ezynota } from "../editor";
export declare function registerInstance(instance: Ezynota): void;
export declare function unregisterInstance(instance: Ezynota): void;
export declare function listInstances(): readonly Ezynota[];
/** Match an instance by its mount element (target). */
export declare function getInstanceByTarget(element: Element): Ezynota | undefined;
