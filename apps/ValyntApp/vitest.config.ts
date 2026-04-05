import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/fetch-polyfill.ts", "./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/*.pure-unit.test.*",
      "src/__tests__/audit/**",
      // src/sdui is a symlink to packages/sdui/src. Those tests are already
      // covered by the root-level "sdui" project. Running them here too causes
      // both projects to compete for the same module-level state and deadlock.
      "src/sdui/**",
    ],

    env: {
      NODE_ENV: "test",
      TEST_MODE: "true",
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "**/*.pure-unit.test.*"],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 75,
        statements: 75,
        // SEC-002: sanitizeHtml is the DOMPurify allowlist backing SafeHtml.tsx.
        // Higher branch coverage is required here to ensure the sanitizer contract
        // is fully tested (script stripping, event handler removal, URI allowlist, etc.).
        "src/utils/sanitizeHtml.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      // Workspace package aliases — must match vite.config.ts
      "@shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@valueos/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@valueos/sdui": path.resolve(__dirname, "../../packages/sdui/src"),
      "@valueos/components": path.resolve(__dirname, "../../packages/components"),
      // sdui symlink uses this alias for its own CanvasLayout component
      "@sdui/components": path.resolve(__dirname, "../../packages/sdui/src/components"),
      // sdui package tests run under ValyntApp's vitest but the sdui package
      // doesn't declare @testing-library/* as its own deps —
      // resolve them from ValyntApp's node_modules so the symlinked tests work.
      "@testing-library/react": path.resolve(__dirname, "node_modules/@testing-library/react"),
      "@testing-library/jest-dom": path.resolve(__dirname, "node_modules/@testing-library/jest-dom"),
      "@testing-library/user-event": path.resolve(__dirname, "node_modules/@testing-library/user-event"),
    },
  },
});
