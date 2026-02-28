#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

function normalizeLocalLink(rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, '');
  if (!target || target.startsWith('#') || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target)) {
    return null;
  }

  const withoutFragment = target.split('#')[0].split('?')[0];
  return withoutFragment || null;
}

function checkMarkdownLinks(sourceFile) {
  const sourcePath = path.resolve(repoRoot, sourceFile);
  const markdown = readFileSync(sourcePath, 'utf8');
  const checked = [];
  const missing = [];

  for (const match of markdown.matchAll(markdownLinkRegex)) {
    const rawTarget = match[1];
    const target = normalizeLocalLink(rawTarget);
    if (!target) {
      continue;
    }

    const resolved = path.resolve(path.dirname(sourcePath), target);
    const relativeResolved = path.relative(repoRoot, resolved);

    checked.push({ sourceFile, link: rawTarget, resolved: relativeResolved });

    if (!existsSync(resolved)) {
      missing.push({ sourceFile, link: rawTarget, resolved: relativeResolved });
    }
  }

  return { checked, missing };
}

function getDirectoryMarkdownFiles(directory) {
  const absoluteDir = path.resolve(repoRoot, directory);
  return readdirSync(absoluteDir)
    .filter((entry) => entry.endsWith('.md'))
    .filter((entry) => entry !== 'README.md')
    .map((entry) => path.join(directory, entry))
    .filter((relativePath) => statSync(path.resolve(repoRoot, relativePath)).isFile())
    .sort();
}

function parseCategoryReadme(readmePath) {
  const absoluteReadme = path.resolve(repoRoot, readmePath);
  const markdown = readFileSync(absoluteReadme, 'utf8');
  const lines = markdown.split(/\r?\n/);

  const listedLinks = [];
  let inCategorySection = false;

  for (const line of lines) {
    if (/^##\s+Documents in this Category\s*$/.test(line.trim())) {
      inCategorySection = true;
      continue;
    }

    if (inCategorySection && /^##\s+/.test(line.trim())) {
      break;
    }

    if (!inCategorySection) {
      continue;
    }

    const match = line.match(/^\s*-\s+\[[^\]]+\]\(([^)]+)\)\s*$/);
    if (!match) {
      continue;
    }

    const target = normalizeLocalLink(match[1]);
    if (!target) {
      continue;
    }

    const resolved = path.normalize(path.join(path.dirname(readmePath), target));
    listedLinks.push(resolved);
  }

  const totalMatch = markdown.match(/\*\*Total Documents\*\*:\s*(\d+)/i);
  const declaredTotal = totalMatch ? Number.parseInt(totalMatch[1], 10) : null;

  return {
    listedLinks: [...new Set(listedLinks)].sort(),
    declaredTotal,
  };
}

const errors = [];
const checks = [];

for (const sourceFile of ['docs/engineering/adr-index.md', 'docs/security-compliance/README.md', 'docs/security-compliance/compliance-guide.md', 'docs/security-compliance/security-overview.md', 'docs/security-compliance/audit-logging.md', 'docs/security-compliance/production-contract.md', 'docs/security-compliance/rbac-role-taxonomy.md']) {
  const { checked, missing } = checkMarkdownLinks(sourceFile);
  checks.push(...checked);
  errors.push(...missing.map((item) => ({ type: 'missing-link', ...item })));
}

const securityReadmePath = 'docs/security-compliance/README.md';
const expectedDocs = getDirectoryMarkdownFiles('docs/security-compliance');
const { listedLinks, declaredTotal } = parseCategoryReadme(securityReadmePath);

const missingInIndex = expectedDocs.filter((doc) => !listedLinks.includes(doc));
const extraInIndex = listedLinks.filter((doc) => !expectedDocs.includes(doc));

if (missingInIndex.length > 0 || extraInIndex.length > 0) {
  errors.push({
    type: 'category-mismatch',
    readme: securityReadmePath,
    missingInIndex,
    extraInIndex,
  });
}

if (declaredTotal !== null && declaredTotal !== expectedDocs.length) {
  errors.push({
    type: 'count-mismatch',
    readme: securityReadmePath,
    declaredTotal,
    actualTotal: expectedDocs.length,
  });
}

if (errors.length > 0) {
  console.error('❌ Docs integrity check failed.');

  for (const error of errors) {
    if (error.type === 'missing-link') {
      console.error(` - [${error.sourceFile}] Missing target for link \`${error.link}\` -> \`${error.resolved}\``);
    }

    if (error.type === 'category-mismatch') {
      if (error.missingInIndex.length > 0) {
        console.error(` - [${error.readme}] Missing docs in category index: ${error.missingInIndex.join(', ')}`);
      }
      if (error.extraInIndex.length > 0) {
        console.error(` - [${error.readme}] Indexed docs not found on disk: ${error.extraInIndex.join(', ')}`);
      }
    }

    if (error.type === 'count-mismatch') {
      console.error(
        ` - [${error.readme}] **Total Documents** declares ${error.declaredTotal}, but found ${error.actualTotal} markdown document(s).`,
      );
    }
  }

  process.exit(1);
}

console.log('✅ Docs integrity check passed.');
console.log(`Checked ${checks.length} markdown link target(s).`);
console.log(`Verified security-compliance category index (${expectedDocs.length} documents).`);
