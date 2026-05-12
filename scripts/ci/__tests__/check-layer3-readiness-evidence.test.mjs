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

function writeArtifact(baseDir, relativePath, payload, ageHours = 0) {
  const artifactPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, payload, 'utf8');
  const now = Date.now();
  const mtime = new Date(now - ageHours * 60 * 60 * 1000);
  fs.utimesSync(artifactPath, mtime, mtime);
}

function buildManifest(overrides = {}) {
  return {
    maxArtifactAgeHours: 24,
    controlOwnership: {
      'workflow-state-tests': {
        paths: ['packages/backend/src/runtime/'],
        interfaces: ['workflow-state-contract-v1'],
      },
      'schema-contract-check': {
        paths: ['packages/shared/src/domain/'],
        interfaces: ['schema-contract-v1'],
      },
    },
    checks: [
      {
        id: 'workflow-state-tests',
        name: 'Workflow-state tests',
        validator: 'json-path-equals',
        formatVersion: 1,
        successPath: 'success',
        expectedValue: true,
        requiredPaths: ['success', 'summary.passed'],
        artifacts: ['artifacts/layer3/workflow-state-tests.json'],
      },
      {
        id: 'schema-contract-check',
        name: 'Schema contract check',
        validator: 'json-path-equals',
        formatVersion: 1,
        successPath: 'success',
        expectedValue: true,
        requiredPaths: ['success', 'contractsValidated'],
        artifacts: ['artifacts/layer3/schema-contract-check.json'],
      },
    ],
    ...overrides,
  };
}

test('fails fresh artifact with failing payload', () => {
  const baseDir = mkTmpDir();
  writeArtifact(
    baseDir,
    'artifacts/layer3/workflow-state-tests.json',
    JSON.stringify({ formatVersion: 1, success: false, summary: { passed: 10 } }),
    1,
  );
  writeArtifact(
    baseDir,
    'artifacts/layer3/schema-contract-check.json',
    JSON.stringify({ formatVersion: 1, success: true, contractsValidated: 2 }),
    1,
  );

  const result = evaluateLayer3Readiness({ manifest: buildManifest(), baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /semantic success check failed/);
});

test('no-op release reports all controls unchanged', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', JSON.stringify({ formatVersion: 1, success: true, summary: { passed: 5 } }), 1);
  writeArtifact(baseDir, 'artifacts/layer3/schema-contract-check.json', JSON.stringify({ formatVersion: 1, success: true, contractsValidated: 2 }), 1);

  const result = evaluateLayer3Readiness({
    manifest: buildManifest(),
    baseDir,
    now: Date.now(),
    releaseDiff: { changedFiles: [], changedChecks: [], changedInterfaces: [] },
  });

  assert.deepEqual(result.controlsImpacted, []);
  assert.deepEqual(result.controlsUnchanged, ['schema-contract-check', 'workflow-state-tests']);
  assert.deepEqual(result.controlsMissingEvidenceDespiteImpact, []);
});

test('interface-changing release reports impacted controls and missing evidence', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', JSON.stringify({ formatVersion: 1, success: false, summary: { passed: 5 } }), 1);
  writeArtifact(baseDir, 'artifacts/layer3/schema-contract-check.json', JSON.stringify({ formatVersion: 1, success: true, contractsValidated: 2 }), 1);

  const result = evaluateLayer3Readiness({
    manifest: buildManifest(),
    baseDir,
    now: Date.now(),
    releaseDiff: { changedInterfaces: ['workflow-state-contract-v1'] },
  });

  assert.deepEqual(result.controlsImpacted, ['workflow-state-tests']);
  assert.deepEqual(result.controlsUnchanged, ['schema-contract-check']);
  assert.deepEqual(result.controlsMissingEvidenceDespiteImpact, ['workflow-state-tests']);
  assert.match(buildLayer3ReadinessReport(result), /Controls impacted by this release/);
});
