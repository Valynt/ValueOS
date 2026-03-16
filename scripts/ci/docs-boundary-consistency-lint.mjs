#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const files = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'infra/k8s/README.md',
  'docs/architecture/README.md',
  'docs/architecture/infrastructure-architecture.md',
  'docs/architecture/component-interaction-diagram.md',
  'docs/engineering/adr-index.md',
].sort();

const staleMarkers = [
  {
    name: 'Legacy product name',
    regex: /\bValueCanvas\b/g,
    hint: 'Use ValueOS for canonical product naming in docs.',
  },
  {
    name: 'Invalid duplicated k8s path',
    regex: /\binfra\/infra\/k8s\//g,
    hint: 'Use infra/k8s/ repository paths.',
  },
  {
    name: 'Legacy agent file location',
    regex: /\bapps\/ValyntApp\/src\/lib\/agent-fabric\/agents\//g,
    hint: 'Use packages/backend/src/lib/agent-fabric/agents/.',
  },
];

const violations = [];

for (const file of files) {
  const absolute = path.resolve(repoRoot, file);
  const content = readFileSync(absolute, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    staleMarkers.forEach((marker) => {
      marker.regex.lastIndex = 0;
      if (marker.regex.test(line)) {
        violations.push({
          file,
          line: index + 1,
          marker: marker.name,
          text: line.trim(),
          hint: marker.hint,
        });
      }
    });
  });
}

if (violations.length > 0) {
  console.error('❌ Docs boundary consistency lint failed.');
  for (const violation of violations) {
    console.error(` - [${violation.file}:${violation.line}] ${violation.marker}: ${violation.text}`);
    console.error(`   ↳ ${violation.hint}`);
  }
  process.exit(1);
}

console.log(`✅ Docs boundary consistency lint passed (${files.length} file(s) scanned).`);
