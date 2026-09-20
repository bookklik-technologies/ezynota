import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["src/core/event-bus.ts"],
    rules: {
      // console.error is the deliberate last-resort error report for broken listeners.
      "no-console": ["error", { allow: ["error"] }]
    }
  },
  {
    files: ["src/init/declarative.ts"],
    rules: {
      // console.error is the deliberate report for failed declarative mounts —
      // a throwing element must never abort the batch scan or the observer.
      "no-console": ["error", { allow: ["error"] }]
    }
  }
);
