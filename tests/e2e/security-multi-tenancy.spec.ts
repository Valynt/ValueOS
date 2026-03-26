import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isNoMatchExit = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 1;

test.describe('Security & Multi-Tenancy Remediation', () => {
  
  test('No RLS bypass vulnerabilities (organization_id IS NULL)', () => {
    // This test verifies that the specific RLS bypass vulnerability identified in the audit
    // (using `organization_id IS NULL` or `tenant_id IS NULL` in policies) has been removed.
    const migrationsPath = path.join(process.cwd(), 'infra/supabase/supabase/migrations');
    
    if (!fs.existsSync(migrationsPath)) {
      test.skip('Migrations directory not found');
      return;
    }

    try {
      // Search for the vulnerable pattern in active migrations (excluding archived/deferred)
      const cmd = `grep -rE "organization_id[[:space:]]+IS[[:space:]]+NULL|tenant_id[[:space:]]+IS[[:space:]]+NULL" "${migrationsPath}" --include="*.sql" | grep -v "_archived|_deferred" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      expect(count, `Found ${count} instances of RLS bypass vulnerabilities (IS NULL checks) in migrations. Expected 0.`).toBe(0);
    } catch (error: unknown) {
      if (!isNoMatchExit(error)) throw error;
    }
  });

  test('Agent sessions table has RLS enabled and policies defined', () => {
    // This test verifies that the agent_sessions table, which was missing RLS, now has it enabled.
    const migrationsPath = path.join(process.cwd(), 'infra/supabase/supabase/migrations');
    
    if (!fs.existsSync(migrationsPath)) {
      test.skip('Migrations directory not found');
      return;
    }

    try {
      // Check if there's a migration enabling RLS on agent_sessions
      const cmd = `grep -rE "ALTER TABLE.*agent_sessions.*ENABLE ROW LEVEL SECURITY" "${migrationsPath}" --include="*.sql" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      expect(count, 'No migration found enabling RLS on agent_sessions table.').toBeGreaterThan(0);
    } catch (error: unknown) {
      if (!isNoMatchExit(error)) throw error;
    }
  });

  test('Supabase queries include explicit tenant_id filters (Defense in Depth)', () => {
    // This test verifies adherence to ADR-0006: Every supabase.from(...) call on a tenant table
    // MUST include .eq("organization_id", orgId) or .eq("tenant_id", tenantId).
    const backendPath = path.join(process.cwd(), 'packages/backend/src');
    
    try {
      // Find all supabase.from() calls
      const fromCmd = `grep -rE "supabase\\.from\\(" "${backendPath}" --include="*.ts" | wc -l`;
      const fromCountStr = execSync(fromCmd, { encoding: 'utf-8' }).trim();
      const fromCount = parseInt(fromCountStr, 10);
      
      // Find all supabase.from() calls that are followed by .eq('tenant_id' or 'organization_id'
      // This is a simplified regex; a true AST parser would be better, but this serves as a proxy
      const eqCmd = `grep -rE "supabase\\.from\\(.*\\.eq\\(['\\\"](tenant_id|organization_id)['\\\"]" "${backendPath}" --include="*.ts" | wc -l`;
      const eqCountStr = execSync(eqCmd, { encoding: 'utf-8' }).trim();
      const eqCount = parseInt(eqCountStr, 10);
      
      // We expect a high correlation between .from() calls and .eq(tenant_id) calls
      // Allowing some margin for non-tenant tables (like users, public config)
      const ratio = eqCount / fromCount;
      expect(ratio, `Only ${Math.round(ratio * 100)}% of Supabase queries include explicit tenant filters. Expected > 80% for defense-in-depth.`).toBeGreaterThan(0.8);
    } catch (error: unknown) {
      if (!isNoMatchExit(error)) throw error;
    }
  });

  test('Agent confidence calibration incorporates historical alignment', () => {
    // This test verifies that the checkConfidenceCalibration method in BaseAgent
    // has been updated to include historical alignment or data quality metrics,
    // rather than just simple averages.
    const agentPath = path.join(process.cwd(), 'packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts');
    
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
      content.includes('calibrationHistory');
      
    expect(hasEnhancedCalibration, 'BaseAgent checkConfidenceCalibration should incorporate historical alignment or data quality metrics.').toBe(true);
  });
});
