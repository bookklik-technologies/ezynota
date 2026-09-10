import { defineConfig } from "vite";
import { resolve } from "node:path";

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
    emptyOutDir: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name && assetInfo.name.endsWith(".css") ? "ezynota.css" : assetInfo.name || "asset")
      }
    }
  }
});
