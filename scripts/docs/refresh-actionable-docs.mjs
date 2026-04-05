#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const utcToday = new Date().toISOString().slice(0, 10);
const staleDays = Number.parseInt(process.env.ACTIONABLE_DOC_STALE_DAYS ?? '30', 10);
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = (modeArg?.split('=')[1] ?? 'refresh').trim();

if (!['refresh', 'archive-stale'].includes(mode)) {
  console.error(`Unsupported mode: ${mode}. Use --mode=refresh or --mode=archive-stale.`);
  process.exit(1);
}

const STALE_DOC_BANNER = [
  '<!-- stale-doc-banner:start -->',
  '> ⚠️ **Stale document:** This actionable document is older than the freshness threshold and is now **archived**.',
  '> Regenerate metadata with `node scripts/docs/refresh-actionable-docs.mjs --mode=refresh` after validating it against current code signals.',
  '<!-- stale-doc-banner:end -->',
].join('\n');

const FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function toIsoDate(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  if (DATE_TIME_PATTERN.test(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }

  return null;
}

function collectMarkdownFiles(directory) {
  const absoluteDirectory = path.resolve(repoRoot, directory);
  const files = [];

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(path.relative(repoRoot, absoluteEntry)));
      continue;
    }

    const relativeEntry = path.relative(repoRoot, absoluteEntry);
    if (relativeEntry.endsWith('.md')) {
      files.push(relativeEntry);
    }
  }

  return files.sort();
}

function isActionableDoc(filePath) {
  if (filePath === 'docs/spec-backlog.md') {
    return true;
  }

  if (/^docs\/(?:specs\/)?sprint-plan-[^/]+\.md$/i.test(filePath)) {
    return true;
  }

  return /(^docs\/|\/)[^/]*readiness[^/]*\.md$/i.test(filePath);
}

function getOwner(filePath) {
  if (filePath.startsWith('docs/operations/')) {
    return 'team-operations';
  }

  if (filePath.startsWith('docs/release/')) {
    return 'team-release';
  }

  return 'team-platform';
}

function parseFrontMatter(markdown) {
  const match = markdown.match(FRONT_MATTER_REGEX);
  if (!match) {
    return { fields: new Map(), body: markdown, hadFrontMatter: false };
  }

  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.+)\s*$/);
    if (m) {
      fields.set(m[1], m[2].replace(/^['"]|['"]$/g, ''));
    }
  }

  return {
    fields,
    body: markdown.slice(match[0].length),
    hadFrontMatter: true,
  };
}

function serializeFrontMatter(fields) {
  const orderedKeys = ['title', 'owner', 'generated_at', 'source_commit', 'status', 'review_date'];
  const seen = new Set();
  const lines = [];

  for (const key of orderedKeys) {
    if (fields.has(key)) {
      lines.push(`${key}: ${fields.get(key)}`);
      seen.add(key);
    }
  }

  for (const [key, value] of fields.entries()) {
    if (!seen.has(key)) {
      lines.push(`${key}: ${value}`);
    }
  }

  return `---\n${lines.join('\n')}\n---\n`;
}

function stripStaleBanner(body) {
  return body
    .replace(/\n?<!-- stale-doc-banner:start -->[\s\S]*?<!-- stale-doc-banner:end -->\n?/g, '\n')
    .replace(/^\s*\n/, '');
}

function addBanner(body) {
  const cleanBody = stripStaleBanner(body);
  return `${STALE_DOC_BANNER}\n\n${cleanBody}`;
}

function ageInDays(isoDate) {
  const start = new Date(`${isoDate}T00:00:00.000Z`);
  const end = new Date(`${utcToday}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function getSourceCommit() {
  return execSync('git rev-parse --short=12 HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

const sourceCommit = getSourceCommit();
const actionableDocs = collectMarkdownFiles('docs').filter((file) => isActionableDoc(file));
let updated = 0;

for (const file of actionableDocs) {
  const absolutePath = path.resolve(repoRoot, file);
  const original = readFileSync(absolutePath, 'utf8');
  const { fields, body } = parseFrontMatter(original);

  fields.set('owner', fields.get('owner') || getOwner(file));
  fields.set('source_commit', sourceCommit);

  let nextBody = body;
  if (mode === 'refresh') {
    fields.set('generated_at', utcToday);
    fields.set('status', 'active');
    nextBody = stripStaleBanner(nextBody);
  } else {
    const generatedAt = toIsoDate(fields.get('generated_at'));
    if (!generatedAt) {
      fields.set('generated_at', utcToday);
      fields.set('status', 'active');
      nextBody = stripStaleBanner(nextBody);
    } else {
      const stale = ageInDays(generatedAt) > staleDays;
      if (stale) {
        fields.set('status', 'archived');
        nextBody = addBanner(nextBody);
      } else {
        fields.set('status', fields.get('status') || 'active');
        nextBody = stripStaleBanner(nextBody);
      }
    }
  }

  const nextContent = `${serializeFrontMatter(fields)}\n${nextBody.replace(/^\n+/, '')}`;
  if (nextContent !== original) {
    writeFileSync(absolutePath, nextContent, 'utf8');
    updated += 1;
    console.log(`updated: ${file}`);
  }
}

console.log(`Done. mode=${mode}, actionable_docs=${actionableDocs.length}, updated=${updated}, stale_days=${staleDays}`);
