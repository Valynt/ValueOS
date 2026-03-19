#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue != null) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const manifestPath = resolve(
  process.cwd(),
  args.manifest ?? "docs/operations/load-test-artifacts/latest.json",
);
const docPath = resolve(
  process.cwd(),
  args.doc ?? "docs/operations/load-test-baselines.md",
);
const maxAgeDays = Number(args["max-age-days"] ?? "14");
const requireStatus = args["require-status"] ?? "passed";
const requiredEnvironment = args.environment ?? "staging";
const requiredCanonicalPath =
  args["canonical-path"] ?? "infra/k8s/overlays/production";

let manifest;
let docContents;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  docContents = readFileSync(docPath, "utf8");
} catch (error) {
  console.error(
    `❌ Unable to load load-test baseline inputs: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

const failures = [];
if (!manifest.timestamp) {
  failures.push("latest baseline manifest is missing timestamp");
}
if (manifest.environment !== requiredEnvironment) {
  failures.push(
    `latest baseline environment is ${manifest.environment ?? "missing"}, expected ${requiredEnvironment}`,
  );
}
if (manifest.status !== requireStatus) {
  failures.push(
    `latest baseline status is ${manifest.status ?? "missing"}, expected ${requireStatus}`,
  );
}
if (manifest.target?.canonical_production_path !== requiredCanonicalPath) {
  failures.push(
    `canonical production path is ${manifest.target?.canonical_production_path ?? "missing"}, expected ${requiredCanonicalPath}`,
  );
}
if (!docContents.includes("docs/operations/load-test-artifacts/latest.json")) {
  failures.push(
    "baseline markdown does not reference docs/operations/load-test-artifacts/latest.json",
  );
}
if (
  manifest.timestamp &&
  !docContents.includes(manifest.timestamp.slice(0, 10))
) {
  failures.push(
    `baseline markdown does not mention the latest run date ${manifest.timestamp.slice(0, 10)}`,
  );
}

const latestRun = manifest.timestamp ? new Date(manifest.timestamp) : null;
if (!latestRun || Number.isNaN(latestRun.valueOf())) {
  failures.push("latest baseline timestamp is invalid");
} else {
  const ageMs = Date.now() - latestRun.valueOf();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    const ageDays = (ageMs / (24 * 60 * 60 * 1000)).toFixed(2);
    failures.push(
      `latest baseline is stale at ${ageDays} days old (max ${maxAgeDays})`,
    );
  }
}

for (const [label, section] of Object.entries({
  load_test: manifest.load_test,
  scaling_policy: manifest.scaling_policy,
})) {
  if (!section || section.status !== "passed") {
    failures.push(`${label} summary is missing or not passed`);
    continue;
  }
  if (
    section.latency_ms?.p50 == null ||
    section.latency_ms?.p95 == null ||
    section.latency_ms?.p99 == null
  ) {
    failures.push(`${label} summary is missing p50/p95/p99 metrics`);
  }
  if (section.error_rate == null) {
    failures.push(`${label} summary is missing error rate`);
  }
}

if (!manifest.infra_observability?.pod_counts) {
  failures.push("infra observability block is missing pod counts");
}
if (!manifest.infra_observability?.queue_depth) {
  failures.push("infra observability block is missing queue depth");
}

if (failures.length > 0) {
  console.error("❌ Load-test baseline promotion gate failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `✅ Load-test baseline promotion gate passed (${manifest.timestamp}).`,
);
