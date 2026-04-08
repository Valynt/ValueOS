#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const diffBase = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}...HEAD` : 'HEAD~1...HEAD';

function listChangedServiceFiles() {
  const output = execSync(`git diff --name-only --diff-filter=ACMR ${diffBase}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return output
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.startsWith('packages/backend/src/services/'))
    .filter((entry) => entry.endsWith('.ts'))
    .filter((entry) => !entry.includes('/__tests__/'));
}

function getLineNumber(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

function hasTenantFilter(queryBlock) {
  const tenantEq = /\.eq\(\s*['"](?:organization_id|tenant_id)['"]/;
  const tenantMatch = /\.match\(\s*\{[^}]*\b(?:organization_id|tenant_id)\b/s;
  const tenantContains = /\.contains\(\s*['"](?:organization_id|tenant_id)['"]/;
  const insertTenant = /\.insert\([\s\S]*\b(?:organization_id|tenant_id)\b/s;
  const upsertTenant = /\.upsert\([\s\S]*\b(?:organization_id|tenant_id)\b/s;

  return (
    tenantEq.test(queryBlock) ||
    tenantMatch.test(queryBlock) ||
    tenantContains.test(queryBlock) ||
    insertTenant.test(queryBlock) ||
    upsertTenant.test(queryBlock)
  );
}

function scanFile(filePath) {
  const absolute = path.resolve(root, filePath);
  const content = readFileSync(absolute, 'utf8');
  const findings = [];

  const queryRegex = /\.from\(\s*['"`][^'"`]+['"`]\s*\)[\s\S]{0,600}?;/g;

  for (const match of content.matchAll(queryRegex)) {
    const queryBlock = match[0];
    const start = match.index ?? 0;
    const line = getLineNumber(content, start);

    const precedingWindow = content.slice(Math.max(0, start - 220), start);
    if (precedingWindow.includes('tenant-filter-guard: ignore-next-query')) {
      continue;
    }

    const isReadOrWriteQuery =
      queryBlock.includes('.select(') ||
      queryBlock.includes('.update(') ||
      queryBlock.includes('.delete(') ||
      queryBlock.includes('.insert(') ||
      queryBlock.includes('.upsert(');

    if (!isReadOrWriteQuery) {
      continue;
    }

    if (!hasTenantFilter(queryBlock)) {
      findings.push({
        file: filePath,
        line,
        message:
          'Supabase query chain in backend service is missing tenant filter. Add organization_id/tenant_id constraint or annotate with tenant-filter-guard: ignore-next-query and justification.',
      });
    }
  }

  return findings;
}

let files = [];
try {
  files = listChangedServiceFiles();
} catch {
  console.log(`✅ tenant query filter guard skipped (no comparable diff base: ${diffBase})`);
  process.exit(0);
}

if (files.length === 0) {
  console.log('✅ tenant query filter guard passed (no backend service files changed)');
  process.exit(0);
}

const findings = files.flatMap(scanFile);

if (findings.length > 0) {
  console.error('❌ Backend service tenant query filter guard failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  }
  process.exit(1);
}

console.log(`✅ tenant query filter guard passed (${files.length} changed backend service file(s) scanned)`);
