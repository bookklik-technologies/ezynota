/* Declarative workspace demo. All persistence lives inside the editor
 * (IndexedDB, one workspace per page+holder). This page only observes the
 * editor's DOM events. */
(() => {
  "use strict";

  const log = document.getElementById("event-log");
  const message = document.getElementById("page-message");

  function logEvent(name, detail) {
    if (!log) return;
    const payload = detail && detail.payload !== undefined ? JSON.stringify(detail.payload) : "";
    const line = `${new Date().toLocaleTimeString()}  ${name}${payload ? ` ${payload}` : ""}`;
    log.textContent = `${line}\n${log.textContent ?? ""}`;
    if (log.textContent && log.textContent.length > 8000) {
      log.textContent = log.textContent.split("\n").slice(0, 80).join("\n");
    }
  }

  const holder = document.querySelector("[data-ezn-editor]");
  if (!holder) return;

  const syncTheme = () => {
    const root = holder.matches("[data-ez-resolved-theme]") ? holder : holder.querySelector("[data-ez-resolved-theme]");
    document.body.classList.toggle("dark", root?.getAttribute("data-ez-resolved-theme") === "dark");
  };
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(holder, { attributes: true, attributeFilter: ["data-ez-resolved-theme"], subtree: true, childList: true });
  syncTheme();

  holder.addEventListener("ezn:ready", (event) => {
    logEvent("ezn:ready", event.detail);
    if (message) message.textContent = "Make room for your next idea. Your workspace is ready.";
  });
  holder.addEventListener("ezn:change", (event) => logEvent("ezn:change", event.detail));
  holder.addEventListener("ezn:error", (event) => logEvent("ezn:error", event.detail));

  // Scanning is automatic on load; re-running is idempotent.
  if (window.Ezynota && typeof window.Ezynota.initAll === "function") {
    const mounted = window.Ezynota.initAll();
    logEvent("initAll", { payload: mounted.length });
  }

  // Programmatic access to the instance and its workspace API:
  // const editor = window.Ezynota.getInstance("[data-ezn-editor]");
  // editor.workspace.search("groceries");      // search titles and text
  // editor.workspace.createNote("Shopping");   // note/folder CRUD
  // editor.workspace.toggleFullscreen();       // fullscreen toggle
})();
