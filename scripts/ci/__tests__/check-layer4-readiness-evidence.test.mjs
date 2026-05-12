import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evaluateLayer4Readiness } from '../check-layer4-readiness-evidence.mjs';

function setupFixture({ artifactOverrides = {}, requiredChecks = [{ id: 'architecture-drift-gate', expectedStatus: 'pass' }] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer4-readiness-'));
  fs.mkdirSync(path.join(root, 'docs/security-compliance'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/observability'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/operations/runbooks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts/ci/artifacts'), { recursive: true });

  fs.writeFileSync(path.join(root, 'docs/security-compliance/layer4-governance-drift-readiness.md'), [
    'Run gate: node scripts/ci/check-architecture-doc-drift.mjs',
    'Test target: pnpm test -- packages/backend/src/lib/__tests__/rules.test.ts',
    '[runbook](../operations/runbooks/governance-drift.md)',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'docs/observability/governance-drift-alerts.md'), 'ok');
  fs.writeFileSync(path.join(root, 'docs/operations/runbooks/governance-drift.md'), 'ok');
  fs.writeFileSync(path.join(root, 'docs/security-compliance/drift-gate-evidence.md'), 'ok');

  const manifest = {
    version: 2,
    releaseBlockingGates: [{ id: 'architecture-drift-gate', script: 'scripts/ci/check-architecture-doc-drift.mjs' }],
    layer4ReadinessEvidence: {
      artifactPath: 'scripts/ci/artifacts/layer4-readiness-evidence.json',
      maxArtifactAgeHours: 24,
      requiredChecks,
    },
  };
  fs.writeFileSync(path.join(root, 'scripts/ci/release-gate-manifest.json'), JSON.stringify(manifest));

  const artifact = {
    commit: 'abc123',
    timestamp: '2026-05-12T12:00:00.000Z',
    checks: [{ id: 'architecture-drift-gate', status: 'pass' }],
    ...artifactOverrides,
  };
  fs.writeFileSync(path.join(root, manifest.layer4ReadinessEvidence.artifactPath), JSON.stringify(artifact));

  return root;
}

test('fails when artifact commit does not match HEAD', () => {
  const root = setupFixture();
  const result = evaluateLayer4Readiness({ root, headCommit: 'def456', nowMs: Date.parse('2026-05-12T13:00:00.000Z') });
  assert.equal(result.status, 'FAIL');
  assert.match(result.failures.join('\n'), /commit .* does not match HEAD/i);
});

test('fails when artifact is older than max age threshold', () => {
  const root = setupFixture();
  const result = evaluateLayer4Readiness({ root, headCommit: 'abc123', nowMs: Date.parse('2026-05-14T13:00:00.000Z') });
  assert.equal(result.status, 'FAIL');
  assert.match(result.failures.join('\n'), /stale or invalid timestamp/i);
});

test('fails when any required check is non-pass', () => {
  const root = setupFixture({ artifactOverrides: { checks: [{ id: 'architecture-drift-gate', status: 'fail' }] } });
  const result = evaluateLayer4Readiness({ root, headCommit: 'abc123', nowMs: Date.parse('2026-05-12T13:00:00.000Z') });
  assert.equal(result.status, 'FAIL');
  assert.match(result.failures.join('\n'), /non-pass required checks/i);
});
