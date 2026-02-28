/**
 * Test Utilities for Database Testing
 *
 * Provides helper functions for:
 * - Creating test data
 * - Cleaning up after tests
 * - Generating test IDs
 * - Tenant-scoped operations
 * - Clean tenant generation for isolation testing
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

/**
 * Generate a randomized tenant ID for isolation testing
 */
export function generateRandomTenantId(): string {
  return `tenant-${uuidv4()}`;
}

/**
 * Clean Tenant Context Factory
 *
 * Generates isolated tenant contexts with randomized IDs to ensure
 * tests never leak data between tenants.
 */
export class CleanTenantFactory {
  private createdTenants: string[] = [];
  private supabaseClient: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabaseClient = client;
  }

  /**
   * Create a clean tenant with randomized ID
   */
  async createCleanTenant(overrides: Partial<Record<string, unknown>> = {}): Promise<{
    tenantId: string;
    tenant: Record<string, unknown>;
    cleanup: () => Promise<void>;
  }> {
    const tenantId = generateRandomTenantId();

    const tenant = {
      id: tenantId,
      name: `Clean Test Tenant ${tenantId}`,
      tier: "standard",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    // Insert tenant
    const { data, error } = await this.supabaseClient
      .from("tenants")
      .insert(tenant)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create clean tenant: ${error.message}`);
    }

    this.createdTenants.push(tenantId);

    // Return tenant context with cleanup function
    return {
      tenantId,
      tenant: data,
      cleanup: async () => {
        await this.cleanupTenant(tenantId);
      },
    };
  }

  /**
   * Create multiple clean tenants
   */
  async createMultipleCleanTenants(
    count: number,
    overrides: Partial<Record<string, unknown>>[] = []
  ): Promise<
    Array<{
      tenantId: string;
      tenant: Record<string, unknown>;
      cleanup: () => Promise<void>;
    }>
  > {
    const tenants = [];

    for (let i = 0; i < count; i++) {
      const tenantOverrides = overrides[i] || {};
      const tenantContext = await this.createCleanTenant(tenantOverrides);
      tenants.push(tenantContext);
    }

    return tenants;
  }

  /**
   * Cleanup a specific tenant and all its data
   */
  private async cleanupTenant(tenantId: string): Promise<void> {
    // Delete in reverse dependency order to avoid FK constraints
    const tablesToClean = [
      "agent_predictions",
      "agent_sessions",
      "workflows",
      "workflow_states",
      "shared_artifacts",
      "message_bus_events",
      // Add other tenant-scoped tables as needed
    ];

    for (const table of tablesToClean) {
      try {
        await this.supabaseClient.from(table).delete().eq("organization_id", tenantId);
      } catch (error) {
        console.warn(`Could not cleanup ${table} for tenant ${tenantId}:`, error);
      }
    }

    // Finally delete the tenant itself
    try {
      await this.supabaseClient.from("tenants").delete().eq("id", tenantId);
    } catch (error) {
      console.warn(`Could not delete tenant ${tenantId}:`, error);
    }

    // Remove from tracking
    this.createdTenants = this.createdTenants.filter((id) => id !== tenantId);
  }

  /**
   * Cleanup all created tenants
   */
  async cleanupAll(): Promise<void> {
    const tenantsToCleanup = [...this.createdTenants];

    for (const tenantId of tenantsToCleanup) {
      await this.cleanupTenant(tenantId);
    }

    this.createdTenants = [];
  }

  /**
   * Get count of created tenants
   */
  getCreatedTenantCount(): number {
    return this.createdTenants.length;
  }

  /**
   * Verify tenant isolation - ensure no data leakage between tenants
   */
  async verifyIsolation(tenantIds: string[]): Promise<{
    isIsolated: boolean;
    violations: Array<{
      table: string;
      tenantId: string;
      recordCount: number;
    }>;
  }> {
    const violations = [];

    const tablesToCheck = ["workflows", "agent_sessions", "agent_predictions", "shared_artifacts"];

    for (const table of tablesToCheck) {
      for (const tenantId of tenantIds) {
        try {
          const count = await countRecords(this.supabaseClient, table, tenantId);
          if (count > 0) {
            violations.push({
              table,
              tenantId,
              recordCount: count,
            });
          }
        } catch (error) {
          console.warn(`Could not check isolation for ${table}:`, error);
        }
      }
    }

    return {
      isIsolated: violations.length === 0,
      violations,
    };
  }
}

/**
 * Create a clean tenant factory instance
 */
export function createCleanTenantFactory(client: SupabaseClient): CleanTenantFactory {
  return new CleanTenantFactory(client);
}

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

  const { data, error } = await client.from("workflows").insert(workflow).select().single();

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

  const { data, error } = await client.from("agent_sessions").insert(session).select().single();

  if (error) throw error;
  return data;
}

/**
 * Create a test tenant
 */
export async function createTestTenant(client: SupabaseClient, overrides: Partial<any> = {}) {
  const tenantId = generateTestId("tenant");
  const tenant = {
    id: tenantId,
    name: "Test Tenant",
    slug: `test-tenant-${tenantId}`,
    tier: "standard",
    status: "active",
    ...overrides,
  };

  const { data, error } = await client.from("tenants").insert(tenant).select().single();

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
  generateRandomTenantId,
  createTestWorkflow,
  createTestAgentSession,
  createTestTenant,
  deleteTestData,
  cleanupTestTables,
  waitFor,
  countRecords,
  createCleanTenantFactory,
  CleanTenantFactory,
};
