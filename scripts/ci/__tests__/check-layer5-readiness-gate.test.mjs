import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  evaluateLayer5Impact,
  loadLayer5ImpactManifest,
} from '../check-layer5-readiness-gate.mjs';

function writeManifest(root, payload) {
  const manifestPath = path.join(root, 'docs/operations/layer5-impact-paths.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2));
}

function buildBaseManifest() {
  return {
    version: 1,
    include: {
      exact: ['docs/operations/runbooks/governance-drift.md'],
      prefixes: [
        'packages/backend/src/lib/agent-fabric/',
      ],
    },
    exclude: {
      exact: [],
      prefixes: [],
    },
  };
}

test('positive detection for known Layer 5 files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer5-manifest-'));
  writeManifest(root, buildBaseManifest());
  const manifest = loadLayer5ImpactManifest({ root });

  const result = evaluateLayer5Impact([
    'packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts',
  ], manifest);

  assert.equal(result.isLayer5Impacting, true);
  assert.deepEqual(result.triggeredFiles, ['packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts']);
});

test('negative detection for unrelated files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer5-manifest-'));
  writeManifest(root, buildBaseManifest());
  const manifest = loadLayer5ImpactManifest({ root });

  const result = evaluateLayer5Impact([
    'apps/ValyntApp/src/components/Hero.tsx',
  ], manifest);

  assert.equal(result.isLayer5Impacting, false);
  assert.deepEqual(result.triggeredFiles, []);
});

test('regression: newly added Layer 5 directory is captured by manifest-only update', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer5-manifest-'));
  const manifestPayload = buildBaseManifest();
  manifestPayload.include.prefixes.push('packages/backend/src/services/governance/');
  writeManifest(root, manifestPayload);
  const manifest = loadLayer5ImpactManifest({ root });

  const result = evaluateLayer5Impact([
    'packages/backend/src/services/governance/DriftPolicy.ts',
  ], manifest);

  assert.equal(result.isLayer5Impacting, true);
  assert.deepEqual(result.triggeredFiles, ['packages/backend/src/services/governance/DriftPolicy.ts']);
});

test('fail-closed behavior on malformed manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer5-manifest-'));
  writeManifest(root, {
    version: 1,
    include: { exact: ['docs/operations/runbooks/governance-drift.md'] },
    exclude: { exact: [], prefixes: [] },
  });

  assert.throws(() => loadLayer5ImpactManifest({ root }), /include\.prefixes/);
});
