#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const STATUS_RANK = {
  aspirational: 0,
  progressing: 1,
  validated: 2,
};

const CRITICAL_EVIDENCE_CLASSES = new Set([
  "deployments",
  "network-policies",
  "external-secrets",
  "observability",
]);

const EVIDENCE_KEY_ALIASES = {
  rollout: [
    "rollout_artifact",
    "rollout_evidence",
    "staging_deployment_result",
  ],
  load: ["load_test_artifact", "load_evidence", "load_test_summary"],
  rollback: ["rollback_artifact", "rollback_evidence", "rollback_rehearsal"],
};

function getArg(name, fallback = "") {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1] ?? fallback;
  }
  const prefix = `${name}=`;
  const inline = process.argv.find(value => value.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  return fallback;
}

function readJsonAtCommit(commit, relativePath) {
  try {
    const output = execFileSync("git", ["show", `${commit}:${relativePath}`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function readLocalJson(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Ledger file not found: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function assertLedgerShape(ledger, ledgerPath) {
  if (!ledger || typeof ledger !== "object") {
    throw new Error(`Invalid ledger in ${ledgerPath}: expected object root.`);
  }
  if (!Array.isArray(ledger.manifests)) {
    throw new Error(
      `Invalid ledger in ${ledgerPath}: manifests must be an array.`
    );
  }
}

function isEmpty(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function normalizeStatus(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function parseBooleanArg(name, fallback = false) {
  const raw = getArg(name);
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
}

function getStatusRank(status) {
  const normalized = normalizeStatus(status);
  return STATUS_RANK[normalized] ?? -1;
}

function resolveEvidenceValue(evidence, aliases) {
  for (const key of aliases) {
    const value = evidence[key];
    if (!isEmpty(value)) {
      return { key, value: value.trim() };
    }
  }
  return null;
}

function isLikelyEvidenceLink(value) {
  return /^(https?:\/\/|s3:\/\/|gs:\/\/|artifact:\/\/|gh:\/\/|urn:)/i.test(
    value
  );
}

function collectMissingEvidenceEvidence(
  entry,
  { requireLinkFormat = false } = {}
) {
  const evidence = entry.evidence ?? {};
  const missing = [];

  for (const [label, aliases] of Object.entries(EVIDENCE_KEY_ALIASES)) {
    const resolved = resolveEvidenceValue(evidence, aliases);
    if (!resolved) {
      missing.push(`evidence.${aliases[0]}`);
      continue;
    }
    if (requireLinkFormat && !isLikelyEvidenceLink(resolved.value)) {
      missing.push(`evidence.${resolved.key} (must be a link/artifact URI)`);
    }
  }

  return missing;
}

function runTransitionCheck() {
  const ledgerPath = getArg(
    "--ledger-path",
    "infra/k8s/manifest-maturity-ledger.json"
  );
  const baseSha = getArg("--base-sha");
  const headSha = getArg("--head-sha") || "HEAD";

  if (!baseSha) {
    throw new Error("--base-sha is required for transition-check mode.");
  }

  const currentLedger = readLocalJson(ledgerPath);
  assertLedgerShape(currentLedger, ledgerPath);

  const previousLedger = readJsonAtCommit(baseSha, ledgerPath);
  if (!previousLedger) {
    console.log(
      `No ${ledgerPath} file found at ${baseSha}; skipping Aspirational -> Validated transition checks.`
    );
    return;
  }

  assertLedgerShape(previousLedger, `${baseSha}:${ledgerPath}`);

  const previousByClass = new Map(
    previousLedger.manifests.map(entry => [entry.class, entry])
  );
  const errors = [];

  for (const entry of currentLedger.manifests) {
    const previous = previousByClass.get(entry.class);
    if (!previous) {
      continue;
    }

    const previousStatus = normalizeStatus(previous.status);
    const currentStatus = normalizeStatus(entry.status);

    if (previousStatus !== "aspirational" || currentStatus !== "validated") {
      continue;
    }

    const missingEvidence = [];

    if (isEmpty(entry.status_owner)) {
      missingEvidence.push("status_owner");
    }
    if (isEmpty(entry.date_validated)) {
      missingEvidence.push("date_validated");
    }

    missingEvidence.push(...collectMissingEvidenceEvidence(entry));

    if (missingEvidence.length > 0) {
      errors.push(
        `Manifest class "${entry.class}" transitioned Aspirational -> Validated without required evidence fields: ${missingEvidence.join(", ")}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Manifest maturity transition checks failed:\n- ${errors.join("\n- ")}`
    );
  }

  console.log(
    `Manifest maturity transition checks passed for ${ledgerPath} (base ${baseSha}, head ${headSha}).`
  );
}

function runEnvironmentGate() {
  const ledgerPath = getArg(
    "--ledger-path",
    "infra/k8s/manifest-maturity-ledger.json"
  );
  const environment = getArg("--environment", "production")
    .trim()
    .toLowerCase();
  const requireCriticalEvidenceLinks = parseBooleanArg(
    "--require-critical-evidence-links",
    environment === "production"
  );
  const requireProductionEvidenceArtifacts = parseBooleanArg(
    "--require-production-evidence-artifacts",
    environment === "production"
  );

  const ledger = readLocalJson(ledgerPath);
  assertLedgerShape(ledger, ledgerPath);

  const errors = [];

  for (const entry of ledger.manifests) {
    const minimumByEnvironment = entry.minimum_maturity_by_environment;
    if (!minimumByEnvironment || typeof minimumByEnvironment !== "object") {
      errors.push(
        `Manifest class "${entry.class}" is missing minimum_maturity_by_environment.`
      );
      continue;
    }

    const minimumStatus = normalizeStatus(minimumByEnvironment[environment]);
    if (!minimumStatus) {
      errors.push(
        `Manifest class "${entry.class}" is missing minimum maturity for environment "${environment}".`
      );
      continue;
    }

    const currentRank = getStatusRank(entry.status);
    const minimumRank = getStatusRank(minimumStatus);

    if (currentRank < minimumRank) {
      errors.push(
        `Manifest class "${entry.class}" is ${entry.status} but requires at least ${minimumByEnvironment[environment]} for ${environment}.`
      );
    }

    if (
      requireCriticalEvidenceLinks &&
      CRITICAL_EVIDENCE_CLASSES.has(entry.class)
    ) {
      const missing = collectMissingEvidenceEvidence(entry, {
        requireLinkFormat: true,
      });
      if (missing.length > 0) {
        errors.push(
          `Manifest class "${entry.class}" is missing required critical evidence links: ${missing.join(", ")}`
        );
      }
    }

    if (
      requireProductionEvidenceArtifacts &&
      environment === "production" &&
      entry.critical
    ) {
      const missing = collectMissingEvidenceEvidence(entry, {
        requireLinkFormat: true,
      });
      if (missing.length > 0) {
        errors.push(
          `Production evidence incomplete for critical class "${entry.class}": ${missing.join(", ")}`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Manifest maturity ${environment} gate failed:\n- ${errors.join("\n- ")}`
    );
  }

  console.log(
    `Manifest maturity ${environment} gate passed for ${ledgerPath}.`
  );
}

function main() {
  const mode = getArg("--mode", "transition-check");

  if (mode === "transition-check") {
    runTransitionCheck();
    return;
  }

  if (
    mode === "production-gate" ||
    mode === "environment-gate" ||
    mode === "release-gate"
  ) {
    runEnvironmentGate();
    return;
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

main();
