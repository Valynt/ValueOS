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
        ...overrides,
      },
    ],
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

  const result = evaluateLayer3Readiness({ manifest: buildManifest(), baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /semantic success check failed/);
});

test('fails closed on malformed payload', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', '{ this is not valid json', 1);

  const result = evaluateLayer3Readiness({ manifest: buildManifest(), baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /not valid JSON/);
});

test('fails closed on unknown validator', () => {
  const baseDir = mkTmpDir();
  writeArtifact(
    baseDir,
    'artifacts/layer3/workflow-state-tests.json',
    JSON.stringify({ formatVersion: 1, success: true, summary: { passed: 10 } }),
    1,
  );

  const result = evaluateLayer3Readiness({
    manifest: buildManifest({ validator: 'nonexistent-validator' }),
    baseDir,
    now: Date.now(),
  });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /unknown validator type/);
});

test('passes valid payload and semantic checks', () => {
  const baseDir = mkTmpDir();
  writeArtifact(
    baseDir,
    'artifacts/layer3/workflow-state-tests.json',
    JSON.stringify({ formatVersion: 1, success: true, summary: { passed: 10 } }),
    1,
  );

  const result = evaluateLayer3Readiness({ manifest: buildManifest(), baseDir, now: Date.now() });

  assert.equal(result.productionReady, true);
  assert.equal(result.failedChecks.length, 0);
  assert.equal(result.passedChecks.length, 1);
  assert.match(buildLayer3ReadinessReport(result), /Production-ready verdict: PASS/);
});
