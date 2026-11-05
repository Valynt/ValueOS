import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    // Tests must resolve the shared implementation in a clean checkout,
    // without depending on unbuilt packages/shared/dist artifacts.
    alias: {
      "@valueos/shared/lib/redisClient": resolve(import.meta.dirname, "../shared/src/lib/redisClient.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
  },
});
