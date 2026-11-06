#!/usr/bin/env node
// Targeted DB regression suite. Every case gets a NEW disposable database.
// This is not full-chain or real Supabase Auth deployment evidence.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireDisposableLocalDatabaseUrl, sanitizedPsqlEnvironment } from './local-postgres-safety.mjs';
const root = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const migration = name => read(`infra/supabase/supabase/migrations/${name}.sql`);
const bridge = '20260318160000_value_modeling_scope_bridge';
const forward = '20261106000000_value_modeling_scope_reconciliation';
const historical = '20260318160647_value_modeling_assumptions_scenarios';
const identity = '20260317010000_canonical_public_users_identity';
const model = '20260318000000_value_modeling_assumptions_scenarios';
const authFixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon') $$;`;
// Roles are cluster-wide on PostgreSQL; PGlite instances are independent.
const authSchema = authFixture.slice(authFixture.indexOf('CREATE SCHEMA'));
const stripMeta = sql => sql.replace(/^\\set ON_ERROR_STOP on\s*$/gm, '');

export async function runScopeRegressionSuite(createDatabase) {
  assert.equal(migration(bridge), migration(forward), 'Fresh/upgrade repairs must remain identical');
  assert.equal(migration(`${bridge}.rollback`), migration(`${forward}.rollback`));
  const setup = async (includeIdentity = true) => {
    const db = await createDatabase({ authFixture, authSchema });
    for (const name of ['00000000000000_initial_release_baseline',
      '20260213000004_tenant_identity_prerequisites', '20260213000005_organizations_table',
      '20260213000010_canonical_identity_baseline']) await db.exec(migration(name));
    if (includeIdentity) {
      await db.exec(migration(identity));
      await db.exec(migration(model));
    }
    return db;
  };
  const expectFailure = async (db, sql, pattern) => {
    await assert.rejects(() => db.exec(sql), pattern);
    // PGlite retains a failed transaction; psql closes its failed session.
    await db.exec('ROLLBACK;');
  };
  let db = await setup();
  try {
    await expectFailure(db, migration(historical), /organization_id.*does not exist/);
    await db.exec(migration(bridge));
    await db.exec(migration(historical));
    await db.exec(stripMeta(read('scripts/ci/verify-canonical-users.sql')));
    console.log('PASS: reproduced old failure; fresh bridge + historical migration; UUID/TEXT identity checks');
  } finally { await db.close(); }

  db = await setup();
  try {
    await db.exec(read('scripts/ci/fixtures/value-modeling-scope.sql'));
    await db.exec(migration(bridge));
    await db.exec(migration(historical));
    await db.exec(stripMeta(read('scripts/ci/verify-value-modeling-scope.sql')));
    await expectFailure(db, migration('20260923000000_value_modeling_schema_consolidation'), /Refusing destructive value-modeling consolidation/);
    await db.exec(stripMeta(read('scripts/ci/verify-value-modeling-scope.sql')));
    await db.exec(migration(forward));
    await db.exec(stripMeta(read('scripts/ci/verify-value-modeling-scope.sql')));
    await db.exec(migration(`${forward}.rollback`));
    await db.exec(`DO $$ BEGIN
      IF has_table_privilege('authenticated','public.assumptions','INSERT')
        OR has_table_privilege('service_role','public.scenarios','UPDATE')
        OR (SELECT sum(value) FROM public.assumptions) <> 126 THEN
        RAISE EXCEPTION 'Rollback lost data or retained write privileges'; END IF;
    END $$;`);
    await db.exec(migration(forward));
    await db.exec(stripMeta(read('scripts/ci/verify-value-modeling-scope.sql')));
    console.log('PASS: populated backfill, forward replay, RLS collision/negative writes, rollback/reapply; destructive historical upgrade blocked');
  } finally { await db.close(); }

  db = await setup();
  try {
    // Exercise the actual historical organization-only schema on an EMPTY
    // installation, then populate it before the new forward reconciliation.
    await db.exec(migration(bridge));
    await db.exec(migration(historical));
    await db.exec(migration('20260923000000_value_modeling_schema_consolidation'));
    const fixture = read('scripts/ci/fixtures/value-modeling-scope.sql');
    const split = fixture.indexOf('INSERT INTO public.assumptions');
    const organizationRows = fixture.slice(split).replaceAll('tenant_id', 'organization_id')
      .replaceAll('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000111')
      .replaceAll('bbbbbbbb-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000222');
    await db.exec(fixture.slice(0, split) + organizationRows);
    await db.exec(migration(forward));
    await db.exec(stripMeta(read('scripts/ci/verify-value-modeling-scope.sql')));
    console.log('PASS: populated historical organization-only schema upgrades without data loss');
  } finally { await db.close(); }

  for (const mutation of [
    "UPDATE public.value_cases SET organization_id = NULL WHERE id = '40000000-0000-4000-8000-000000000111'",
    "UPDATE public.value_cases SET tenant_id = 'scope-text-tenant' WHERE id = '40000000-0000-4000-8000-000000000111'",
    "UPDATE public.scenarios SET tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' WHERE id = '60000000-0000-4000-8000-000000000222'",
  ]) {
    db = await setup();
    try {
      await db.exec(read('scripts/ci/fixtures/value-modeling-scope.sql'));
      await db.exec(mutation);
      await expectFailure(db, migration(bridge), /manual scope reconciliation required/);
      await db.exec(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name IN ('assumptions','scenarios') AND column_name='organization_id')
          OR (SELECT sum(value) FROM public.assumptions) <> 126 THEN
          RAISE EXCEPTION 'Rejected upgrade was not atomic'; END IF;
      END $$;`);
      console.log('PASS: ambiguous/contradictory upgrade rejected atomically');
    } finally { await db.close(); }
  }
  db = await setup(false);
  try {
    await db.exec("CREATE TABLE public.users(id text PRIMARY KEY); INSERT INTO public.users VALUES ('legacy-text-identity');");
    await expectFailure(db, migration(identity), /manual data-safe identity migration required/i);
    await db.exec(`DO $$ BEGIN
      IF (SELECT id FROM public.users) <> 'legacy-text-identity'
        OR (SELECT atttypid FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='id') <> 'text'::regtype THEN
        RAISE EXCEPTION 'Incompatible identity was converted'; END IF;
    END $$;`);
    console.log('PASS: incompatible TEXT user identity rejected without conversion');
  } finally { await db.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The runner creates databases only on an explicit LOCAL disposable PG service.
  const url = requireDisposableLocalDatabaseUrl(process.env.DATABASE_URL);
  const execute = (databaseUrl, sql) => {
    try {
      execFileSync('psql', ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1', databaseUrl],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: sanitizedPsqlEnvironment() });
    } catch (error) {
      throw new Error(String(error.stderr ?? 'psql execution failed'));
    }
  };
  // Create missing roles, but never alter existing role privileges.
  execute(url.href, `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
  END $$;`);
  await runScopeRegressionSuite(async ({ authSchema: schema }) => {
    const name = `valueos_scope_${randomBytes(8).toString('hex')}`;
    execute(url.href, `CREATE DATABASE ${name};`);
    const target = new URL(url); target.pathname = `/${name}`;
    execute(target.href, schema);
    return {
      exec: async sql => execute(target.href, sql),
      close: async () => {}, // Ephemeral CI service owns cleanup; never drop caller DBs.
    };
  });
}
