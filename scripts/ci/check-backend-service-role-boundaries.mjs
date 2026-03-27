#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const requestHandlerPrefixes = [
  'packages/backend/src/api/',
  'packages/backend/src/middleware/',
  'packages/backend/src/routes/',
];

const requestHandlerEmergencyExceptions = [
  {
    filePath: 'packages/backend/src/api/auth.ts',
    expiresOn: '2026-06-30',
    reason: 'Auth provisioning bootstrap still executes service-role path inline during migration to dedicated auth service.',
  },
  {
    filePath: 'packages/backend/src/api/customer/benchmarks.ts',
    expiresOn: '2026-05-31',
    reason: 'Customer benchmark endpoint still uses service-role reads pending tenant-safe aggregation service extraction.',
  },
  {
    filePath: 'packages/backend/src/api/customer/metrics.ts',
    expiresOn: '2026-05-31',
    reason: 'Customer metrics endpoint still uses service-role reads pending tenant-safe aggregation service extraction.',
  },
  {
    filePath: 'packages/backend/src/api/health/index.ts',
    expiresOn: '2026-05-15',
    reason: 'Health diagnostics still require privileged auth check until delegated health probe service is completed.',
  },
  {
    filePath: 'packages/backend/src/middleware/auth.ts',
    expiresOn: '2026-05-15',
    reason: 'Auth middleware fallback path still invokes service-role verification while token-path hardening lands.',
  },
  {
    filePath: 'packages/backend/src/api/services/ReferralService.ts',
    expiresOn: '2026-05-15',
    reason: 'Referral write path still relies on privileged mutations pending extraction into queued worker module.',
  },
  {
    filePath: 'packages/backend/src/api/services/ReferralAnalyticsService.ts',
    expiresOn: '2026-05-15',
    reason: 'Referral analytics backfill path still performs privileged reads pending migration to analytics job worker.',
  },
];

const requestHandlerEmergencyExceptionMap = new Map(
  requestHandlerEmergencyExceptions.map((exception) => [exception.filePath, exception])
);

const privilegedFactoryCalls = [
  'createAuthProvisioningSupabaseClient',
  'createCronSupabaseClient',
  'createPlatformAdminSupabaseClient',
];

const forbiddenRequestHandlerSymbols = [
  'createServiceRoleSupabaseClient',
  'createServerSupabaseClient',
  'getSupabaseClient',
  'supabase',
];

function listBackendSourceFiles(repoRoot) {
  const out = execFileSync('rg', ['--files', 'packages/backend/src', '-g', '*.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isNonTestTs(filePath) {
  return !filePath.includes('__tests__') && !filePath.endsWith('.test.ts') && !filePath.endsWith('.spec.ts');
}

function isRequestHandlingFile(filePath) {
  return requestHandlerPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function parseExceptionExpiration(exception) {
  const expiresAt = new Date(`${exception.expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiresAt.getTime())) {
    return { isValid: false, expiresAt: null };
  }

  return { isValid: true, expiresAt };
}

function findDirectServiceRoleUsageInRequestHandler(source) {
  if (source.includes('/lib/supabase/privileged')) return true;

  const staticImportRegex = /import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"]/g;
  for (const match of source.matchAll(staticImportRegex)) {
    const importedSymbols = match[1];
    const modulePath = match[2];
    if (!modulePath.includes('supabase')) continue;

    const importedNames = importedSymbols
      .split(',')
      .map((symbol) => symbol.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);

    if (importedNames.some((name) => forbiddenRequestHandlerSymbols.includes(name))) {
      return true;
    }
  }

  const dynamicImportRegex = /await\s+import\((['\"])([^'\"]+)\1\)/g;
  for (const match of source.matchAll(dynamicImportRegex)) {
    const modulePath = match[2];
    if (!modulePath.includes('supabase')) continue;

    const destructureFromDynamicImport = new RegExp(
      `const\\s+\\{[^}]*\\b(${forbiddenRequestHandlerSymbols.join('|')})\\b[^}]*\\}\\s*=\\s*await\\s+import\\((['\\"])${modulePath}\\2\\)`
    );
    if (destructureFromDynamicImport.test(source)) {
      return true;
    }
  }

  return false;
}

export function analyzeServiceRoleBoundaries({ repoRoot = process.cwd(), now = new Date() } = {}) {
  const allFiles = listBackendSourceFiles(repoRoot).filter(isNonTestTs);
  const violations = [];

  for (const exception of requestHandlerEmergencyExceptions) {
    const { isValid, expiresAt } = parseExceptionExpiration(exception);
    if (!isValid) {
      violations.push(
        `${exception.filePath}: emergency exception has invalid expiresOn date "${exception.expiresOn}" (expected YYYY-MM-DD).`
      );
      continue;
    }

    if (now.getTime() > expiresAt.getTime()) {
      violations.push(
        `${exception.filePath}: emergency exception expired on ${exception.expiresOn}; remove direct service-role usage or renew with documented incident justification.`
      );
      continue;
    }

    if (!fs.existsSync(path.join(repoRoot, exception.filePath))) {
      violations.push(`${exception.filePath}: emergency exception path does not exist.`);
    }
  }

  for (const filePath of allFiles.filter(isRequestHandlingFile)) {
    const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');

    const hasDirectServiceRoleUsage = findDirectServiceRoleUsageInRequestHandler(source);
    if (!hasDirectServiceRoleUsage) continue;

    const exception = requestHandlerEmergencyExceptionMap.get(filePath);
    if (!exception) {
      violations.push(
        `${filePath}: request-handling module directly uses service-role Supabase access. Use request-scoped RLS clients and delegate privileged work to allowlisted service/job modules.`
      );
    }
  }

  for (const filePath of allFiles) {
    if (filePath.startsWith('packages/backend/src/lib/supabase/privileged/')) continue;

    const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');

    for (const factory of privilegedFactoryCalls) {
      const callRegex = new RegExp(`${factory}\\(\\s*\\{[\\s\\S]{0,260}?justification\\s*:\\s*['\"]service-role:justified\\s+[^'\"]+['\"]`, 'm');
      if (!source.includes(`${factory}(`)) continue;
      if (!callRegex.test(source)) {
        violations.push(`${filePath}: ${factory}(...) requires justification: "service-role:justified <reason>".`);
      }
    }
  }

  return {
    violations,
    checkedFiles: allFiles.length,
    activeEmergencyExceptions: requestHandlerEmergencyExceptions,
  };
}

function runCli() {
  const { violations } = analyzeServiceRoleBoundaries({ repoRoot: process.cwd(), now: new Date() });

  if (violations.length > 0) {
    console.error('❌ Service-role boundary guard failed:');
    violations.forEach((violation) => console.error(` - ${violation}`));
    process.exit(1);
  }

  console.log('✅ Service-role boundary guard passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
