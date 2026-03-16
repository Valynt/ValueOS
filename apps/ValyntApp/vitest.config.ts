import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/*.pure-unit.test.*"],
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
      // doesn't declare @testing-library/* or p-queue/uuid as its own deps —
      // resolve them from ValyntApp's node_modules so the symlinked tests work.
      "@testing-library/react": path.resolve(__dirname, "node_modules/@testing-library/react"),
      "@testing-library/jest-dom": path.resolve(__dirname, "node_modules/@testing-library/jest-dom"),
      "@testing-library/user-event": path.resolve(__dirname, "node_modules/@testing-library/user-event"),
      "p-queue": path.resolve(__dirname, "../../node_modules/.pnpm/p-queue@9.1.0/node_modules/p-queue"),
      "uuid": path.resolve(__dirname, "../../node_modules/.pnpm/uuid@8.3.2/node_modules/uuid"),
      // react-dnd is not installed; stub it so components that import it can be tested
      "react-dnd": path.resolve(__dirname, "./src/test/stubs/react-dnd.ts"),
      // node-vault is not installed; stub dynamic import to prevent transform-time failure
      "node-vault": path.resolve(__dirname, "./src/test/stubs/node-vault.ts"),
      // Packages in the pnpm store but not declared in ValyntApp's deps
      "@aws-sdk/client-secrets-manager": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/@aws-sdk+client-secrets-manager@3.1004.0/node_modules/@aws-sdk/client-secrets-manager"
      ),
      "jest-axe": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/jest-axe@10.0.0/node_modules/jest-axe"
      ),
      "jspdf": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/jspdf@4.2.0/node_modules/jspdf"
      ),
      "html2canvas": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/html2canvas@1.4.1/node_modules/html2canvas"
      ),
    },
  },
});
