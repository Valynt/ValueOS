#!/usr/bin/env node
console.warn('Deprecated script: use scripts/check-coverage.cjs instead');
process.exit(0);

  keys.forEach((k) => {
    const entry = summary[k];
    // Some entries might have lines as { total, covered }
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
    `Overall lines coverage: ${overall}% (threshold ${cfg.overall}%)`
  );
  if (overall < cfg.overall) {
    console.error(
      `Overall coverage ${overall}% is below threshold ${cfg.overall}%`
    );
    process.exit(2);
  }

  const agentsPaths = ["src/lib/agent-fabric/agents"];
  const agentsPct = computeAggregateForPaths(summary, agentsPaths);
  console.log(
    `Agents folder coverage: ${agentsPct}% (threshold ${cfg.agents}%)`
  );
  if (agentsPct === -1) {
    console.error(
      `No files found for agents folder (paths: ${agentsPaths.join(", ")}). Coverage check failed.`
    );
    process.exit(2);
  }
  if (agentsPct < cfg.agents) {
    console.error(
      `Agents folder coverage ${agentsPct}% is below threshold ${cfg.agents}%`
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
    `Security & Billing folders coverage: ${secBillPct}% (threshold ${cfg.security_billing}%)`
  );
  if (secBillPct === -1) {
    console.error(
      `No files found for Security & Billing folders (paths: ${securityBillingPaths.join(", ")}). Coverage check failed.`
    );
    process.exit(2);
  }
  if (secBillPct < cfg.security_billing) {
    console.error(
      `Security & Billing coverage ${secBillPct}% is below threshold ${cfg.security_billing}%`
    );
    process.exit(2);
  }

  console.log("Coverage checks passed.");
  process.exit(0);
}

main();
