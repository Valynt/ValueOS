#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

function arg(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1] ?? fallback;
  }
  const prefix = `${name}=`;
  const match = args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const manifestPath = resolve(arg("--manifest", process.env.LOAD_TEST_MANIFEST || "docs/operations/load-test-artifacts/staging/latest.json"));
const maxAgeHours = Number(arg("--max-age-hours", process.env.LOAD_TEST_MAX_AGE_HOURS || "168"));
const requirePass = (arg("--require-pass", process.env.LOAD_TEST_REQUIRE_PASS || "true") ?? "true") !== "false";

if (!existsSync(manifestPath)) {
  console.error(`❌ Missing benchmark manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const timestamp = Date.parse(manifest.timestamp || "");
if (Number.isNaN(timestamp)) {
  console.error(`❌ Benchmark manifest is missing a valid timestamp: ${manifestPath}`);
  process.exit(1);
}

const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
if (ageHours > maxAgeHours) {
  console.error(`❌ Benchmark manifest is stale (${ageHours.toFixed(2)}h > ${maxAgeHours}h): ${manifestPath}`);
  process.exit(1);
}

if (requirePass && manifest.run_status?.live_validation_passed !== true) {
  console.error(`❌ Benchmark manifest exists but live validation did not pass: ${manifestPath}`);
  process.exit(1);
}

console.log(`✅ Benchmark manifest present, fresh, and ${requirePass ? "passed" : "recorded"}: ${manifestPath}`);
