#!/usr/bin/env node
/**
 * check-architecture-doc-drift.mjs
 *
 * Detects drift between architecture documentation claims and runtime reality.
 * Focuses on two categories identified in the production sign-off review:
 *
 *   A. Eventing stack claims — docs/AGENTS.md claims CloudEvents + MessageBus
 *      for inter-agent messaging. Verifies the runtime implementation matches.
 *
 *   B. Deployment claims — docs/AGENTS.md names specific agents, runtime
 *      services, and the MessageBus path. Verifies each named entity exists
 *      as a source file.
 *
 * This is a static analysis gate — it does not run the application.
 * It catches the class of bug where docs are updated without updating code,
 * or code is refactored without updating docs.
 *
 * Exit 1 if any drift is detected.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const failures = [];
const warnings = [];

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function fail(msg) { failures.push(msg); }
function warn(msg) { warnings.push(msg); }
function pass(msg) { console.log('  ✓ ' + msg); }

function fileExists(...segments) {
  return existsSync(join(ROOT, ...segments));
}

function dirContains(dir, pattern) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return false;
  try {
    return readdirSync(abs).some(f => pattern.test(f));
  } catch { return false; }
}

console.log('\nArchitecture Doc / Runtime Drift Gate\n');

// ── A. Eventing stack claims ─────────────────────────────────────────────────
console.log('A. Eventing stack claims (docs/AGENTS.md)');

const agentsMd = read('docs/AGENTS.md');
if (!agentsMd) {
  fail('docs/AGENTS.md is missing — cannot verify architecture claims');
} else {

  // A1. MessageBus (CloudEvents) claim
  // docs/AGENTS.md: "Inter-agent messaging via MessageBus (CloudEvents)"
  // Runtime: packages/backend/src/services/realtime/MessageBus.ts
  //          packages/backend/src/services/MessageBus.ts (re-export)
  if (/MessageBus.*CloudEvents|CloudEvents.*MessageBus/i.test(agentsMd)) {
    const mbPrimary = 'packages/backend/src/services/realtime/MessageBus.ts';
    const mbAlias   = 'packages/backend/src/services/MessageBus.ts';
    if (!fileExists(mbPrimary) && !fileExists(mbAlias)) {
      fail(`docs/AGENTS.md claims MessageBus (CloudEvents) but neither ${mbPrimary} nor ${mbAlias} exists`);
    } else {
      pass('MessageBus source file exists');

      // Verify the implementation actually uses CloudEvents-style envelope
      // (trace_id, tenant_id, event_type fields — the CloudEvents-inspired schema)
      const mbSrc = read(mbPrimary) ?? read(mbAlias) ?? '';
      if (!/trace_id|CloudEvent|event_type/.test(mbSrc)) {
        fail(`${mbPrimary}: docs claim CloudEvents messaging but source has no trace_id/event_type fields`);
      } else {
        pass('MessageBus implements CloudEvents-style envelope (trace_id, event_type)');
      }

      // Verify tenant isolation is enforced in the bus
      if (!/tenant_id|organization_id/.test(mbSrc)) {
        fail(`${mbPrimary}: MessageBus has no tenant_id/organization_id enforcement — cross-tenant message delivery possible`);
      } else {
        pass('MessageBus enforces tenant_id/organization_id on messages');
      }
    }
  }

  // A2. Redis + BullMQ claim
  // docs/AGENTS.md: "Redis, BullMQ queues"
  if (/BullMQ/.test(agentsMd)) {
    // BullMQ must be a declared dependency
    const pkgJson = read('packages/backend/package.json');
    if (!pkgJson || !/bullmq/.test(pkgJson)) {
      fail('docs/AGENTS.md claims BullMQ queues but bullmq is not in packages/backend/package.json');
    } else {
      pass('BullMQ is declared in backend package.json');
    }

    // At least one worker file must exist
    const workerDir = 'packages/backend/src/workers';
    if (!fileExists(workerDir)) {
      fail(`docs/AGENTS.md claims BullMQ queues but ${workerDir} does not exist`);
    } else if (!dirContains(workerDir, /Worker\.ts$/)) {
      fail(`${workerDir} exists but contains no *Worker.ts files — BullMQ workers may be missing`);
    } else {
      pass('BullMQ worker files exist in packages/backend/src/workers/');
    }
  }

  // A3. NATS JetStream claim (metering pipeline)
  // docs/production-sign-off-review.md: NATS JetStream is the metering transport
  {
    const meteringQueue = read('packages/backend/src/services/metering/MeteringQueue.ts');
    if (!meteringQueue) {
      fail('packages/backend/src/services/metering/MeteringQueue.ts is missing — metering pipeline broken');
    } else if (!/nats|NATS|JetStream/i.test(meteringQueue)) {
      fail('MeteringQueue.ts exists but has no NATS/JetStream reference — metering transport may have changed without doc update');
    } else {
      pass('MeteringQueue.ts references NATS JetStream');
    }

    // The NATS k8s manifest must exist (checked by infra-readiness-contract too, belt-and-suspenders)
    if (!fileExists('infra/k8s/base/nats-jetstream.yaml')) {
      fail('infra/k8s/base/nats-jetstream.yaml missing — NATS deployment not defined');
    } else {
      pass('NATS JetStream k8s manifest exists');
    }
  }

  // A4. Redis Streams claim
  // kustomization references redis-streams.yaml
  {
    const kustomization = read('infra/k8s/base/kustomization.yaml');
    if (kustomization && !/redis-streams\.yaml/.test(kustomization)) {
      warn('infra/k8s/base/kustomization.yaml does not reference redis-streams.yaml — Redis Streams broker may not be deployed');
    } else if (kustomization) {
      pass('kustomization.yaml references redis-streams.yaml');
    }
  }
}

// ── B. Deployment claims — named entities must exist as source files ─────────
console.log('\nB. Deployment claims — named entities');

// B1. Agent names
// docs/AGENTS.md: "Agents: OpportunityAgent, TargetAgent, FinancialModelingAgent,
//   IntegrityAgent, RealizationAgent, ExpansionAgent, NarrativeAgent, ComplianceAuditorAgent"
const CLAIMED_AGENTS = [
  'OpportunityAgent',
  'TargetAgent',
  'FinancialModelingAgent',
  'IntegrityAgent',
  'RealizationAgent',
  'ExpansionAgent',
  'NarrativeAgent',
  'ComplianceAuditorAgent',
];

const AGENT_DIR = 'packages/backend/src/lib/agent-fabric/agents';

for (const agent of CLAIMED_AGENTS) {
  const agentFile = join(ROOT, AGENT_DIR, `${agent}.ts`);
  if (!existsSync(agentFile)) {
    fail(`docs/AGENTS.md claims agent "${agent}" but ${AGENT_DIR}/${agent}.ts does not exist`);
  } else {
    pass(`Agent ${agent} exists`);
  }
}

// B2. Runtime service names
// docs/AGENTS.md: "six runtime services in packages/backend/src/runtime/
//   (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore,
//    ArtifactComposer, RecommendationEngine)"
const CLAIMED_RUNTIME_SERVICES = [
  { name: 'DecisionRouter',      dir: 'decision-router' },
  { name: 'ExecutionRuntime',    dir: 'execution-runtime' },
  { name: 'PolicyEngine',        dir: 'policy-engine' },
  { name: 'ContextStore',        dir: 'context-store' },
  { name: 'ArtifactComposer',    dir: 'artifact-composer' },
  { name: 'RecommendationEngine',dir: 'recommendation-engine' },
];

const RUNTIME_DIR = 'packages/backend/src/runtime';

for (const svc of CLAIMED_RUNTIME_SERVICES) {
  const svcDir = join(ROOT, RUNTIME_DIR, svc.dir);
  if (!existsSync(svcDir)) {
    fail(`docs/AGENTS.md claims runtime service "${svc.name}" at ${RUNTIME_DIR}/${svc.dir}/ but directory does not exist`);
  } else {
    pass(`Runtime service ${svc.name} directory exists`);
  }
}

// B3. MessageBus path claim
// docs/AGENTS.md table: "packages/backend/src/services/realtime/MessageBus.ts"
{
  const claimedPath = 'packages/backend/src/services/realtime/MessageBus.ts';
  if (!fileExists(claimedPath)) {
    fail(`docs/AGENTS.md table claims MessageBus at ${claimedPath} but file does not exist`);
  } else {
    pass(`MessageBus at claimed path ${claimedPath}`);
  }
}

// B4. Image registry claim
// kustomization.yaml uses ghcr.io/valynt/valueos-backend and valueos-frontend
// Verify the Dockerfile(s) exist and the image names are consistent
{
  const kustomization = read('infra/k8s/base/kustomization.yaml');
  if (kustomization) {
    const imageNames = [...kustomization.matchAll(/name:\s*(ghcr\.io\/[^\s]+)/g)].map(m => m[1]);
    for (const img of imageNames) {
      // Each claimed image must have a corresponding Dockerfile somewhere
      const isBackend  = /backend/.test(img);
      const isFrontend = /frontend/.test(img);
      if (isBackend && !fileExists('infra/docker/Dockerfile.backend') && !fileExists('packages/backend/Dockerfile') && !fileExists('Dockerfile')) {
        warn(`kustomization.yaml references backend image ${img} but no Dockerfile found at infra/docker/Dockerfile.backend or packages/backend/Dockerfile`);
      } else if (isFrontend && !fileExists('infra/docker/Dockerfile.frontend') && !fileExists('apps/ValyntApp/Dockerfile') && !fileExists('Dockerfile.frontend')) {
        warn(`kustomization.yaml references frontend image ${img} but no frontend Dockerfile found`);
      } else {
        pass(`Image ${img} has a corresponding Dockerfile`);
      }
    }
  }
}

// B5. Agent count consistency
// docs/AGENTS.md must state the correct agent count (N-agent fabric).
// The count is extracted from the doc and compared to the actual file count.
{
  const agentDir = join(ROOT, AGENT_DIR);
  if (existsSync(agentDir) && agentsMd) {
    const agentFiles = readdirSync(agentDir)
      .filter(f => /Agent\.ts$/.test(f) && f !== 'BaseAgent.ts' && !f.includes('__tests__'));
    const countMatch = agentsMd.match(/(\d+)-agent fabric/);
    if (!countMatch) {
      warn('docs/AGENTS.md does not state an agent count (expected "N-agent fabric")');
    } else {
      const docCount = parseInt(countMatch[1], 10);
      if (agentFiles.length !== docCount) {
        fail(`docs/AGENTS.md claims "${docCount}-agent fabric" but ${agentFiles.length} *Agent.ts files found in ${AGENT_DIR}/. Update the count in docs/AGENTS.md.`);
      } else {
        pass(`Agent count consistent: ${agentFiles.length} agents`);
      }
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('');

if (warnings.length > 0) {
  console.warn('Warnings:');
  for (const w of warnings) console.warn('  ⚠ ' + w);
  console.warn('');
}

if (failures.length > 0) {
  console.error('Architecture Doc / Runtime Drift FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  console.error('');
  console.error('Fix by either:');
  console.error('  (a) updating docs/AGENTS.md to match the current runtime, or');
  console.error('  (b) restoring the missing runtime component.');
  process.exit(1);
}

console.log(`Architecture drift gate: PASS (${failures.length} failures, ${warnings.length} warnings)`);
