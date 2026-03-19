#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const inventoryPath = path.join(repoRoot, 'runtime-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const importRegex = /(?:import|export)\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
const envRegexes = [
  /process\.env\.?([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /getEnvVar\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  /getEnv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
];

const violations = [];

for (const runtime of inventory.browserRuntimes ?? []) {
  const visited = new Set();
  const queue = [...(runtime.entrypoints ?? [])];
  const sourceRoots = (runtime.sourceRoots ?? []).map((root) => normalize(root.endsWith('/') ? root : `${root}/`));

  while (queue.length > 0) {
    const rel = normalize(queue.shift());
    if (visited.has(rel)) continue;
    visited.add(rel);

    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      continue;
    }

    if (isIgnored(rel)) continue;

    const source = fs.readFileSync(abs, 'utf8');
    const imports = [...source.matchAll(importRegex)].map((match) => match[1] ?? match[2]).filter(Boolean);

    validateEnvReads(runtime, rel, source);

    for (const specifier of imports) {
      validateImport(runtime, rel, specifier);

      const resolved = resolveSpecifier({ importerRel: rel, specifier, aliases: runtime.pathAliases ?? {} });
      if (!resolved) continue;
      if (!sourceRoots.some((root) => resolved === root.slice(0, -1) || resolved.startsWith(root))) continue;
      queue.push(resolved);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Browser runtime boundary check failed.');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('✅ Browser runtime boundary check passed.');

function validateImport(runtime, importerRel, specifier) {
  const forbiddenNodeBuiltins = new Set(runtime.forbiddenNodeBuiltins ?? []);
  const forbiddenPackages = new Set(runtime.forbiddenPackages ?? []);

  if (forbiddenNodeBuiltins.has(specifier)) {
    violations.push(`${importerRel}: imports forbidden Node builtin "${specifier}"`);
    return;
  }

  for (const pkg of forbiddenPackages) {
    if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
      violations.push(`${importerRel}: imports forbidden server-only package "${specifier}"`);
      return;
    }
  }

  const resolved = resolveSpecifier({ importerRel, specifier, aliases: runtime.pathAliases ?? {} });
  if (!resolved) return;

  const forbiddenPrefixes = (runtime.forbiddenPathPrefixes ?? []).map((prefix) => normalize(prefix));
  if (forbiddenPrefixes.some((prefix) => resolved.startsWith(prefix))) {
    violations.push(`${importerRel}: reaches forbidden server-only path "${specifier}" -> ${resolved}`);
    return;
  }

  const forbiddenExact = new Set((runtime.forbiddenPathExact ?? []).map((value) => normalize(value)));
  if (forbiddenExact.has(resolved)) {
    violations.push(`${importerRel}: reaches forbidden server-only module "${specifier}" -> ${resolved}`);
  }
}

function validateEnvReads(runtime, rel, source) {
  for (const regex of envRegexes) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const envName = match[1];
      if (!envName) continue;
      if ((runtime.allowedEnvVars ?? []).includes(envName)) continue;
      if ((runtime.allowedEnvPrefixes ?? []).some((prefix) => envName.startsWith(prefix))) continue;
      violations.push(`${rel}: reads non-browser environment variable "${envName}"`);
    }
  }
}

function resolveSpecifier({ importerRel, specifier, aliases }) {
  if (specifier.startsWith('.')) {
    return resolveFile(normalize(path.join(path.dirname(importerRel), specifier)));
  }

  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier.startsWith(alias)) {
      return resolveFile(normalize(path.join(target, specifier.slice(alias.length))));
    }
  }

  return null;
}

function resolveFile(baseRel) {
  const candidates = [];
  if (path.extname(baseRel)) {
    candidates.push(baseRel);
  } else {
    for (const extension of sourceExtensions) {
      candidates.push(`${baseRel}${extension}`);
    }
    for (const extension of sourceExtensions) {
      candidates.push(normalize(path.join(baseRel, `index${extension}`)));
    }
  }

  for (const candidate of candidates) {
    const abs = path.join(repoRoot, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return normalize(candidate);
    }
  }

  return normalize(baseRel);
}

function isIgnored(rel) {
  return /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)/.test(rel)
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel)
    || rel.endsWith('.d.ts');
}

function normalize(value) {
  return value.replaceAll(path.sep, '/');
}
