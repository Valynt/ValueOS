#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const sourceFile = 'docs/engineering/adr-index.md';
const sourcePath = path.resolve(repoRoot, sourceFile);

const markdown = await readFile(sourcePath, 'utf8');
const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

const missing = [];
const checked = [];

for (const match of markdown.matchAll(linkRegex)) {
  const rawTarget = match[1].trim();

  if (!rawTarget || rawTarget.startsWith('#') || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawTarget)) {
    continue;
  }

  const target = rawTarget.replace(/^<|>$/g, '').split('#')[0].split('?')[0];
  if (!target) {
    continue;
  }

  const resolved = path.resolve(path.dirname(sourcePath), target);
  const relativeResolved = path.relative(repoRoot, resolved);
  checked.push({ link: rawTarget, resolved: relativeResolved });

  if (!existsSync(resolved)) {
    missing.push({ link: rawTarget, resolved: relativeResolved });
  }
}

if (missing.length > 0) {
  console.error(`❌ Docs integrity check failed for ${sourceFile}.`);
  for (const item of missing) {
    console.error(` - Missing target for link \`${item.link}\` -> \`${item.resolved}\``);
  }
  process.exit(1);
}

console.log(`✅ Docs integrity check passed for ${sourceFile}.`);
console.log(`Checked ${checked.length} markdown link target(s).`);
