import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLayer4Readiness } from '../check-layer4-readiness-evidence.mjs';

test('layer4 readiness gate currently passes', () => {
  const result = evaluateLayer4Readiness();
  assert.equal(result.status, 'PASS');
  assert.equal(result.failures.length, 0);
});
