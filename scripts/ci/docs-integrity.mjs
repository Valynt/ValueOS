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

function getDirectoryFilesByExtension(directory, extensions) {
  const absoluteDir = path.resolve(repoRoot, directory);
  const files = [];

  for (const entry of readdirSync(absoluteDir)) {
    const absoluteEntry = path.join(absoluteDir, entry);
    const relativeEntry = path.join(directory, entry);
    const stats = statSync(absoluteEntry);

    if (stats.isDirectory()) {
      files.push(...getDirectoryFilesByExtension(relativeEntry, extensions));
      continue;
    }

    if (extensions.some((ext) => relativeEntry.endsWith(ext))) {
      files.push(relativeEntry);
    }
  }

  return files.sort();
}

function checkWorkflowPathReferences(sourceFile) {
  const sourcePath = path.resolve(repoRoot, sourceFile);
  const content = readFileSync(sourcePath, 'utf8');
  const workflowPathRegex = /(\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml)/g;
  const deprecatedWorkflowPaths = new Set(['.github/workflows/ci.yml']);
  const checked = [];
  const errors = [];

  for (const match of content.matchAll(workflowPathRegex)) {
    const workflowPath = match[1];
    checked.push({ sourceFile, workflowPath });
    const absoluteWorkflowPath = path.resolve(repoRoot, workflowPath);

    if (deprecatedWorkflowPaths.has(workflowPath)) {
      errors.push({ type: 'deprecated-workflow-path', sourceFile, workflowPath });
      continue;
    }

    if (!existsSync(absoluteWorkflowPath)) {
      errors.push({ type: 'missing-workflow-path', sourceFile, workflowPath });
    }
  }

  return { checked, errors };
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

function parseAdrIndexEntries(indexPath) {
  const absoluteIndexPath = path.resolve(repoRoot, indexPath);
  const markdown = readFileSync(absoluteIndexPath, 'utf8');
  const adrLinkRegex = /\[[^\]]+\]\((\.\/adr\/[^)]+\.md)\)/g;
  const entries = [];

  for (const match of markdown.matchAll(adrLinkRegex)) {
    const target = normalizeLocalLink(match[1]);
    if (!target) {
      continue;
    }

    entries.push(path.normalize(path.join(path.dirname(indexPath), target)));
  }

  return [...new Set(entries)].sort();
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

const adrIndexPath = 'docs/engineering/adr-index.md';
const expectedAdrDocs = getDirectoryMarkdownFiles('docs/engineering/adr');
const indexedAdrDocs = parseAdrIndexEntries(adrIndexPath);

const missingAdrEntries = expectedAdrDocs.filter((doc) => !indexedAdrDocs.includes(doc));
const extraAdrEntries = indexedAdrDocs.filter((doc) => !expectedAdrDocs.includes(doc));

if (missingAdrEntries.length > 0 || extraAdrEntries.length > 0) {
  errors.push({
    type: 'adr-index-mismatch',
    index: adrIndexPath,
    missingAdrEntries,
    extraAdrEntries,
  });
}

const docsWorkflowReferenceFiles = [
  ...getDirectoryFilesByExtension('docs/security-compliance', ['.md', '.json']),
  ...getDirectoryFilesByExtension('docs/operations', ['.md', '.json']),
];

for (const sourceFile of docsWorkflowReferenceFiles) {
  const { checked, errors: workflowPathErrors } = checkWorkflowPathReferences(sourceFile);
  checks.push(...checked.map((item) => ({ sourceFile: item.sourceFile, link: item.workflowPath, resolved: item.workflowPath })));
  errors.push(...workflowPathErrors);
}

// Validate migration file paths referenced in evidence-index.md.
// The "Migration lineage" column contains backtick-quoted paths like
// `infra/supabase/supabase/migrations/...`. Each path must exist on disk.
const evidenceIndexPath = 'docs/security-compliance/evidence-index.md';
const evidenceIndexAbsolute = path.resolve(repoRoot, evidenceIndexPath);
if (existsSync(evidenceIndexAbsolute)) {
  const evidenceContent = readFileSync(evidenceIndexAbsolute, 'utf8');
  // Match backtick-quoted paths that look like migration file references.
  const migrationPathRegex = /`(infra\/supabase\/supabase\/migrations\/[^`]+\.sql)`/g;
  const migrationRefs = [];

  for (const match of evidenceContent.matchAll(migrationPathRegex)) {
    migrationRefs.push(match[1]);
  }

  for (const ref of migrationRefs) {
    const resolved = path.resolve(repoRoot, ref);
    if (!existsSync(resolved)) {
      errors.push({
        type: 'missing-migration-ref',
        sourceFile: evidenceIndexPath,
        ref,
      });
    } else {
      checks.push({ sourceFile: evidenceIndexPath, link: ref, resolved: ref });
    }
  }
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

    if (error.type === 'missing-migration-ref') {
      console.error(
        ` - [${error.sourceFile}] Migration lineage reference not found on disk: \`${error.ref}\``,
      );
    }

    if (error.type === 'adr-index-mismatch') {
      if (error.missingAdrEntries.length > 0) {
        console.error(` - [${error.index}] Missing ADR index entries: ${error.missingAdrEntries.join(', ')}`);
      }
      if (error.extraAdrEntries.length > 0) {
        console.error(` - [${error.index}] ADR index references missing files: ${error.extraAdrEntries.join(', ')}`);
      }
    }

    if (error.type === 'deprecated-workflow-path') {
      console.error(
        ` - [${error.sourceFile}] Deprecated workflow path reference found: \`${error.workflowPath}\`. Use canonical lanes (\`.github/workflows/pr-fast.yml\`, \`.github/workflows/main-verify.yml\`, \`.github/workflows/nightly-governance.yml\`) where applicable.`,
      );
    }

    if (error.type === 'missing-workflow-path') {
      console.error(
        ` - [${error.sourceFile}] Referenced workflow path does not exist on disk: \`${error.workflowPath}\``,
      );
    }
  }

  process.exit(1);
}

console.log('✅ Docs integrity check passed.');
console.log(`Checked ${checks.length} markdown link target(s).`);
console.log(`Verified security-compliance category index (${expectedDocs.length} documents).`);
console.log(`Verified ADR index coverage (${expectedAdrDocs.length} ADR documents).`);
