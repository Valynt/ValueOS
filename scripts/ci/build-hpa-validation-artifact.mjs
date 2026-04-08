#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1] ?? fallback;
  }

  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  return fallback;
}

const loadOutputPath = getArg(
  "--load-output",
  "artifacts/scalability/load-test-output.json"
);
const thresholdsPath = getArg(
  "--thresholds",
  "infra/k8s/scalability-gate-thresholds.json"
);
const artifactPath = getArg(
  "--artifact-path",
  "artifacts/scalability/hpa-validation.json"
);

const requiredMetricKeys = [
  "queue_depth_max",
  "p95_latency_ms",
  "oscillation_count",
  "scale_up_time_seconds",
  "scale_down_time_seconds",
];

function readJson(relativePath, label) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} file not found: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function evaluateMetric(metricName, metricValue, metricThreshold) {
  const operator = metricThreshold.operator;
  const threshold = metricThreshold.threshold;

  if (typeof metricValue !== "number" || Number.isNaN(metricValue)) {
    return {
      pass: false,
      reason: `${metricName} is missing or non-numeric`,
    };
  }

  let pass = false;
  if (operator === "<=") {
    pass = metricValue <= threshold;
  } else if (operator === "<") {
    pass = metricValue < threshold;
  } else if (operator === ">=") {
    pass = metricValue >= threshold;
  } else if (operator === ">") {
    pass = metricValue > threshold;
  } else if (operator === "==") {
    pass = metricValue === threshold;
  } else {
    return {
      pass: false,
      reason: `${metricName} uses unsupported operator \"${operator}\"`,
    };
  }

  return {
    pass,
    reason: pass
      ? ""
      : `${metricName} ${metricValue} failed ${operator} ${threshold}`,
  };
}

function main() {
  const loadOutput = readJson(loadOutputPath, "Load output");
  const thresholds = readJson(thresholdsPath, "Thresholds");

  if (!Array.isArray(loadOutput.agent_classes)) {
    throw new Error("Load output must include an array at agent_classes.");
  }

  const thresholdDefinitions = thresholds.required_metrics ?? {};

  for (const key of requiredMetricKeys) {
    if (!thresholdDefinitions[key]) {
      throw new Error(`Thresholds file missing required metric definition: ${key}`);
    }
  }

  const evaluatedClasses = loadOutput.agent_classes.map((agentMetrics) => {
    const violations = [];

    for (const metricKey of requiredMetricKeys) {
      const evaluation = evaluateMetric(
        metricKey,
        agentMetrics[metricKey],
        thresholdDefinitions[metricKey]
      );

      if (!evaluation.pass) {
        violations.push(evaluation.reason);
      }
    }

    return {
      agent_class: agentMetrics.agent_class,
      scaler_type: agentMetrics.scaler_type,
      metrics: Object.fromEntries(
        requiredMetricKeys.map((metricKey) => [metricKey, agentMetrics[metricKey]])
      ),
      pass: violations.length === 0,
      violations,
    };
  });

  const failedAgentClasses = evaluatedClasses
    .filter((entry) => !entry.pass)
    .map((entry) => entry.agent_class);

  const output = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source: {
      load_output: loadOutputPath,
      run_id: loadOutput.source?.run_id ?? "unknown",
      tool: loadOutput.source?.tool ?? "unknown",
    },
    required_metrics: thresholdDefinitions,
    agent_classes: evaluatedClasses,
    summary: {
      total_agent_classes: evaluatedClasses.length,
      passing_agent_classes: evaluatedClasses.length - failedAgentClasses.length,
      failed_agent_classes: failedAgentClasses,
    },
    gate_status: failedAgentClasses.length === 0 ? "pass" : "fail",
  };

  const artifactAbsolutePath = path.resolve(process.cwd(), artifactPath);
  fs.mkdirSync(path.dirname(artifactAbsolutePath), { recursive: true });
  fs.writeFileSync(artifactAbsolutePath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(`Wrote scalability artifact: ${artifactPath}`);
  if (failedAgentClasses.length > 0) {
    console.log(`Failed agent classes: ${failedAgentClasses.join(", ")}`);
  } else {
    console.log("All agent classes passed scalability thresholds.");
  }
}

main();
