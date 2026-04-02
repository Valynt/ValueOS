#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const getArg = (flag, fallback = '') => {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const outMd = getArg('--out-md', 'artifacts/ci-lanes/suite-execution-modes.md');
const outJson = getArg('--out-json', 'artifacts/ci-lanes/suite-execution-modes.json');
const lane = getArg('--lane', 'unknown');

const truthy = (value) => String(value || '').toLowerCase() === 'true';
const hasEnv = (...keys) => keys.some((key) => Boolean(process.env[key]));

const hasSupabaseUrl = hasEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
const hasSupabaseServiceKey = hasEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
const realIntegrationFlag = truthy(process.env.VALUEOS_TEST_REAL_INTEGRATION);
const trustedContext = truthy(process.env.VALUEOS_TRUSTED_CONTEXT);

const rlsTenantMode = hasSupabaseUrl && hasSupabaseServiceKey
  ? 'real_supabase'
  : 'fail_fast_missing_real_infra';

const billingRlsMode = realIntegrationFlag && hasSupabaseUrl && hasSupabaseServiceKey
  ? 'real_supabase'
  : (trustedContext ? 'fail_fast_missing_real_infra' : 'intentionally_conditional_skip');

const dbHelpersMode = realIntegrationFlag && hasSupabaseUrl && hasSupabaseServiceKey
  ? 'real_supabase'
  : 'deterministic_in_memory_fallback';

const suites = [
  {
    file: 'tests/security/rls-tenant-isolation.test.ts',
    classification: 'fail-fast on missing real infra',
    execution_mode: rlsTenantMode,
  },
  {
    file: 'packages/backend/src/services/billing/__tests__/security/rls-policies.test.ts',
    classification: 'fail-fast on missing real infra',
    execution_mode: billingRlsMode,
  },
  {
    file: 'packages/backend/src/services/billing/__tests__/__helpers__/db-helpers.ts',
    classification: 'deterministic in-memory fallback',
    execution_mode: dbHelpersMode,
  },
];

const markdown = [
  '# Suite Execution Modes',
  '',
  `- lane: ${lane}`,
  `- trusted_context: ${trustedContext}`,
  `- real_integration_flag: ${realIntegrationFlag}`,
  `- supabase_url_present: ${hasSupabaseUrl}`,
  `- supabase_service_key_present: ${hasSupabaseServiceKey}`,
  '',
  '| Suite | Classification | Observed execution mode |',
  '| --- | --- | --- |',
  ...suites.map((suite) => `| \`${suite.file}\` | ${suite.classification} | ${suite.execution_mode} |`),
  '',
  'Execution mode legend:',
  '- `real_supabase`: runs against a real Supabase endpoint.',
  '- `deterministic_in_memory_fallback`: runs against deterministic in-memory test double.',
  '- `fail_fast_missing_real_infra`: suite intentionally errors when required real infra is absent.',
  '- `intentionally_conditional_skip`: lane intentionally does not execute this suite in current context.',
  '',
].join('\n');

const payload = {
  lane,
  trusted_context: trustedContext,
  real_integration_flag: realIntegrationFlag,
  supabase_url_present: hasSupabaseUrl,
  supabase_service_key_present: hasSupabaseServiceKey,
  suites,
};

mkdirSync(dirname(outMd), { recursive: true });
mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outMd, markdown, 'utf8');
writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Wrote suite execution mode report to ${outMd} and ${outJson}`);
