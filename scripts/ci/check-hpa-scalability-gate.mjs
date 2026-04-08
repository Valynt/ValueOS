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

const artifactPath = getArg(
  "--artifact-path",
  "artifacts/scalability/hpa-validation.json"
);
const ledgerPath = getArg(
  "--ledger-path",
  "infra/k8s/manifest-maturity-ledger.json"
);

const requiredMetrics = new Set([
  "queue_depth_max",
  "p95_latency_ms",
  "oscillation_count",
  "scale_up_time_seconds",
  "scale_down_time_seconds",
]);

function readJson(relativePath, label) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} file not found: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function getManifestEntryByClass(ledger, manifestClass) {
  return (ledger.manifests ?? []).find((entry) => entry.class === manifestClass);
}

function validateLedgerCoverage(ledger, artifactAgentClasses) {
  const errors = [];
  const hpaEntry = getManifestEntryByClass(ledger, "hpa");
  const kedaEntry = getManifestEntryByClass(ledger, "keda");

  if (!hpaEntry) {
    errors.push('Manifest maturity ledger is missing class "hpa" entry.');
  }
  if (!kedaEntry) {
    errors.push('Manifest maturity ledger is missing class "keda" entry.');
  }

  const hpaCoverage =
    hpaEntry?.metadata?.scalability_validation?.agent_classes ?? {};
  const kedaCoverage =
    kedaEntry?.metadata?.scalability_validation?.agent_classes ?? {};

  for (const { agent_class: agentClass, scaler_type: scalerType } of artifactAgentClasses) {
    const coverage = scalerType === "keda" ? kedaCoverage[agentClass] : hpaCoverage[agentClass];
    if (!coverage) {
      errors.push(
        `Ledger scalability coverage missing for agent class \"${agentClass}\" under scaler_type \"${scalerType}\".`
      );
      continue;
    }

    if (!coverage.validation_artifact) {
      errors.push(
        `Ledger scalability coverage for \"${agentClass}\" is missing validation_artifact.`
      );
    }
  }

  return errors;
}

function main() {
  const artifact = readJson(artifactPath, "Scalability artifact");
  const ledger = readJson(ledgerPath, "Manifest maturity ledger");

  const errors = [];

  const metrics = artifact.required_metrics ?? {};
  for (const metricName of requiredMetrics) {
    if (!metrics[metricName]) {
      errors.push(`Artifact is missing required metric definition: ${metricName}`);
    }
  }

  if (!Array.isArray(artifact.agent_classes) || artifact.agent_classes.length === 0) {
    errors.push("Artifact must contain at least one agent_classes entry.");
  }

  const failingClasses = [];
  const allAgentClasses = [];

  for (const entry of artifact.agent_classes ?? []) {
    if (typeof entry.agent_class !== "string" || entry.agent_class.length === 0) {
      errors.push("Artifact agent_classes entries must include a non-empty agent_class.");
      continue;
    }

    if (entry.scaler_type !== "hpa" && entry.scaler_type !== "keda") {
      errors.push(
        `Artifact agent class \"${entry.agent_class}\" has unsupported scaler_type \"${entry.scaler_type}\".`
      );
      continue;
    }

    allAgentClasses.push({
      agent_class: entry.agent_class,
      scaler_type: entry.scaler_type,
    });
    if (entry.pass !== true) {
      failingClasses.push(entry.agent_class);
    }
  }

  if (artifact.gate_status !== "pass") {
    errors.push(`Artifact gate_status is \"${artifact.gate_status}\" (expected \"pass\").`);
  }

  if (failingClasses.length > 0) {
    errors.push(
      `Scalability thresholds failed for agent classes: ${failingClasses.join(", ")}`
    );
  }

  errors.push(...validateLedgerCoverage(ledger, allAgentClasses));

  if (errors.length > 0) {
    throw new Error(`Scalability gate failed:\n- ${errors.join("\n- ")}`);
  }

  console.log(
    `Scalability gate passed for ${allAgentClasses.length} agent classes using ${artifactPath}.`
  );
}

main();
