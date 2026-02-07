#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function loadDefaultThresholds() {
  const baselinePath = path.resolve(process.cwd(), "quality-baselines.json");

  if (!fs.existsSync(baselinePath)) {
    return {
      overall: 80,
      agents: 100,
      security_billing: 95,
    };
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return {
    overall: baseline?.coverage?.overall?.baseline ?? 80,
    agents: baseline?.coverage?.agents?.baseline ?? 100,
    security_billing: baseline?.coverage?.security_billing?.baseline ?? 95,
  };
}

const defaults = loadDefaultThresholds();

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = { ...defaults };
  args.forEach((a, i) => {
    if (a === "--overall") cfg.overall = parseFloat(args[i + 1]);
    if (a === "--agents") cfg.agents = parseFloat(args[i + 1]);
    if (a === "--security_billing") cfg.security_billing = parseFloat(args[i + 1]);
  });
  return cfg;
}

function readSummary() {
  const file = path.resolve(process.cwd(), "coverage", "coverage-summary.json");
  if (!fs.existsSync(file)) {
    console.error(
      "Coverage summary not found at ./coverage/coverage-summary.json",
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getPct(entry) {
  return entry && entry.lines && typeof entry.lines.pct === "number"
    ? entry.lines.pct
    : 0;
}

function computeAggregateForPaths(summary, paths) {
  const keys = Object.keys(summary).filter((k) =>
    paths.some((p) => k.includes(p)),
  );
  if (keys.length === 0) return -1;

  let covered = 0;
  let total = 0;

  keys.forEach((k) => {
    const entry = summary[k];
    if (entry && entry.lines && typeof entry.lines.total === "number") {
      covered += entry.lines.covered;
      total += entry.lines.total;
    }
  });
  return total === 0 ? 0 : Math.round((covered / total) * 100 * 100) / 100;
}

function main() {
  const cfg = parseArgs();
  const summary = readSummary();

  const overall = getPct(summary.total);
  console.log(
    `Overall lines coverage: ${overall}% (threshold ${cfg.overall}%)`,
  );
  if (overall < cfg.overall) {
    console.error(
      `Overall coverage ${overall}% is below threshold ${cfg.overall}%`,
    );
    process.exit(2);
  }

  const agentsPaths = ["src/lib/agent-fabric/agents"];
  const agentsPct = computeAggregateForPaths(summary, agentsPaths);
  console.log(
    `Agents folder coverage: ${agentsPct}% (threshold ${cfg.agents}%)`,
  );
  if (agentsPct === -1) {
    console.error(
      `No files found for agents folder (paths: ${agentsPaths.join(", ")}). Coverage check failed.`,
    );
    process.exit(2);
  }
  if (agentsPct < cfg.agents) {
    console.error(
      `Agents folder coverage ${agentsPct}% is below threshold ${cfg.agents}%`,
    );
    process.exit(2);
  }

  const securityBillingPaths = [
    "src/security/",
    "src/services/metering",
    "src/services/billing",
  ];
  const secBillPct = computeAggregateForPaths(summary, securityBillingPaths);
  console.log(
    `Security & Billing folders coverage: ${secBillPct}% (threshold ${cfg.security_billing}%)`,
  );
  if (secBillPct === -1) {
    console.error(
      `No files found for Security & Billing folders (paths: ${securityBillingPaths.join(", ")}). Coverage check failed.`,
    );
    process.exit(2);
  }
  if (secBillPct < cfg.security_billing) {
    console.error(
      `Security & Billing coverage ${secBillPct}% is below threshold ${cfg.security_billing}%`,
    );
    process.exit(2);
  }

  console.log("Coverage checks passed.");
  process.exit(0);
}

main();
