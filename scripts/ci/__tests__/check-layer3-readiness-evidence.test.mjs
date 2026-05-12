import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildLayer3ReadinessReport,
  evaluateLayer3Readiness,
} from '../check-layer3-readiness-evidence.mjs';

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'layer3-readiness-'));
}

function writeArtifact(baseDir, relativePath, ageHours = 0) {
  const artifactPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, 'ok', 'utf8');
  const now = Date.now();
  const mtime = new Date(now - ageHours * 60 * 60 * 1000);
  fs.utimesSync(artifactPath, mtime, mtime);
}

const manifest = {
  maxArtifactAgeHours: 24,
  checkOwnership: {
    'workflow-state-tests': {
      paths: ['packages/backend/src/runtime'],
      interfaces: ['workflow-state-contract'],
    },
    'route-compatibility-check': {
      paths: ['packages/backend/src/routes'],
      interfaces: ['http-route-contract'],
    },
  },
  checks: [
    {
      id: 'workflow-state-tests',
      name: 'Workflow-state tests',
      artifacts: ['artifacts/layer3/workflow-state-tests.json'],
    },
    {
      id: 'route-compatibility-check',
      name: 'Route compatibility check',
      artifacts: ['artifacts/layer3/route-compatibility-check.json'],
    },
  ],
};

test('passes when required artifact exists and is fresh', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 1);
  writeArtifact(baseDir, 'artifacts/layer3/route-compatibility-check.json', 1);

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, true);
  assert.equal(result.failedChecks.length, 0);
  assert.equal(result.passedChecks.length, 2);
  assert.match(buildLayer3ReadinessReport(result), /Production-ready verdict: PASS/);
});

test('fails closed when artifact is missing', () => {
  const baseDir = mkTmpDir();

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 2);
  assert.match(result.failedChecks[0].failures[0], /missing artifact/);
});

test('fails closed when artifact is stale', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 48);
  writeArtifact(baseDir, 'artifacts/layer3/route-compatibility-check.json', 1);

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /stale artifact/);
});

test('no-op release reports no impacted controls and all unchanged', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 1);
  writeArtifact(baseDir, 'artifacts/layer3/route-compatibility-check.json', 1);

  const result = evaluateLayer3Readiness({
    manifest,
    baseDir,
    now: Date.now(),
    releaseDiff: { changedFiles: [], changedChecks: [], changedInterfaces: [] },
  });

  assert.deepEqual(result.changedControls, []);
  assert.deepEqual(result.unchangedControls, ['route-compatibility-check', 'workflow-state-tests']);
  assert.deepEqual(result.missingEvidenceImpactedControls, []);
});

test('interface-changing release marks impacted controls and missing evidence', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 1);

  const result = evaluateLayer3Readiness({
    manifest,
    baseDir,
    now: Date.now(),
    releaseDiff: {
      changedFiles: ['packages/backend/src/routes/opportunities.ts'],
      changedChecks: [],
      changedInterfaces: ['workflow-state-contract'],
    },
  });

  assert.deepEqual(result.changedControls, ['route-compatibility-check', 'workflow-state-tests']);
  assert.deepEqual(result.unchangedControls, []);
  assert.deepEqual(result.missingEvidenceImpactedControls, ['route-compatibility-check']);
});
