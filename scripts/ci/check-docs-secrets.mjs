#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const markdownFiles = execSync("rg --files docs -g '**/*.md'", { encoding: 'utf8' })
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const knownSecretPatterns = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]+\b/g,
  /\bsk-(?:live|test|proj|org)-[A-Za-z0-9_-]+\b/g,
  /\bghp_[A-Za-z0-9]{36}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{35}\b/g,
];

const sensitiveNameRegex = /(api[_-]?key|secret|token|password|client_secret|private_key|service_role_key)/i;
const allowValues = new Set(['<REDACTED>', '<EXAMPLE_ONLY_NOT_A_SECRET>', '...', '<redacted>', '<example_only_not_a_secret>']);

function shannonEntropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isAllowed(value) {
  if (!value) return true;
  if (allowValues.has(value)) return true;
  if (value.startsWith('sm://')) return true;
  if (value.includes('example') || value.includes('your-') || value.includes('your_') || value.includes('changeme')) {
    return true;
  }
  return false;
}

const findings = [];
for (const file of markdownFiles) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    for (const pattern of knownSecretPatterns) {
      for (const match of line.matchAll(pattern)) {
        findings.push({ file, line: i + 1, type: 'Known key pattern', value: match[0] });
      }
    }

    const envMatch = line.match(/^\s*([A-Z0-9_]{3,})\s*=\s*([^\s#`]+)\s*$/);
    if (envMatch && sensitiveNameRegex.test(envMatch[1])) {
      const value = envMatch[2].replace(/^['"]|['"]$/g, '');
      if (!isAllowed(value)) {
        const entropy = shannonEntropy(value);
        if (value.length >= 12 || entropy >= 3.5) {
          findings.push({ file, line: i + 1, type: 'Sensitive env assignment', value: `${envMatch[1]}=${value}` });
        }
      }
    }

    const kvMatch = line.match(/\b([A-Za-z_][A-Za-z0-9_-]*)\b\s*[:=]\s*['"]([A-Za-z0-9_\-/.+=]{8,})['"]/);
    if (kvMatch && sensitiveNameRegex.test(kvMatch[1])) {
      const value = kvMatch[2];
      if (!isAllowed(value) && shannonEntropy(value) >= 3.3) {
        findings.push({ file, line: i + 1, type: 'Sensitive inline literal', value: `${kvMatch[1]}:${value}` });
      }
    }
  }
}

if (findings.length) {
  console.error('❌ Potential secret-like literals detected in markdown docs.');
  for (const f of findings) {
    console.error(`${f.file}:${f.line} [${f.type}] ${f.value}`);
  }
  console.error('Use <REDACTED>, <EXAMPLE_ONLY_NOT_A_SECRET>, or sm:// secret-manager paths.');
  process.exit(1);
}

console.log('✅ Docs secret-literal lint passed');
