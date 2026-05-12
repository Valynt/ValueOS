import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evaluateLayer5Impact, loadLayer5ImpactManifest } from '../check-layer5-readiness-gate.mjs';

const MANIFEST_PATH = path.resolve('docs/operations/layer5-impact-paths.json');

function writeTempManifest(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layer5-manifest-'));
  const manifestPath = path.join(dir, 'layer5-impact-paths.json');
  fs.writeFileSync(manifestPath, content, 'utf8');
  return manifestPath;
}

test('positive detection for known Layer 5 files', () => {
  const manifest = loadLayer5ImpactManifest(MANIFEST_PATH);
  const changed = [
    'packages/backend/src/runtime/DecisionRouter/index.ts',
    'README.md',
  ];

  const result = evaluateLayer5Impact(changed, manifest);

  assert.equal(result.isLayer5Impacting, true);
  assert.deepEqual(result.triggeringFiles, ['packages/backend/src/runtime/DecisionRouter/index.ts']);
});

test('negative detection for unrelated files', () => {
  const manifest = loadLayer5ImpactManifest(MANIFEST_PATH);
  const changed = [
    'README.md',
    'docs/testing/pnpm-test-contract.md',
  ];

  const result = evaluateLayer5Impact(changed, manifest);

  assert.equal(result.isLayer5Impacting, false);
  assert.deepEqual(result.triggeringFiles, []);
});

test('regression coverage: newly added layer5 directory captured by manifest-only update', () => {
  const manifest = {
    version: 1,
    include: {
      exact: [],
      prefixes: ['packages/backend/src/new-layer5-surface/'],
    },
    exclude: {
      exact: [],
      prefixes: [],
    },
  };

  const changed = ['packages/backend/src/new-layer5-surface/adapter.ts'];
  const result = evaluateLayer5Impact(changed, manifest);

  assert.equal(result.isLayer5Impacting, true);
  assert.deepEqual(result.triggeringFiles, ['packages/backend/src/new-layer5-surface/adapter.ts']);
});

test('fail-closed behavior on malformed manifest', () => {
  const malformedPath = writeTempManifest(
    JSON.stringify({
      version: 1,
      include: { exact: ['README.md'] },
      exclude: { exact: [], prefixes: [] },
    })
  );

  assert.throws(
    () => loadLayer5ImpactManifest(malformedPath),
    /include\.prefixes must be an array of strings/
  );
});
