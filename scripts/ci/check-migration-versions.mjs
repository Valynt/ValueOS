#!/usr/bin/env node
// Supabase records numeric versions, not filenames. A raw psql loop cannot
// certify deployability when multiple forward files share the same version.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function inventoryMigrationVersions(directory) {
  if (!existsSync(directory)) throw new Error(`Migration directory missing: ${directory}`);
  const files = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql') && !entry.name.endsWith('.rollback.sql'))
    .map(entry => entry.name).sort();
  if (files.length === 0) throw new Error('No active forward migrations found');
  const invalid = files.filter(name => !/^\d{14}_[a-zA-Z0-9_]+\.sql$/.test(name));
  const migrations = files.map(name => ({
    version: name.slice(0, 14), name,
    sha256: createHash('sha256').update(readFileSync(resolve(directory, name))).digest('hex'),
  }));
  const groups = new Map();
  for (const item of migrations) {
    if (!groups.has(item.version)) groups.set(item.version, []);
    groups.get(item.version).push(item.name);
  }
  const collisions = [...groups].filter(([, names]) => names.length > 1)
    .map(([version, names]) => ({ version, names }));
  return { schema_version: 1, forward_count: migrations.length, invalid, collisions, migrations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--inventory')) throw new Error('Usage: check-migration-versions.mjs [--inventory]');
  const directory = resolve(import.meta.dirname, '../../infra/supabase/supabase/migrations');
  const report = inventoryMigrationVersions(directory);
  // Inventory mode is read-only evidence, never a passing validation mode.
  if (args.includes('--inventory')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.forward_count} forward files; ${report.collisions.length} duplicate version groups`);
    for (const group of report.collisions) console.error(`${group.version}: ${group.names.join(', ')}`);
    for (const name of report.invalid) console.error(`Invalid migration filename: ${name}`);
  }
  if (report.collisions.length || report.invalid.length) process.exitCode = 1;
}
