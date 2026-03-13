#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const canonicalFile = path.join(repoRoot, 'packages/backend/src/config/slo.ts');
const k8sRulesFile = path.join(repoRoot, 'infra/k8s/monitoring/prometheus-slo-rules.yaml');
const promAlertsFile = path.join(repoRoot, 'infra/prometheus/alerts/slo-alerts.yml');
const dashboardFile = path.join(repoRoot, 'infra/observability/grafana/dashboards/mission-control.json');
const docsFile = path.join(repoRoot, 'infra/observability/SLOs.md');

const canonicalSource = fs.readFileSync(canonicalFile, 'utf8');

const extractObject = (source, constName) => {
  const expression = new RegExp(`export const ${constName} = \\{([\\s\\S]*?)\\} as const;`, 'm');
  const match = source.match(expression);
  if (!match) {
    throw new Error(`Unable to find ${constName} in ${canonicalFile}`);
  }

  const values = {};
  const linePattern = /^\s*([a-zA-Z0-9_]+):\s*([0-9.]+),?$/gm;
  let lineMatch = linePattern.exec(match[1]);
  while (lineMatch) {
    values[lineMatch[1]] = Number(lineMatch[2]);
    lineMatch = linePattern.exec(match[1]);
  }

  return values;
};

const canonical = extractObject(canonicalSource, 'SLO_BASE_THRESHOLDS');

const expectedTemplateVarsByFile = {
  [k8sRulesFile]: [
    'SLO_API_AVAILABILITY_TARGET',
    'SLO_API_LATENCY_P95_TARGET',
    'SLO_AUTH_SUCCESS_TARGET',
    'SLO_QUEUE_HEALTH_TARGET',
    'SLO_AGENT_COLD_START_TARGET',
    'SLO_API_LATENCY_BUCKET_LE_SECONDS',
    'SLO_AGENT_COLD_START_THRESHOLD_SECONDS',
    'SLO_BURN_RATE_CRITICAL',
  ],
  [promAlertsFile]: [
    'SLO_AVAILABILITY_FAST_BURN_ERROR_RATE_THRESHOLD',
    'SLO_AVAILABILITY_SLOW_BURN_ERROR_RATE_THRESHOLD',
    'SLO_MAX_P95_LATENCY_MS',
    'SLO_MAX_MTTR_MINUTES',
  ],
  [dashboardFile]: [
    'SLO_MAX_P95_LATENCY_MS',
    'SLO_WARN_P95_LATENCY_MS',
    'SLO_MAX_ERROR_RATE',
    'SLO_WARN_ERROR_RATE',
    'SLO_MAX_MTTR_MINUTES',
    'SLO_WARN_MTTR_MINUTES',
  ],
};

const errors = [];

for (const [file, requiredTemplateVars] of Object.entries(expectedTemplateVarsByFile)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const variable of requiredTemplateVars) {
    const token = '${' + variable + '}';
    if (!content.includes(token)) {
      errors.push(`${path.relative(repoRoot, file)} is missing template variable ${token}`);
    }
  }
}

const docsSource = fs.readFileSync(docsFile, 'utf8');
const docsExpected = {
  SLO_MAX_P95_LATENCY_MS: canonical.maxP95LatencyMs,
  SLO_MAX_ERROR_RATE: canonical.maxErrorRate,
  SLO_MAX_MTTR_MINUTES: canonical.maxMttrMinutes,
  SLO_WARN_P95_LATENCY_MS: canonical.warnP95LatencyMs,
  SLO_WARN_ERROR_RATE: canonical.warnErrorRate,
  SLO_WARN_MTTR_MINUTES: canonical.warnMttrMinutes,
  SLO_API_AVAILABILITY_TARGET: canonical.apiAvailabilityTarget,
  SLO_API_LATENCY_P95_TARGET: canonical.apiLatencyP95Target,
  SLO_AUTH_SUCCESS_TARGET: canonical.authSuccessTarget,
  SLO_QUEUE_HEALTH_TARGET: canonical.queueHealthTarget,
  SLO_AGENT_COLD_START_TARGET: canonical.agentColdStartTarget,
  SLO_API_LATENCY_BUCKET_LE_SECONDS: canonical.apiLatencyBucketLeSeconds,
  SLO_AGENT_COLD_START_THRESHOLD_SECONDS: canonical.agentColdStartThresholdSeconds,
  SLO_BURN_RATE_CRITICAL: canonical.burnRateCritical,
  SLO_AVAILABILITY_FAST_BURN_ERROR_RATE_THRESHOLD: canonical.availabilityFastBurnErrorRateThreshold,
  SLO_AVAILABILITY_SLOW_BURN_ERROR_RATE_THRESHOLD: canonical.availabilitySlowBurnErrorRateThreshold,
};

for (const [envVar, expectedValue] of Object.entries(docsExpected)) {
  const matcher = new RegExp(`- \\\`${envVar}=([0-9.]+)\\\``);
  const match = docsSource.match(matcher);
  if (!match) {
    errors.push(`Missing ${envVar} default in ${path.relative(repoRoot, docsFile)}`);
    continue;
  }

  const actualValue = Number(match[1]);
  if (Number.isNaN(actualValue) || actualValue !== expectedValue) {
    errors.push(`Docs default for ${envVar} is ${match[1]}, expected ${expectedValue}`);
  }
}

if (errors.length > 0) {
  console.error('SLO threshold consistency check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SLO thresholds are consistent across canonical config, templates, and docs.');
