import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const RLSValidationResultSchema = z.object({
  tableName: z.string(),
  hasRLS: z.boolean(),
  hasTenantPolicy: z.boolean(),
  vulnerabilities: z.array(z.string()),
});

type RLSValidationResult = z.infer<typeof RLSValidationResultSchema>;

export class TenantRLSValidator {
  private adminClient;

  constructor(supabaseUrl: string, serviceKey: string) {
    this.adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: { schema: "public" },
    });
  }

  async validateAllTables(): Promise<{
    passed: RLSValidationResult[];
    failed: RLSValidationResult[];
    summary: { total: number; passed: number; failed: number };
  }> {
    const tables = await this.getAllPublicTables();
    const results: RLSValidationResult[] = [];

    for (const table of tables) {
      const result = await this.validateTable(table);
      results.push(result);
    }

    const passed = results.filter((r) => r.hasRLS && r.hasTenantPolicy);
    const failed = results.filter((r) => !r.hasRLS || !r.hasTenantPolicy);

    return {
      passed,
      failed,
      summary: {
        total: results.length,
        passed: passed.length,
        failed: failed.length,
      },
    };
  }

  private async getAllPublicTables(): Promise<string[]> {
    const { data, error } = await this.adminClient.rpc("get_public_tables");

    if (error) {
      // Fallback: query information_schema directly
      const { data: schemaData, error: schemaError } = await this.adminClient
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .eq("table_type", "BASE TABLE");

      if (schemaError) {
        console.error("Error fetching tables:", schemaError);
        return [];
      }

      return (schemaData || []).map(
        (t: { table_name: string }) => t.table_name
      );
    }

    return data || [];
  }

  private async validateTable(tableName: string): Promise<RLSValidationResult> {
    const vulnerabilities: string[] = [];

    // Check if RLS is enabled
    // Note: check_rls_enabled RPC might not exist, using metadata query if it fails
    let hasRLS = false;
    const { data: rlsData, error: rlsError } = await this.adminClient.rpc(
      "check_rls_enabled",
      {
        p_table_name: tableName,
      }
    );

    if (rlsError) {
      const { data: pgData } = await this.adminClient.rpc("exec_sql", {
        sql: `SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = '${tableName}';`,
      });
      hasRLS = pgData?.[0]?.relrowsecurity ?? false;
    } else {
      hasRLS = rlsData?.rls_enabled ?? false;
    }

    if (!hasRLS) {
      vulnerabilities.push(`RLS not enabled on table: ${tableName}`);
    }

    // Check for tenant_id or organization_id column
    const { data: columnData } = await this.adminClient
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    const columns = (columnData || []).map(
      (c: { column_name: string }) => c.column_name
    );
    const hasTenantColumn =
      columns.includes("tenant_id") || columns.includes("organization_id");

    // Check for tenant isolation policy
    const { data: policyData, error: policyError } = await this.adminClient.rpc(
      "get_rls_policies",
      {
        p_table_name: tableName,
      }
    );

    let policies = policyData || [];
    if (policyError) {
      const { data: pgPolicies } = await this.adminClient.rpc("exec_sql", {
        sql: `SELECT policyname as policy_name, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}';`,
      });
      policies = pgPolicies || [];
    }

    const hasTenantPolicy = policies.some(
      (policy: { policy_name: string; qual: string }) =>
        policy.qual?.includes("tenant_id") ||
        policy.qual?.includes("organization_id") ||
        policy.qual?.includes("auth.uid()")
    );

    if (!hasTenantPolicy && hasTenantColumn) {
      vulnerabilities.push(`Missing tenant isolation policy on: ${tableName}`);
    }

    return {
      tableName,
      hasRLS,
      hasTenantPolicy: hasTenantPolicy || !hasTenantColumn, // Tables without tenant columns are exempt from tenant-specific policy checks here
      vulnerabilities,
    };
  }

  async validateNegativeRLS(): Promise<string[]> {
    const issues: string[] = [];
    console.log("🕵️  Running Negative RLS Checks (Tenant Isolation)...");

    // We'll use a transaction to create temp data, test access, and rollback
    const verificationSQL = `
      BEGIN;
        -- Create temp organizations if they don't exist (for safety, though we rollback)
        INSERT INTO organizations (id, name) VALUES 
          ('00000000-0000-0000-0000-00000000000a', 'Tenant A'),
          ('00000000-0000-0000-0000-00000000000b', 'Tenant B')
        ON CONFLICT (id) DO NOTHING;

        -- Create a test case for Tenant A
        INSERT INTO cases (id, organization_id, title) VALUES 
          ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Secret Case A')
        ON CONFLICT (id) DO UPDATE SET title = 'Secret Case A';

        -- IMPERSONATE Tenant B
        -- Note: We use SET LOCAL to persist within this transaction block
        SET LOCAL "request.jwt.claims" = '{"sub": "user_b", "role": "authenticated", "app_metadata": {"organization_id": "00000000-0000-0000-0000-00000000000b"}}';
        SET LOCAL ROLE authenticated;

        -- Attempt to read Tenant A's case
        DO $$
        DECLARE
          count_result int;
        BEGIN
          SELECT count(*) INTO count_result FROM cases WHERE id = '00000000-0000-0000-0000-000000000001';
          IF count_result > 0 THEN
            RAISE EXCEPTION 'LEAK: Tenant B can see Tenant A case';
          END IF;
        END $$;

        -- Reset Role
        RESET ROLE;
      ROLLBACK;
    `;

    const { error } = await this.adminClient.rpc("exec_sql", {
      sql: verificationSQL,
    });

    if (error) {
      // If the SQL raised an exception (LEAK), it comes here
      issues.push(`RLS Verification Failed: ${error.message}`);
    }

    return issues;
  }
}

// CLI execution
async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
    process.exit(1);
  }

  const validator = new TenantRLSValidator(supabaseUrl, serviceKey);

  console.log("🔒 Validating RLS on all tables...\n");

  const results = await validator.validateAllTables();

  console.log("📊 Summary:");
  console.log(`   Total tables: ${results.summary.total}`);
  console.log(`   ✅ Passed: ${results.summary.passed}`);
  console.log(`   ❌ Failed: ${results.summary.failed}`);

  if (results.failed.length > 0) {
    console.log("\n⚠️ Tables requiring attention:");
    results.failed.forEach((f) => {
      console.log(`   - ${f.tableName}: ${f.vulnerabilities.join(", ")}`);
    });
    process.exit(1);
  }

  console.log(
    "\n✅ All tables have proper RLS and tenant isolation configuration!"
  );

  // Run Negative Checks
  const negativeIssues = await validator.validateNegativeRLS();
  if (negativeIssues.length > 0) {
    console.error("\n❌ Negative RLS Verification Failed:");
    negativeIssues.forEach((issue) => console.error(`   - ${issue}`));
    process.exit(1);
  } else {
    console.log(
      "✅ Negative RLS Verification Passed: No cross-tenant leaks detected."
    );
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch(console.error);
}
