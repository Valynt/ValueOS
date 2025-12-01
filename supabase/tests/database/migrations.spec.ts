import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

const loadMigration = (fileName: string) =>
  readFileSync(path.join(migrationsDir, fileName), 'utf8');

describe('Provenance tracking migration', () => {
  const sql = loadMigration('20251118000000_add_provenance_tracking.sql');

  it('creates lifecycle artifact links with indexes', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS lifecycle_artifact_links');
    expect(sql).toContain('idx_lifecycle_links_source');
    expect(sql).toContain('idx_lifecycle_links_target');
    expect(sql).toContain('idx_lifecycle_links_session');
  });

  it('adds provenance audit log and ROI calculation lineage columns', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS provenance_audit_log');
    expect(sql).toMatch(/ALTER TABLE roi_model_calculations\s+\s*ADD COLUMN input_variables/i);
    expect(sql).toMatch(/ADD COLUMN source_references/i);
    expect(sql).toMatch(/ADD COLUMN reasoning_trace/i);
  });
});

describe('Workflow orchestration extension', () => {
  const sql = loadMigration('20251118010000_extend_workflow_orchestrator.sql');

  it('extends executions and logs with new metadata', () => {
    expect(sql).toMatch(/ALTER TABLE workflow_executions\s+\s*ADD COLUMN IF NOT EXISTS workflow_version/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS audit_context/i);
    expect(sql).toMatch(/ALTER TABLE workflow_execution_logs\s+\s*ADD COLUMN IF NOT EXISTS retry_policy/i);
  });

  it('creates workflow audit logging table with policies', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_audit_logs');
    expect(sql).toContain('idx_workflow_audit_execution');
    expect(sql).toContain('idx_workflow_audit_created');
    expect(sql).toContain('Users can view workflow audit logs');
    expect(sql).toContain('Users can insert workflow audit logs');
  });
});

describe('Performance optimization migration', () => {
  const sql = loadMigration('20251118090000_performance_optimizations.sql');

  it('adds lifecycle stage and supporting indexes for value cases', () => {
    expect(sql).toMatch(/ALTER TABLE value_cases\s+\s*ADD COLUMN lifecycle_stage/i);
    expect(sql).toContain('idx_value_cases_lifecycle_stage');
  });

  it('creates performance metrics and traversal helper', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS performance_metrics');
    expect(sql).toContain('idx_performance_metrics_session');
    expect(sql).toContain('idx_performance_metrics_agent');
    expect(sql).toContain('idx_performance_metrics_created');
    expect(sql).toContain('idx_performance_metrics_duration');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION get_value_tree_hierarchy');
  });
});

describe('Extended schema rollback coverage', () => {
  const sql = loadMigration('20251118095000_rollback_extended_schema.sql');

  it('drops tables introduced by the extended schema', () => {
    expect(sql).toMatch(/DROP TABLE IF EXISTS workflow_audit_logs/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS performance_metrics/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS lifecycle_artifact_links/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS provenance_audit_log/i);
  });

  it('removes columns, policies, functions, and indexes', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Users can manage own performance metrics"/i);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS get_value_tree_hierarchy/i);
    expect(sql).toMatch(/ALTER TABLE workflow_executions DROP COLUMN IF EXISTS workflow_version/i);
    expect(sql).toMatch(/ALTER TABLE roi_model_calculations DROP COLUMN IF EXISTS input_variables/i);
    expect(sql).toMatch(/ALTER TABLE value_cases DROP COLUMN IF EXISTS lifecycle_stage/i);
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_lifecycle_links_source/i);
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_performance_metrics_duration/i);
  });
});
