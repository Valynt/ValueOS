/**
 * Database Test Helpers
 * Utilities for database setup, cleanup, and assertions
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach } from "vitest";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Get Supabase client for tests
 */
export function getTestSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for testing");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Clean up billing tables
 */
export async function cleanupBillingTables(
  supabase: SupabaseClient
): Promise<void> {
  // Order matters due to foreign key constraints
  const tables = [
    "usage_alerts",
    "usage_quotas",
    "invoices",
    "usage_aggregates",
    "usage_events",
    "subscription_items",
    "subscriptions",
    "billing_customers",
    "webhook_events",
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      console.warn(`Warning: Failed to cleanup ${table}:`, error);
    }
  }
}

/**
 * Setup test database with automatic cleanup
 */
export function setupTestDatabase() {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    if (supabase) {
      await cleanupBillingTables(supabase);
    }
  });

  return () => supabase;
}

/**
 * Create test user with specific tenant access
 */
export async function createTestUser(
  supabase: SupabaseClient,
  email: string,
  tenantId: string,
  role: string = "user"
): Promise<{ userId: string; tenantId: string }> {
  // Note: In real tests, you'd use supabase.auth.admin.createUser
  // This is a simplified version
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Create user_tenants entry if table exists
  try {
    await supabase.from("user_tenants").insert({
      user_id: userId,
      tenant_id: tenantId,
      role,
      status: "active",
    });
  } catch (error) {
    console.warn("Could not create user_tenants entry:", error);
  }

  return { userId, tenantId };
}

/**
 * Execute SQL as service role (bypassing RLS)
 */
export async function executeAsServiceRole<T = any>(
  supabase: SupabaseClient,
  query: () => Promise<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await query();

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("No data returned from query");
  }

  return data;
}

/**
 * Execute SQL as specific user (testing RLS)
 */
export async function executeAsUser<T = any>(
  supabase: SupabaseClient,
  userId: string,
  query: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  // In real implementation, you'd set the JWT token context
  // For now, this is a placeholder that shows the pattern
  return await query();
}

/**
 * Assert row count in table
 */
export async function assertRowCount(
  supabase: SupabaseClient,
  tableName: string,
  expectedCount: number,
  filter?: Record<string, any>
): Promise<void> {
  let query = supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });

  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count rows in ${tableName}: ${error.message}`);
  }

  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} rows in ${tableName}, but found ${count}${
        filter ? ` with filter ${JSON.stringify(filter)}` : ""
      }`
    );
  }
}

/**
 * Assert record exists with specific fields
 */
export async function assertRecordExists(
  supabase: SupabaseClient,
  tableName: string,
  filter: Record<string, any>,
  expectedFields?: Record<string, any>
): Promise<void> {
  let query = supabase.from(tableName).select("*");

  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query.single();

  if (error) {
    throw new Error(
      `Record not found in ${tableName} with filter ${JSON.stringify(filter)}: ${error.message}`
    );
  }

  if (expectedFields) {
    Object.entries(expectedFields).forEach(([key, value]) => {
      if (data[key] !== value) {
        throw new Error(
          `Field mismatch in ${tableName}: expected ${key}=${value}, got ${key}=${data[key]}`
        );
      }
    });
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Seed database with test data
 */
export async function seedTestData(
  supabase: SupabaseClient,
  data: {
    customers?: any[];
    subscriptions?: any[];
    subscriptionItems?: any[];
    usageEvents?: any[];
    usageQuotas?: any[];
  }
): Promise<void> {
  if (data.customers) {
    await supabase.from("billing_customers").insert(data.customers);
  }

  if (data.subscriptions) {
    await supabase.from("subscriptions").insert(data.subscriptions);
  }

  if (data.subscriptionItems) {
    await supabase.from("subscription_items").insert(data.subscriptionItems);
  }

  if (data.usageQuotas) {
    await supabase.from("usage_quotas").insert(data.usageQuotas);
  }

  if (data.usageEvents) {
    await supabase.from("usage_events").insert(data.usageEvents);
  }
}

/**
 * Get all records from table (for debugging)
 */
export async function debugTable(
  supabase: SupabaseClient,
  tableName: string
): Promise<any[]> {
  const { data, error } = await supabase.from(tableName).select("*");

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return [];
  }

  console.log(`${tableName} (${data?.length || 0} rows):`, data);
  return data || [];
}
