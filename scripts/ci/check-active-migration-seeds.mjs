#!/usr/bin/env node
// Fail closed on Auth provisioning and demo credentials in active migrations.
// Retain SQL strings and identifiers while removing whitespace-like comments.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stripSqlComments(sql) {
  let output = '';
  let state = 'code';
  let delimiter = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (state === 'line-comment') {
      if (c === '\n') { output += '\n'; state = 'code'; }
      else output += ' ';
    } else if (state === 'block-comment') {
      if (c === '*' && n === '/') { output += '  '; i++; state = 'code'; }
      else output += c === '\n' ? '\n' : ' ';
    } else if (state === 'single') {
      output += c;
      if (c === "'" && n === "'") { output += n; i++; }
      else if (c === "'") state = 'code';
    } else if (state === 'double') {
      output += c;
      if (c === '"' && n === '"') { output += n; i++; }
      else if (c === '"') state = 'code';
    } else if (state === 'dollar') {
      if (sql.startsWith(delimiter, i)) {
        output += delimiter;
        i += delimiter.length - 1;
        state = 'code';
      } else output += c;
    } else if (c === '-' && n === '-') {
      output += '  '; i++; state = 'line-comment';
    } else if (c === '/' && n === '*') {
      output += '  '; i++; state = 'block-comment';
    } else if (c === "'") {
      output += c; state = 'single';
    } else if (c === '"') {
      output += c; state = 'double';
    } else if (c === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        delimiter = match[0];
        output += delimiter;
        i += delimiter.length - 1;
        state = 'dollar';
      } else output += c;
    } else output += c;
  }
  return output;
}

export function findForbiddenMigrationRules(filename, sql) {
  const normalized = stripSqlComments(sql);
  const rules = [];
  if (/(?:^|[_-])seed(?:[_-]|\.)/i.test(filename)) {
    rules.push('seed-named migration');
  }
  const authEntity = '(?:"auth"|auth)\\s*\\.\\s*(?:"(?:users|identities)"|(?:users|identities))';
  const insertion = new RegExp('\\bINSERT\\s+INTO\\s+(?:ONLY\\s+)?' + authEntity + '(?![\\w])', 'i');
  const copy = new RegExp('\\bCOPY\\s+' + authEntity + '(?![\\w])', 'i');
  if (insertion.test(normalized) || copy.test(normalized)) {
    rules.push('direct Auth user/identity provisioning');
  }
  if (/\bpassword123\b|\bdev@valueos\.local\b/i.test(normalized)) {
    rules.push('hardcoded demo credential');
  }
  return rules;
}

function main() {
  const root = resolve(import.meta.dirname, '../..');
  const migrationsDir = resolve(root, 'infra/supabase/supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.rollback.sql'))
    .sort();
  if (files.length === 0) {
    console.error('FAIL: active migration inventory is empty');
    process.exit(1);
  }
  let violations = 0;
  for (const filename of files) {
    const sql = readFileSync(resolve(migrationsDir, filename), 'utf8');
    for (const rule of findForbiddenMigrationRules(filename, sql)) {
      console.error('FAIL: ' + filename + ': ' + rule);
      violations++;
    }
  }
  if (violations > 0) process.exit(1);
  console.log('PASS: ' + files.length + ' active schema migrations contain no demo credentials');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
