import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/shared/*.test.ts",
      "tests/matrix/*.test.ts",
      "tests/chaos/*.test.ts",
      "scripts/*.test.ts",
    ],
  },
});
