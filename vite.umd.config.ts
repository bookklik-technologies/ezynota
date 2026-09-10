import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";

/**
 * The UMD pass must not wipe the ESM output (emptyOutDir: false), but that
 * also means hashed chunks from an *older* ESM build linger in dist/ and
 * would be shipped by package.json files:["dist"]. The ESM pass records
 * its emitted chunk names in dist/size-report.json; before bundling, drop
 * any hashed *.js chunk (and its map) that is no longer in that manifest.
 */
function removeStaleChunks(): Plugin {
  return {
    name: "ezynota-umd-remove-stale-chunks",
    buildStart() {
      const out = resolve(__dirname, "dist");
      let manifest: { chunks?: { file: string }[] };
      try {
        manifest = JSON.parse(readFileSync(resolve(out, "size-report.json"), "utf8"));
      } catch {
        return; // no freshness manifest — cannot judge staleness, keep everything
      }
      const current = new Set((manifest.chunks ?? []).map((c) => c.file));
      let files: string[] = [];
      try {
        files = readdirSync(out);
      } catch {
        return;
      }
      for (const f of files) {
        // Compare the chunk's own .js name against the manifest (strip a
        // trailing .map first) so live ESM chunks are preserved.
        const base = f.replace(/\.map$/, "");
        if (!/^[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.js$/.test(base)) continue;
        if (!current.has(base)) {
          try {
            unlinkSync(resolve(out, f));
          } catch {
            /* already gone */
          }
        }
      }
    }
  };
}

/**
 * UMD build — Rollup supports exactly one UMD entry, so the UMD bundle is
 * built from the main entry only (declarative scanning included).
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Ezynota",
      formats: ["umd"],
      fileName: () => "ezynota.umd.cjs"
    },
    cssCodeSplit: false,
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
    // Preserves the ESM pass output; stale hashed chunks are cleaned by the
    // removeStaleChunks() plugin above instead.
    emptyOutDir: false,
    rollupOptions: {
      plugins: [removeStaleChunks()],
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name && assetInfo.name.endsWith(".css") ? "ezynota.css" : assetInfo.name || "asset")
      }
    }
  }
});
