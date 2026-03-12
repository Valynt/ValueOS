#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
const allowlistPath = path.resolve(repoRoot, 'scripts/ci/docs-deprecated-token-allowlist.json');

const DEPRECATED_TOKEN_RULES = [
  {
    id: 'legacy-src-agents-root',
    regex: /\bsrc\/agents\//g,
    reason: 'Use `packages/backend/src/lib/agent-fabric/agents/` instead of legacy `src/agents/` roots.',
  },
  {
    id: 'legacy-restored-token',
    regex: /\blegacy-restored\b/g,
    reason: 'The `legacy-restored` marker is retired and should not appear in current docs.',
  },
  {
    id: 'legacy-backend-root',
    regex: /\bsrc\/lib\/agent-fabric\/agents\b/g,
    reason:
      'Use a fully-qualified path (`packages/backend/src/lib/agent-fabric/agents`) when referring to backend agents.',
    shouldSkipMatch: ({ content, index }) => {
      const windowStart = Math.max(0, index - 40);
      const prefixWindow = content.slice(windowStart, index);
      return prefixWindow.endsWith('packages/backend/') || prefixWindow.endsWith('apps/ValyntApp/');
    },
  },
  {
    id: 'retired-runtime-path',
    regex: /\bpackages\/backend\/src\/services\/UnifiedAgentOrchestrator\.ts\b/g,
    reason: 'UnifiedAgentOrchestrator was retired; reference runtime services under `packages/backend/src/runtime/`.',
  },
  {
    id: 'retired-unified-api-path',
    regex: /\bpackages\/backend\/src\/services\/UnifiedAgentAPI\.ts\b/g,
    reason: 'UnifiedAgentAPI was retired; document runtime API entrypoints under `packages/backend/src/runtime/`.',
  },
  {
    id: 'obsolete-compose-reference',
    regex:
      /\binfra\/docker\/(docker-compose\.(?:dev|staging|caddy|observability|agents|observability-sidecars)\.ya?ml)\b/g,
    reason: 'Compose docs now use `ops/compose/compose.yml` and profile overlays instead of legacy infra/docker compose files.',
  },
  {
    id: 'obsolete-compose-root-reference',
    regex: /\binfra\/docker-compose\.(?:dev|staging|caddy|observability|agents|observability-sidecars)\.ya?ml\b/g,
    reason: 'Root-level `infra/docker-compose*.yml` references are obsolete.',
  },
];

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileGlob(pattern) {
  const segments = pattern.split('**').map((segment) => escapeRegex(segment).replace(/\\\*/g, '[^/]*'));
  return new RegExp(`^${segments.join('.*')}$`);
}

function loadAllowlistConfig() {
  if (!existsSync(allowlistPath)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const entries = Array.isArray(parsed?.allowlist) ? parsed.allowlist : [];

  return entries.map((entry) => ({
    ...entry,
    regex: compileGlob(entry.file),
    tokens: new Set(Array.isArray(entry.tokens) ? entry.tokens : []),
  }));
}

function isAllowedDeprecatedToken(allowlistEntries, sourceFile, tokenId) {
  return allowlistEntries.some((entry) => {
    if (!entry.regex.test(sourceFile)) {
      return false;
    }

    return entry.tokens.has('*') || entry.tokens.has(tokenId);
  });
}

function getMarkdownFilesRecursive(directory) {
  const absoluteDir = path.resolve(repoRoot, directory);
  const markdownFiles = [];

  function walk(currentDirectory) {
    const entries = readdirSync(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (['.git', 'node_modules', '.turbo', 'dist', 'build', 'coverage'].includes(entry.name)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (entry.isFile() && relativePath.endsWith('.md')) {
        markdownFiles.push(relativePath);
      }
    }
  }

  walk(absoluteDir);
  return markdownFiles.sort();
}

function collectDeprecatedTokenFindings(sourceFile, allowlistEntries) {
  const sourcePath = path.resolve(repoRoot, sourceFile);
  const content = readFileSync(sourcePath, 'utf8');
  const findings = [];
  const dedupe = new Set();

  for (const rule of DEPRECATED_TOKEN_RULES) {
    for (const match of content.matchAll(rule.regex)) {
      const matchedToken = match[0];
      const index = match.index ?? 0;

      if (rule.shouldSkipMatch?.({ sourceFile, content, index, matchedToken })) {
        continue;
      }

      if (isAllowedDeprecatedToken(allowlistEntries, sourceFile, rule.id)) {
        continue;
      }

      findings.push({
        type: 'deprecated-token',
        sourceFile,
        tokenId: rule.id,
        token: matchedToken,
        reason: rule.reason,
      });

      dedupe.add(`${sourceFile}::${rule.id}::${matchedToken}`);
    }
  }

  return findings.filter((finding) => {
    const key = `${finding.sourceFile}::${finding.tokenId}::${finding.token}`;
    if (!dedupe.has(key)) {
      return false;
    }

    dedupe.delete(key);
    return true;
  });
}

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
const allowlistEntries = loadAllowlistConfig();

for (const sourceFile of ['docs/engineering/adr-index.md', 'docs/security-compliance/README.md', 'docs/security-compliance/compliance-guide.md', 'docs/security-compliance/security-overview.md', 'docs/security-compliance/audit-logging.md', 'docs/security-compliance/production-contract.md', 'docs/security-compliance/rbac-role-taxonomy.md']) {
  const { checked, missing } = checkMarkdownLinks(sourceFile);
  checks.push(...checked);
  errors.push(...missing.map((item) => ({ type: 'missing-link', ...item })));
}

for (const markdownFile of getMarkdownFilesRecursive('.')) {
  errors.push(...collectDeprecatedTokenFindings(markdownFile, allowlistEntries));
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

    if (error.type === 'deprecated-token') {
      console.error(
        ` - [${error.sourceFile}] Deprecated token (${error.tokenId}) found: \`${error.token}\`. ${error.reason}`,
      );
    }
  }

  process.exit(1);
}

console.log('✅ Docs integrity check passed.');
console.log(`Checked ${checks.length} markdown link target(s).`);
console.log(`Verified security-compliance category index (${expectedDocs.length} documents).`);
