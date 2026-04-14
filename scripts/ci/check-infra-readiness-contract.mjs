#!/usr/bin/env node
/**
 * check-infra-readiness-contract.mjs
 *
 * Enforces the infra readiness contract identified in the production sign-off
 * review (docs/production-sign-off-review.md). It combines static source
 * assertions with optional live Kubernetes validations during deploy-time gates.
 *
 * Checks:
 *   1. NATS deployment manifest exists and is referenced in kustomization
 *   2. LLMCache keys are tenant-scoped (no un-prefixed llm:cache:{model}: pattern)
 *   3. RLS test suite cannot be silently skipped — describe.skipIf must not gate
 *      on a condition that is always false when Supabase secrets are absent
 *   4. UsageEmitter failedEventsBuffer has a documented drain path
 *   5. BullMQ workers restore tenant context from job payload before processing
 *   6. Billing alert metric contract (alerts reference metrics that actually exist)
 *   7. Optional live kubectl checks for messaging, collectors, and monitoring targets
 *
 * Exit 1 if any check fails.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const failures = [];
const warnings = [];
const liveChecks = [];
const artifactRoot = process.env.INFRA_CONFORMANCE_ARTIFACT_DIR || 'artifacts/infra-conformance';
const runId = process.env.GITHUB_RUN_ID || 'local';
const artifactDir = join(ROOT, artifactRoot);
const reportJsonPath = join(artifactDir, `infra-readiness-report-${runId}.json`);
const reportMdPath = join(artifactDir, `infra-readiness-report-${runId}.md`);
const enableLiveChecks = process.env.INFRA_READINESS_LIVE_CHECKS === 'true';
const kubeNamespace = process.env.INFRA_READINESS_NAMESPACE || 'valueos';
const observabilityNamespace = process.env.INFRA_READINESS_OBSERVABILITY_NAMESPACE || 'observability';

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function fail(msg) { failures.push(msg); }
function warn(msg) { warnings.push(msg); }
function pass(msg) { console.log('  ✓ ' + msg); }
function passLive(msg) {
  liveChecks.push({ status: 'pass', message: msg });
  pass(msg);
}
function failLive(msg) {
  liveChecks.push({ status: 'fail', message: msg });
  fail(msg);
}
function warnLive(msg) {
  liveChecks.push({ status: 'warn', message: msg });
  warn(msg);
}
function runKubectl(args) {
  const cmd = `kubectl ${args}`;
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    const detail = stderr || stdout || error?.message || 'unknown kubectl error';
    throw new Error(`${cmd} failed: ${detail}`);
  }
}

console.log('\nInfra Readiness Contract Gate\n');

// ── Check 1: NATS JetStream deployment manifest exists and is in kustomization ─
console.log('1. NATS JetStream deployment manifest');
{
  const natsManifest = read('infra/k8s/base/nats-jetstream.yaml');
  if (!natsManifest) {
    fail('infra/k8s/base/nats-jetstream.yaml is missing — metering pipeline has no NATS deployment');
  } else if (!/kind:\s*StatefulSet|kind:\s*Deployment/m.test(natsManifest)) {
    fail('infra/k8s/base/nats-jetstream.yaml exists but contains no StatefulSet or Deployment — NATS may not be deployed');
  } else {
    pass('nats-jetstream.yaml contains a deployable workload');
  }

  const kustomization = read('infra/k8s/base/kustomization.yaml');
  if (!kustomization) {
    fail('infra/k8s/base/kustomization.yaml is missing');
  } else if (!/nats-jetstream\.yaml/.test(kustomization)) {
    fail('infra/k8s/base/kustomization.yaml does not reference nats-jetstream.yaml — NATS will not be deployed by kustomize');
  } else {
    pass('kustomization.yaml references nats-jetstream.yaml');
  }
}

// ── Check 2: LLMCache keys are tenant-scoped ────────────────────────────────
console.log('\n2. LLMCache tenant-scoped key construction');
{
  // The canonical implementation must include tenantId in the key
  const coreCache = read('packages/backend/src/services/core/LLMCache.ts');
  if (!coreCache) {
    fail('packages/backend/src/services/core/LLMCache.ts is missing');
  } else {
    // Must have tenantId in the key builder
    if (!/tenantId/.test(coreCache)) {
      fail('LLMCache.ts: buildLLMCacheKey does not reference tenantId — cross-tenant cache hits possible');
    } else {
      pass('LLMCache.ts includes tenantId in key construction');
    }

    // Must throw when tenantId is absent
    if (!/throw.*tenantId|tenantId.*required/i.test(coreCache)) {
      fail('LLMCache.ts: missing guard that throws when tenantId is absent — silent cross-tenant leakage possible');
    } else {
      pass('LLMCache.ts throws when tenantId is absent');
    }

    // Must NOT have the old un-prefixed key pattern: llm:cache:{model}:{hash}
    // (i.e. the key format must include tenantId between "llm:cache:" and the model)
    if (/`llm:cache:\$\{model\}/.test(coreCache)) {
      fail('LLMCache.ts: old un-prefixed key format detected — llm:cache:{model}:{hash} shares cache across tenants');
    } else {
      pass('LLMCache.ts does not use un-prefixed key format');
    }
  }
}

// ── Check 3: RLS tests cannot be silently skipped ───────────────────────────
console.log('\n3. RLS test suite cannot be silently skipped');
{
  // The pr-fast.yml tenant-isolation-gate must assert a minimum test count
  const prFast = read('.github/workflows/pr-fast.yml');
  if (!prFast) {
    fail('.github/workflows/pr-fast.yml is missing');
  } else {
    if (!/Assert RLS test count|numPassedTests|PASSED.*-lt/m.test(prFast)) {
      fail('.github/workflows/pr-fast.yml: no assertion that RLS tests actually ran — describe.skipIf can silently pass the gate');
    } else {
      pass('pr-fast.yml asserts minimum RLS test count');
    }
  }

  // The security test config must not have a global skipIf that fires when secrets are absent
  const rlsTest = read('tests/security/rls-tenant-isolation.test.ts');
  if (rlsTest) {
    // Warn if the entire suite is wrapped in a single skipIf — the CI gate
    // must assert count > 0 to catch this
    if (/describe\.skipIf\s*\(/.test(rlsTest)) {
      warn('tests/security/rls-tenant-isolation.test.ts uses describe.skipIf — ensure CI asserts test count > 0');
    } else {
      pass('rls-tenant-isolation.test.ts does not use top-level describe.skipIf');
    }
  }
}

// ── Check 4: UsageEmitter has a documented drain path for failedEventsBuffer ─
console.log('\n4. UsageEmitter failedEventsBuffer drain path');
{
  const emitter = read('packages/backend/src/services/metering/UsageEmitter.ts');
  if (!emitter) {
    fail('packages/backend/src/services/metering/UsageEmitter.ts is missing');
  } else {
    if (!/failedEventsBuffer/.test(emitter)) {
      // Buffer removed — that's fine, check passes
      pass('UsageEmitter: no in-memory failedEventsBuffer (buffer removed or renamed)');
    } else {
      // Buffer exists — must have retryFailedEvents or equivalent drain
      if (!/retryFailedEvents|drainBuffer|persistFailedEvents/.test(emitter)) {
        fail('UsageEmitter: failedEventsBuffer exists but no drain method (retryFailedEvents/drainBuffer) found — events dropped on process restart');
      } else {
        pass('UsageEmitter: failedEventsBuffer has a drain method');
      }

      // Must have a cap to prevent unbounded growth
      if (!/10000|MAX_BUFFER|maxBuffer|bufferLimit/.test(emitter)) {
        warn('UsageEmitter: failedEventsBuffer cap not found — verify buffer is bounded');
      } else {
        pass('UsageEmitter: failedEventsBuffer is bounded');
      }
    }
  }
}

// ── Check 5: BullMQ workers restore tenant context before processing ─────────
console.log('\n5. BullMQ workers restore tenant context');
{
  const workerFiles = [
    'packages/backend/src/workers/researchWorker.ts',
    'packages/backend/src/workers/billingAggregatorWorker.ts',
  ];

  for (const rel of workerFiles) {
    const src = read(rel);
    if (!src) {
      warn(`${rel} not found — skipping tenant context check`);
      continue;
    }

    const hasTenantId = /tenantId|tenant_id|organizationId|organization_id/.test(src);
    const restoresTenantContext = /tenantContextStorage\.run|AsyncLocalStorage.*run|runWithTenantContext|runJobWithTenantContext/.test(src);

    if (!hasTenantId) {
      warn(`${rel}: no tenantId reference found — verify tenant isolation in worker`);
    } else if (!restoresTenantContext) {
      fail(`${rel}: reads tenantId from job payload but does not call tenantContextStorage.run() — downstream CacheService/logger calls use tenant:global: prefix`);
    } else {
      pass(`${rel}: restores tenant context via AsyncLocalStorage`);
    }
  }
}

// ── Check 6: Billing alert metric contract ───────────────────────────────────
console.log('\n6. Billing alert metric contract');
{
  const alerts = read('infra/k8s/monitoring/billing-alerts.yaml');
  const metrics = read('packages/backend/src/metrics/billingMetrics.ts');

  if (!alerts) {
    fail('infra/k8s/monitoring/billing-alerts.yaml is missing');
  }

  if (!metrics) {
    fail('packages/backend/src/metrics/billingMetrics.ts is missing');
  }

  if (alerts && metrics) {
    const emittedMetricNames = new Set(
      [...metrics.matchAll(/name:\s*["']([a-zA-Z_:][a-zA-Z0-9_:]*)["']/g)].map((m) => m[1]),
    );

    const extractAlertExpressions = (source) => {
      const lines = source.split(/\r?\n/);
      const expressions = [];

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const match = line.match(/^(\s*)expr:\s*(.*)$/);
        if (!match) continue;

        const baseIndent = match[1].length;
        const value = match[2].trim();

        if (value === '|' || value === '>' || value === '|-' || value === '>-') {
          const blockLines = [];
          for (let j = i + 1; j < lines.length; j += 1) {
            const blockLine = lines[j];
            const indent = blockLine.match(/^\s*/)?.[0].length ?? 0;

            if (blockLine.trim().length > 0 && indent <= baseIndent) {
              i = j - 1;
              break;
            }

            if (blockLine.trim().length === 0) {
              blockLines.push('');
              continue;
            }

            blockLines.push(blockLine.slice(baseIndent + 2));

            if (j === lines.length - 1) {
              i = j;
            }
          }

          expressions.push(blockLines.join('\n'));
          continue;
        }

        if (value.length > 0) {
          expressions.push(value);
        }
      }

      return expressions;
    };

    const exprBlocks = extractAlertExpressions(alerts);

    const promQlKeywords = new Set([
      'and', 'or', 'unless', 'by', 'without', 'on', 'ignoring', 'group_left', 'group_right',
      'bool',
    ]);

    const promQlFunctions = new Set([
      'rate', 'increase', 'histogram_quantile', 'clamp_min', 'time',
    ]);

    const contractPrefixes = ['billing_', 'webhook_', 'webhooks_'];
    const missingMetricRefs = new Set();

    for (const block of exprBlocks) {
      const normalized = block.replace(/"[^"\n]*"|'[^'\n]*'/g, ' ');
      for (const match of normalized.matchAll(/[a-zA-Z_:][a-zA-Z0-9_:]*/g)) {
        const token = match[0];

        if (promQlKeywords.has(token) || promQlFunctions.has(token)) {
          continue;
        }

        const isContractMetric = contractPrefixes.some((prefix) => token.startsWith(prefix));
        if (!isContractMetric) {
          continue;
        }

        const baseMetricName = token.replace(/_(bucket|sum|count)$/, '');
        const hasHistogramDerivative = baseMetricName !== token && emittedMetricNames.has(baseMetricName);

        if (!emittedMetricNames.has(token) && !hasHistogramDerivative) {
          missingMetricRefs.add(token);
        }
      }
    }

    if (missingMetricRefs.size > 0) {
      fail(
        'billing-alerts.yaml references metric(s) not emitted by billingMetrics.ts: '
          + [...missingMetricRefs].sort().join(', '),
      );
    } else {
      pass('billing-alerts.yaml metric references are emitted by billingMetrics.ts');
    }
  }
}

