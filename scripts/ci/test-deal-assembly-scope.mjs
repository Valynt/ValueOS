#!/usr/bin/env node
// Disposable local PostgreSQL-only deal migration compatibility regression.
// No real deployment, Supabase Auth, or production data accessed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireDisposableLocalDatabaseUrl, sanitizedPsqlEnvironment } from './local-postgres-safety.mjs';

const root = resolve(import.meta.dirname, '../..');
const m = name => readFileSync(resolve(root, 'infra/supabase/supabase/migrations', name + '.sql'), 'utf8');
const old = '20260318000000_deal_assembly_pipeline';
const newer = '20260318161110_deal_assembly_tables';
const before = '20260318161109_deal_assembly_scope_bridge';
const after = '20261106020000_deal_assembly_scope_reconciliation';
assert.equal(m(before), m(after), 'early and post-history bridge must be byte-identical');
assert.equal(m(before + '.rollback'), m(after + '.rollback'));

const base = requireDisposableLocalDatabaseUrl(process.env.DATABASE_URL);
function sql(url, body) {
  try {
    return execFileSync('psql', ['-X', '--no-password', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', url], {
      input: body, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      env: sanitizedPsqlEnvironment(),
    }).trim();
  } catch (error) {
    throw new Error(String(error.stderr ?? 'psql execution failed'));
  }
}
const apply = (url, name) => sql(url, m(name));
const count = (url, stmt) => Number(sql(url, stmt));
const mustReject = (fn, pattern) => assert.throws(fn, pattern);
sql(base.href, [
  'DO $roles$ BEGIN',
  "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;",
  "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;",
  "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;",
  'END $roles$;',
].join('\n'));
const TEN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEN_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ORG_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CASE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CTX = '11111111-1111-4111-8111-111111111111';
const SRC = '22222222-2222-4222-8222-222222222222';
const STK = '33333333-3333-4333-8333-333333333333';
const USE = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const OPP = '66666666-6666-4666-8666-666666666666';

