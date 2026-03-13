#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sloRulesFile = "infra/k8s/monitoring/prometheus-slo-rules.yaml";
const backendRegistryFile = "packages/backend/src/lib/metrics/httpMetrics.ts";


function expandHistogramSeries(metricNames) {
  const expanded = new Set(metricNames);
  for (const name of metricNames) {
    expanded.add(`${name}_bucket`);
    expanded.add(`${name}_count`);
    expanded.add(`${name}_sum`);
  }
  return expanded;
}

const collectorExportedMetrics = new Set([
  "agent_enqueue_to_ready_seconds_bucket",
  "agent_enqueue_to_ready_seconds_count",
  "auth_attempts_total",
  "queue_depth",
  "queue_oldest_message_age_seconds",
]);

function extractBackendMetricNames(source) {
  const matches = source.matchAll(/name:\s*"([a-zA-Z_:][a-zA-Z0-9_:]*)"/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

function extractPromqlMetrics(source) {
  const metrics = new Set();
  const rateMatches = source.matchAll(/rate\(\s*([a-zA-Z_:][a-zA-Z0-9_:]*)/g);
  const avgMatches = source.matchAll(/avg_over_time\(\s*\(?\s*([a-zA-Z_:][a-zA-Z0-9_:]*)/g);

  for (const match of rateMatches) {
    metrics.add(match[1]);
  }

  for (const match of avgMatches) {
    metrics.add(match[1]);
  }

  return metrics;
}

const sloRulesPath = path.resolve(repoRoot, sloRulesFile);
const backendRegistryPath = path.resolve(repoRoot, backendRegistryFile);

const [sloRules, backendRegistry] = await Promise.all([
  readFile(sloRulesPath, "utf8"),
  readFile(backendRegistryPath, "utf8"),
]);

const backendMetricNames = extractBackendMetricNames(backendRegistry);
const expressionMetrics = extractPromqlMetrics(sloRules);

const backendSeries = expandHistogramSeries(backendMetricNames);
const allowedMetrics = new Set([...backendSeries, ...collectorExportedMetrics]);
const unknownMetrics = Array.from(expressionMetrics).filter((metric) => !allowedMetrics.has(metric));

if (unknownMetrics.length > 0) {
  console.error(`❌ SLO rule metrics contract check failed for ${sloRulesFile}.`);
  console.error(`Backend registry source: ${backendRegistryFile}`);
  console.error("Unknown metric references:");
  for (const metric of unknownMetrics.sort()) {
    console.error(` - ${metric}`);
  }
  process.exit(1);
}

console.log(`✅ SLO rule metrics contract check passed for ${sloRulesFile}.`);
console.log(`Validated ${expressionMetrics.size} metric reference(s) against ${allowedMetrics.size} allowed metric(s).`);
