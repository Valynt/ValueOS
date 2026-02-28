#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const composeFiles = [
  'ops/compose/compose.yml',
  'infra/docker/docker-compose.prod.yml',
];

const violations = [];

for (const relPath of composeFiles) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    continue;
  }

  const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith('- "') && !trimmed.startsWith("- '")) {
      continue;
    }

    const mappingMatch = trimmed.match(/^-[\s]*["']([^"']+)["']/);
    if (!mappingMatch) {
      continue;
    }

    const mapping = mappingMatch[1].trim();
    if (!mapping.endsWith(':5432')) {
      continue;
    }

    if (mapping.startsWith('127.0.0.1:')) {
      continue;
    }

    violations.push({ relPath, lineNumber: i + 1, mapping });
  }
}

if (violations.length > 0) {
  console.error('❌ Found non-loopback Postgres host port bindings (:5432) in compose files.');
  for (const violation of violations) {
    console.error(`   - ${violation.relPath}:${violation.lineNumber} -> ${violation.mapping}`);
  }
  console.error('   Use 127.0.0.1:${PGPORT:-5432}:5432 for local dev, or remove host mapping for production-like profiles.');
  process.exit(1);
}

console.log('✅ Compose DB binding guard passed.');
