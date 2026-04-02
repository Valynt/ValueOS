#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const backendRoot = path.join(repoRoot, "packages/backend");
const configPath = path.join(backendRoot, "tsconfig.strict-exceptions.json");

if (!fs.existsSync(configPath)) {
  console.error(`Missing strict exception config: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const policy = config.strictExceptionBudgets;

if (!policy?.folders) {
  console.error("Missing strictExceptionBudgets.folders in packages/backend/tsconfig.strict-exceptions.json");
  process.exit(1);
}

const includePatterns = new Set(config.include ?? []);
const excludePatterns = config.exclude ?? [];

const listFilesForPattern = (pattern) => {
  const args = ["--files", "-g", pattern];
  for (const exclude of excludePatterns) {
    args.push("-g", `!${exclude}`);
  }

  const result = spawnSync("rg", args, { cwd: backendRoot, encoding: "utf8" });
  if (result.status === 1) {
    return [];
  }

  if (result.status !== 0) {
    throw new Error(`Failed to evaluate pattern '${pattern}': ${result.stderr || "unknown error"}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const countFilesForGlob = (patternOrPatterns) => {
  const patterns = Array.isArray(patternOrPatterns) ? patternOrPatterns : [patternOrPatterns];
  const files = new Set();

  for (const pattern of patterns) {
    for (const file of listFilesForPattern(pattern)) {
      files.add(file);
    }
  }

  return files.size;
};

let regressions = 0;
console.log("Backend strict-exception debt budget status");
console.log(`Policy captured at: ${policy.capturedAt ?? "unknown"}`);

for (const [folder, folderPolicy] of Object.entries(policy.folders)) {
  const patterns = folderPolicy.glob;
  const expected = Array.isArray(patterns) ? patterns : [patterns];
  const missingPatterns = expected.filter((entry) => !includePatterns.has(entry));

  if (missingPatterns.length > 0) {
    regressions += 1;
    console.error(`❌ ${folder}: glob missing from include[] (${missingPatterns.join(", ")})`);
    continue;
  }

  const current = countFilesForGlob(patterns);
  const baseline = Number(folderPolicy.baseline ?? 0);
  const nextTarget = folderPolicy.nextTarget === undefined ? undefined : Number(folderPolicy.nextTarget);

  if (current > baseline) {
    regressions += 1;
    console.error(`❌ ${folder}: ${current} strict exceptions > baseline ${baseline}`);
  } else {
    console.log(`✅ ${folder}: ${current} <= baseline ${baseline}`);
  }

  if (typeof nextTarget === "number" && current > nextTarget) {
    console.warn(`⚠️ ${folder}: ${current} above nextTarget ${nextTarget}`);
  }

  if (folderPolicy.sunsetDate) {
    console.log(`   sunset: ${folderPolicy.sunsetDate}`);
  }
}

const zeroNewZones = policy.protectedZeroNewZones ?? {};
if (Object.keys(zeroNewZones).length > 0) {
  console.log("\nProtected zero-new strict-exception zones");
  for (const [zone, budgetRaw] of Object.entries(zeroNewZones)) {
    const budget = Number(budgetRaw ?? 0);
    const matchingInclude = [...includePatterns].filter(
      (entry) => entry === `${zone}/**/*.ts` || entry.startsWith(`${zone}/`) || entry === zone,
    );

    if (matchingInclude.length > budget) {
      regressions += 1;
      console.error(
        `❌ ${zone}: ${matchingInclude.length} include pattern(s) found (budget ${budget}). ${matchingInclude.join(", ")}`,
      );
      continue;
    }

    console.log(`✅ ${zone}: ${matchingInclude.length} include pattern(s) <= budget ${budget}`);
  }
}

if (regressions > 0) {
  console.error(`\nStrict-exception budget regression detected in ${regressions} check(s).`);
  process.exit(1);
}

console.log("\nStrict-exception budget check passed.");
