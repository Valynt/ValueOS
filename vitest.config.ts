import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

/**
 * Vitest workspace — each project runs with its own environment and aliases.
 *
 * - packages/memory: node, no aliases (relative imports only)
 * - packages/backend: node, @shared/@backend/@mcp aliases (delegates to package config)
 * - apps/ValyntApp: jsdom, react plugin, @/* aliases (delegates to package config)
 */
export default defineConfig({
  test: {
    projects: [
      // packages/memory — no per-package vitest config; inline it here
      {
        test: {
          name: "memory",
          globals: true,
          environment: "node",
          fileParallelism: false,
          include: ["packages/memory/tests/**/*.{test,spec}.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
        resolve: {
          alias: {
            "@shared": path.resolve(root, "packages/shared/src"),
          },
        },
      },
      // packages/backend — delegates to its own vitest.config.ts
      "packages/backend",
      // apps/ValyntApp — delegates to its own vitest.config.ts (jsdom + react + @/* aliases)
      "apps/ValyntApp",
    ],
  },
});