function disposableDb() {
  const name = 'valueos_deal_test_' + randomBytes(8).toString('hex');
  sql(base.href, 'CREATE DATABASE ' + name + ';');
  const db = new URL(base.href);
  db.pathname = '/' + name;
  const u = db.href;
  sql(u, [
    'CREATE SCHEMA auth;',
    'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS ' +
      "$fn$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;",
    'CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS ' +
      "$fn$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $fn$;",
    'CREATE SCHEMA security;',
    'CREATE TABLE public.organizations (id uuid PRIMARY KEY, tenant_id text NOT NULL);',
    'CREATE TABLE public.value_cases (id uuid PRIMARY KEY, organization_id uuid NOT NULL, tenant_id text NOT NULL);',
    'CREATE TABLE public.user_tenants (tenant_id text NOT NULL, user_id text NOT NULL);',
    'CREATE FUNCTION security.user_has_tenant_access(t uuid) RETURNS boolean ' +
      'LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public ' +
      'AS $fn$ SELECT EXISTS(SELECT 1 FROM public.user_tenants ' +
      'WHERE tenant_id=t::text AND user_id=auth.uid()::text) $fn$;',
    'CREATE FUNCTION security.user_has_tenant_access(t text) RETURNS boolean ' +
      'LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public ' +
      'AS $fn$ SELECT EXISTS(SELECT 1 FROM public.user_tenants ' +
      'WHERE tenant_id=t AND user_id=auth.uid()::text) $fn$;',
    'GRANT USAGE ON SCHEMA auth, security TO authenticated;',
    'GRANT SELECT ON public.organizations, public.value_cases TO authenticated;',
    "INSERT INTO public.organizations VALUES ('" + ORG_A + "','" + TEN_A + "'),('" + ORG_B + "','" + TEN_B + "');",
    "INSERT INTO public.value_cases VALUES ('" + CASE + "','" + ORG_A + "','" + TEN_A + "');",
    "INSERT INTO public.user_tenants VALUES ('" + TEN_A + "','" + USER + "');",
  ].join('\n'));
  return u;
}
function seedOld(u, hasCase = true) {
  apply(u, old);
  sql(u, [
    'INSERT INTO public.deal_contexts (id,tenant_id,opportunity_id,case_id) VALUES (' +
      "'" + CTX + "','" + TEN_A + "','" + OPP + "'," + (hasCase ? "'" + CASE + "'" : 'NULL') + ');',
    'INSERT INTO public.deal_context_sources (id,tenant_id,deal_context_id,source_type,fragment_hash) VALUES (' +
      "'" + SRC + "','" + TEN_A + "','" + CTX + "','crm-opportunity','hash-a');",
    'INSERT INTO public.stakeholders (id,tenant_id,deal_context_id,name,role,source_type) VALUES (' +
      "'" + STK + "','" + TEN_A + "','" + CTX + "','Person','champion','CRM-derived');",
    'INSERT INTO public.use_cases (id,tenant_id,deal_context_id,name,description,source_type) VALUES (' +
      "'" + USE + "','" + TEN_A + "','" + CTX + "','Use case','Description','CRM-derived');",
  ].join('\n'));
}
function preserved(u) {
  for (const table of ['deal_contexts','deal_context_sources','stakeholders','use_cases']) {
    assert.equal(count(u, 'SELECT count(*) FROM public.' + table + ';'), 1, table + ' row count');
    assert.equal(count(u, 'SELECT count(*) FROM public.' + table +
      " WHERE organization_id='" + ORG_A + "' AND tenant_id='" + TEN_A + "';"), 1, table + ' verified mapping');
  }
  assert.equal(count(u, "SELECT count(*) FROM pg_constraint WHERE contype='f' AND conname IN (" +
    "'deal_context_sources_parent_scope_fk','stakeholders_parent_scope_fk','use_cases_parent_scope_fk');"), 3);
  assert.equal(count(u, "SELECT count(*) FROM pg_policy WHERE NOT polpermissive AND polname LIKE '%_verified_%_guard';"), 16);
  mustReject(() => sql(u, "UPDATE public.stakeholders SET organization_id='" + ORG_B +
    "' WHERE id='" + STK + "';"), /scope mismatch|foreign key/i);
  assert.equal(count(u, "SELECT count(*) FROM public.stakeholders WHERE organization_id='" + ORG_A + "';"), 1);
}
function visible(u, tenant, jwtTenant) {
  return count(u, [
    'BEGIN;',
    'SET LOCAL ROLE authenticated;',
    "SET LOCAL request.jwt.claim.sub = '" + USER + "';",
    "SET LOCAL request.jwt.claims = '{\"tenant_id\":\"" + jwtTenant + "\"}';",
    "SELECT count(*) FROM public.deal_contexts WHERE tenant_id='" + tenant + "';",
    'ROLLBACK;',
  ].join('\n'));
}
{
  const u = disposableDb();
  seedOld(u);
  mustReject(() => apply(u, newer), /column "organization_id" does not exist/i);
  apply(u, before); apply(u, newer); apply(u, after);
  preserved(u);
  assert.equal(visible(u, TEN_A, TEN_A), 1);
  // A foreign TEN_B row must ACTUALLY exist during the read. Otherwise
  // count=0 would pass even with RLS disabled and the test would be vacuous.
  const forgedTenantRead = [
    'BEGIN;',
    "INSERT INTO public.deal_contexts(id,tenant_id,organization_id,opportunity_id,case_id) VALUES (" +
      "'77777777-7777-4777-8777-777777777777','" + TEN_B + "','" + ORG_B + "','" + OPP + "',NULL);",
    'SET LOCAL ROLE authenticated;',
    "SET LOCAL request.jwt.claim.sub='" + USER + "';",
    "SET LOCAL request.jwt.claims='{\\\"tenant_id\\\":\\\"" + TEN_B + "\\\"}';",
    "SELECT count(*) FROM public.deal_contexts WHERE tenant_id='" + TEN_B + "';",
    'ROLLBACK;',
  ].join('\\n');
  assert.equal(count(u, forgedTenantRead), 0, 'member of A must never read a real B row by forging JWT tenant claim');
  assert.equal(count(u, "SELECT count(*) FROM public.deal_contexts;"), 1, 'foreign row must be rolled back');
  assert.equal(count(u, "SELECT count(*) FROM pg_trigger WHERE tgrelid='public.deal_contexts'::regclass " +
    "AND tgname IN ('update_deal_contexts_updated_at','legacy_deal_deal_contexts_updated_at');"), 1);
  assert.equal(sql(u, "SELECT atttypid::regtype::text FROM pg_attribute " +
    "WHERE attrelid='public.deal_contexts'::regclass AND attname='opportunity_id';"), 'uuid');
  assert.equal(sql(u, "SELECT atttypid::regtype::text FROM pg_attribute " +
    "WHERE attrelid='public.use_cases'::regclass AND attname='pain_signals';"), 'jsonb');
  apply(u, after + '.rollback');
  assert.equal(count(u, "SELECT has_table_privilege('authenticated','public.deal_contexts','UPDATE')::int;"), 0);
  apply(u, after);
  preserved(u);
  console.log('PASS: historical failure reproduced; bridge, populated scope, FK, RLS, rollback/reapply');
}
{
  const u = disposableDb();
  seedOld(u, false);
  mustReject(() => apply(u, before), /ownership unresolved/i);
  assert.equal(count(u, 'SELECT count(*) FROM public.deal_contexts;'), 1);
  assert.equal(count(u, "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' " +
    "AND table_name='deal_contexts' AND column_name='organization_id';"), 0);
  console.log('PASS: ambiguous legacy parent rejected atomically without changing schema or rows');
}
{
  const u = disposableDb();
  apply(u, newer);
  sql(u, [
    "INSERT INTO public.deal_contexts(id,organization_id,opportunity_id,case_id) VALUES ('" + CTX + "','" + ORG_A + "','external-id','" + CASE + "');",
    "INSERT INTO public.deal_context_sources(id,organization_id,deal_context_id,source_type,fragment_hash) VALUES ('" + SRC + "','" + ORG_A + "','" + CTX + "','crm-derived','hash-a');",
    "INSERT INTO public.stakeholders(id,organization_id,deal_context_id,name,role,source_type) VALUES ('" + STK + "','" + ORG_A + "','" + CTX + "','Person','champion','crm-derived');",
    "INSERT INTO public.use_cases(id,organization_id,deal_context_id,name,description,source_type) VALUES ('" + USE + "','" + ORG_A + "','" + CTX + "','Use case','Description','crm-derived');",
  ].join('\n'));
  apply(u, after);
  preserved(u);
  assert.equal(sql(u, "SELECT atttypid::regtype::text FROM pg_attribute " +
    "WHERE attrelid='public.deal_contexts'::regclass AND attname='opportunity_id';"), 'text');
  console.log('PASS: populated organization-first history preserves TEXT schema and rows');
}
console.log('DEAL_SCOPE_TARGETED_PASSED; deployed histories, full chain and real Supabase Auth remain separate gates');
