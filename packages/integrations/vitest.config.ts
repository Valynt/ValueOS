import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    // Allow .js imports to resolve to .ts source files (ESM interop in tests)
    extensionOrder: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  },
});
