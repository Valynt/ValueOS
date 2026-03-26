#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
const labels = (process.env.PR_LABELS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
if (!base || !head) {
  console.log('BASE_SHA/HEAD_SHA not set; skipping security signoff gate.');
  process.exit(0);
}

const diff = execSync(`git diff --unified=0 ${base}..${head} -- packages/backend/src/api/**/*.ts`, { encoding: 'utf8' });
const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
const routeAdds = added.filter((line) => /\b(router|[A-Za-z0-9_]+Router)\.(get|post|put|patch|delete)\(/.test(line));
const unprotected = routeAdds.filter((line) => !/requireAuth|tenantContextMiddleware|tenantDbContextMiddleware/.test(line));

if (unprotected.length === 0) {
  console.log('No newly added unprotected routes detected.');
  process.exit(0);
}

if (!labels.includes('security-signoff')) {
  console.error('Unprotected route additions detected; missing required "security-signoff" label.');
  for (const line of unprotected.slice(0, 20)) console.error(`  ${line}`);
  process.exit(1);
}

console.log('Unprotected route additions found, and security-signoff label is present.');
