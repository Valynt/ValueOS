#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const defaultManifest = path.join(repoRoot, 'infra/supabase/performance-indexes.manifest.json');
const defaultMigrationsDir = path.join(repoRoot, 'infra/supabase/supabase/migrations');

function parseArgs(argv) {
  const args = {
    manifest: defaultManifest,
    migrationsDir: defaultMigrationsDir,
    databaseUrl: process.env.DATABASE_URL || '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--migrations-dir') args.migrationsDir = argv[++i];
    else if (arg === '--database-url') args.databaseUrl = argv[++i];
    else if (arg === '--help') {
      console.log('Usage: node scripts/ci/check-db-performance-indexes.mjs [--manifest path] [--migrations-dir path] [--database-url postgres://...]');
      process.exit(0);
    }
  }

  return args;
}

function loadManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function loadMigrationSql(migrationsDir) {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.rollback.sql'))
    .sort();

  return files
    .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n');
}

function verifyManifestInMigrations(manifest, migrationSql) {
  const missing = [];

  for (const index of manifest.indexes) {
    const pattern = new RegExp(
      String.raw`CREATE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+${index.name}\b`,
      'i',
    );
    if (!pattern.test(migrationSql)) {
      missing.push(index.name);
    }
  }

  return missing;
}

function verifyDatabaseIndexes(manifest, databaseUrl) {
  const names = manifest.indexes
    .map((index) => `'${index.name.replace(/'/g, "''")}'`)
    .join(', ');
  const sql = `SELECT indexname FROM pg_indexes WHERE schemaname = '${manifest.schema}' AND indexname IN (${names}) ORDER BY indexname;`;
  const output = execFileSync(
    'psql',
    ['--dbname', databaseUrl, '--tuples-only', '--no-align', '--command', sql],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const found = new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

  return manifest.indexes
    .filter((index) => !found.has(index.name))
    .map((index) => index.name);
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = loadManifest(args.manifest);
  const migrationSql = loadMigrationSql(args.migrationsDir);

  const missingInMigrations = verifyManifestInMigrations(manifest, migrationSql);
  if (missingInMigrations.length > 0) {
    console.error('Missing required performance indexes from active migrations:');
    for (const name of missingInMigrations) console.error(`  - ${name}`);
    process.exit(1);
  }

  console.log(`Migration manifest check passed for ${manifest.indexes.length} required performance indexes.`);

  if (!args.databaseUrl) {
    console.log('No DATABASE_URL provided; skipped live schema verification.');
    return;
  }

  const missingInDatabase = verifyDatabaseIndexes(manifest, args.databaseUrl);
  if (missingInDatabase.length > 0) {
    console.error('Missing required performance indexes from target database schema:');
    for (const name of missingInDatabase) console.error(`  - ${name}`);
    process.exit(1);
  }

  console.log(`Database schema check passed for ${manifest.indexes.length} required performance indexes.`);
}

main();
