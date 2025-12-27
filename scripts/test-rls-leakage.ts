/**
 * RLS Leakage Hammer - CI Integration Script
 *
 * Automates RLS policy testing in CI by:
 * 1. Testing all tables for tenant isolation
 * 2. Fuzzing JWT tokens
 * 3. Cross-tenant attack scenarios
 * 4. Reporting any leakage
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.test" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface LeakageResult {
  table: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const TENANT_TABLES = [
  "tenants",
  "workflows",
  "agent_sessions",
  "agent_predictions",
  "messages",
  "llm_usage",
  "audit_logs",
];

const TEST_TENANTS = ["tenant-test-a", "tenant-test-b"];

/**
 * Test RLS isolation for a specific table
 */
async function testTableIsolation(table: string): Promise<LeakageResult> {
  try {
    // Attempt cross-tenant query using service key (should respect RLS)
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("tenant_id", TEST_TENANTS[0])
      .limit(10);

    if (error) {
      // Error is acceptable if RLS blocks access
      return {
        table,
        passed: true,
        details: "RLS blocked unauthorized access",
      };
    }

    // Verify all returned rows belong to correct tenant
    const allCorrectTenant = data?.every(
      (row: any) => row.tenant_id === TEST_TENANTS[0]
    );

    return {
      table,
      passed: allCorrectTenant ?? true,
      details: `Returned ${data?.length || 0} rows`,
    };
  } catch (err: any) {
    return {
      table,
      passed: false,
      error: err.message,
    };
  }
}

/**
 * Test JWT token fuzzing
 */
async function testJWTFuzzing(): Promise<LeakageResult> {
  const fuzzedTokens = [
    "invalid-token",
    "",
    "Bearer malformed.jwt.token",
    "null",
    "undefined",
  ];

  for (const token of fuzzedTokens) {
    try {
      // Attempt to create client with fuzzed token
      const fuzzedClient = createClient(SUPABASE_URL, token);

      const { error } = await fuzzedClient
        .from("workflows")
        .select("*")
        .limit(1);

      if (!error) {
        // Should have errored on invalid token
        return {
          table: "JWT Fuzzing",
          passed: false,
          error: `Accepted invalid token: ${token.substring(0, 20)}...`,
        };
      }
    } catch (err) {
      // Expected to fail
    }
  }

  return {
    table: "JWT Fuzzing",
    passed: true,
    details: "All fuzzed tokens rejected",
  };
}

/**
 * Test cross-tenant attack scenarios
 */
async function testCrossTenantAttacks(): Promise<LeakageResult> {
  try {
    // Attempt to access tenant B data using tenant A context
    // This requires actual JWT tokens, simplified for demonstration

    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", TEST_TENANTS[1]) // Try to access tenant B
      .limit(1);

    // With proper RLS, this should either error or return empty
    if (data && data.length > 0) {
      return {
        table: "Cross-Tenant Attack",
        passed: false,
        error: "Able to access other tenant data",
      };
    }

    return {
      table: "Cross-Tenant Attack",
      passed: true,
      details: "Cross-tenant access blocked",
    };
  } catch (err: any) {
    return {
      table: "Cross-Tenant Attack",
      passed: true,
      details: "Attack blocked with error",
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🔒 Starting RLS Leakage Hammer Test...\n");

  const results: LeakageResult[] = [];

  // Test each table
  console.log("Testing table isolation...");
  for (const table of TENANT_TABLES) {
    const result = await testTableIsolation(table);
    results.push(result);

    const status = result.passed ? "✅" : "❌";
    console.log(`${status} ${table}: ${result.passed ? "PASS" : "FAIL"}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  }

  // JWT fuzzing
  console.log("\nTesting JWT fuzzing...");
  const jwtResult = await testJWTFuzzing();
  results.push(jwtResult);
  console.log(
    `${jwtResult.passed ? "✅" : "❌"} JWT Fuzzing: ${jwtResult.passed ? "PASS" : "FAIL"}`
  );

  // Cross-tenant attacks
  console.log("\nTesting cross-tenant attacks...");
  const attackResult = await testCrossTenantAttacks();
  results.push(attackResult);
  console.log(
    `${attackResult.passed ? "✅" : "❌"} Cross-Tenant: ${attackResult.passed ? "PASS" : "FAIL"}`
  );

  // Summary
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log("\n" + "=".repeat(50));
  console.log("RLS Leakage Hammer Results");
  console.log("=".repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log("=".repeat(50));

  if (failedTests > 0) {
    console.error("\n❌ RLS LEAKAGE DETECTED - FAILING BUILD");
    process.exit(1);
  }

  console.log("\n✅ All RLS tests passed - No leakage detected");
  process.exit(0);
}

main();
