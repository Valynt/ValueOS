/**
 * Test Setup and Global Configuration
 * Manages observability stack lifecycle for all tests
 */

import { beforeAll, afterAll } from "vitest";
import { DockerComposeHelper } from "./helpers/docker-compose.helper";

const dockerHelper = new DockerComposeHelper();

// Global setup - runs once before all test files
beforeAll(async () => {
  console.log("🚀 Setting up observability stack for tests...");

  try {
    // Start observability stack
    await dockerHelper.up(true);

    console.log("✅ Observability stack is ready for testing");
  } catch (error) {
    console.error("❌ Failed to start observability stack:", error);
    throw error;
  }
}, 120000); // 2 minute timeout for startup

// Global teardown - runs once after all test files
afterAll(async () => {
  console.log("🧹 Cleaning up observability stack...");

  try {
    // Optionally keep stack running for debugging
    const keepStackRunning = process.env.KEEP_STACK_RUNNING === "true";

    if (!keepStackRunning) {
      await dockerHelper.down(false); // Don't remove volumes by default
      console.log("✅ Observability stack stopped");
    } else {
      console.log(
        "ℹ️  Keeping stack running for debugging (KEEP_STACK_RUNNING=true)"
      );
    }
  } catch (error) {
    console.error("⚠️  Error stopping observability stack:", error);
  }
}, 60000); // 1 minute timeout for teardown

// Export helper for access in individual tests if needed
export { dockerHelper };
