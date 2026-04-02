#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const metricsSourceFile = 'packages/backend/src/metrics/billingMetrics.ts';
const manifestFile = 'docs/observability/billing-metrics-manifest.json';
const billingAlertsFile = 'infra/k8s/monitoring/billing-alerts.yaml';

const promQlFunctionNames = new Set([
  'abs', 'absent', 'absent_over_time', 'avg', 'avg_over_time', 'ceil', 'changes', 'clamp', 'clamp_max', 'clamp_min',
  'count', 'count_over_time', 'day_of_month', 'day_of_week', 'day_of_year', 'delta', 'deriv', 'exp', 'floor', 'histogram_avg',
  'histogram_count', 'histogram_fraction', 'histogram_quantile', 'histogram_sum', 'holt_winters', 'hour', 'idelta', 'increase',
  'irate', 'label_join', 'label_replace', 'last_over_time', 'ln', 'log10', 'log2', 'max', 'max_over_time', 'min',
  'min_over_time', 'minute', 'month', 'predict_linear', 'present_over_time', 'quantile', 'quantile_over_time', 'rate', 'resets',
  'round', 'scalar', 'sgn', 'sort', 'sort_desc', 'sqrt', 'stddev', 'stddev_over_time', 'stdvar', 'stdvar_over_time',
  'sum', 'sum_over_time', 'time', 'timestamp', 'vector', 'year', 'bool', 'on', 'ignoring', 'group_left', 'group_right',
  'and', 'or', 'unless', 'by', 'without'
]);

const managedMetricPrefixes = ['billing_', 'webhook_', 'webhooks_', 'partition_', 'subscription_'];
const histogramSuffixes = ['_bucket', '_sum', '_count'];

function parseMetricNamesFromSource(sourceText) {
  return new Set([...sourceText.matchAll(/name:\s*"([a-zA-Z_:][a-zA-Z0-9_:]*)"/g)].map((match) => match[1]));
}

function extractPromQlExprBlocks(yamlText) {
  const lines = yamlText.split('\n');
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^(\s*)expr:\s*\|\s*$/);
    if (!match) {
      continue;
    }

    const exprIndent = match[1].length;
    const exprLines = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j];
      if (nextLine.trim().length === 0) {
        exprLines.push('');
        continue;
      }

      const indent = nextLine.match(/^\s*/)?.[0]?.length ?? 0;
      if (indent <= exprIndent) {
        i = j - 1;
        break;
      }

      exprLines.push(nextLine.trim());
      if (j === lines.length - 1) {
        i = j;
      }
    }

    if (exprLines.length > 0) {
      blocks.push(exprLines.join('\n'));
    }
  }

  return blocks;
}

function parseManagedMetricReferences(exprBlocks) {
  const refs = new Set();

  for (const expr of exprBlocks) {
    const tokens = expr.match(/\b[a-zA-Z_:][a-zA-Z0-9_:]*\b/g) ?? [];
    for (const token of tokens) {
      if (promQlFunctionNames.has(token)) {
        continue;
      }
      if (token === 'le' || token === 'job_name' || token === 'cronjob' || token === 'queue' || token === 'status' || token === 'event_type' || token === 'metric' || token === 'tenant_id') {
        continue;
      }
      if (managedMetricPrefixes.some((prefix) => token.startsWith(prefix))) {
        refs.add(token);
      }
    }
  }

  return refs;
}

const sourceText = await readFile(path.join(repoRoot, metricsSourceFile), 'utf8');
const manifestRaw = await readFile(path.join(repoRoot, manifestFile), 'utf8');
const alertRulesYaml = await readFile(path.join(repoRoot, billingAlertsFile), 'utf8');

const sourceMetricNames = parseMetricNamesFromSource(sourceText);
const manifest = JSON.parse(manifestRaw);
const manifestMetricNames = new Set((manifest.metrics ?? []).map((entry) => entry.name));

const missingFromManifest = [...sourceMetricNames].filter((name) => !manifestMetricNames.has(name));
const unknownInManifest = [...manifestMetricNames].filter((name) => !sourceMetricNames.has(name));

const exprBlocks = extractPromQlExprBlocks(alertRulesYaml);
const metricReferences = parseManagedMetricReferences(exprBlocks);
const normalizedAlertMetricRefs = [...metricReferences].map((metric) => {
  const suffix = histogramSuffixes.find((candidate) => metric.endsWith(candidate));
  if (!suffix) {
    return metric;
  }

  return metric.slice(0, -suffix.length);
});
const unknownInAlerts = normalizedAlertMetricRefs.filter((metric) => !manifestMetricNames.has(metric));

const errors = [];
if (missingFromManifest.length > 0) {
  errors.push(`Manifest missing metrics exported by ${metricsSourceFile}: ${missingFromManifest.sort().join(', ')}`);
}

if (unknownInManifest.length > 0) {
  errors.push(`Manifest contains metrics not found in ${metricsSourceFile}: ${unknownInManifest.sort().join(', ')}`);
}

if (unknownInAlerts.length > 0) {
  errors.push(`Billing alert rules reference unknown managed metrics: ${unknownInAlerts.sort().join(', ')}`);
}

if (errors.length > 0) {
  console.error(`❌ Billing metric validation failed.`);
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('✅ Billing metric validation passed.');
console.log(`Checked ${sourceMetricNames.size} exported backend metrics against ${manifestFile}.`);
console.log(`Validated ${metricReferences.size} managed metric references in ${billingAlertsFile}.`);
