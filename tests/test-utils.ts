/**
 * Test Utilities for Database Testing
 *
 * Provides helper functions for:
 * - Creating test data
 * - Cleaning up after tests
 * - Generating test IDs
 * - Tenant-scoped operations
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate a unique test ID with prefix
 */
export function generateTestId(prefix: string = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a test workflow
 */
export async function createTestWorkflow(
  client: SupabaseClient,
  tenantId: string,
  overrides: Partial<any> = {}
) {
  const workflow = {
    id: generateTestId("workflow"),
    tenant_id: tenantId,
    name: "Test Workflow",
    status: "active",
    type: "opportunity",
    ...overrides,
  };

  const { data, error } = await client
    .from("workflows")
    .insert(workflow)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a test agent session
 */
export async function createTestAgentSession(
  client: SupabaseClient,
  tenantId: string,
  overrides: Partial<any> = {}
) {
  const session = {
    id: generateTestId("session"),
    tenant_id: tenantId,
    agent_id: "OpportunityAgent",
    status: "active",
    ...overrides,
  };

  const { data, error } = await client
    .from("agent_sessions")
    .insert(session)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a test tenant
 */
export async function createTestTenant(
  client: SupabaseClient,
  overrides: Partial<any> = {}
) {
  const tenant = {
    id: generateTestId("tenant"),
    name: "Test Tenant",
    tier: "standard",
    status: "active",
    ...overrides,
  };

  const { data, error } = await client
    .from("tenants")
    .insert(tenant)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete test data by ID prefix
 */
export async function deleteTestData(
  client: SupabaseClient,
  table: string,
  prefix: string = "test-"
): Promise<void> {
  await client.from(table).delete().like("id", `${prefix}%`);
}

/**
 * Cleanup multiple tables
 */
export async function cleanupTestTables(
  client: SupabaseClient,
  tables: string[],
  prefix: string = "test-"
): Promise<void> {
  for (const table of tables) {
    try {
      await deleteTestData(client, table, prefix);
    } catch (err) {
      console.warn(`Could not cleanup ${table}:`, err);
    }
  }
}

/**
 * Wait for a condition to be true (polling)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Count records in a table for a tenant
 */
export async function countRecords(
  client: SupabaseClient,
  table: string,
  tenantId?: string
): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

export default {
  generateTestId,
  createTestWorkflow,
  createTestAgentSession,
  createTestTenant,
  deleteTestData,
  cleanupTestTables,
  waitFor,
  countRecords,
};
