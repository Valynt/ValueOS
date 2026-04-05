#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildExplicitAnyRatchetViews,
  loadExplicitAnyBudgetEntries,
  toComparableBudgetShape,
} from "./lib/explicit-any-budgets.mjs";

const repoRoot = process.cwd();
const canonical = loadExplicitAnyBudgetEntries(repoRoot);
const canonicalViews = buildExplicitAnyRatchetViews(canonical.entries);
const canonicalComparable = {
  packageBudgets: toComparableBudgetShape(canonicalViews.packageBudgets),
  bucketBudgets: toComparableBudgetShape(canonicalViews.bucketBudgets),
};

const candidateFiles = [
  path.join(repoRoot, ".github", "any-ratchet-budgets.json"),
];

const existingCandidates = candidateFiles.filter((candidatePath) => fs.existsSync(candidatePath));

if (existingCandidates.length === 0) {
  console.log(`✅ Explicit-any budget consistency: single canonical source (${canonical.budgetPath}).`);
  process.exit(0);
}

let divergenceCount = 0;
for (const candidatePath of existingCandidates) {
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const candidateComparable = {
    packageBudgets: candidate.packageBudgets ?? {},
    bucketBudgets: candidate.bucketBudgets ?? {},
  };

  const canonicalJson = JSON.stringify(canonicalComparable);
  const candidateJson = JSON.stringify(candidateComparable);

  if (candidateJson !== canonicalJson) {
    divergenceCount += 1;
    console.error(`❌ Budget divergence detected: ${candidatePath} does not match ${canonical.budgetPath}.`);
  } else {
    console.log(`✅ Budget parity: ${candidatePath} matches ${canonical.budgetPath}.`);
  }
}

if (divergenceCount > 0) {
  console.error(`Explicit-any budget consistency check failed (${divergenceCount} divergent file${divergenceCount === 1 ? "" : "s"}).`);
  process.exit(1);
}

console.log("Explicit-any budget consistency check passed.");
