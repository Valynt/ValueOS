import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { analyzeOrchestrationInfraBoundaries } from '../check-orchestration-infra-boundaries.mjs';

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-boundary-'));
  fs.mkdirSync(path.join(root, 'packages/backend/src/runtime/custom-runtime'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/backend/src/lib/agent-fabric'), { recursive: true });
  return root;
}

test('fails when orchestration runtime imports legacy supabase module outside allowlist', () => {
  const repoRoot = makeTempRepo();

  fs.writeFileSync(
    path.join(repoRoot, 'packages/backend/src/runtime/custom-runtime/unsafe.ts'),
    "import { supabase } from '../../lib/supabase.js';\nexport const unsafe = () => supabase;\n",
    'utf8'
  );

  const result = analyzeOrchestrationInfraBoundaries({ repoRoot, now: new Date('2026-04-05T00:00:00.000Z') });

  assert.ok(
    result.violations.some((violation) =>
      violation.includes('packages/backend/src/runtime/custom-runtime/unsafe.ts: imports legacy supabase module')
    )
  );
});

test('fails when allowlist entry is expired', () => {
  const repoRoot = makeTempRepo();
  fs.mkdirSync(path.join(repoRoot, 'packages/backend/src/runtime/context-store'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'packages/backend/src/runtime/context-store/index.ts'),
    "import { supabase as defaultSupabase } from '../../lib/supabase.js';\nexport const context = defaultSupabase;\n",
    'utf8'
  );

  const result = analyzeOrchestrationInfraBoundaries({ repoRoot, now: new Date('2026-08-01T00:00:00.000Z') });

  assert.ok(
    result.violations.some((violation) =>
      violation.includes('packages/backend/src/runtime/context-store/index.ts: temporary allowlist entry expired on 2026-07-31')
    )
  );
});
