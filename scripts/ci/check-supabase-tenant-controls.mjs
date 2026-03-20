#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
import { readdirSync } from 'node:fs';

const MIGRATIONS_DIR = 'infra/supabase/supabase/migrations';

function listMigrationFiles() {
  const dirPath = resolve(ROOT, MIGRATIONS_DIR);
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.sql'))
      .map((e) => `${MIGRATIONS_DIR}/${e.name}`)
      .sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function lineNumberForOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

const files = listMigrationFiles();
const findings = [];
const allContent = files.map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n\n');

for (const file of files) {
  const content = readFileSync(resolve(ROOT, file), 'utf8');
  const isLegacyBaseline = /baseline_schema/i.test(file);
  const isSnapshotBaseline = /baseline_restructured/i.test(file);

  if (!isLegacyBaseline && !isSnapshotBaseline) {
    const tableBlocks = [...content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?public\.([a-zA-Z0-9_]+)\s*\(([^;]*?)\);/gims)];
    for (const block of tableBlocks) {
      const [, tableName, columns] = block;
      const hasTenantColumn = /\btenant_id\b|\borganization_id\b/i.test(columns);
      if (!hasTenantColumn) continue;

      const hasRlsEnabled = new RegExp(`ALTER TABLE(?: IF EXISTS)?\\s+public\\.${tableName}\\s+ENABLE ROW LEVEL SECURITY`, 'i').test(allContent);
      const hasTenantPolicy = new RegExp(`CREATE POLICY[\\s\\S]*?ON\\s+public\\.${tableName}[\\s\\S]*?TO\\s+authenticated`, 'i').test(allContent);
      const hasServiceRolePolicy = new RegExp(`CREATE POLICY[\\s\\S]*?ON\\s+public\\.${tableName}[\\s\\S]*?TO\\s+service_role`, 'i').test(allContent);

      if (!hasRlsEnabled || !hasTenantPolicy || !hasServiceRolePolicy) {
        findings.push({
          file,
          line: lineNumberForOffset(content, block.index ?? 0),
          rule: 'tenant-table-rls-coverage',
          message: `Table public.${tableName} must have RLS enabled plus authenticated and service_role policies across active migrations.`,
        });
      }
    }
  }

  if (!isLegacyBaseline) {
    for (const match of content.matchAll(/\b(credentials\s+jsonb)\b/gi)) {
      findings.push({
        file,
        line: lineNumberForOffset(content, match.index ?? 0),
        rule: 'plaintext-credential-column',
        message: `Potential plaintext credential column detected (${match[1]}). Use encrypted storage fields and avoid raw credential columns.`,
      });
    }
  }

  if (!isLegacyBaseline) {
    for (const match of content.matchAll(/\b(tenant_id|organization_id)\s*=\s*\(auth\.jwt\(\)\s*->>\s*'(tenant_id|organization_id)'\)::uuid/gi)) {
      findings.push({
        file,
        line: lineNumberForOffset(content, match.index ?? 0),
        rule: 'jwt-claim-only-tenant-isolation',
        message: 'JWT-claim-only tenant predicate detected. Use membership-aware helper predicates and explicit service_role exception policy.',
      });
    }
  }
}

if (findings.length > 0) {
  console.error('❌ Supabase tenant controls check failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}

console.log('✅ Supabase tenant controls check passed');
