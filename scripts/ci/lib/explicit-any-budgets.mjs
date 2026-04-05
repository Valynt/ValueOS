import fs from "node:fs";
import path from "node:path";

const EXPLICIT_ANY_METRIC = "explicitAny";

function normalizePath(inputPath) {
  return String(inputPath).replace(/\\/g, "/").replace(/\/$/, "");
}

function inferPackageKey(targetPath) {
  const normalized = normalizePath(targetPath);
  const withoutSrcSuffix = normalized.replace(/\/src$/, "");
  if (withoutSrcSuffix.startsWith("apps/") || withoutSrcSuffix.startsWith("packages/")) {
    const segments = withoutSrcSuffix.split("/");
    return segments.slice(0, 2).join("/");
  }
  return withoutSrcSuffix;
}

function ensureFiniteNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadExplicitAnyBudgetEntries(repoRoot) {
  const budgetPath = path.join(repoRoot, "config", "debt-budgets.json");

  if (!fs.existsSync(budgetPath)) {
    throw new Error(`Missing debt budgets config: ${budgetPath}`);
  }

  const config = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
  const entries = Array.isArray(config.entries)
    ? config.entries.filter((entry) => entry.metric === EXPLICIT_ANY_METRIC)
    : [];

  return { budgetPath, entries };
}

export function buildExplicitAnyRatchetViews(entries) {
  const packageBudgets = new Map();
  const bucketBudgets = new Map();

  for (const entry of entries) {
    const targetPath = typeof entry.path === "string" ? normalizePath(entry.path) : "";
    if (!targetPath) {
      continue;
    }

    const baseline = ensureFiniteNumber(entry.baseline, 0);
    const nextTarget = ensureFiniteNumber(entry.nextTarget, baseline);
    const excludeTests = entry.includeTests === true ? false : true;

    const packageKey = inferPackageKey(targetPath);
    const packageBudget = packageBudgets.get(packageKey) ?? {
      baseline: 0,
      nextTarget: 0,
      paths: new Set(),
      excludeTests,
      entryIds: [],
    };
    packageBudget.baseline += baseline;
    packageBudget.nextTarget += nextTarget;
    packageBudget.paths.add(targetPath);
    packageBudget.excludeTests = packageBudget.excludeTests && excludeTests;
    packageBudget.entryIds.push(entry.id);
    packageBudgets.set(packageKey, packageBudget);

    const bucketKey = typeof entry.bucket === "string" && entry.bucket.length > 0 ? entry.bucket : "unbucketed";
    const bucketBudget = bucketBudgets.get(bucketKey) ?? {
      baseline: 0,
      nextTarget: 0,
      paths: new Set(),
      excludeTests,
      entryIds: [],
    };
    bucketBudget.baseline += baseline;
    bucketBudget.nextTarget += nextTarget;
    bucketBudget.paths.add(targetPath);
    bucketBudget.excludeTests = bucketBudget.excludeTests && excludeTests;
    bucketBudget.entryIds.push(entry.id);
    bucketBudgets.set(bucketKey, bucketBudget);
  }

  return { packageBudgets, bucketBudgets };
}

export function toComparableBudgetShape(map) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        {
          baseline: ensureFiniteNumber(value.baseline, 0),
          nextTarget: ensureFiniteNumber(value.nextTarget, 0),
          excludeTests: value.excludeTests === false ? false : true,
          paths: [...(value.paths ?? [])].sort(),
        },
      ]),
  );
}
