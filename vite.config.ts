import { defineConfig } from "vite";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Gzip budget for the total ESM payload shipped to the browser.
 *
 * Measured with `npx vite build` (all *.js chunks in dist/ summed):
 *   ~347 KB raw / ~85 KB gzip.
 *
 * The historical 35 KB budget was computed against ezynota.esm.js alone —
 * a ~2 KB re-export stub — while the real code lives in hashed shared
 * chunks, so the gate was always green. The current budget is the measured
 * total rounded up ~15% for headroom (85 * 1.15 ≈ 97.8 → 98 KB).
 * Re-measure and adjust after meaningful bundle changes.
 */
const TOTAL_GZIP_BUDGET_BYTES = 98 * 1024;

function sizeReport() {
  return {
    name: "ezynota-size-report",
    closeBundle() {
      const out = resolve(__dirname, "dist");
      const kb = (n: number) => (n / 1024).toFixed(1) + " KB";
      const lines: string[] = ["", "Ezynota bundle sizes (all shipped JS chunks):"];
      const report: { file: string; raw: number; gzip: number }[] = [];
      let gzipOk = true;
      let totalRaw = 0;
      let totalGzip = 0;
      let files: string[] = [];
      try {
        files = readdirSync(out).filter((f) => f.endsWith(".js"));
      } catch {
        /* dist missing */
      }
      for (const f of files) {
        const raw = readFileSync(resolve(out, f));
        const gz = gzipSync(raw);
        totalRaw += raw.length;
        totalGzip += gz.length;
        report.push({ file: f, raw: raw.length, gzip: gz.length });
        lines.push(`  ${f}: ${kb(raw.length)} raw, ${kb(gz.length)} gzip`);
      }
      lines.push(`  TOTAL (*.js): ${kb(totalRaw)} raw, ${kb(totalGzip)} gzip`);
      if (totalGzip > TOTAL_GZIP_BUDGET_BYTES) {
        lines.push(`  WARNING: total JS gzip size exceeds ${(TOTAL_GZIP_BUDGET_BYTES / 1024).toFixed(0)} KB budget`);
        gzipOk = false;
      }
      // Named single-file sizes (UMD/CSS) for reference — not part of the
      // chunk budget above.
      const namedFiles = ["ezynota.umd.cjs", "ezynota.css"];
      const named: { file: string; raw: number; gzip: number }[] = [];
      for (const f of namedFiles) {
        try {
          const raw = readFileSync(resolve(out, f));
          const gz = gzipSync(raw);
          named.push({ file: f, raw: raw.length, gzip: gz.length });
          lines.push(`  ${f}: ${kb(raw.length)} raw, ${kb(gz.length)} gzip (reference)`);
        } catch {
          /* file missing */
        }
      }
      console.log(lines.join("\n"));
      writeFileSync(
        resolve(out, "size-report.json"),
        JSON.stringify({ gzipOk, budgetBytes: TOTAL_GZIP_BUDGET_BYTES, totalRaw, totalGzip, chunks: report, named }, null, 2)
      );
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
    // Always start from a clean dist so hashed shared chunks never
    // accumulate stale copies across builds (the UMD pass later runs with
    // emptyOutDir: false to preserve this output).
    emptyOutDir: true,
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
