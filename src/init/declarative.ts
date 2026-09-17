import { Ezynota } from "../editor";
import type { EzynotaConfig } from "../types";
import { listInstances } from "./registry";

/**
 * Declarative initialization: every element with `[data-ezn-editor]` becomes
 * a workspace editor after DOM readiness, and elements inserted later are
 * observed automatically. Only documented attribute values are parsed —
 * attribute contents are never evaluated.
 *
 * DOM events: `ezn:ready`, `ezn:change` and `ezn:error` bubble from each
 * mount element with `{ instance, payload }` details.
 *
 * Detached editors are cleaned up after confirming they remain disconnected
 * (transient DOM moves are tolerated). Explicit destroy() unregisters and
 * suppresses immediate automatic remounting.
 */

const MOUNT_FLAG = "data-ezn-mounted";
const DESTROY_FLAG = "data-ezn-destroyed";
const MODES = new Set(["workspace", "document", "embedded", "headless"]);
const THEMES = new Set(["light", "dark", "system"]);

let observer: MutationObserver | null = null;
let started = false;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

/** Build a config from documented data-ezn-* attributes only. */
export function configFromAttributes(element: HTMLElement): Partial<EzynotaConfig> & { target: HTMLElement } {
  const config: Partial<EzynotaConfig> & { target: HTMLElement } = { target: element };
  const mode = element.getAttribute("data-ezn-mode");
  if (mode && MODES.has(mode)) config.mode = mode as EzynotaConfig["mode"];
  const workspace = element.getAttribute("data-ezn-workspace");
  if (workspace && workspace.trim() !== "") config.workspace = workspace.trim();
  const theme = element.getAttribute("data-ezn-theme");
  if (theme && THEMES.has(theme)) config.theme = theme as EzynotaConfig["theme"];
  const readonlyAttr = element.getAttribute("data-ezn-readonly");
  if (readonlyAttr === "true") config.readOnly = true;
  else if (readonlyAttr === "false") config.readOnly = false;
  const placeholder = element.getAttribute("data-ezn-placeholder");
  if (placeholder && placeholder.trim() !== "") config.placeholder = placeholder;
  const autofocus = element.getAttribute("data-ezn-autofocus");
  if (autofocus === "true") config.autofocus = true;
  return config;
}

/** Mount one element unless it already holds an editor. Returns undefined when skipped. */
export function mountElement(element: HTMLElement): Ezynota | undefined {
  if (element.hasAttribute(MOUNT_FLAG) || element.hasAttribute(DESTROY_FLAG)) return undefined;
  const existing = listInstances().find((instance) => (instance as unknown as { targetEl: Element }).targetEl === element);
  if (existing) return existing;
  const config = configFromAttributes(element);
  let instance: Ezynota;
  try {
    instance = new Ezynota(config);
  } catch (error) {
    // Never leave the element flagged as mounted when construction failed —
    // it would be permanently skipped on retry.
    element.removeAttribute(MOUNT_FLAG);
    throw error;
  }
  instance.declarative = true;
  element.setAttribute(MOUNT_FLAG, "");
  return instance;
}

/** Initialize every `[data-ezn-editor]` under `root` (default: document). */
export function initAll(root?: ParentNode): Ezynota[] {
  startGlobalObserver();
  const scope = root ?? document;
  const mounted: Ezynota[] = [];
  for (const element of Array.from(scope.querySelectorAll<HTMLElement>("[data-ezn-editor]"))) {
    const instance = mountElement(element);
    if (instance) mounted.push(instance);
  }
  return mounted;
}

/**
 * Side-effect hook used by the main entry: starts the DOM observer and
 * performs the initial scan. `ezynota/core` never calls this.
 */
export function setupDeclarativeScanning(): void {
  initAll();
}

/** Look up the editor instance for an element or selector. */
export function getInstance(elementOrSelector: Element | string): Ezynota | undefined {
  const element = typeof elementOrSelector === "string" ? document.querySelector(elementOrSelector) : elementOrSelector;
  if (!element) return undefined;
  const direct = listInstances().find((instance) => (instance as unknown as { targetEl: Element }).targetEl === element);
  if (direct) return direct;
  // Also match elements inside an instance's mount (e.g. the surface).
  if (element instanceof Element) {
    for (const instance of listInstances()) {
      if (instance.target.contains(element)) return instance;
    }
  }
  return undefined;
}

function startGlobalObserver(): void {
  if (started || typeof MutationObserver === "undefined") return;
  started = true;
  observer = new MutationObserver((mutations) => {
    const added: HTMLElement[] = [];
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches("[data-ezn-editor]")) added.push(node);
        for (const child of Array.from(node.querySelectorAll<HTMLElement>("[data-ezn-editor]"))) added.push(child);
      }
    }
    for (const element of added) {
      if (!element.hasAttribute(MOUNT_FLAG) && !element.hasAttribute(DESTROY_FLAG)) mountElement(element);
    }
    scheduleDetachedCleanup();
  });
  // document.body is null for classic scripts running in <head> — defer
  // both the scan and the observation to DOMContentLoaded.
  if (typeof document === "undefined") return;
  if (document.readyState === "loading" || !document.body) {
    document.addEventListener("DOMContentLoaded", () => {
      if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
      initAll();
    });
    return;
  }
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Clean up disconnected editors — but only after confirming a real detach. */
function scheduleDetachedCleanup(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    for (const instance of Array.from(listInstances())) {
      if (!instance.declarative || instance.isDestroyed()) continue;
      const target = (instance as unknown as { targetEl: HTMLElement }).targetEl;
      if (target.isConnected) continue;
      // Double-check after another tick: transient DOM moves are tolerated.
      setTimeout(() => {
        if (target.isConnected || instance.isDestroyed()) return;
        instance.destroy();
        // destroy() stamps data-ezn-destroyed to suppress automatic
        // remounting, but a confirmed detach cleanup must allow the
        // element to mount again later (frameworks reparent/virtualize
        // elements constantly) — clear both flags.
        target.removeAttribute(MOUNT_FLAG);
        target.removeAttribute(DESTROY_FLAG);
      }, 100);
    }
  }, 200);
}
