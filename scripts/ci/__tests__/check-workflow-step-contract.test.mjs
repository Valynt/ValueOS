import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeWorkflowStepContract } from '../check-workflow-step-contract.mjs';

test('fails when a workflow step lacks both uses and run', () => {
  const content = `name: Example\njobs:\n  broken:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Missing implementation\n        if: always()\n`;

  const violations = analyzeWorkflowStepContract({
    workflowPath: '.github/workflows/example.yml',
    content,
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /Missing implementation/);
});

test('passes when every step has uses or run', () => {
  const content = `name: Example\njobs:\n  valid:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Build\n        run: pnpm run build\n`;

  const violations = analyzeWorkflowStepContract({
    workflowPath: '.github/workflows/example.yml',
    content,
  });

  assert.deepEqual(violations, []);
});
