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

test('does not hide Auth provisioning after escaped E-string quotes', () => {
  const sql = String.raw`SELECT E'it\'s -- still a string'; INSERT INTO auth.users (id) VALUES (gen_random_uuid());`;
  assert.ok(findForbiddenMigrationRules('20261105120000_safe.sql', sql)
    .includes('direct Auth user/identity provisioning'));
});

test('strips executable comments inside dollar-quoted DO bodies', () => {
  const sql = 'DO $$ BEGIN INSERT /* comment */ INTO auth.users (id) VALUES (gen_random_uuid()); END $$;';
  assert.ok(findForbiddenMigrationRules('20261105120000_safe.sql', sql)
    .includes('direct Auth user/identity provisioning'));
});

test('ignores non-executable Auth provisioning comments in a DO body', () => {
  const sql = 'DO $block$ BEGIN /* INSERT INTO auth.users (id) VALUES (1); */ PERFORM auth.uid(); END $block$;';
  assert.deepEqual(findForbiddenMigrationRules('20261105120000_safe.sql', sql), []);
});
