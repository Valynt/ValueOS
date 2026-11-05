import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scannerSource = fileURLToPath(new URL('../check-docs-secrets.mjs', import.meta.url));

function execute(markdown) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-secret-gate-'));
  try {
    mkdirSync(join(dir, 'docs/guide'), { recursive: true });
    mkdirSync(join(dir, 'scripts/ci'), { recursive: true });
    copyFileSync(scannerSource, join(dir, 'scripts/ci/check-docs-secrets.mjs'));
    if (markdown !== null) writeFileSync(join(dir, 'docs/guide/README.md'), markdown);
    return spawnSync(process.execPath, ['scripts/ci/check-docs-secrets.mjs'], {
      cwd: dir, encoding: 'utf8'
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts only explicitly non-runnable database credential placeholders', () => {
  const result = execute('postgresql://<USER>:<PASSWORD>@db.example.invalid:5432/valueos');
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a concrete database password without printing its value', () => {
  const value = 'pretendpassword' + String(456);
  const result = execute('postgresql://app:' + value + '@db.example.invalid:5432/valueos');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Known key pattern/);
  assert.doesNotMatch(result.stderr, new RegExp(value));
});

test('rejects synthetic Supabase access tokens without disclosing the matched token', () => {
  const token = 'sbp_' + 'X'.repeat(32);
  const result = execute('Token: ' + token);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Known key pattern/);
  assert.ok(!result.stderr.includes(token));
});

test('refuses to pass with zero markdown documents', () => {
  const result = execute(null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /zero Markdown files/);
});
