#!/usr/bin/env node

/**
 * CI guard: assert zero direct LLM gateway complete() calls in production source.
 *
 * All LLM invocations must go through:
 *   - secureLLMComplete()     for service/worker/middleware paths
 *   - BaseAgent.secureInvoke() for agent-owned paths
 *
 * Direct calls to llmGateway.complete(), this.llmGateway.complete(), or
 * this.llm.complete() bypass circuit breaker and hallucination detection
 * (AGENTS.md rule 2).
 *
 * Excluded from scanning:
 *   - LLMGateway.ts          (the implementation itself)
 *   - secureLLMWrapper.ts    (the approved wrapper)
 *   - *.test.ts / *.spec.ts  (test files)
 *   - __tests__/ directories
 *   - node_modules/
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');

// Patterns that indicate a direct LLM gateway call.
// Matches: llmGateway.complete(, this.llmGateway.complete(, this.llm.complete(
const DIRECT_CALL_PATTERN = /(?:llmGateway|this\.llmGateway|this\.llm)\.complete\s*\(/;

// Files excluded from the check (relative to repo root).
const EXCLUDED_SUFFIXES = [
  'lib/agent-fabric/LLMGateway.ts',
  'lib/llm/secureLLMWrapper.ts',
  // BaseAgent.ts contains the secureInvoke implementation which calls
  // this.llmGateway.complete() internally — this is the approved path.
  'lib/agent-fabric/agents/BaseAgent.ts',
  // RedTeamAgent calls through an injected RedTeamLLMGateway interface;
  // the production implementation (RedTeamLLMAdapter) uses secureLLMComplete.
  'lib/agents/orchestration/agents/RedTeamAgent.ts',
];

function isExcluded(filePath) {
  if (filePath.includes('node_modules/')) return true;
  if (filePath.includes('__tests__/')) return true;
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) return true;
  if (filePath.endsWith('.test.js') || filePath.endsWith('.spec.js')) return true;
  return EXCLUDED_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

function listProductionTsFiles() {
  try {
    const output = execSync(
      "find packages/backend/src -name '*.ts' -not -path '*/node_modules/*'",
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

const files = listProductionTsFiles();
const violations = [];

for (const relFile of files) {
  if (isExcluded(relFile)) continue;

  const absFile = path.resolve(ROOT, relFile);
  if (!existsSync(absFile)) continue;

  const content = readFileSync(absFile, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines
    if (/^\s*\/\//.test(line)) continue;
    if (DIRECT_CALL_PATTERN.test(line)) {
      violations.push({ file: relFile, line: i + 1, content: line.trim() });
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Direct LLM gateway complete() calls found in production source.');
  console.error('   Use secureLLMComplete (services/workers) or BaseAgent.secureInvoke (agents).');
  console.error('   See AGENTS.md rule 2.\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.content}`);
  }
  process.exit(1);
}

console.log(`✅ No direct LLM gateway complete() calls found (scanned ${files.length} files).`);
