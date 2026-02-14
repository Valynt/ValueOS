#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REGISTRY_FILE = 'infra/README.md';
const START = '<!-- infra-manifest-registry:start -->';
const END = '<!-- infra-manifest-registry:end -->';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseRegistry(markdown) {
  const start = markdown.indexOf(START);
  const end = markdown.indexOf(END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Registry markers not found in ${REGISTRY_FILE}.`);
  }

  const block = markdown.slice(start + START.length, end);
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !line.includes('---'));

  const rows = [];
  for (const line of lines) {
    const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cols.length < 4 || cols[0] === 'Path') continue;
    rows.push({ path: cols[0].replace(/`/g, ''), status: cols[1].toLowerCase(), replacement: cols[2], notes: cols[3] });
  }
  return rows;
}

function findDeprecatedReferences(deprecatedPath) {
  try {
    const result = run([
      'rg --line-number --fixed-strings',
      `"${deprecatedPath}"`,
      '--glob "!infra/README.md"',
      '--glob "!scripts/ci/check-infra-manifest-registry.mjs"',
      '--glob "!.git/**"',
      '.',
    ].join(' '));
    return result ? result.split('\n') : [];
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

try {
  const content = readFileSync(REGISTRY_FILE, 'utf8');
  const registry = parseRegistry(content);

  if (registry.length === 0) {
    throw new Error('Registry is empty. Add at least one manifest row.');
  }

  const activeCount = registry.filter((r) => r.status === 'active').length;
  const deprecated = registry.filter((r) => r.status === 'deprecated');

  if (activeCount === 0) {
    throw new Error('Registry must contain at least one active manifest entry.');
  }

  const failures = [];
  for (const entry of deprecated) {
    const refs = findDeprecatedReferences(entry.path);
    if (refs.length > 0) {
      failures.push(`Deprecated path ${entry.path} is still referenced:\n${refs.map((r) => `  - ${r}`).join('\n')}`);
    }
  }

  if (failures.length > 0) {
    console.error('❌ Infra manifest registry check failed.');
    for (const failure of failures) console.error(`\n${failure}`);
    process.exit(1);
  }

  console.log(`✅ Infra manifest registry check passed (${activeCount} active, ${deprecated.length} deprecated entries).`);
} catch (error) {
  console.error(`❌ Infra manifest registry check failed: ${error.message}`);
  process.exit(1);
}