// ── Check 7: Live Kubernetes state checks (deploy-time gate) ────────────────
console.log('\n7. Live Kubernetes state checks (messaging, collectors, monitoring)');
{
  if (!enableLiveChecks) {
    warnLive('Live checks disabled. Set INFRA_READINESS_LIVE_CHECKS=true to validate cluster state.');
  } else if (!process.env.KUBECONFIG && !existsSync(resolve(process.env.HOME || '~', '.kube/config'))) {
    warnLive('Live checks requested but kubeconfig not found. Skipping live kubectl validations.');
  } else {
    try {
      const natsReady = runKubectl(`-n ${kubeNamespace} get statefulset metering-nats -o jsonpath='{.status.readyReplicas}'`).replace(/'/g, '');
      if (Number.parseInt(natsReady || '0', 10) >= 1) {
        passLive(`NATS JetStream readyReplicas=${natsReady || 0} in namespace ${kubeNamespace}`);
      } else {
        failLive(`NATS JetStream has no ready replicas in namespace ${kubeNamespace}`);
      }
    } catch (error) {
      failLive(`Failed to verify NATS JetStream health: ${error.message}`);
    }

    try {
      const collectorAvailable = runKubectl(`-n ${observabilityNamespace} get deployment otel-collector -o jsonpath='{.status.availableReplicas}'`).replace(/'/g, '');
      if (Number.parseInt(collectorAvailable || '0', 10) >= 1) {
        passLive(`OTel collector availableReplicas=${collectorAvailable || 0} in namespace ${observabilityNamespace}`);
      } else {
        failLive(`OTel collector has no available replicas in namespace ${observabilityNamespace}`);
      }
    } catch (error) {
      failLive(`Failed to verify OTel collector health: ${error.message}`);
    }

    try {
      const serviceMonitor = runKubectl(`-n ${kubeNamespace} get servicemonitor billing-aggregator-worker -o name`);
      if (serviceMonitor.includes('servicemonitor')) {
        passLive(`Monitoring target present: ${serviceMonitor}`);
      } else {
        failLive('billing-aggregator-worker ServiceMonitor not found');
      }
    } catch (error) {
      failLive(`Failed to verify billing ServiceMonitor presence: ${error.message}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('');

mkdirSync(artifactDir, { recursive: true });
const report = {
  generated_at_utc: new Date().toISOString(),
  run_id: runId,
  live_checks_enabled: enableLiveChecks,
  namespaces: {
    app: kubeNamespace,
    observability: observabilityNamespace,
  },
  failures,
  warnings,
  live_checks: liveChecks,
  status: failures.length > 0 ? 'failed' : 'passed',
};
writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
writeFileSync(
  reportMdPath,
  [
    '# Infra Readiness Contract Report',
    '',
    `- generated_at_utc: ${report.generated_at_utc}`,
    `- run_id: ${report.run_id}`,
    `- live_checks_enabled: ${report.live_checks_enabled}`,
    `- status: ${report.status}`,
    `- app_namespace: ${kubeNamespace}`,
    `- observability_namespace: ${observabilityNamespace}`,
    `- failures: ${failures.length}`,
    `- warnings: ${warnings.length}`,
    '',
    '## Live Checks',
    ...(liveChecks.length === 0
      ? ['- (none)']
      : liveChecks.map((item) => `- [${item.status}] ${item.message}`)),
  ].join('\n') + '\n',
  'utf8',
);
console.log(`Wrote infra readiness artifacts:\n  - ${reportJsonPath}\n  - ${reportMdPath}\n`);

if (warnings.length > 0) {
  console.warn('Warnings:');
  for (const w of warnings) console.warn('  ⚠ ' + w);
  console.warn('');
}

if (failures.length > 0) {
  console.error('Infra Readiness Contract FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  console.error('');
  console.error('These gaps were identified in docs/production-sign-off-review.md.');
  console.error('Each failure represents a production-breaking condition.');
  process.exit(1);
}

console.log(`Infra Readiness Contract: PASS (${failures.length} failures, ${warnings.length} warnings)`);
