#!/usr/bin/env node

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const DOC_SCOPES = [
  'docs/architecture',
  'docs/security-compliance',
  'docs/operations',
];
const ARTIFACT_DIR = path.resolve(repoRoot, 'artifacts/docs-trust');
const MIN_TRUST_SCORE = Number.parseFloat(process.env.DOC_TRUST_SCORE_MIN ?? '90');

const ROOT_PATH_PREFIXES = [
  'docs/',
  'scripts/',
  'packages/',
  'apps/',
  'infra/',
  '.github/',
  'tests/',
  'ops/',
  'config/',
  'policy/',
  '.windsurf/',
  '.gitpod/',
  '.devcontainer/',
];

const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
const inlineCodeRegex = /`([^`]+)`/g;
const pathLikeRegex = /^(?:\.{1,2}\/|\/?[A-Za-z0-9._-]+\/)[A-Za-z0-9._\/-]*(?:\.[A-Za-z0-9._-]+)?$/;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walkMarkdownFiles(relativeDir) {
  const absoluteDir = path.resolve(repoRoot, relativeDir);
  const files = [];

  for (const entry of readdirSync(absoluteDir)) {
    const absoluteEntry = path.join(absoluteDir, entry);
    const relativeEntry = path.join(relativeDir, entry);
    const stats = statSync(absoluteEntry);

    if (stats.isDirectory()) {
      files.push(...walkMarkdownFiles(relativeEntry));
      continue;
    }

    if (entry.endsWith('.md')) {
      files.push(toPosix(relativeEntry));
    }
  }

  return files;
}

function normalizeRawTarget(rawTarget) {
  const cleaned = rawTarget.trim().replace(/^<|>$/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('#')) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(cleaned)) return null;

  const withoutSuffix = cleaned.split('#')[0].split('?')[0].trim();
  if (!withoutSuffix) return null;
  if (!pathLikeRegex.test(withoutSuffix)) return null;
  const repoRelative = withoutSuffix.replace(/^\//, '');
  const isExplicitRootPath = ROOT_PATH_PREFIXES.some((prefix) => repoRelative.startsWith(prefix));
  const isRelativePath = withoutSuffix.startsWith('./') || withoutSuffix.startsWith('../');
  if (!isExplicitRootPath && !isRelativePath) {
    return null;
  }

  return withoutSuffix;
}

function resolveReference(sourceFile, normalizedTarget) {
  if (normalizedTarget.startsWith('./') || normalizedTarget.startsWith('../')) {
    return path.resolve(repoRoot, path.dirname(sourceFile), normalizedTarget);
  }

  const repoRelative = normalizedTarget.replace(/^\//, '');
  if (ROOT_PATH_PREFIXES.some((prefix) => repoRelative.startsWith(prefix))) {
    return path.resolve(repoRoot, repoRelative);
  }
  return path.resolve(repoRoot, path.dirname(sourceFile), normalizedTarget);
}

function gatherRepoFiles(relativeDir = '.') {
  const absoluteDir = path.resolve(repoRoot, relativeDir);
  const results = [];

  for (const entry of readdirSync(absoluteDir)) {
    if (entry === '.git' || entry === 'node_modules') {
      continue;
    }

    const absoluteEntry = path.join(absoluteDir, entry);
    const relativeEntry = toPosix(path.join(relativeDir, entry));
    let stats;
    try {
      stats = statSync(absoluteEntry);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    if (stats.isDirectory()) {
      results.push(...gatherRepoFiles(relativeEntry));
      continue;
    }

    results.push(relativeEntry.replace(/^\.\//, ''));
  }

  return results;
}

function computeRenamedCandidates(missingPath, repoFiles) {
  const missingBase = path.basename(missingPath);
  if (!missingBase) return [];

  return repoFiles
    .filter((candidate) => path.basename(candidate) === missingBase)
    .slice(0, 5);
}

function parseReferences(sourceFile) {
  const absoluteSource = path.resolve(repoRoot, sourceFile);
  const content = readFileSync(absoluteSource, 'utf8');
  const references = [];

  for (const match of content.matchAll(markdownLinkRegex)) {
    const normalized = normalizeRawTarget(match[1]);
    if (!normalized) continue;

    references.push({
      sourceFile,
      raw: match[1],
      normalized,
      referenceType: 'markdown-link',
    });
  }

  for (const match of content.matchAll(inlineCodeRegex)) {
    const normalized = normalizeRawTarget(match[1]);
    if (!normalized) continue;

    references.push({
      sourceFile,
      raw: match[1],
      normalized,
      referenceType: 'inline-code',
    });
  }

  return references;
}

const scopedDocs = DOC_SCOPES.flatMap((scope) => walkMarkdownFiles(scope)).sort();
const repoFiles = gatherRepoFiles();
const checks = [];
const missing = [];

for (const sourceFile of scopedDocs) {
  const references = parseReferences(sourceFile);

  for (const reference of references) {
    const absoluteTarget = resolveReference(sourceFile, reference.normalized);
    const repoRelativeTarget = toPosix(path.relative(repoRoot, absoluteTarget));
    const exists = existsSync(absoluteTarget);

    checks.push({ ...reference, resolved: repoRelativeTarget, exists });

    if (!exists) {
      missing.push({
        ...reference,
        resolved: repoRelativeTarget,
        renamedCandidates: computeRenamedCandidates(repoRelativeTarget, repoFiles),
      });
    }
  }
}

const uniqueReferenceCount = new Set(checks.map((item) => `${item.sourceFile}::${item.normalized}`)).size;
const uniqueMissing = Array.from(
  new Map(missing.map((item) => [`${item.sourceFile}::${item.resolved}`, item])).values(),
);
const trustScore = uniqueReferenceCount === 0
  ? 100
  : Number((((uniqueReferenceCount - uniqueMissing.length) / uniqueReferenceCount) * 100).toFixed(2));

mkdirSync(ARTIFACT_DIR, { recursive: true });

const summaryLines = [
  '# Docs Trust Score',
  '',
  `- Scopes: ${DOC_SCOPES.join(', ')}`,
  `- Markdown files scanned: ${scopedDocs.length}`,
  `- Path references checked: ${uniqueReferenceCount}`,
  `- Missing path references: ${uniqueMissing.length}`,
  `- Docs trust score: **${trustScore}%**`,
  `- Minimum passing trust score: **${MIN_TRUST_SCORE}%**`,
  '',
];

if (uniqueMissing.length > 0) {
  summaryLines.push('## Missing or stale references');
  summaryLines.push('');

  for (const item of uniqueMissing.slice(0, 50)) {
    const candidateText = item.renamedCandidates.length > 0
      ? ` (possible renamed targets: ${item.renamedCandidates.join(', ')})`
      : '';
    summaryLines.push(`- ${item.sourceFile} -> \`${item.raw}\` resolved to \`${item.resolved}\`${candidateText}`);
  }

  if (uniqueMissing.length > 50) {
    summaryLines.push(`- ... ${uniqueMissing.length - 50} additional missing references omitted from markdown summary.`);
  }
}

const summaryPath = path.join(ARTIFACT_DIR, 'summary.md');
const reportPath = path.join(ARTIFACT_DIR, 'report.json');

writeFileSync(summaryPath, `${summaryLines.join('\n')}\n`, 'utf8');
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scopes: DOC_SCOPES,
      markdownFilesScanned: scopedDocs,
      referenceCount: uniqueReferenceCount,
      missingCount: uniqueMissing.length,
      trustScore,
      minimumTrustScore: MIN_TRUST_SCORE,
      missing: uniqueMissing,
    },
    null,
    2,
  ),
  'utf8',
);

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summaryLines.join('\n')}\n`, { flag: 'a' });
}

if (trustScore < MIN_TRUST_SCORE) {
  console.error(`❌ Docs path validity check failed. Trust score ${trustScore}% is below required ${MIN_TRUST_SCORE}%.`);
  console.error(`See ${toPosix(path.relative(repoRoot, summaryPath))} for details.`);
  process.exit(1);
}

console.log('✅ Docs path validity check passed.');
console.log(`Docs trust score: ${trustScore}%`);
console.log(`Summary: ${toPosix(path.relative(repoRoot, summaryPath))}`);
