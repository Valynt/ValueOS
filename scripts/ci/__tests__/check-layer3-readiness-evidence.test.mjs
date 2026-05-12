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
  checks: [
    {
      id: 'workflow-state-tests',
      name: 'Workflow-state tests',
      artifacts: ['artifacts/layer3/workflow-state-tests.json'],
    },
  ],
};

test('passes when required artifact exists and is fresh', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 1);

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, true);
  assert.equal(result.failedChecks.length, 0);
  assert.equal(result.passedChecks.length, 1);
  assert.match(buildLayer3ReadinessReport(result), /Production-ready verdict: PASS/);
});

test('fails closed when artifact is missing', () => {
  const baseDir = mkTmpDir();

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures[0], /missing artifact/);
});

test('fails closed when artifact is stale', () => {
  const baseDir = mkTmpDir();
  writeArtifact(baseDir, 'artifacts/layer3/workflow-state-tests.json', 48);

  const result = evaluateLayer3Readiness({ manifest, baseDir, now: Date.now() });

  assert.equal(result.productionReady, false);
  assert.equal(result.failedChecks.length, 1);
  assert.match(result.failedChecks[0].failures.join(' '), /stale artifact/);
});
