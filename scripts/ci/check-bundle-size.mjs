#!/usr/bin/env node

/**
 * Bundle size budget gate (Audit Recommendation #8)
 *
 * Runs after `vite build` and checks that the total bundle size for
 * ValyntApp stays within the configured budget. Fails CI if the budget
 * is exceeded.
 *
 * Usage:
 *   node scripts/ci/check-bundle-size.mjs [--budget <bytes>]
 *
 * Default budget: 2 MB (2097152 bytes) for all JS assets combined.
 */

import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const DEFAULT_BUDGET_BYTES = 2 * 1024 * 1024; // 2 MB
const DIST_DIR = "apps/ValyntApp/dist/assets";

function parseArgs() {
  const args = process.argv.slice(2);
  let budget = DEFAULT_BUDGET_BYTES;
  const budgetIdx = args.indexOf("--budget");
  if (budgetIdx !== -1 && args[budgetIdx + 1]) {
    budget = parseInt(args[budgetIdx + 1], 10);
    if (Number.isNaN(budget) || budget <= 0) {
      console.error(
        "Invalid --budget value. Must be a positive integer (bytes)."
      );
      process.exit(1);
    }
  }
  return { budget };
}

function getJsAssetSizes(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`Could not read directory: ${dir}`);
    console.error("Run 'pnpm --filter valynt-app build' first.");
    process.exit(1);
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (
      stat.isFile() &&
      (extname(entry) === ".js" || extname(entry) === ".mjs")
    ) {
      results.push({ name: entry, size: stat.size });
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const { budget } = parseArgs();
const assets = getJsAssetSizes(DIST_DIR);
const totalSize = assets.reduce((sum, a) => sum + a.size, 0);

console.log("Bundle size report (JS assets):");
console.log("================================");
for (const asset of assets.sort((a, b) => b.size - a.size)) {
  console.log(
    `  ${asset.name.padEnd(50)} ${formatBytes(asset.size).padStart(10)}`
  );
}
console.log("--------------------------------");
console.log(`  ${"TOTAL".padEnd(50)} ${formatBytes(totalSize).padStart(10)}`);
console.log(`  ${"BUDGET".padEnd(50)} ${formatBytes(budget).padStart(10)}`);
console.log("");

if (totalSize > budget) {
  console.error(
    `FAIL: Total JS bundle size (${formatBytes(totalSize)}) exceeds budget (${formatBytes(budget)}).`
  );
  console.error("Reduce bundle size or increase --budget if justified.");
  process.exit(1);
} else {
  const headroom = budget - totalSize;
  console.log(
    `PASS: Bundle size within budget. Headroom: ${formatBytes(headroom)} (${((headroom / budget) * 100).toFixed(1)}%)`
  );
}
