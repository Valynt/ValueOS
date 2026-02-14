#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const allowedPrefixes = [
  'packages/backend/src/lib/agent-fabric/',
  'packages/backend/src/lib/provider-adapters/',
];

const allowedFiles = new Set([
  'scripts/test-vector-queries.ts',
  'scripts/validate-together-ai.ts',
]);

const bannedImportMatchers = [
  /from\s+['\"]openai['\"]/,
  /from\s+['\"]@anthropic-ai\//,
  /from\s+['\"][^'\"]*together[^'\"]*['\"]/,
  /from\s+['\"][^'\"]*ollama[^'\"]*['\"]/,
  /require\(\s*['\"]openai['\"]\s*\)/,
  /require\(\s*['\"]@anthropic-ai\//,
  /require\(\s*['\"][^'\"]*together[^'\"]*['\"]\s*\)/,
  /require\(\s*['\"][^'\"]*ollama[^'\"]*['\"]\s*\)/,
];

const scanRoots = ['packages', 'scripts'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const ignoreSegments = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

function isAllowedPath(relPath) {
  return allowedPrefixes.some((prefix) => relPath.startsWith(prefix));
}

function shouldScanFile(relPath) {
  return [...sourceExtensions].some((ext) => relPath.endsWith(ext));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoreSegments.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    const relPath = relative(repoRoot, fullPath).replaceAll('\\\\', '/');
    if (shouldScanFile(relPath)) {
      out.push(relPath);
    }
  }
  return out;
}

const violations = [];
for (const root of scanRoots) {
  const rootPath = join(repoRoot, root);
  let files = [];
  try {
    files = walk(rootPath);
  } catch {
    continue;
  }

  for (const relPath of files) {
    if (isAllowedPath(relPath) || allowedFiles.has(relPath)) continue;
    const contents = readFileSync(join(repoRoot, relPath), 'utf8');
    for (const matcher of bannedImportMatchers) {
      if (matcher.test(contents)) {
        violations.push({ relPath, matcher: matcher.toString() });
        break;
      }
    }
  }
}

if (violations.length > 0) {
  console.error('LLM readiness contract violations found:');
  for (const violation of violations) {
    console.error(`- ${violation.relPath} (matched: ${violation.matcher})`);
  }
  process.exit(1);
}

console.log('LLM readiness contract check passed.');
