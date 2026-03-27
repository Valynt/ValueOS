#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "../..");

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

const outPath = argValue("--out", "artifacts/security/appsec-controls-attestation.json");
const sbomPath = argValue("--sbom", "sbom.json");
const secretScanPath = argValue("--secret-scan", "gitleaks.sarif");

function runNodeCheck(name, scriptPath) {
  const startedAt = new Date().toISOString();
  const proc = spawnSync("node", [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const completedAt = new Date().toISOString();
  const passed = proc.status === 0;

  return {
    id: name,
    type: "script",
    command: `node ${scriptPath}`,
    status: passed ? "pass" : "fail",
    startedAt,
    completedAt,
    exitCode: proc.status,
    output: {
      stdout: (proc.stdout ?? "").trim(),
      stderr: (proc.stderr ?? "").trim(),
    },
  };
}

function filePresenceCheck(id, targetPath, description) {
  const absolutePath = resolve(ROOT, targetPath);
  const present = existsSync(absolutePath);
  const sizeBytes = present ? statSync(absolutePath).size : 0;
  return {
    id,
    type: "artifact",
    description,
    path: targetPath,
    status: present && sizeBytes > 0 ? "pass" : "fail",
    sizeBytes,
  };
}

const checks = [
  runNodeCheck("tenant-isolation-runtime-checks", "scripts/ci/check-supabase-tenant-controls.mjs"),
  runNodeCheck("service-role-boundaries", "scripts/ci/check-backend-service-role-boundaries.mjs"),
  filePresenceCheck("sbom-presence", sbomPath, "CycloneDX SBOM exists and is non-empty."),
  filePresenceCheck("secret-scan-evidence", secretScanPath, "Secret scan SARIF exists and is non-empty."),
];

const failures = checks.filter((check) => check.status !== "pass");
const attestation = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  overallStatus: failures.length === 0 ? "pass" : "fail",
  checks,
  failureCount: failures.length,
};

const resolvedOut = resolve(ROOT, outPath);
mkdirSync(dirname(resolvedOut), { recursive: true });
writeFileSync(resolvedOut, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");

console.log(`AppSec control attestation written to ${outPath}`);

if (failures.length > 0) {
  console.error("AppSec control attestation failed.");
  for (const failure of failures) {
    console.error(` - ${failure.id} (${failure.status})`);
  }
  process.exit(1);
}

console.log("AppSec control attestation passed.");
