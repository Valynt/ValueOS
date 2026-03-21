import { describe, it, expect } from 'vitest';

describe('Security & Multi-Tenancy Remediation', () => {

  it('No RLS bypass vulnerabilities (IS NULL inside USING/WITH CHECK policy clauses)', () => {
    // This test verifies that the specific RLS bypass vulnerability identified in the audit
    // (using `organization_id IS NULL` or `tenant_id IS NULL` inside USING/WITH CHECK policy
    // predicates) has been removed from active migrations.
    //
    // NOTE: IS NULL on tenant_id in partial indexes or seed data is intentional and correct
    // (global catalog rows like billing_price_versions use tenant_id IS NULL to mean "shared").
    // The dangerous pattern is when an RLS USING clause allows NULL to bypass tenant isolation.
    const migrationsPath = path.join(process.cwd(), 'infra/supabase/supabase/migrations');

    if (!fs.existsSync(migrationsPath)) {
      test.skip('Migrations directory not found');
      return;
    }

    try {
      // Only flag IS NULL inside USING(...) or WITH CHECK(...) policy predicates
      const cmd = `grep -rE "USING.*IS NULL|WITH CHECK.*IS NULL" "${migrationsPath}" --include="*.sql" | grep -v "_archived\\|_deferred\\|--" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);

      expect(
        count,
        `Found ${count} instances of RLS bypass vulnerabilities (IS NULL inside USING/WITH CHECK) in active migrations. Expected 0.`
      ).toBe(0);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('Agent sessions table has RLS enabled and policies defined', () => {
    // This test verifies that the agent_sessions table, which was missing RLS in the active
    // migration set, now has ENABLE ROW LEVEL SECURITY and at least one tenant isolation policy.
    const migrationsPath = path.join(process.cwd(), 'infra/supabase/supabase/migrations');

    if (!fs.existsSync(migrationsPath)) {
      test.skip('Migrations directory not found');
      return;
    }

    try {
      // Check for a migration enabling RLS on agent_sessions
      const rlsCmd = `grep -rE "ALTER TABLE.*agent_sessions.*ENABLE ROW LEVEL SECURITY|ALTER TABLE public\\.agent_sessions ENABLE ROW LEVEL SECURITY" "${migrationsPath}" --include="*.sql" | grep -v "_archived\\|_deferred" | wc -l`;
      const rlsCountStr = execSync(rlsCmd, { encoding: 'utf-8' }).trim();
      const rlsCount = parseInt(rlsCountStr, 10);

      expect(rlsCount, 'No active migration found enabling RLS on agent_sessions table.').toBeGreaterThan(0);

      // Check for at least one policy on agent_sessions
      const policyCmd = `grep -rE "CREATE POLICY.*agent_sessions|ON.*agent_sessions" "${migrationsPath}" --include="*.sql" | grep -v "_archived\\|_deferred" | wc -l`;
      const policyCountStr = execSync(policyCmd, { encoding: 'utf-8' }).trim();
      const policyCount = parseInt(policyCountStr, 10);

      expect(policyCount, 'No RLS policy found for agent_sessions table in active migrations.').toBeGreaterThan(0);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('Supabase queries include explicit tenant_id filters (Defense in Depth)', () => {
    // This test verifies adherence to ADR-0006: Every supabase.from(...) call on a tenant table
    // MUST include .eq("organization_id", orgId) or .eq("tenant_id", tenantId).
    const backendPath = path.join(process.cwd(), 'packages/backend/src');

    try {
      // Find all supabase.from() calls
      const fromCmd = `grep -rE "supabase\\.from\\(" "${backendPath}" --include="*.ts" | wc -l`;
      const fromCountStr = execSync(fromCmd, { encoding: 'utf-8' }).trim();
      const fromCount = parseInt(fromCountStr, 10);

      if (fromCount === 0) {
        // No supabase queries found — skip rather than fail with division by zero
        test.skip('No supabase.from() calls found in backend');
        return;
      }

      // Find all supabase.from() calls that are followed by .eq('tenant_id' or 'organization_id')
      // This is a simplified regex; a true AST parser would be more accurate, but this serves
      // as a meaningful proxy for defense-in-depth compliance.
      const eqCmd = `grep -rE "\\.eq\\(['\\"](tenant_id|organization_id)['\\"](,|\\))" "${backendPath}" --include="*.ts" | wc -l`;
      const eqCountStr = execSync(eqCmd, { encoding: 'utf-8' }).trim();
      const eqCount = parseInt(eqCountStr, 10);

      // We expect a high correlation between .from() calls and .eq(tenant_id) calls.
      // Allowing some margin for non-tenant tables (like users, public config, billing catalog).
      const ratio = eqCount / fromCount;
      expect(
        ratio,
        `Only ${Math.round(ratio * 100)}% of Supabase queries include explicit tenant filters. Expected > 60% for defense-in-depth.`
      ).toBeGreaterThan(0.6);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('Agent confidence calibration incorporates historical alignment', () => {
    // This test verifies that the checkConfidenceCalibration method in BaseAgent
    // has been updated to include historical alignment or data quality metrics,
    // rather than just simple averages.
    const agentPath = path.join(
      process.cwd(),
      'packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts'
    );

    if (!fs.existsSync(agentPath)) {
      test.skip('BaseAgent.ts not found');
      return;
    }

    const content = fs.readFileSync(agentPath, 'utf-8');

    // Check for keywords indicating enhanced calibration logic
    const hasEnhancedCalibration =
      content.includes('historicalAlignment') ||
      content.includes('dataQualityScore') ||
      content.includes('ConfidenceMonitor') ||
      content.includes('calibrationHistory') ||
      content.includes('historicalAccuracy') ||
      content.includes('calibratedConfidence');

    expect(
      hasEnhancedCalibration,
      'BaseAgent checkConfidenceCalibration should incorporate historical alignment or data quality metrics.'
    ).toBe(true);
  });
});
