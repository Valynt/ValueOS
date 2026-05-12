import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

const documentedLayer3SchemaAndMigrationFiles = [
  'infra/supabase/sql/ops/rls-tenant-isolation-fixes.sql',
  'infra/supabase/supabase/migrations/20260303000001_harden_tenant_rls_service_role_exceptions.sql',
  'infra/supabase/supabase/migrations/20260326050000_value_tree_atomic_tenant_scope.sql',
  'infra/supabase/supabase/migrations/20260302000000_webhook_tenant_isolation.sql',
  'infra/supabase/supabase/migrations/20260304000000_tenant_provisioning_workflow.sql',
];

test('all documented Layer 3 schema/migration files exist', () => {
  for (const filePath of documentedLayer3SchemaAndMigrationFiles) {
    const absolute = path.join(repoRoot, filePath);
    assert.ok(fs.existsSync(absolute), `Missing documented Layer 3 file: ${filePath}`);
  }
});
