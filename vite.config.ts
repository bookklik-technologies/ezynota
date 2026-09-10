import { defineConfig } from "vite";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { readFileSync, statSync, writeFileSync } from "node:fs";

function sizeReport() {
  return {
    name: "ezynota-size-report",
    closeBundle() {
      const out = resolve(__dirname, "dist");
      const files = ["ezynota.esm.js", "ezynota.umd.cjs", "ezynota.css", "index.d.ts"];
      const lines: string[] = ["", "Ezynota bundle sizes:"];
      let gzipOk = true;
      for (const f of files) {
        try {
          const p = resolve(out, f);
          const raw = readFileSync(p);
          const gz = gzipSync(raw);
          const kb = (n: number) => (n / 1024).toFixed(1) + " KB";
          lines.push(`  ${f}: ${kb(raw.length)} raw, ${kb(gz.length)} gzip`);
          if (f === "ezynota.esm.js" && gz.length > 35 * 1024) {
            lines.push(`  WARNING: ESM bundle exceeds 35 KB gzip budget`);
            gzipOk = false;
          }
        } catch {
          /* file missing */
        }
      }
      console.log(lines.join("\n"));
      writeFileSync(resolve(out, "size-report.json"), JSON.stringify({ gzipOk, files: lines.slice(1) }, null, 2));
    }
  };
}

/**
 * Library builds. Rollup cannot emit UMD with multiple entries, so:
 * - this config builds BOTH ESM entries (`ezynota.esm.js`, `core.esm.js`),
 * - `vite.umd.config.ts` builds the single UMD bundle from the main entry.
 * CSS is emitted once as `ezynota.css`.
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        ezynota: resolve(__dirname, "src/index.ts"),
        core: resolve(__dirname, "src/core-entry.ts")
      },
      formats: ["es"],
      fileName: (format, entryName) => (entryName === "ezynota" ? "ezynota.esm.js" : `${entryName}.esm.js`)
    },
    cssCodeSplit: false,
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name && assetInfo.name.endsWith(".css") ? "ezynota.css" : assetInfo.name || "asset")
      }
    }
  },
  plugins: [sizeReport()]
});
