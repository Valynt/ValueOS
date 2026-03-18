import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const middlewarePath = 'packages/backend/src/middleware/planEnforcementMiddleware.ts';
const source = readFileSync(middlewarePath, 'utf8');

test('billing bypass attempt: hard cap path must block quota bypass', () => {
  assert.match(source, /return\s+res\.status\(402\)\.json\([\s\S]*code:\s*'QUOTA_EXCEEDED'/);
});

test('billing bypass attempt: soft cap path must emit warning/alert headers', () => {
  assert.match(source, /res\.setHeader\('X-Quota-Warning',\s*'true'\)/);
  assert.match(source, /res\.setHeader\('X-Grace-Period-Expires'/);
});
