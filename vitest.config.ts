import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./apps/ValyntApp/src/test/setup.ts"],
    include: ["apps/**/*.{test,spec}.{js,ts,jsx,tsx}", "packages/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/ValyntApp/src"),
      "@app": path.resolve(__dirname, "./apps/ValyntApp/src/app"),
      "@pages": path.resolve(__dirname, "./apps/ValyntApp/src/pages"),
      "@layouts": path.resolve(__dirname, "./apps/ValyntApp/src/layouts"),
      "@components": path.resolve(__dirname, "./apps/ValyntApp/src/components"),
      "@features": path.resolve(__dirname, "./apps/ValyntApp/src/features"),
      "@services": path.resolve(__dirname, "./apps/ValyntApp/src/services"),
      "@lib": path.resolve(__dirname, "./apps/ValyntApp/src/lib"),
      "@hooks": path.resolve(__dirname, "./apps/ValyntApp/src/hooks"),
      "@types": path.resolve(__dirname, "./apps/ValyntApp/src/types"),
    },
  },
});
