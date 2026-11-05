import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const scannerSource = new URL('../validate-browser-api-key-governance.mjs', import.meta.url);

function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'browser-key-governance-'));
  try {
    mkdirSync(join(root, 'scripts/security'), { recursive: true });
    mkdirSync(join(root, 'config/security'), { recursive: true });
    copyFileSync(scannerSource, join(root, 'scripts/security/validate-browser-api-key-governance.mjs'));
    writeFileSync(join(root, 'config/security/browser-key-policy.json'), JSON.stringify({
      keys: {
        VITE_PUBLIC_API_KEY: {
          classification: 'public-key-safe',
          allowedOrigins: ['https://example.test'],
          allowedEndpoints: ['https://api.example.test'],
          quotas: { perMinute: 1, perDay: 20 },
          anomalyAlerts: ['quota-exceeded'],
        },
      },
    }));
    for (const [relativePath, contents] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, contents);
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function scan(root, app) {
  return spawnSync(process.execPath, [
    join(root, 'scripts/security/validate-browser-api-key-governance.mjs'),
    ...(app ? [`--app=${app}`] : []),
  ], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
}

test('public browser API key is allowed with a valid policy, without rg or git', () => {
  withFixture({ 'apps/demo/src/app.ts': 'export const key = import.meta.env.VITE_PUBLIC_API_KEY;' }, root => {
    const result = scan(root, 'demo');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 usage\(s\) validated/);
  });
});

test('unknown browser API key is rejected', () => {
  withFixture({ 'apps/demo/src/app.ts': 'export const key = import.meta.env.VITE_UNKNOWN_API_KEY;' }, root => {
    const result = scan(root, 'demo');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no policy entry exists/);
  });
});

test('nested client src paths are checked', () => {
  withFixture({
    'apps/demo/src/app.ts': 'export const harmless = 1;',
    'apps/demo/client/src/client.tsx': 'export const key = import.meta.env.VITE_UNKNOWN_API_KEY;',
  }, root => {
    const result = scan(root, 'demo');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /apps\/demo\/client\/src\/client\.tsx/);
  });
});

test('missing app or empty source inventory cannot pass', () => {
  withFixture({ 'apps/demo/src/app.ts': 'export const harmless = 1;' }, root => {
    const missing = scan(root, 'missing');
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /No matching frontend app/);
  });
  withFixture({ 'apps/demo/README.md': 'No frontend sources yet' }, root => {
    const empty = scan(root, 'demo');
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /No frontend source files/);
  });
});
