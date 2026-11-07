#!/usr/bin/env node
// Active ten-pillar schema, populated legacy rejection, RLS and rollback.
// PostgreSQL disposable localhost only; NOT Supabase Auth/deployed history.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireDisposableLocalDatabaseUrl, sanitizedPsqlEnvironment } from './local-postgres-safety.mjs';
const root=resolve(import.meta.dirname,'../..');
const file=n=>readFileSync(resolve(root,'infra/supabase/supabase/migrations',n+'.sql'),'utf8');
const before='20260318180001_academy_reference_bridge';
const after='20261107010000_academy_reference_reconciliation';
const historic='20260319000000_create_academy_pillars_table';
assert.equal(file(before),file(after),'history repairs must match exactly');
assert.equal(file(before+'.rollback'),file(after+'.rollback'));
const base=requireDisposableLocalDatabaseUrl(process.env.DATABASE_URL);
function sql(url,src) {
  try {
    return execFileSync('psql',['-X','--no-password','-q','-t','-A','-v','ON_ERROR_STOP=1',url],{
      input:src,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:sanitizedPsqlEnvironment(),
    }).trim();
  } catch(e) { throw new Error(String(e.stderr??'psql failed')); }
}
const apply=(url,name)=>sql(url,file(name));
const count=(url,src)=>Number(sql(url,src));
const deny=(fn,pattern)=>assert.throws(fn,pattern);
sql(base.href,[
'DO $r$ BEGIN',
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;",
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;",
"IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;",
'END $r$;',
].join('\n'));
function disposable() {
 const u=new URL(base.href);u.pathname='/valueos_academy_'+randomBytes(8).toString('hex');
 sql(base.href,'CREATE DATABASE '+u.pathname.slice(1)+';');
 return u.href;
}
const MOD='11111111-1111-4111-8111-111111111111';
const LES='22222222-2222-4222-8222-222222222222';
{
 const u=disposable();
 deny(()=>sql(u,'BEGIN;\n'+file(historic)+'\nROLLBACK;'),/relation "public.academy_modules" does not exist/i);
 assert.equal(count(u,"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='academy_pillars';"),0,'failed historical DDL must leave no partial objects');
 apply(u,before);apply(u,historic);apply(u,after);
 assert.equal(count(u,'SELECT count(*) FROM public.academy_pillars;'),10);
 sql(u,"INSERT INTO public.academy_modules(id,pillar,title) VALUES ('"+MOD+"',8,'Advanced module');"+
   "INSERT INTO public.academy_lessons(id,module_id,title) VALUES ('"+LES+"','"+MOD+"','Lesson 8');");
 assert.equal(count(u,'SELECT count(*) FROM public.academy_modules m JOIN public.academy_pillars p ON m.pillar=p.number WHERE m.pillar=8;'),1);
 assert.equal(count(u,"SELECT count(*) FROM public.academy_lessons WHERE module_id='"+MOD+"';"),1);
 assert.equal(count(u,'BEGIN; SET LOCAL ROLE authenticated; SELECT count(*) FROM public.academy_modules; ROLLBACK;'),1);
 assert.equal(count(u,'BEGIN; SET LOCAL ROLE authenticated; SELECT count(*) FROM public.academy_lessons; ROLLBACK;'),1);
 deny(()=>sql(u,"BEGIN;SET LOCAL ROLE authenticated;INSERT INTO public.academy_modules(pillar,title) VALUES(1,'unauthorized');ROLLBACK;"),
   /permission denied|row-level security policy/i);
 deny(()=>sql(u,"INSERT INTO public.academy_modules(pillar,title) VALUES(11,'invalid');"),
   /check constraint|foreign key constraint/i);
 deny(()=>sql(u,"INSERT INTO public.academy_lessons(module_id,title) VALUES('33333333-3333-4333-8333-333333333333','orphan');"),
   /foreign key constraint/i);
 apply(u,after+'.rollback');
 assert.equal(count(u,"SELECT has_table_privilege('service_role','public.academy_modules','INSERT')::int;"),0);
 apply(u,after);
 assert.equal(count(u,"SELECT has_table_privilege('service_role','public.academy_modules','INSERT')::int;"),1);
 assert.equal(count(u,'SELECT count(*) FROM public.academy_modules;'),1);
 assert.equal(count(u,'SELECT count(*) FROM public.academy_lessons;'),1);
 console.log('PASS: original missing-table defect, ten-pillar FK, reference RLS, rollback/reapply');
}
{
 const u=disposable();
 sql(u,"CREATE TYPE public.academy_pillar AS ENUM('1','2','3','4','5','6','7');"+
   "CREATE TABLE public.academy_modules(id uuid PRIMARY KEY,pillar public.academy_pillar NOT NULL,title text NOT NULL);"+
   "INSERT INTO public.academy_modules VALUES('"+MOD+"','7','legacy seventh pillar');");
 deny(()=>apply(u,before),/incompatible type|No implicit enum\/integer migration/i);
 assert.equal(count(u,'SELECT count(*) FROM public.academy_modules;'),1);
 assert.equal(sql(u,"SELECT atttypid::regtype::text FROM pg_attribute WHERE attrelid='public.academy_modules'::regclass AND attname='pillar';"),'academy_pillar');
 assert.equal(count(u,"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='academy_lessons';"),0);
 console.log('PASS: populated enum rejected atomically; original row/schema retained');
}
{
 const u=disposable();
 sql(u,"CREATE TABLE public.academy_modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pillar integer NOT NULL,title text NOT NULL,display_order integer NOT NULL DEFAULT 0);"+
    "INSERT INTO public.academy_modules(id,pillar,title) VALUES('"+MOD+"',7,'compatible seventh pillar');");
 apply(u,before);apply(u,historic);apply(u,after);
 assert.equal(count(u,"SELECT count(*) FROM public.academy_modules WHERE id='"+MOD+"';"),1);
 console.log('PASS: populated numeric history preserves rows');
}
console.log('ACADEMY_REFERENCE_TARGETED_PASSED; live Supabase Auth and deployed enum history remain separate gates');
