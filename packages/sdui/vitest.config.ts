import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.stories.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "../shared/src"),
      "@shared/*": path.resolve(import.meta.dirname, "../shared/src/*"),
      "@sdui": path.resolve(import.meta.dirname, "./src"),
      "@sdui/*": path.resolve(import.meta.dirname, "./src/*"),
      "@": path.resolve(import.meta.dirname, "./src"),
      "@testing-library/react": path.resolve(import.meta.dirname, "../../apps/ValyntApp/node_modules/@testing-library/react"),
      "@testing-library/jest-dom": path.resolve(import.meta.dirname, "../../apps/ValyntApp/node_modules/@testing-library/jest-dom"),
      "@testing-library/user-event": path.resolve(import.meta.dirname, "../../apps/ValyntApp/node_modules/@testing-library/user-event"),
    },
  },
});
