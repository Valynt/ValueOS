#!/usr/bin/env node
// Fail closed on Auth provisioning and demo credentials in active migrations.
// Retain SQL strings and identifiers while removing whitespace-like comments.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stripSqlComments(sql) {
  let output = '';
  let state = 'code';
  let blockDepth = 0;
  let escapeString = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (state === 'line-comment') {
      if (c === '\n') { output += '\n'; state = 'code'; }
      else output += ' ';
    } else if (state === 'block-comment') {
      if (c === '/' && n === '*') {
        output += '  '; i++; blockDepth++;
      } else if (c === '*' && n === '/') {
        output += '  '; i++;
        if (--blockDepth === 0) state = 'code';
      } else output += c === '\n' ? '\n' : ' ';
    } else if (state === 'single') {
      output += c;
      // PostgreSQL E'...' and U&'...' backslash escapes must not close
      // the string before a real subsequent SQL statement.
      if (escapeString && c === '\\' && n !== undefined) {
        output += n; i++;
      } else if (c === "'" && n === "'") {
        output += n; i++;
      } else if (c === "'") state = 'code';
    } else if (state === 'double') {
      output += c;
      if (c === '"' && n === '"') { output += n; i++; }
      else if (c === '"') state = 'code';
    } else if (c === '-' && n === '-') {
      output += '  '; i++; state = 'line-comment';
    } else if (c === '/' && n === '*') {
      output += '  '; i++; blockDepth = 1; state = 'block-comment';
    } else if (c === "'") {
      escapeString = ((/[Ee]/.test(sql[i - 1] ?? '') &&
        (i < 2 || !/[a-zA-Z_0-9]/.test(sql[i - 2]))) ||
        (sql.slice(i - 2, i).toUpperCase() === 'U&'));
      output += c; state = 'single';
    } else if (c === '"') {
      output += c; state = 'double';
    } else if (c === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (!match) { output += c; continue; }
      const tag = match[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) {
        // Leave malformed SQL unsuppressed; PostgreSQL will reject it.
        output += sql.slice(i);
        break;
      }
      // A DO/function dollar-quoted body contains executable SQL.
      // Strip its own comments instead of blindly preserving them.
      const body = sql.slice(i + tag.length, end);
      output += tag + stripSqlComments(body) + tag;
      i = end + tag.length - 1;
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
