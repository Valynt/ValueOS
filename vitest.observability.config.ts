import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Global setup/teardown
    globalSetup: "./tests/observability/setup.ts",

    // Test file patterns
    include: ["tests/observability/**/*.test.ts"],

    // Timeouts (increased for container startup)
    testTimeout: 30000,
    hookTimeout: 60000,

    // Reporter configuration
    reporters: ["verbose"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/observability/**/*.ts"],
      exclude: ["src/observability/example-app.ts", "tests/**/*"],
    },

    // Retry failed tests (useful for timing-sensitive tests)
    retry: 1,

    // Run tests sequentially (important for Docker resource management)
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Environment variables for tests
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    },
  },
});
