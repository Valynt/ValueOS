#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const requestPrefixes = [
  'packages/backend/src/api/',
  'packages/backend/src/middleware/',
  'packages/backend/src/routes/',
];

const requestImportAllowlist = new Set([
  'packages/backend/src/api/auth.ts',
  'packages/backend/src/api/services/ReferralService.ts',
  'packages/backend/src/api/services/ReferralAnalyticsService.ts',
  'packages/backend/src/api/customer/benchmarks.ts',
  'packages/backend/src/api/customer/metrics.ts',
  'packages/backend/src/api/billing/overrides.ts',
  'packages/backend/src/api/billing/usage.ts',
  'packages/backend/src/api/billing/execution-control.ts',
  'packages/backend/src/api/academy/utils.ts',
  'packages/backend/src/api/academy/routers/quiz.router.ts',
  'packages/backend/src/api/academy/routers/resources.router.ts',
  'packages/backend/src/api/academy/routers/pillars.router.ts',
  'packages/backend/src/api/academy/routers/maturity.router.ts',
  'packages/backend/src/api/academy/routers/progress.router.ts',
  'packages/backend/src/api/academy/routers/simulations.router.ts',
  'packages/backend/src/api/academy/routers/analytics.router.ts',
  'packages/backend/src/api/academy/routers/user.router.ts',
  'packages/backend/src/api/academy/routers/certifications.router.ts',
  'packages/backend/src/api/tenant.ts',
  'packages/backend/src/api/health/index.ts',
  'packages/backend/src/middleware/usageTrackingMiddleware.ts',
  'packages/backend/src/middleware/usageEnforcement.ts',
  'packages/backend/src/middleware/billingAccessEnforcement.ts',
  'packages/backend/src/middleware/auth.ts',
]);

const privilegedFactoryCalls = [
  'createAuthProvisioningSupabaseClient',
  'createCronSupabaseClient',
  'createPlatformAdminSupabaseClient',
];

function listBackendSourceFiles() {
  const out = execFileSync('rg', ['--files', 'packages/backend/src', '-g', '*.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isNonTestTs(filePath) {
  return !filePath.includes('__tests__') && !filePath.endsWith('.test.ts') && !filePath.endsWith('.spec.ts');
}

const allFiles = listBackendSourceFiles().filter(isNonTestTs);
const violations = [];

for (const filePath of allFiles.filter((file) => requestPrefixes.some((prefix) => file.startsWith(prefix)))) {
  if (requestImportAllowlist.has(filePath)) continue;

  const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');

  const hasServiceRoleImport =
    source.includes('/lib/supabase/privileged') ||
    source.includes('createServiceRoleSupabaseClient') ||
    source.includes('createServerSupabaseClient') ||
    source.includes('getSupabaseClient') ||
    source.match(/\bimport\s+\{[^}]*\bsupabase\b[^}]*\}\s+from\s+['"][^'"]*lib\/supabase/);

  if (hasServiceRoleImport) {
    violations.push(`${filePath}: request-handling module imports service-role access but is not allowlisted.`);
  }
}

for (const filePath of allFiles) {
  if (filePath.startsWith('packages/backend/src/lib/supabase/privileged/')) continue;

  const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');

  for (const factory of privilegedFactoryCalls) {
    const callRegex = new RegExp(`${factory}\\(\\s*\\{[\\s\\S]{0,260}?justification\\s*:\\s*['\"]service-role:justified\\s+[^'\"]+['\"]`, 'm');
    if (!source.includes(`${factory}(`)) continue;
    if (!callRegex.test(source)) {
      violations.push(`${filePath}: ${factory}(...) requires justification: \"service-role:justified <reason>\".`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Service-role boundary guard failed:');
  violations.forEach((violation) => console.error(` - ${violation}`));
  process.exit(1);
}

console.log('✅ Service-role boundary guard passed.');
