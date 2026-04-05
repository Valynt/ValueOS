#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts/ci/package-metadata-legacy-allowlist.json');
const legacyConfig = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const legacyTokens = Array.isArray(legacyConfig.tokens) && legacyConfig.tokens.length > 0
  ? legacyConfig.tokens.map((token) => String(token).toLowerCase())
  : ['valuecanvas'];

const allowlist = new Map(
  (legacyConfig.allowlist ?? []).map((entry) => [`${entry.path}::${entry.field}`, entry.reason ?? 'No reason provided.']),
);

function listPackageJsonFiles() {
  const output = execFileSync('rg', ['--files', '-g', 'package.json', '-g', '**/package.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function hasLegacyToken(value) {
  const normalized = String(value).toLowerCase();
  return legacyTokens.some((token) => normalized.includes(token));
}

function inspectServiceMetadata(value, prefix, findings) {
  if (typeof value === 'string') {
    if (hasLegacyToken(value)) {
      findings.push({ field: prefix, value });
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    inspectServiceMetadata(child, `${prefix}.${key}`, findings);
  }
}

const packageJsonFiles = listPackageJsonFiles();
const findings = [];

for (const relPath of packageJsonFiles) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));

  if (typeof packageJson.name === 'string' && hasLegacyToken(packageJson.name)) {
    findings.push({ path: relPath, field: 'name', value: packageJson.name });
  }

  if (typeof packageJson.author === 'string' && hasLegacyToken(packageJson.author)) {
    findings.push({ path: relPath, field: 'author', value: packageJson.author });
  }

  const serviceMetadataKeys = ['service', 'serviceName', 'serviceMetadata'];
  const serviceFindings = [];
  for (const key of serviceMetadataKeys) {
    if (!(key in packageJson)) continue;
    inspectServiceMetadata(packageJson[key], key, serviceFindings);
  }

  for (const finding of serviceFindings) {
    findings.push({ path: relPath, field: finding.field, value: finding.value });
  }
}

const nonAllowlisted = findings.filter(({ path: filePath, field }) => !allowlist.has(`${filePath}::${field}`));
const staleAllowlist = [...allowlist.keys()].filter((key) => {
  const [filePath, field] = key.split('::');
  return !findings.some((finding) => finding.path === filePath && finding.field === field);
});

if (nonAllowlisted.length > 0 || staleAllowlist.length > 0) {
  console.error('❌ Package metadata naming guard failed.');

  if (nonAllowlisted.length > 0) {
    console.error('\nLegacy identifiers found outside allowlist:');
    for (const finding of nonAllowlisted) {
      console.error(`- ${finding.path} :: ${finding.field} = ${JSON.stringify(finding.value)}`);
    }
  }

  if (staleAllowlist.length > 0) {
    console.error('\nAllowlist entries with no matching finding (remove stale exceptions):');
    for (const key of staleAllowlist) {
      console.error(`- ${key}`);
    }
  }

  process.exit(1);
}

console.log(`✅ Package metadata naming guard passed (${packageJsonFiles.length} package.json files scanned).`);
