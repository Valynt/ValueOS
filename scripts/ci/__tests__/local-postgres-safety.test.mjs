import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireDisposableLocalDatabaseUrl, sanitizedPsqlEnvironment,
} from '../local-postgres-safety.mjs';

const local = 'postgresql://postgres:postgres@127.0.0.1:5432/valueos_ci';

test('explicit local disposable URI passes without inherited routing settings', () => {
  assert.equal(requireDisposableLocalDatabaseUrl(local, {}).hostname, '127.0.0.1');
  assert.equal(requireDisposableLocalDatabaseUrl('postgresql://u:p@localhost:5432/fixture', {}).hostname, 'localhost');
  assert.equal(requireDisposableLocalDatabaseUrl('postgresql://u:p@[::1]:5432/fixture', {}).hostname, '[::1]');
});

for (const [key, value] of [
  ['PGHOST', 'untrusted-db.example'],
  ['PGHOSTADDR', '203.0.113.17'],
  ['PGSERVICE', 'external'],
  ['PGSERVICEFILE', '/tmp/untrusted.conf'],
  ['PGSYSCONFDIR', '/tmp'],
  ['PGPORT', '6432'],
  ['PGDATABASE', 'production'],
  ['PGUSER', 'unsafe'],
  ['PGOPTIONS', '-c search_path=unsafe'],
]) {
  test('rejects inherited libpq routing environment variable ' + key, () => {
    assert.throws(
      () => requireDisposableLocalDatabaseUrl(local, { [key]: value }),
      new RegExp('Refusing inherited libpq routing setting: ' + key),
    );
  });
}
for (const url of [
  'postgresql://u:p@external.example:5432/valueos_ci',
  'postgresql://u:p@localhost:5432/valueos_ci?hostaddr=203.0.113.17',
  'postgresql://u:p@localhost:5432/valueos_ci#ignored',
  'postgresql://u:p@localhost/valueos_ci',
  'postgresql://u:p@localhost:5432/',
  'postgresql://u:p@127.0.0.2:5432/valueos_ci',
  'http://localhost:5432/valueos_ci',
  'service=external',
]) {
  test('rejects non-local/ambiguous URL: ' + url, () => {
    assert.throws(() => requireDisposableLocalDatabaseUrl(url, {}));
  });
}

test('child env never inherits libpq settings, even when added later', () => {
  const result = sanitizedPsqlEnvironment({
    HOME: '/tmp', DATABASE_URL: local, PGHOSTADDR: '203.0.113.17',
    PGPASSWORD: 'hidden', PGSERVICE: 'remote', pGhost: 'external',
    NODE_ENV: 'test',
  });
  assert.deepEqual(result, { HOME: '/tmp', DATABASE_URL: local, NODE_ENV: 'test' });
});
