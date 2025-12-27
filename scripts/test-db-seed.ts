#!/usr/bin/env tsx
/**
 * Test Database Seeding Script
 *
 * Seeds the test database with:
 * - 3 synthetic tenants (tenant-test-a, tenant-test-b, tenant-test-c)
 * - 50 workflows per tenant
 * - 10 users per tenant (1 admin, 9 regular users)
 * - 100 agent sessions per tenant
 *
 * Usage:
 *   npm run db:test:seed
 *   or
 *   tsx scripts/test-db-seed.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.test") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Test tenant configuration
 */
const TEST_TENANTS = [
  {
    id: "tenant-test-a",
    name: "Test Tenant A",
    tier: "standard",
    status: "active",
  },
  {
    id: "tenant-test-b",
    name: "Test Tenant B",
    tier: "enterprise",
    status: "active",
  },
  {
    id: "tenant-test-c",
    name: "Test Tenant C",
    tier: "standard",
    status: "active",
  },
];

/**
 * Generate workflow data for a tenant
 */
function generateWorkflows(tenantId: string, count: number) {
  const workflows = [];
  const statuses = ["pending", "active", "completed", "failed"];
  const types = ["opportunity", "target", "realization", "expansion"];

  for (let i = 0; i < count; i++) {
    workflows.push({
      id: `test-workflow-${tenantId}-${i}`,
      tenant_id: tenantId,
      name: `Test Workflow ${i + 1}`,
      status: statuses[i % statuses.length],
      type: types[i % types.length],
      created_at: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  return workflows;
}

/**
 * Generate user data for a tenant
 */
function generateUsers(tenantId: string, count: number) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const isAdmin = i === 0;
    users.push({
      id: `test-user-${tenantId}-${i}`,
      tenant_id: tenantId,
      email: `user${i}@${tenantId}.com`,
      role: isAdmin ? "admin" : "user",
      full_name: `Test User ${i + 1}`,
      created_at: new Date().toISOString(),
    });
  }

  return users;
}

/**
 * Generate agent session data for a tenant
 */
function generateAgentSessions(tenantId: string, count: number) {
  const sessions = [];
  const agents = [
    "OpportunityAgent",
    "TargetAgent",
    "RealizationAgent",
    "ExpansionAgent",
    "IntegrityAgent",
  ];
  const statuses = ["active", "completed", "failed"];

  for (let i = 0; i < count; i++) {
    sessions.push({
      id: `test-session-${tenantId}-${i}`,
      tenant_id: tenantId,
      agent_id: agents[i % agents.length],
      status: statuses[i % statuses.length],
      created_at: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  return sessions;
}

/**
 * Seed tenants
 */
async function seedTenants() {
  console.log("👥 Seeding tenants...");

  const { data, error } = await supabase
    .from("tenants")
    .upsert(TEST_TENANTS, { onConflict: "id" })
    .select();

  if (error) {
    throw new Error(`Failed to seed tenants: ${error.message}`);
  }

  console.log(`   ✓ Created ${data?.length || 0} tenants\n`);
}

/**
 * Seed workflows for all tenants
 */
async function seedWorkflows() {
  console.log("📋 Seeding workflows (50 per tenant)...");

  for (const tenant of TEST_TENANTS) {
    const workflows = generateWorkflows(tenant.id, 50);

    const { error } = await supabase
      .from("workflows")
      .upsert(workflows, { onConflict: "id" });

    if (error) {
      throw new Error(
        `Failed to seed workflows for ${tenant.id}: ${error.message}`
      );
    }

    console.log(`   ✓ ${tenant.id}: 50 workflows`);
  }

  console.log("");
}

/**
 * Seed users for all tenants
 */
async function seedUsers() {
  console.log("👤 Seeding users (10 per tenant)...");

  for (const tenant of TEST_TENANTS) {
    const users = generateUsers(tenant.id, 10);

    const { error } = await supabase
      .from("users")
      .upsert(users, { onConflict: "id" });

    if (error) {
      // If users table doesn't exist or has different schema, skip
      console.warn(
        `   ⚠️  ${tenant.id}: Could not seed users (${error.message})`
      );
      continue;
    }

    console.log(`   ✓ ${tenant.id}: 10 users (1 admin, 9 users)`);
  }

  console.log("");
}

/**
 * Seed agent sessions for all tenants
 */
async function seedAgentSessions() {
  console.log("🤖 Seeding agent sessions (100 per tenant)...");

  for (const tenant of TEST_TENANTS) {
    const sessions = generateAgentSessions(tenant.id, 100);

    const { error } = await supabase
      .from("agent_sessions")
      .upsert(sessions, { onConflict: "id" });

    if (error) {
      throw new Error(
        `Failed to seed sessions for ${tenant.id}: ${error.message}`
      );
    }

    console.log(`   ✓ ${tenant.id}: 100 agent sessions`);
  }

  console.log("");
}

/**
 * Verify seeded data
 */
async function verifyData() {
  console.log("✅ Verifying seeded data...\n");

  // Count workflows per tenant
  for (const tenant of TEST_TENANTS) {
    const { count } = await supabase
      .from("workflows")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    console.log(`   ${tenant.id}: ${count} workflows`);
  }

  console.log("");
}

/**
 * Main seeding flow
 */
async function main() {
  console.log("🌱 Seeding test database...\n");
  console.log(`   Database: ${SUPABASE_URL}`);
  console.log(`   Tenants: ${TEST_TENANTS.length}\n`);

  try {
    await seedTenants();
    await seedWorkflows();
    await seedUsers();
    await seedAgentSessions();
    await verifyData();

    console.log("✅ Database seeding complete!\n");
    console.log("   Test data summary:");
    console.log(`   - ${TEST_TENANTS.length} tenants`);
    console.log(`   - ${TEST_TENANTS.length * 50} workflows`);
    console.log(`   - ${TEST_TENANTS.length * 10} users`);
    console.log(`   - ${TEST_TENANTS.length * 100} agent sessions\n`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Seeding failed:", error.message);
    process.exit(1);
  }
}

// Run if executed directly (ES module compatible check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export { main as seedTestDatabase };
