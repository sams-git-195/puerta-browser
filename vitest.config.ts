import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    // Mirrors the "~" aliases in electron.vite.config.ts — check that file
    // and copy any alias the code under test imports.
    alias: {
      "~/shared": resolve(__dirname, "src/shared")
    }
  }
});
