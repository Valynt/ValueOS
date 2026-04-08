#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  const prefix = `${name}=`;
  const inline = process.argv.find(value => value.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  return fallback;
}

function readJsonFile(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function evaluateThreshold(observed, threshold) {
  if (observed == null) {
    return { passed: false, reason: "missing_observation" };
  }

  if (threshold.operator !== "<=") {
    return { passed: false, reason: `unsupported_operator:${threshold.operator}` };
  }

  return {
    passed: observed <= threshold.target,
    reason: observed <= threshold.target ? "ok" : "threshold_exceeded",
  };
}

function metricFromLoadSummary(loadSummary, key) {
  if (key === "p95_latency") {
    return toNumber(loadSummary?.latency_ms?.overall_p95);
  }
  return null;
}

function buildMetricResult(metricName, threshold, agentObservation, loadSummary) {
  const observed = toNumber(agentObservation?.[metricName]) ?? metricFromLoadSummary(loadSummary, metricName);
  const evaluation = evaluateThreshold(observed, threshold);

  return {
    observed,
    operator: threshold.operator,
    target: threshold.target,
    unit: threshold.unit,
    passed: evaluation.passed,
    reason: evaluation.reason,
  };
}

function main() {
  const loadSummaryPath = getArg("--load-summary", "load-test-summary.json");
  const loadResultsPath = getArg("--load-results", "load-test-results.json");
  const thresholdsPath = getArg("--thresholds", "infra/testing/scalability-thresholds.json");
  const observationsPath = getArg("--observations", "artifacts/scalability/autoscaling-observations.json");
  const outputPath = getArg("--output", "artifacts/scalability/hpa-validation.json");

  const loadSummary = readJsonFile(loadSummaryPath);
  const loadResults = readJsonFile(loadResultsPath);
  const thresholdsConfig = readJsonFile(thresholdsPath);
  const observations = readJsonFile(observationsPath);

  const metricThresholds = thresholdsConfig.metric_thresholds;
  const requiredAgentClasses = thresholdsConfig.required_agent_classes ?? [];
  const agentClasses = observations.agent_classes ?? {};

  const missingClasses = requiredAgentClasses.filter(agentClass => !agentClasses[agentClass]);

  const requiredMetrics = Object.keys(metricThresholds);
  const agentClassResults = {};

  for (const agentClass of requiredAgentClasses) {
    const agentObservation = agentClasses[agentClass] ?? {};
    const metrics = {};

    for (const metricName of requiredMetrics) {
      metrics[metricName] = buildMetricResult(
        metricName,
        metricThresholds[metricName],
        agentObservation,
        loadSummary,
      );
    }

    const failedMetrics = Object.entries(metrics)
      .filter(([, metric]) => !metric.passed)
      .map(([name]) => name);

    agentClassResults[agentClass] = {
      metrics,
      passed: failedMetrics.length === 0,
      failed_metrics: failedMetrics,
    };
  }

  const failedAgentClasses = Object.entries(agentClassResults)
    .filter(([, result]) => !result.passed)
    .map(([agentClass]) => agentClass);

  const artifact = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source: {
      load_summary_path: loadSummaryPath,
      load_results_path: loadResultsPath,
      observations_path: observationsPath,
      thresholds_path: thresholdsPath,
      request_count: toNumber(loadSummary?.total_requests),
      thresholds_passed_in_load_test: Boolean(loadSummary?.thresholds_passed),
      k6_http_req_duration_p95_ms: toNumber(loadResults?.metrics?.http_req_duration?.values?.["p(95)"]),
    },
    required_metrics: requiredMetrics,
    required_agent_classes: requiredAgentClasses,
    missing_agent_classes: missingClasses,
    agent_class_results: agentClassResults,
    gate: {
      passed: missingClasses.length === 0 && failedAgentClasses.length === 0,
      failed_agent_classes: failedAgentClasses,
    },
  };

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`Wrote scalability validation artifact: ${outputPath}`);

  if (!artifact.gate.passed) {
    console.error("Scalability gate failed. Review artifacts/scalability/hpa-validation.json");
    process.exit(1);
  }
}

main();
