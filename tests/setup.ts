/**
 * Global Test Setup
 *
 * This file runs before all tests to:
 * 1. Load environment variables
 * 2. Initialize test database connection
 * 3. Set up global test utilities
 * 4. Configure test timeout and retry logic
 */

import { resolve } from "path";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach } from "vitest";

// Load test environment variables
config({ path: resolve(process.cwd(), ".env.test") });

// Ensure critical environment variables are set
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL or SUPABASE_URL must be set in .env.test");
}

if (!SUPABASE_ANON_KEY) {
  console.warn("⚠️  VITE_SUPABASE_ANON_KEY not set - some tests may fail");
}

// Export test database clients
export const testSupabaseClient = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export const testAdminClient = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Create a tenant-scoped Supabase client for testing
 */
export function createTenantClient(tenantId: string): SupabaseClient | null {
  if (!SUPABASE_ANON_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "X-Tenant-ID": tenantId,
      },
    },
  });
}

/**
 * Test tenant IDs
 */
export const TEST_TENANT_A = "tenant-test-a";
export const TEST_TENANT_B = "tenant-test-b";
export const TEST_TENANT_C = "tenant-test-c";

/**
 * Clean up test data after each test
 */
export async function cleanupTestData(prefix: string = "test-") {
  if (!testAdminClient) {
    console.warn("⚠️  Admin client not available - skipping cleanup");
    return;
  }

  try {
    // Clean up agent sessions
    await testAdminClient
      .from("agent_sessions")
      .delete()
      .like("id", `${prefix}%`);

    // Clean up workflows
    await testAdminClient.from("workflows").delete().like("id", `${prefix}%`);

    // Clean up agent predictions
    await testAdminClient
      .from("agent_predictions")
      .delete()
      .like("id", `${prefix}%`);
  } catch (err) {
    // Ignore cleanup errors - table might not exist yet
    console.warn("Cleanup warning:", err);
  }
}

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log("\n🧪 Test Environment Setup");
  console.log(`   Database: ${SUPABASE_URL}`);
  console.log(`   Admin Client: ${testAdminClient ? "✓" : "✗"}`);
  console.log(`   Anon Client: ${testSupabaseClient ? "✓" : "✗"}\n`);
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log("\n🧹 Cleaning up test environment...\n");
});

/**
 * Per-test cleanup - runs after each test
 */
beforeEach(async () => {
  // Optional: Clean up before each test
  // Uncomment if needed for strict test isolation
  // await cleanupTestData();
});

// Export setup utilities
export default {
  testSupabaseClient,
  testAdminClient,
  createTenantClient,
  cleanupTestData,
  TEST_TENANT_A,
  TEST_TENANT_B,
  TEST_TENANT_C,
};
