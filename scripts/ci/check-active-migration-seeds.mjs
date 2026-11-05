#!/usr/bin/env node
// Fail closed if development-user credential fixtures enter active migrations.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const migrationsDir = resolve(root, 'infra/supabase/supabase/migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && !f.endsWith('.rollback.sql')).sort();
if (files.length === 0) {
  console.error('FAIL: active migration inventory is empty');
  process.exit(1);
}
const forbidden = [
  { name: 'seed-named migration', test: (filename) => /(?:^|[_-])seed(?:[_-]|\.)/i.test(filename) },
  { name: 'Auth user insertion', test: (_, sql) => /\bINSERT\s+INTO\s+auth\.users\b/i.test(sql) },
  { name: 'Auth identity insertion', test: (_, sql) => /\bINSERT\s+INTO\s+auth\.identities\b/i.test(sql) },
  { name: 'hardcoded demo password', test: (_, sql) => /\bpassword123\b|\bdev@valueos\.local\b/i.test(sql) },
];
let findings = 0;
for (const filename of files) {
  const sql = readFileSync(resolve(migrationsDir, filename), 'utf8');
  for (const rule of forbidden) {
    if (rule.test(filename, sql)) {
      console.error(`FAIL: ${filename}: ${rule.name} is forbidden in production migrations`);
      findings++;
    }
  }
}
if (findings) process.exit(1);
console.log(`PASS: ${files.length} active migrations contain no development seed credentials`);
