import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["ground-truth/**/*.test.ts", "crm/**/*.test.ts"],
  },
});
