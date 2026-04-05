#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ORCHESTRATION_PATHS = [
  'packages/backend/src/runtime',
  'packages/backend/src/lib/agent-fabric',
];

const SCAN_FILE_GLOBS = ['*.ts', '*.tsx', '*.mts', '*.cts'];

const temporaryAllowlist = [
  {
    filePath: 'packages/backend/src/runtime/context-store/index.ts',
    expiresOn: '2026-07-31',
    reason: 'ContextStore composition root still wires legacy Supabase singleton while DI migration is in progress.',
  },
  {
    filePath: 'packages/backend/src/runtime/execution-runtime/index.ts',
    expiresOn: '2026-07-31',
    reason: 'ExecutionRuntime composition root still performs direct Supabase factory wiring pending runtime bootstrap extraction.',
  },
  {
    filePath: 'packages/backend/src/runtime/approval-inbox/index.ts',
    expiresOn: '2026-07-31',
    reason: 'Approval inbox composition root still creates Supabase dependency inline during inbox modularization.',
  },
  {
    filePath: 'packages/backend/src/runtime/execution-runtime/DecisionContextRepository.ts',
    expiresOn: '2026-06-30',
    reason: 'Decision context repository still reaches legacy Supabase factory pending infrastructure adapter introduction.',
  },
  {
    filePath: 'packages/backend/src/runtime/execution-runtime/WorkflowExecutor.ts',
    expiresOn: '2026-06-30',
    reason: 'Workflow executor still references legacy Supabase singleton pending orchestration persistence port migration.',
  },
  {
    filePath: 'packages/backend/src/runtime/execution-runtime/state-persistence.ts',
    expiresOn: '2026-06-30',
    reason: 'Runtime state persistence still depends on legacy Supabase singleton pending persistence interface extraction.',
  },
  {
    filePath: 'packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts',
    expiresOn: '2026-06-30',
    reason: 'FinancialModelingAgent still imports legacy Supabase factory pending agent memory adapter transition.',
  },
  {
    filePath: 'packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts',
    expiresOn: '2026-06-30',
    reason: 'TargetAgent still imports legacy Supabase factory pending agent memory adapter transition.',
  },
  {
    filePath: 'packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts',
    expiresOn: '2026-06-30',
    reason: 'RealizationAgent still dynamically imports legacy Supabase module pending orchestration-memory boundary migration.',
  },
  {
    filePath: 'packages/backend/src/lib/agent-fabric/FabricMonitor.ts',
    expiresOn: '2026-06-30',
    reason: 'FabricMonitor still instantiates raw Redis client pending metrics transport abstraction.',
  },
  {
    filePath: 'packages/backend/src/lib/agent-fabric/SecureMessageBus.ts',
    expiresOn: '2026-06-30',
    reason: 'SecureMessageBus still imports Redis stream broker directly pending runtime messaging adapter boundary cleanup.',
  },
];

const allowlistByPath = new Map(temporaryAllowlist.map((entry) => [entry.filePath, entry]));

const disallowedImportMatchers = [
  {
    name: 'legacy supabase module',
    test: (specifier) => /(?:^|\/)(?:lib\/)?supabase(?:\.js)?$/i.test(specifier),
  },
  {
    name: 'redis infra module',
    test: (specifier) => /(ioredis|redis|RedisStreamBroker)/.test(specifier),
  },
  {
    name: 'BullMQ package',
    test: (specifier) => specifier === 'bullmq',
  },
];

const bullMqCtorPattern = /new\s+(?:Queue|Worker|QueueScheduler|QueueEvents)\s*\(/;
const dynamicImportPattern = /await\s+import\((['"])([^'"]+)\1\)/g;

function parseExpiration(entry) {
  const expiresAt = new Date(`${entry.expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiresAt.getTime())) {
    return { valid: false, expiresAt: null };
  }
  return { valid: true, expiresAt };
}

function listTargetFiles(repoRoot) {
  const found = new Set();
  for (const root of ORCHESTRATION_PATHS) {
    if (!fs.existsSync(path.join(repoRoot, root))) {
      continue;
    }

    const args = ['--files', root];
    for (const glob of SCAN_FILE_GLOBS) {
      args.push('-g', glob);
    }

    try {
      const out = execFileSync('rg', args, { cwd: repoRoot, encoding: 'utf8' });
      out.split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => found.add(line));
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
        continue;
      }
      throw error;
    }
  }

  return [...found].filter((filePath) => (
    !filePath.includes('__tests__/')
    && !filePath.endsWith('.test.ts')
    && !filePath.endsWith('.spec.ts')
  )).sort();
}

function findForbiddenModuleUsages(source) {
  const hits = [];

  const staticImportRegex = /import\s+(?:type\s+)?(?:[^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(staticImportRegex)) {
    const specifier = match[1];
    const matchedRule = disallowedImportMatchers.find((rule) => rule.test(specifier));
    if (matchedRule) {
      hits.push(`imports ${matchedRule.name} via "${specifier}"`);
    }
  }

  for (const match of source.matchAll(dynamicImportPattern)) {
    const specifier = match[2];
    const matchedRule = disallowedImportMatchers.find((rule) => rule.test(specifier));
    if (matchedRule) {
      hits.push(`dynamically imports ${matchedRule.name} via "${specifier}"`);
    }
  }

  if (source.includes("from 'bullmq'") || source.includes('from "bullmq"') || bullMqCtorPattern.test(source)) {
    hits.push('constructs BullMQ queues/workers directly inside orchestration runtime');
  }

  return [...new Set(hits)];
}

export function analyzeOrchestrationInfraBoundaries({ repoRoot = process.cwd(), now = new Date() } = {}) {
  const violations = [];
  const checkedFiles = listTargetFiles(repoRoot);

  for (const entry of temporaryAllowlist) {
    const { valid, expiresAt } = parseExpiration(entry);
    if (!valid) {
      violations.push(`${entry.filePath}: temporary allowlist has invalid expiresOn date "${entry.expiresOn}" (expected YYYY-MM-DD).`);
      continue;
    }

    if (now.getTime() > expiresAt.getTime()) {
      violations.push(`${entry.filePath}: temporary allowlist entry expired on ${entry.expiresOn}; remove direct infra import or renew with migration justification.`);
      continue;
    }

    if (!fs.existsSync(path.join(repoRoot, entry.filePath))) {
      violations.push(`${entry.filePath}: temporary allowlist path does not exist.`);
    }
  }

  for (const filePath of checkedFiles) {
    const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
    const findings = findForbiddenModuleUsages(source);
    if (findings.length === 0) continue;

    if (allowlistByPath.has(filePath)) {
      continue;
    }

    violations.push(`${filePath}: ${findings.join('; ')}. Route infra access through composition-root adapters instead.`);
  }

  return {
    checkedFiles: checkedFiles.length,
    activeTemporaryAllowlist: temporaryAllowlist,
    violations,
  };
}

function runCli() {
  const { checkedFiles, activeTemporaryAllowlist, violations } = analyzeOrchestrationInfraBoundaries({
    repoRoot: process.cwd(),
    now: new Date(),
  });

  if (violations.length > 0) {
    console.error('❌ Orchestration/runtime infra boundary guard failed:');
    violations.forEach((violation) => console.error(` - ${violation}`));
    process.exit(1);
  }

  console.log(
    `✅ Orchestration/runtime infra boundary guard passed (${checkedFiles} files, ${activeTemporaryAllowlist.length} temporary allowlist entries).`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
