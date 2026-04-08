#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_POLICY_PATH = resolve("docs/security-compliance/data-residency-controls.json");
const DEFAULT_OUTPUT_PATH = resolve("artifacts/security/governance/data-residency-status.json");

function parseArgs(argv) {
  const options = {
    policyPath: DEFAULT_POLICY_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    asOfDate: new Date().toISOString(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--policy") {
      options.policyPath = resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.outputPath = resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--as-of") {
      options.asOfDate = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildSignature(payload) {
  const canonicalPayload = stableStringify(payload);
  const payloadDigest = createHash("sha256").update(canonicalPayload).digest("hex");

  const signingKey =
    process.env.DATA_RESIDENCY_ARTIFACT_SIGNING_KEY ||
    process.env.CI_ARTIFACT_SIGNING_KEY ||
    "local-dev-unsigned";

  const keySource = process.env.DATA_RESIDENCY_ARTIFACT_SIGNING_KEY
    ? "DATA_RESIDENCY_ARTIFACT_SIGNING_KEY"
    : process.env.CI_ARTIFACT_SIGNING_KEY
      ? "CI_ARTIFACT_SIGNING_KEY"
      : "local-dev-fallback";

  const signature = createHmac("sha256", signingKey).update(payloadDigest).digest("hex");

  return {
    algorithm: "HMAC-SHA256",
    keySource,
    payloadDigest,
    signature,
    signedAt: new Date().toISOString(),
  };
}

function validateResidency(policyDocument, asOfDate) {
  const tenants = Array.isArray(policyDocument.tenants) ? policyDocument.tenants : [];
  const dataStores = Array.isArray(policyDocument.dataStores) ? policyDocument.dataStores : [];
  const exportDestinations = Array.isArray(policyDocument.exportDestinations)
    ? policyDocument.exportDestinations
    : [];

  const dataStoreResults = [];
  const exportResults = [];
  const violations = [];

  const tenantMap = new Map(tenants.map((tenant) => [tenant.tenantId, tenant]));

  for (const dataStore of dataStores) {
    const tenant = tenantMap.get(dataStore.tenantId);
    const residencyPolicy = tenant?.residencyPolicy || "unknown";
    const allowedRegions = Array.isArray(tenant?.allowedRegions) ? tenant.allowedRegions : [];

    const compliant =
      Boolean(tenant) &&
      allowedRegions.includes(dataStore.region) &&
      (residencyPolicy !== "strict" || dataStore.region === tenant.primaryRegion);

    if (!compliant) {
      violations.push({
        type: "data_store_region_mismatch",
        tenantId: dataStore.tenantId,
        storeId: dataStore.storeId,
        configuredRegion: dataStore.region,
        allowedRegions,
        policy: residencyPolicy,
      });
    }

    dataStoreResults.push({
      tenantId: dataStore.tenantId,
      storeId: dataStore.storeId,
      storeType: dataStore.storeType,
      region: dataStore.region,
      residencyPolicy,
      compliant,
    });
  }

  for (const destination of exportDestinations) {
    const tenant = tenantMap.get(destination.tenantId);
    const residencyPolicy = tenant?.residencyPolicy || "unknown";
    const allowedRegions = Array.isArray(tenant?.allowedRegions) ? tenant.allowedRegions : [];

    const compliant = Boolean(tenant) && allowedRegions.includes(destination.region);

    if (!compliant) {
      violations.push({
        type: "export_region_mismatch",
        tenantId: destination.tenantId,
        exportId: destination.exportId,
        configuredRegion: destination.region,
        allowedRegions,
        policy: residencyPolicy,
      });
    }

    exportResults.push({
      tenantId: destination.tenantId,
      exportId: destination.exportId,
      provider: destination.provider,
      region: destination.region,
      residencyPolicy,
      compliant,
    });
  }

  return {
    schemaVersion: "2026-04-08.1",
    asOfDate,
    generatedAt: new Date().toISOString(),
    source: {
      policyPath: "docs/security-compliance/data-residency-controls.json",
    },
    summary: {
      tenantCount: tenants.length,
      dataStoreCount: dataStoreResults.length,
      exportDestinationCount: exportResults.length,
      violationCount: violations.length,
      compliant: violations.length === 0,
    },
    checks: {
      dataStores: dataStoreResults,
      exportDestinations: exportResults,
      violations,
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.policyPath)) {
    throw new Error(`[data-residency] policy file not found: ${options.policyPath}`);
  }

  const policyDocument = readJson(options.policyPath);
  const report = validateResidency(policyDocument, options.asOfDate);
  report.signature = buildSignature(report);

  mkdirSync(resolve(options.outputPath, ".."), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);

  const status = report.summary.compliant ? "PASS" : "FAIL";
  console.log(
    `[data-residency] ${status}: ${report.summary.violationCount} violations across ${report.summary.dataStoreCount} stores and ${report.summary.exportDestinationCount} exports.`,
  );

  if (!report.summary.compliant) {
    process.exitCode = 1;
  }
}

main();
