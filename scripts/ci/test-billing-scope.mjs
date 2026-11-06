#!/usr/bin/env node
// Disposable localhost PostgreSQL only; not real Supabase Auth certification.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const m = name => readFileSync(resolve(root, 'infra/supabase/supabase/migrations', name + '.sql'), 'utf8');
const pre = '20260318160750_billing_scope_bridge';
const post = '20261106010000_billing_scope_reconciliation';
const old = '20260318160751_billing_v2_core_tables';
assert.equal(m(pre), m(post), 'Fresh/replay and forward repairs must be identical');
assert.equal(m(pre + '.rollback'), m(post + '.rollback'));

const base = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost','127.0.0.1','[::1]'].includes(base.hostname) ||
    !['postgres:','postgresql:'].includes(base.protocol) || base.search || base.hash)
  throw new Error('Refusing remote database: require disposable localhost DATABASE_URL');

function sql(url, script) {
  try {
    return execFileSync('psql',
      ['-X','--no-password','-A','-t','-v','ON_ERROR_STOP=1',url],
      { input: script, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
  } catch (error) { throw new Error(String(error.stderr ?? 'psql failed')); }
}
const run = (url,name) => sql(url,m(name));
const scalar = (url,query) => Number(sql(url,query));
const reject = (url, script, pattern) => assert.throws(() => sql(url,script), pattern);
sql(base.href, "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;");

function createDb() {
  const name = 'valueos_billing_' + randomBytes(8).toString('hex');
  sql(base.href,'CREATE DATABASE ' + name + ';');
  const u = new URL(base); u.pathname = '/' + name;
  sql(u.href, [
    'CREATE SCHEMA auth;',
    'GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;',
    'CREATE TABLE auth.users(id uuid PRIMARY KEY);',
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;",
    "CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon') $$;"
  ].join('\n'));
  for (const v of [
    '00000000000000_initial_release_baseline',
    '20260213000004_tenant_identity_prerequisites',
    '20260213000005_organizations_table',
    '20260213000010_canonical_identity_baseline'
  ]) run(u.href,v);
  return u.href;
}
const A='aaaaaaaa-0000-4000-8000-000000000001';
const B='bbbbbbbb-0000-4000-8000-000000000002';
const OA='10000000-0000-4000-8000-000000000111';
const OB='20000000-0000-4000-8000-000000000222';
const UA='00000000-0000-4000-8000-000000000111';
const UB='00000000-0000-4000-8000-000000000222';
const fixture=[
  "INSERT INTO auth.users(id) VALUES ('"+UA+"'),('"+UB+"');",
  "INSERT INTO public.tenants(id,name) VALUES ('"+A+"','A'),('"+B+"','B'),('"+OB+"','Collision');",
  "INSERT INTO public.organizations(id,tenant_id,name) VALUES ('"+OA+"','"+A+"','A'),('"+OB+"','"+B+"','B');",
  "INSERT INTO public.user_tenants(tenant_id,user_id,role,status) VALUES ('"+A+"','"+UA+"','member','active'),('"+OB+"','"+UA+"','member','active'),('"+B+"','"+UB+"','member','active');",
  "INSERT INTO public.billing_price_versions(id,version_tag,plan_tier,tenant_id,definition,status) VALUES ('70000000-0000-4000-8000-000000000111','shared','free','"+A+"','{}','active'),('70000000-0000-4000-8000-000000000222','shared','free','"+B+"','{}','active');",
  "INSERT INTO public.usage_policies(id,tenant_id,meter_key) VALUES ('71000000-0000-4000-8000-000000000111','"+A+"','ai_tokens'),('71000000-0000-4000-8000-000000000222','"+B+"','ai_tokens');",
  "INSERT INTO public.billing_approval_policies(id,tenant_id,action_type) VALUES ('72000000-0000-4000-8000-000000000111','"+A+"','plan_change'),('72000000-0000-4000-8000-000000000222','"+B+"','plan_change');",
  "INSERT INTO public.billing_approval_requests(approval_id,tenant_id,requested_by_user_id,action_type,payload) VALUES ('73000000-0000-4000-8000-000000000111','"+A+"','"+UA+"','plan_change','{}'),('73000000-0000-4000-8000-000000000222','"+B+"','"+UB+"','plan_change','{}');",
  "INSERT INTO public.entitlement_snapshots(id,tenant_id,subscription_id,price_version_id,entitlements,effective_at) VALUES ('74000000-0000-4000-8000-000000000111','"+A+"','75000000-0000-4000-8000-000000000111','70000000-0000-4000-8000-000000000111','{}',now()),('74000000-0000-4000-8000-000000000222','"+B+"','75000000-0000-4000-8000-000000000222','70000000-0000-4000-8000-000000000222','{}',now());"
].join('\n');
function verifyRows(u) {
  for (const [table,n] of [['billing_price_versions',5],['usage_policies',2],
    ['billing_approval_policies',2],['billing_approval_requests',2],['entitlement_snapshots',2]])
    assert.equal(scalar(u,'SELECT count(*) FROM public.'+table),n,table+' rows changed');
  assert.equal(scalar(u,'SELECT count(*) FROM public.billing_price_versions WHERE tenant_id IS NULL AND organization_id IS NULL'),3);
  assert.equal(scalar(u,"SELECT count(*) FROM public.billing_price_versions WHERE version_tag='shared'"),2);
}
function verifyIsolation(u) {
  sql(u,[
    'BEGIN;',
    'SET LOCAL ROLE authenticated;',
    "SET LOCAL request.jwt.claim.sub = '"+UA+"';",
    "DO $$ DECLARE changed integer; BEGIN "+
    "IF (SELECT count(*) FROM public.billing_price_versions) <> 4 OR "+
    "(SELECT count(*) FROM public.usage_policies) <> 1 OR "+
    "(SELECT count(*) FROM public.billing_approval_policies) <> 1 OR "+
    "(SELECT count(*) FROM public.billing_approval_requests) <> 1 OR "+
    "(SELECT count(*) FROM public.entitlement_snapshots) <> 1 THEN "+
    "RAISE EXCEPTION 'Tenant isolation failure'; END IF; "+
    "UPDATE public.billing_approval_requests SET status='approved' "+
    "WHERE approval_id='73000000-0000-4000-8000-000000000222'; "+
    "GET DIAGNOSTICS changed = ROW_COUNT; "+
    "IF changed <> 0 THEN RAISE EXCEPTION 'Cross-tenant update'; END IF; "+
    "BEGIN UPDATE public.billing_approval_requests SET tenant_id='"+B+"' "+
    "WHERE approval_id='73000000-0000-4000-8000-000000000111'; "+
    "RAISE EXCEPTION 'Ownership change accepted'; "+
    "EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END; END $$;",
    'ROLLBACK;'
  ].join('\n'));
  sql(u,[
    'BEGIN;',
    "DO $$ BEGIN "+
    "BEGIN UPDATE public.billing_price_versions SET organization_id='"+OB+"' "+
    "WHERE id='70000000-0000-4000-8000-000000000111'; "+
    "RAISE EXCEPTION 'Mismatched org accepted'; "+
    "EXCEPTION WHEN check_violation THEN NULL; END; "+
    "BEGIN UPDATE public.billing_price_versions SET organization_id='"+OA+"' "+
    "WHERE tenant_id IS NULL AND plan_tier='free'; "+
    "RAISE EXCEPTION 'Global row adopted'; "+
    "EXCEPTION WHEN check_violation THEN NULL; END; END $$;",
    'ROLLBACK;'
  ].join('\n'));
}
{
  const u=createDb();
  reject(u,m(old),/organization_id.*does not exist/i);
  run(u,pre); run(u,old);
  assert.equal(scalar(u,'SELECT count(*) FROM public.billing_price_versions WHERE tenant_id IS NULL AND organization_id IS NULL'),3);
  console.log('PASS: reproduced original failure, repaired fresh billing schema and global prices');
}
{
  const u=createDb();
  sql(u,fixture); run(u,pre);
  sql(u,"UPDATE public.billing_price_versions SET organization_id='"+OB+"' WHERE tenant_id='"+B+"';"+
        "UPDATE public.billing_approval_requests SET organization_id='"+OB+"' WHERE tenant_id='"+B+"';");
  run(u,old); verifyRows(u); verifyIsolation(u);
  run(u,post); verifyRows(u); verifyIsolation(u);
  run(u,post+'.rollback'); verifyRows(u);
  assert.equal(scalar(u,"SELECT has_table_privilege('service_role','public.billing_approval_requests','UPDATE')::integer"),0);
  run(u,post); verifyRows(u); verifyIsolation(u);
  assert.equal(scalar(u,"SELECT has_table_privilege('service_role','public.billing_approval_requests','UPDATE')::integer"),1);
  console.log('PASS: populated rows, collision-negative RLS, forward upgrade, rollback freeze, reapply');
}
{
  const u=createDb(); sql(u,fixture);
  sql(u,"ALTER TABLE public.billing_price_versions ADD COLUMN organization_id uuid;"+
        "UPDATE public.billing_price_versions SET organization_id='"+OA+"' WHERE tenant_id IS NULL AND plan_tier='free';");
  reject(u,m(pre),/Global billing price has an organization/i);
  assert.equal(scalar(u,"SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='usage_policies' AND column_name='organization_id'"),0);
  assert.equal(scalar(u,'SELECT count(*) FROM public.billing_price_versions WHERE tenant_id IS NULL'),3);
  console.log('PASS: ambiguous global price rejected atomically');
}
console.log('BILLING_SCOPE_TARGETED_PASSED; real Supabase Auth and full history remain separate gates');
