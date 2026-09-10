import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@ezynota": resolve(__dirname, "src")
    }
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    globals: false
  }
});
