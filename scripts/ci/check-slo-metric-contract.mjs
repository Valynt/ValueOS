#!/usr/bin/env node

import fs from 'node:fs';

const SLO_RULES_PATH = 'infra/k8s/monitoring/prometheus-slo-rules.yaml';
const BACKEND_METRICS_PATH = 'packages/backend/src/lib/metrics/httpMetrics.ts';
const COLLECTOR_METRICS_PATH = 'infra/observability/prometheus/collector-export-metrics.yaml';

const PROMQL_FUNCTIONS = new Set([
  'sum',
  'rate',
  'avg_over_time',
  'histogram_quantile',
  'vector',
  'bool',
  'and',
  'or',
  'unless',
]);

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

function extractBackendMetricNames(content) {
  // First, collect the names of Histogram metrics so we only add *_bucket/*_count/*_sum
  // for those, and avoid whitelisting the unsuffixed histogram name (prom-client only
  // exports the suffixed series for Histograms).
  const histogramNames = new Set(
    Array.from(
      content.matchAll(
        /Histogram\(\{\s*name:\s*"([a-zA-Z_:][a-zA-Z0-9_:]*)"/g,
      ),
      (match) => match[1],
    ),
  );

  const matches = content.matchAll(/name:\s*"([a-zA-Z_:][a-zA-Z0-9_:]*)"/g);
  const metrics = new Set();
  for (const match of matches) {
    const metricName = match[1];

    if (histogramNames.has(metricName)) {
      // Histograms: prom-client exports only the *_bucket/*_count/*_sum series.
      metrics.add(`${metricName}_bucket`);
      metrics.add(`${metricName}_count`);
      metrics.add(`${metricName}_sum`);
    } else {
      // Counters/Gauges/etc.: export only the base series.
      metrics.add(metricName);
    }
  }

  return metrics;
}

function extractCollectorMetricNames(content) {
  const metrics = new Set();
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*-\s*([a-zA-Z_:][a-zA-Z0-9_:]*)\s*$/);
    if (match) {
      metrics.add(match[1]);
    }
  }
  return metrics;
}

function extractExprBlocks(content) {
  const lines = content.split('\n');
  const expressions = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const blockMatch = line.match(/^(\s*)expr:\s*\|\s*$/);
    if (blockMatch) {
      const indent = blockMatch[1].length;
      const exprLines = [];
      let j = i + 1;
      while (j < lines.length) {
        const candidate = lines[j];
        if (candidate.trim().length === 0) {
          exprLines.push(candidate);
          j += 1;
          continue;
        }

        const candidateIndent = candidate.match(/^\s*/)?.[0].length ?? 0;
        if (candidateIndent <= indent) {
          break;
        }

        exprLines.push(candidate.trim());
        j += 1;
      }

      expressions.push(exprLines.join(' '));
      i = j - 1;
      continue;
    }

    const inlineMatch = line.match(/^\s*expr:\s*(.+)\s*$/);
    if (inlineMatch) {
      expressions.push(inlineMatch[1].trim());
    }
  }

  return expressions;
}

function extractMetricNamesFromExpr(expr) {
  const tokens = Array.from(
    expr.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?=\{|\[)/g),
    (match) => match[1],
  );
  const metrics = new Set();

  for (const token of tokens) {
    if (PROMQL_FUNCTIONS.has(token)) {
      continue;
    }

    if (token.startsWith('slo:')) {
      continue;
    }

    if (!token.includes('_')) {
      continue;
    }

    metrics.add(token);
  }

  return metrics;
}

function main() {
  const backendMetricNames = extractBackendMetricNames(readFile(BACKEND_METRICS_PATH));
  const collectorMetricNames = extractCollectorMetricNames(readFile(COLLECTOR_METRICS_PATH));
  const allowedMetrics = new Set([...backendMetricNames, ...collectorMetricNames]);

  const exprBlocks = extractExprBlocks(readFile(SLO_RULES_PATH));
  const referencedMetrics = new Set();

  for (const expr of exprBlocks) {
    const metrics = extractMetricNamesFromExpr(expr);
    for (const metric of metrics) {
      referencedMetrics.add(metric);
    }
  }

  const unknownMetrics = Array.from(referencedMetrics)
    .filter((metric) => !allowedMetrics.has(metric))
    .sort();

  if (unknownMetrics.length > 0) {
    console.error('❌ SLO rule metric contract check failed.');
    console.error('Unknown metrics referenced in infra/k8s/monitoring/prometheus-slo-rules.yaml:');
    for (const metric of unknownMetrics) {
      console.error(`  - ${metric}`);
    }
    process.exit(1);
  }

  console.log('✅ SLO rule metric contract check passed.');
  console.log(`Validated ${referencedMetrics.size} referenced metrics against backend registry + collector export list.`);
}

main();
