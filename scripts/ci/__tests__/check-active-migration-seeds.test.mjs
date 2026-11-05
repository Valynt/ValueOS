import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findForbiddenMigrationRules } from '../check-active-migration-seeds.mjs';

const forbidden = [
  'INSERT INTO auth.users (id) VALUES (gen_random_uuid());',
  'INSERT INTO "auth"."users" (id) VALUES (gen_random_uuid());',
  'INSERT INTO ONLY auth.identities (id) VALUES (gen_random_uuid());',
  'INSERT /* between keywords */ INTO /* target */ "auth" . "identities" (id) VALUES (gen_random_uuid());',
  'COPY auth.users FROM STDIN;',
  "EXECUTE 'INSERT INTO auth.users(id) VALUES (gen_random_uuid())';",
];

for (const [index, sql] of forbidden.entries()) {
  test('forbids direct Auth user/identity provisioning form ' + index, () => {
    assert.ok(findForbiddenMigrationRules('20261105120000_test.sql', sql).includes('direct Auth user/identity provisioning'));
  });
}

test('rejects demo credentials and seed-named migrations', () => {
  assert.ok(findForbiddenMigrationRules('20261105120000_seed_dev.sql', 'SELECT 1;').includes('seed-named migration'));
  assert.ok(findForbiddenMigrationRules('20261105120000_safe.sql', "SELECT 'dev@valueos.local'").includes('hardcoded demo credential'));
});

test('allows normal canonical RLS function use and Auth queries', () => {
  const safe = "CREATE POLICY own ON public.users USING (id = auth.uid()); SELECT id FROM auth.users;";
  assert.deepEqual(findForbiddenMigrationRules('20261105120000_rls.sql', safe), []);
});

test('does not treat commented-out Auth inserts as executable', () => {
  const safe = "/* INSERT INTO auth.users(id) VALUES ('ignored') */\n-- INSERT INTO auth.identities(id)\nSELECT auth.uid();";
  assert.deepEqual(findForbiddenMigrationRules('20261105120000_good.sql', safe), []);
});

test('does not confuse a similarly named table with Auth users', () => {
  assert.deepEqual(findForbiddenMigrationRules('20261105120000_good.sql', 'INSERT INTO auth.users_legacy VALUES (1);'), []);
});
