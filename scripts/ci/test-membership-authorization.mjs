#!/usr/bin/env node
// Isolated PostgreSQL proof that an authenticated member cannot self-enroll
// or self-promote before invoking privileged tenant-erasure operations.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireDisposableLocalDatabaseUrl, sanitizedPsqlEnvironment } from './local-postgres-safety.mjs';

const root = resolve(import.meta.dirname, '../..');
const m = n => readFileSync(resolve(root,'infra/supabase/supabase/migrations',n+'.sql'),'utf8');
const before = '20260317010001_user_tenants_membership_write_guard';
const after = '20261106030000_user_tenants_membership_write_guard';
assert.equal(m(before),m(after),'history-compatible authorization protection must replay');
assert.equal(m(before+'.rollback'),m(after+'.rollback'));

const base = requireDisposableLocalDatabaseUrl(process.env.DATABASE_URL);
function sql(url,body) {
  try {
    return execFileSync('psql',['-X','--no-password','-A','-t','-q','-v','ON_ERROR_STOP=1',url],{
      input:body,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:sanitizedPsqlEnvironment(),
    }).trim();
  } catch(e) { throw new Error(String(e.stderr ?? 'psql failed')); }
}
sql(base.href,[
'DO $roles$ BEGIN',
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;",
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;",
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;",
'END $roles$;',
].join('\n'));

const db = new URL(base.href);
db.pathname = '/valueos_membership_' + randomBytes(8).toString('hex');
sql(base.href,'CREATE DATABASE '+db.pathname.slice(1)+';');
const u=db.href;
const USER='11111111-1111-4111-8111-111111111111';
const TENANT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
sql(u,[
'CREATE SCHEMA auth;',
'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS '+
  "$fn$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;",
'GRANT USAGE ON SCHEMA auth TO authenticated;',
'CREATE TABLE public.user_tenants (tenant_id text NOT NULL,user_id text NOT NULL,'+
  "role text DEFAULT 'member', status text DEFAULT 'active', created_at timestamptz DEFAULT now(),"+
  'updated_at timestamptz DEFAULT now(), PRIMARY KEY(tenant_id,user_id));',
'ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;',
'CREATE POLICY user_tenants_select ON public.user_tenants FOR SELECT USING(user_id=auth.uid()::text);',
'CREATE POLICY user_tenants_insert ON public.user_tenants FOR INSERT WITH CHECK(user_id=auth.uid()::text);',
'CREATE POLICY user_tenants_update ON public.user_tenants FOR UPDATE USING(user_id=auth.uid()::text) WITH CHECK(user_id=auth.uid()::text);',
'CREATE POLICY user_tenants_delete ON public.user_tenants FOR DELETE USING(user_id=auth.uid()::text);',
'CREATE POLICY user_tenants_service_role ON public.user_tenants FOR ALL TO service_role USING(true) WITH CHECK(true);',
'GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_tenants TO authenticated;',
'GRANT ALL ON public.user_tenants TO service_role;',
"INSERT INTO public.user_tenants(tenant_id,user_id,role) VALUES('"+TENANT+"','"+USER+"','member');",
].join('\n'));
const asMember=statement=>[
'BEGIN;',
'SET LOCAL ROLE authenticated;',
"SET LOCAL request.jwt.claim.sub='"+USER+"';",
statement,
'ROLLBACK;',
].join('\n');
const count=(statement)=>Number(sql(u,statement));
assert.equal(count(asMember("UPDATE public.user_tenants SET role='admin' WHERE user_id='"+USER+
  "'; SELECT count(*) FROM public.user_tenants WHERE role='admin';")),1,
  'fixture must first reproduce the actual baseline self-promotion vulnerability');
assert.equal(count("SELECT count(*) FROM public.user_tenants WHERE role='member';"),1,
  'baseline reproduction must roll back');
sql(u,m(before));
assert.equal(count(asMember("SELECT count(*) FROM public.user_tenants WHERE user_id='"+USER+"';")),1);
for (const statement of [
 "UPDATE public.user_tenants SET role='admin' WHERE user_id='"+USER+"';",
 "INSERT INTO public.user_tenants(tenant_id,user_id,role) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','"+USER+"','admin');",
 "DELETE FROM public.user_tenants WHERE user_id='"+USER+"';",
]) {
 assert.throws(()=>sql(u,asMember(statement)),/permission denied|row-level security policy/i);
}
assert.equal(count("SELECT count(*) FROM public.user_tenants WHERE role='member';"),1);
assert.equal(count("SELECT count(*) FROM public.user_tenants WHERE role='admin';"),0);
sql(u,m(after));
assert.equal(count("SELECT count(*) FROM pg_policy WHERE NOT polpermissive AND polname LIKE 'user_tenants_authenticated_%_deny';"),3);
const asService = [
  'BEGIN;',
  'SET LOCAL ROLE service_role;',
  "UPDATE public.user_tenants SET role='admin' WHERE user_id='"+USER+"';",
  "SELECT count(*) FROM public.user_tenants WHERE role='admin' AND user_id='"+USER+"';",
  'ROLLBACK;',
].join('\n');
assert.equal(count(asService),1,'authorized service-role path must remain functional');
assert.equal(count("SELECT count(*) FROM public.user_tenants WHERE role='member';"),1,
  'service-role test mutation must roll back');
sql(u,m(after+'.rollback'));
assert.throws(()=>sql(u,asMember("UPDATE public.user_tenants SET role='admin';")),/permission denied|row-level security policy/i);
console.log('MEMBERSHIP_SCOPE_TARGETED_PASSED: self-promote/enroll/delete denied; existing rows and service-managed path preserved');
