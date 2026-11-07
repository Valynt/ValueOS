import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const checker = resolve('scripts/ci/check-security-test-syntax.mjs');
const run = (path) => spawnSync(process.execPath, [checker, path], { encoding: 'utf8' });

test('valid security test syntax is accepted', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'valueos-ts-parse-'));
  try {
    const path = join(dir, 'valid.test.ts');
    writeFileSync(path, 'import { test } from "node:test";\ntest("works", () => {});\n');
    const result = run(path);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SECURITY_TEST_PARSE_PASSED/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('syntax errors are rejected, never downgraded to warnings', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'valueos-ts-parse-'));
  try {
    const path = join(dir, 'broken.test.ts');
    writeFileSync(path, 'const unfinished = ;\n');
    const result = run(path);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /SECURITY_TEST_PARSE_FAILED/);
    assert.match(result.stderr, /broken\.test\.ts:1:/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing source files fail closed', () => {
  const result = run('/unavailable/valueos-checker-missing.test.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unable to read TypeScript test source/);
});
