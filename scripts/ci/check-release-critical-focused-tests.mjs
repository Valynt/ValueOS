#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const releaseCriticalSuites = [
  'packages/backend/src/__tests__/projects.audit-log.int.test.ts',
  'packages/backend/src/lib/agents/orchestration/agents/redteam-agent.secureinvoke.test.ts',
];

const allowlistPath = path.join(repoRoot, 'scripts/ci/release-critical-focused-tests.allowlist.json');

function readAllowlist() {
  if (!fs.existsSync(allowlistPath)) {
    return { exceptions: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const exceptions = Array.isArray(parsed.exceptions) ? parsed.exceptions : [];
  for (const entry of exceptions) {
    if (
      typeof entry?.file !== 'string' ||
      typeof entry?.line !== 'number' ||
      typeof entry?.pattern !== 'string' ||
      typeof entry?.reason !== 'string' ||
      entry.reason.trim().length === 0
    ) {
      throw new Error('Invalid allowlist entry in release-critical-focused-tests.allowlist.json.');
    }
  }

  return { exceptions };
}

const matchPattern = /\b(?:it|test|describe)\s*\.\s*(?:skip|only)\s*\(/g;

function findViolations(file) {
  const abs = path.join(repoRoot, file);
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matches = line.matchAll(matchPattern);
    for (const match of matches) {
      const column = (match.index ?? 0) + 1;
      violations.push({
        file,
        line: index + 1,
        column,
        pattern: match[0],
      });
    }
  }

  return violations;
}

const allowlist = readAllowlist();
const violations = releaseCriticalSuites.flatMap(findViolations);

const actionable = violations.filter((violation) => {
  return !allowlist.exceptions.some((entry) => (
    entry.file === violation.file &&
    entry.line === violation.line &&
    entry.pattern === violation.pattern
  ));
});

if (actionable.length > 0) {
  console.error('❌ Found forbidden .skip/.only usage in release-critical suites:');
  for (const violation of actionable) {
    console.error(`  - ${violation.file}:${violation.line}:${violation.column} => ${violation.pattern}`);
  }

  if (allowlist.exceptions.length > 0) {
    console.error('\nAllowlist entries exist, but none matched these violations.');
  }

  process.exit(1);
}

console.log('✅ No forbidden .skip/.only found in release-critical suites.');
