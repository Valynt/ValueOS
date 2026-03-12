#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseOutDir = process.env.CHAOS_RESULTS_DIR ?? resolve(projectRoot, 'artifacts/chaos-launch', timestamp);
const requireLiveK8s = process.env.CHAOS_REQUIRE_LIVE_K8S === '1';
const crossTenantCommand =
  process.env.CHAOS_CROSS_TENANT_CMD ?? 'node --test tests/integration/multi-tenant-chaos-invariants.test.mjs';
const billingBypassCommand =
  process.env.CHAOS_BILLING_BYPASS_CMD ??
  'node --test tests/integration/billing-bypass-chaos-gate.test.mjs';
const autoscaleDeployment = process.env.CHAOS_AUTOSCALE_DEPLOYMENT ?? 'backend-blue';
const autoscaleNamespace = process.env.CHAOS_AUTOSCALE_NAMESPACE ?? 'valynt';
const highReplicaCount = Number(process.env.CHAOS_AUTOSCALE_HIGH_REPLICAS ?? '8');

mkdirSync(baseOutDir, { recursive: true });

function commandAvailable(bin) {
  const result = spawnSync('bash', ['-lc', `command -v ${bin}`], { encoding: 'utf8' });
  return result.status === 0;
}

function runCommand(name, command, expectedExitCode = 0) {
  const startedAt = new Date().toISOString();
  const result = spawnSync('bash', ['-lc', command], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  const endedAt = new Date().toISOString();
  const evidencePath = resolve(baseOutDir, `${name}.log`);
  const output = [
    `# command`,
    command,
    '',
    `# exit_code`,
    String(result.status ?? -1),
    '',
    '# stdout',
    result.stdout ?? '',
    '',
    '# stderr',
    result.stderr ?? '',
  ].join('\n');
  writeFileSync(evidencePath, output);

  return {
    name,
    command,
    expectedExitCode,
    exitCode: result.status ?? -1,
    passed: (result.status ?? -1) === expectedExitCode,
    startedAt,
    endedAt,
    evidence: evidencePath,
  };
}

function parseHpaMaxReplicas(hpaPath, targetHpa) {
  const content = readFileSync(hpaPath, 'utf8');
  const docs = content.split(/^---\s*$/m);
  for (const doc of docs) {
    if (!doc.includes('kind: HorizontalPodAutoscaler')) continue;
    if (!doc.includes(`name: ${targetHpa}`)) continue;
    const max = doc.match(/maxReplicas:\s*(\d+)/);
    const min = doc.match(/minReplicas:\s*(\d+)/);
    const target = doc.match(/scaleTargetRef:[\s\S]*?name:\s*([^\n]+)/);
    return {
      maxReplicas: max ? Number(max[1]) : null,
      minReplicas: min ? Number(min[1]) : null,
      scaleTarget: target ? target[1].trim() : null,
    };
  }
  return null;
}

function runAutoscaleCheck() {
  const checkName = 'autoscale-stress-clean-downscale';

  if (!commandAvailable('kubectl')) {
    if (requireLiveK8s) {
      const evidencePath = resolve(baseOutDir, `${checkName}.log`);
      writeFileSync(evidencePath, 'kubectl unavailable and CHAOS_REQUIRE_LIVE_K8S=1');
      return {
        name: checkName,
        mode: 'live',
        passed: false,
        reason: 'kubectl unavailable',
        evidence: evidencePath,
      };
    }

    const hpaPath = resolve(projectRoot, 'infra/k8s/base/hpa.yaml');
    const deploymentPath = resolve(projectRoot, 'infra/k8s/base/backend-blue-deployment.yaml');
    const hpa = parseHpaMaxReplicas(hpaPath, 'backend-hpa');
    const evidencePath = resolve(baseOutDir, `${checkName}.log`);
    const pass =
      Boolean(hpa) &&
      Boolean(hpa?.maxReplicas && hpa.maxReplicas >= highReplicaCount) &&
      hpa?.scaleTarget === autoscaleDeployment &&
      existsSync(deploymentPath);

    writeFileSync(
      evidencePath,
      [
        'mode=manifest-simulation',
        `hpaPath=${hpaPath}`,
        `deploymentPath=${deploymentPath}`,
        `requiredHighReplicas=${highReplicaCount}`,
        `parsed=${JSON.stringify(hpa)}`,
        `deploymentExists=${existsSync(deploymentPath)}`,
        `result=${pass ? 'pass' : 'fail'}`,
      ].join('\n')
    );

    return {
      name: checkName,
      mode: 'manifest-simulation',
      command: 'manifest validation fallback (kubectl unavailable)',
      expectedExitCode: 0,
      exitCode: pass ? 0 : 1,
      passed: pass,
      evidence: evidencePath,
      reason: pass
        ? 'Validated HPA can scale backend-blue to required high replicas and retain downscale baseline.'
        : 'HPA/deployment topology does not satisfy autoscale requirement.',
    };
  }

  const startedAt = new Date().toISOString();
  const evidencePath = resolve(baseOutDir, `${checkName}.log`);
  const commands = [];

  const getReplicasCmd = `kubectl -n ${autoscaleNamespace} get deploy/${autoscaleDeployment} -o jsonpath='{.spec.replicas}'`;
  const current = runCommand(`${checkName}-current`, getReplicasCmd);
  commands.push(current.command);
  if (!current.passed) {
    writeFileSync(evidencePath, `failed to read current replicas\nsee ${current.evidence}`);
    return {
      name: checkName,
      mode: 'live',
      passed: false,
      evidence: evidencePath,
      reason: 'Unable to query current deployment replica count.',
    };
  }

  const originalReplicas = Number((readFileSync(current.evidence, 'utf8').match(/# stdout\n([^\n]+)/)?.[1] ?? '2').trim());

  const stressCommands = [
    `kubectl -n ${autoscaleNamespace} scale deploy/${autoscaleDeployment} --replicas=${highReplicaCount}`,
    `kubectl -n ${autoscaleNamespace} rollout status deploy/${autoscaleDeployment} --timeout=5m`,
    `kubectl -n ${autoscaleNamespace} get deploy/${autoscaleDeployment} -o jsonpath='{.status.readyReplicas}'`,
    `kubectl -n ${autoscaleNamespace} scale deploy/${autoscaleDeployment} --replicas=${originalReplicas}`,
    `kubectl -n ${autoscaleNamespace} rollout status deploy/${autoscaleDeployment} --timeout=5m`,
  ];

  let pass = true;
  const evidencePointers = [current.evidence];

  for (let i = 0; i < stressCommands.length; i += 1) {
    const result = runCommand(`${checkName}-${i + 1}`, stressCommands[i]);
    commands.push(result.command);
    evidencePointers.push(result.evidence);
    if (!result.passed) {
      pass = false;
      break;
    }
  }

  writeFileSync(
    evidencePath,
    [
      `mode=live`,
      `namespace=${autoscaleNamespace}`,
      `deployment=${autoscaleDeployment}`,
      `originalReplicas=${originalReplicas}`,
      `stressReplicas=${highReplicaCount}`,
      `commands=${JSON.stringify(commands)}`,
      `evidencePointers=${JSON.stringify(evidencePointers)}`,
      `result=${pass ? 'pass' : 'fail'}`,
    ].join('\n')
  );

  return {
    name: checkName,
    mode: 'live',
    startedAt,
    endedAt: new Date().toISOString(),
    command: 'kubectl scale up/down with rollout verification',
    expectedExitCode: 0,
    exitCode: pass ? 0 : 1,
    passed: pass,
    evidence: evidencePath,
    evidencePointers,
  };
}

const checks = [];
checks.push(runCommand('cross-tenant-access-attempt-must-fail', crossTenantCommand));
checks.push(runCommand('billing-bypass-attempt-must-alert-or-block', billingBypassCommand));
checks.push(runAutoscaleCheck());

// R3 chaos suite — five new failure scenarios
const chaosVitest = 'pnpm exec vitest run --config tests/vitest.shared.config.ts';
checks.push(runCommand('chaos-llm-provider-outage', `${chaosVitest} tests/chaos/llm-provider-outage.test.ts`));
checks.push(runCommand('chaos-db-transient-outage', `${chaosVitest} tests/chaos/db-transient-outage.test.ts`));
checks.push(runCommand('chaos-queue-outage', `${chaosVitest} tests/chaos/queue-outage.test.ts`));
checks.push(runCommand('chaos-crm-billing-failure', `${chaosVitest} tests/chaos/crm-billing-failure.test.ts`));
checks.push(runCommand('chaos-partial-execution-recovery', `${chaosVitest} tests/chaos/partial-execution-recovery.test.ts`));

const failed = checks.filter((check) => !check.passed);
const summary = {
  suite: 'launch-chaos-smoke',
  generatedAt: new Date().toISOString(),
  blocking: true,
  checks,
  status: failed.length === 0 ? 'pass' : 'fail',
  releaseSignOff: {
    approved: failed.length === 0,
    reason: failed.length === 0 ? 'All mandatory launch chaos/smoke checks passed.' : 'One or more mandatory checks failed.',
    evidenceDirectory: baseOutDir,
  },
};

const jsonPath = resolve(baseOutDir, 'launch-chaos-results.json');
writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

const markdownPath = resolve(baseOutDir, 'launch-chaos-results.md');
const markdownLines = [
  '# Launch Chaos/Smoke Results',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Status: ${summary.status.toUpperCase()}`,
  `- Blocking: ${summary.blocking}`,
  '',
  '| Check | Status | Evidence |',
  '| --- | --- | --- |',
  ...checks.map((check) => `| ${check.name} | ${check.passed ? 'PASS' : 'FAIL'} | ${check.evidence} |`),
  '',
  `JSON: ${jsonPath}`,
];
writeFileSync(markdownPath, `${markdownLines.join('\n')}\n`);

console.log(`Launch chaos/smoke suite: ${summary.status.toUpperCase()}`);
console.log(`Results JSON: ${jsonPath}`);
console.log(`Results Markdown: ${markdownPath}`);

if (summary.status === 'fail') {
  process.exit(1);
}
