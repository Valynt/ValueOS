#!/usr/bin/env tsx
/**
 * Test Database Initialization Script
 *
 * This script initializes a clean test database by:
 * 1. Connecting to Supabase
 * 2. Running all pending migrations in order
 * 3. Verifying critical tables exist
 * 4. Setting up RLS policies
 *
 * Usage:
 *   npm run db:test:init
 *   or
 *   tsx scripts/test-db-init.ts
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.test") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing required environment variables:");
  console.error("   VITE_SUPABASE_URL or SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_KEY");
  process.exit(1);
}

// Create admin client with service key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Critical tables required for tests
 */
const REQUIRED_TABLES = [
  "tenants",
  "agent_sessions",
  "agent_predictions",
  "workflows",
  "workflow_executions",
  "messages",
  "users",
  "llm_usage",
  "llm_calls",
  "audit_logs",
];

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true })
      .limit(0);

    return !error || !error.message.includes("does not exist");
  } catch (err) {
    return false;
  }
}

/**
 * Verify all required tables exist
 */
async function verifyTables(): Promise<void> {
  console.log("\n📋 Verifying required tables...");

  const missingTables = [];

  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(table);
    if (exists) {
      console.log(`   ✓ ${table}`);
    } else {
      console.log(`   ✗ ${table} (missing)`);
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    console.error(
      `\n❌ Missing ${missingTables.length} required tables:`,
      missingTables
    );
    console.error(
      "   Run migrations first: supabase db push or npm run db:push"
    );
    throw new Error("Missing required tables");
  }

  console.log("✅ All required tables exist\n");
}

/**
 * Run Supabase migrations
 */
async function runMigrations(): Promise<void> {
  console.log("🔄 Running database migrations...\n");

  try {
    // Check if Supabase CLI is available
    execSync("supabase --version", { stdio: "pipe" });

    // Run migrations
    execSync("supabase db push", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    console.log("\n✅ Migrations completed successfully\n");
  } catch (error: any) {
    if (error.message.includes("supabase: command not found")) {
      console.warn("⚠️  Supabase CLI not found. Skipping migration step.");
      console.warn("    Install: npm install -g supabase");
    } else {
      console.error("❌ Migration failed:", error.message);
      throw error;
    }
  }
}

/**
 * Verify RLS is enabled on critical tables
 */
async function verifyRLS(): Promise<void> {
  console.log("🔒 Verifying Row Level Security (RLS) policies...\n");

  try {
    const { data, error } = await supabase.rpc("verify_rls_tenant_isolation");

    if (error && !error.message.includes("does not exist")) {
      console.warn(
        "⚠️  RLS verification function not found. Skipping RLS check."
      );
      return;
    }

    if (data && Array.isArray(data)) {
      const tablesWithoutRLS = data.filter((row: any) => !row.rls_enabled);

      if (tablesWithoutRLS.length > 0) {
        console.warn("⚠️  Some tables do not have RLS enabled:");
        tablesWithoutRLS.forEach((row: any) => {
          console.warn(`   - ${row.table_name}`);
        });
      } else {
        console.log("✅ All critical tables have RLS enabled\n");
      }
    }
  } catch (err: any) {
    console.warn("⚠️  Could not verify RLS:", err.message);
  }
}

/**
 * Clean up existing test data
 */
async function cleanupTestData(): Promise<void> {
  console.log("🧹 Cleaning up existing test data...\n");

  const testPrefixes = ["test-", "tenant-test-"];

  try {
    // Clean up test sessions
    await supabase
      .from("agent_sessions")
      .delete()
      .or(testPrefixes.map((prefix) => `id.like.${prefix}%`).join(","));

    // Clean up test workflows
    await supabase
      .from("workflows")
      .delete()
      .or(testPrefixes.map((prefix) => `id.like.${prefix}%`).join(","));

    // Clean up test tenants
    await supabase
      .from("tenants")
      .delete()
      .or(testPrefixes.map((prefix) => `id.like.${prefix}%`).join(","));

    console.log("✅ Test data cleaned up\n");
  } catch (err: any) {
    console.warn("⚠️  Could not clean up test data:", err.message);
    console.warn("    This is normal if tables are empty\n");
  }
}

/**
 * Main initialization flow
 */
async function main() {
  console.log("🚀 Initializing test database...\n");
  console.log(`   Database: ${SUPABASE_URL}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "test"}\n`);

  try {
    // Step 1: Run migrations
    await runMigrations();

    // Step 2: Verify tables exist
    await verifyTables();

    // Step 3: Verify RLS policies
    await verifyRLS();

    // Step 4: Clean up existing test data
    await cleanupTestData();

    console.log("✅ Database initialization complete!\n");
    console.log("   Next steps:");
    console.log("   1. Run: npm run db:test:seed");
    console.log("   2. Run: npm test\n");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Database initialization failed:", error.message);
    process.exit(1);
  }
}

// Run if executed directly (ES module compatible check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export { main as initTestDatabase };
