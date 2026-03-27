import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { analyzeServiceRoleBoundaries } from '../check-backend-service-role-boundaries.mjs';

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-role-boundary-'));
  fs.mkdirSync(path.join(root, 'packages/backend/src/routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/backend/src/services/jobs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'packages/backend/src/services/jobs/worker.ts'),
    'export const jobWorker = () => true;\n',
    'utf8'
  );
  return root;
}

test('fails when request route imports createServiceRoleSupabaseClient directly', () => {
  const repoRoot = makeTempRepo();
  fs.writeFileSync(
    path.join(repoRoot, 'packages/backend/src/routes/direct-service-role.ts'),
    "import { createServiceRoleSupabaseClient } from '../lib/supabase.js';\nexport const route = () => createServiceRoleSupabaseClient();\n",
    'utf8'
  );

  const result = analyzeServiceRoleBoundaries({ repoRoot, now: new Date('2026-03-27T00:00:00.000Z') });

  assert.ok(
    result.violations.some((violation) =>
      violation.includes('packages/backend/src/routes/direct-service-role.ts: request-handling module directly uses service-role Supabase access')
    )
  );
});
