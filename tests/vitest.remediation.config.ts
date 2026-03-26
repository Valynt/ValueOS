import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/e2e/architecture-quality.spec.ts",
      "tests/e2e/ui-ux-design-system.spec.ts",
      "tests/e2e/security-multi-tenancy.spec.ts",
      "tests/e2e/performance-scalability.spec.ts",
      "tests/e2e/testing-ci-cd.spec.ts",
    ],
    fileParallelism: false,
    passWithNoTests: false,
  },
});
