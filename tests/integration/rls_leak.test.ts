import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";

describe("RLS Leak Testing - Unauthorized Table Access", () => {
  let dbClient: Client;
  const tenantAId = uuidv4();
  const tenantBId = uuidv4();
  const userAId = uuidv4();
  const userBId = uuidv4();
  const testIds: Record<string, string> = {};

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();

    // Create test tenants
    await dbClient.query(
      `INSERT INTO tenants (id, name, domain, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [tenantAId, "Test Tenant A", "tenant-a.test", "{}"]
    );
    await dbClient.query(
      `INSERT INTO tenants (id, name, domain, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [tenantBId, "Test Tenant B", "tenant-b.test", "{}"]
    );

    // Create test users
    await dbClient.query(
      `INSERT INTO users (id, tenant_id, email, full_name, role, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [userAId, tenantAId, "user-a@test.com", "User A", "user", "{}"]
    );
    await dbClient.query(
      `INSERT INTO users (id, tenant_id, email, full_name, role, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [userBId, tenantBId, "user-b@test.com", "User B", "user", "{}"]
    );

    // Generate test IDs for each table
    const tables = [
      "value_cases",
      "opportunities",
      "value_drivers",
      "financial_models",
      "realization_metrics",
      "agent_executions",
      "agent_memory"
    ];
    tables.forEach(table => {
      testIds[table] = uuidv4();
    });

    // Insert test records for tenant A
    // value_cases
    await dbClient.query(
      `INSERT INTO value_cases (id, tenant_id, created_by, name, company_name, description, lifecycle_stage, status, tags, custom_fields, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.value_cases, tenantAId, userAId, "Test Case", "Test Company", "Test description", "discovery", "active", [], "{}"]
    );

    // opportunities
    await dbClient.query(
      `INSERT INTO opportunities (id, value_case_id, tenant_id, type, title, description, priority, impact_score, urgency_score, data_sources, confidence_score, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.opportunities, testIds.value_cases, tenantAId, "pain_point", "Test Opportunity", "Test desc", "medium", 0.8, 0.7, ["source1"], 0.9]
    );

    // value_drivers
    await dbClient.query(
      `INSERT INTO value_drivers (id, value_case_id, tenant_id, name, description, category, baseline_value, target_value, unit, calculation_method, assumptions, confidence_level, data_quality, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.value_drivers, testIds.value_cases, tenantAId, "Test Driver", "Test desc", "revenue", 100000, 150000, "$", "simple", "{}", "medium", "medium"]
    );

    // financial_models
    await dbClient.query(
      `INSERT INTO financial_models (id, value_case_id, tenant_id, model_type, time_horizon_years, initial_investment, recurring_costs, revenue_projections, discount_rate, roi, npv, irr, payback_period_months, best_case, base_case, worst_case, sensitivity_analysis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.financial_models, testIds.value_cases, tenantAId, "roi", 3, 50000, "{}", "{}", 0.1, 150, 75000, 0.25, 18, "{}", "{}", "{}", "{}"]
    );

    // realization_metrics
    await dbClient.query(
      `INSERT INTO realization_metrics (id, value_case_id, tenant_id, metric_name, metric_type, predicted_value, predicted_date, actual_value, actual_date, variance, variance_pct, status, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.realization_metrics, testIds.value_cases, tenantAId, "revenue", "revenue", 120000, "2026-06-01", 115000, "2026-06-15", -5000, -4.17, "on_track", "Slight delay", NOW(), NOW()]
    );

    // agent_executions
    await dbClient.query(
      `INSERT INTO agent_executions (id, tenant_id, user_id, value_case_id, agent_name, agent_version, input, output, confidence_score, execution_time_ms, llm_calls, cost, status, error_message, trace_id, span_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.agent_executions, tenantAId, userAId, testIds.value_cases, "TestAgent", "1.0", "{}", "{}", 0.85, 1500, 2, 0.02, "success", null, "trace-123", "span-456"]
    );

    // agent_memory
    await dbClient.query(
      `INSERT INTO agent_memory (id, tenant_id, agent_name, memory_type, content, context_keys, relevance_score, access_count, last_accessed_at, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [testIds.agent_memory, tenantAId, "TestAgent", "episodic", "{}", ["key1"], 0.9, 1, null, null]
    );

  }, 120_000);

  afterAll(async () => {
    try {
      // Clean up test records
      const tables = ["agent_memory", "agent_executions", "realization_metrics", "financial_models", "value_drivers", "opportunities", "value_cases", "users", "tenants"];
      for (const table of tables) {
        if (table === "tenants") {
          await dbClient.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [tenantAId, tenantBId]);
        } else if (table === "users") {
          await dbClient.query(`DELETE FROM users WHERE id IN ($1, $2);`, [userAId, userBId]);
        } else {
          const id = testIds[table];
          if (id) {
            await dbClient.query(`DELETE FROM ${table} WHERE id = $1;`, [id]);
          }
        }
      }
    } finally {
      await dbClient.end();
    }
  });

  const tablesWithRLS = [
    "value_cases",
    "opportunities",
    "value_drivers",
    "financial_models",
    "realization_metrics",
    "agent_executions",
    "agent_memory"
  ];

  tablesWithRLS.forEach(table => {
    it(`should deny unauthorized access to ${table} from different tenant`, async () => {
      // Set context to tenant A - should see the record
      await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
        BEGIN
          RETURN jsonb_build_object('role', 'authenticated', 'tenant_id', '${tenantAId}');
        END; $$ LANGUAGE plpgsql;`);

      const { rows: authorizedRows } = await dbClient.query(
        `SELECT id FROM ${table} WHERE id = $1;`,
        [testIds[table]]
      );
      expect(authorizedRows.length).toBe(1);

      // Set context to tenant B - should not see the record
      await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
        BEGIN
          RETURN jsonb_build_object('role', 'authenticated', 'tenant_id', '${tenantBId}');
        END; $$ LANGUAGE plpgsql;`);

      const { rows: unauthorizedRows } = await dbClient.query(
        `SELECT id FROM ${table} WHERE id = $1;`,
        [testIds[table]]
      );
      expect(unauthorizedRows.length).toBe(0);
    }, 60_000);
  });

  it("should allow access to benchmarks regardless of tenant (public data)", async () => {
    // Benchmarks table has no RLS, so should be accessible from any tenant
    const benchmarkId = uuidv4();
    await dbClient.query(
      `INSERT INTO benchmarks (id, kpi_name, industry, company_size, p25, median, p75, best_in_class, unit, source, vintage, sample_size, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [benchmarkId, "Revenue Growth", "Tech", "medium", 0.05, 0.1, 0.15, 0.25, "%", "Industry Report", "2024", 100]
    );

    // Set context to tenant B
    await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN jsonb_build_object('role', 'authenticated', 'tenant_id', '${tenantBId}');
      END; $$ LANGUAGE plpgsql;`);

    const { rows } = await dbClient.query(
      `SELECT id FROM benchmarks WHERE id = $1;`,
      [benchmarkId]
    );
    expect(rows.length).toBe(1);

    // Clean up benchmark
    await dbClient.query(`DELETE FROM benchmarks WHERE id = $1;`, [benchmarkId]);
  }, 60_000);
});
