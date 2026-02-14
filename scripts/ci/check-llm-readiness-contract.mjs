#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();

const allowedPathPatterns = [
  /^packages\/backend\/src\/lib\/agent-fabric\/LLMGateway\.ts$/,
  /^packages\/backend\/src\/lib\/agent-fabric\/provider-adapters\//,
];

// Known legacy locations kept temporarily outside the contract scope.
const legacyAllowlist = new Set([
  'apps/ValyntApp/src/api/health.ts',
  'apps/ValyntApp/src/services/LLMFallback.ts',
  'apps/ValyntApp/src/services/security/APIKeyRotationService.ts',
  'packages/backend/src/api/health/index.ts',
  'packages/backend/src/services/security/APIKeyRotationService.ts',
  'scripts/test-vector-queries.ts',
  'tests/test/services/LLMFallback.test.ts',
]);

const importPattern =
  /\bfrom\s+['"](openai|@anthropic-ai\/[^'"]+|together-ai|ollama)['"]|\brequire\((['"])(openai|@anthropic-ai\/[^'"]+|together-ai|ollama)\2\)/g;
const endpointPattern = /(https?:\/\/api\.(openai|anthropic|together)\.ai|localhost:11434|\/api\/generate\b)/g;

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx|js|mjs|cjs)$/.test(file));

const violations = [];

for (const relativeFile of files) {
  if (
    allowedPathPatterns.some((pattern) => pattern.test(relativeFile)) ||
    legacyAllowlist.has(relativeFile)
  ) {
    continue;
  }

  const absoluteFile = path.join(repoRoot, relativeFile);
  const content = fs.readFileSync(absoluteFile, 'utf8');

  for (const pattern of [importPattern, endpointPattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const before = content.slice(0, match.index);
      const line = before.split('\n').length;
      violations.push({ file: relativeFile, line, snippet: match[0] });
    }
  }
}

if (violations.length > 0) {
  console.error('LLM readiness contract failed. Provider SDK/API usage found outside gateway/provider-adapter layer.');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.snippet}`);
  }
  process.exit(1);
}

console.log('LLM readiness contract passed.');
