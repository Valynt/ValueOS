#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";

interface BurnDownPlan {
  startDate: string;
  cadence: "weekly";
  weeklyReductionTarget: number;
  targetWeeks: number;
  targetErrorBudget: number;
  nextCheckpointDate: string;
}

interface TsDebtFile {
  baseline: number;
  burnDown?: BurnDownPlan;
}

const projectRoot = process.cwd();
const DEFAULT_WEEKS = 12;
const args = new Set(process.argv.slice(2));
const shouldSync = args.has("--sync");

function getPackageDebtFiles(): string[] {
  const scopes = ["apps", "packages"];
  const debtFiles: string[] = [];

  for (const scope of scopes) {
    const scopePath = path.join(projectRoot, scope);
    if (!fs.existsSync(scopePath)) continue;

    for (const entry of fs.readdirSync(scopePath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const debtFile = path.join(scopePath, entry.name, ".ts-debt.json");
      if (fs.existsSync(debtFile)) debtFiles.push(debtFile);
    }
  }

  return debtFiles.sort((a, b) => a.localeCompare(b));
}

function clampToDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weeklyReductionFor(baseline: number): number {
  return Math.max(1, Math.ceil(baseline * 0.03));
}

function createPlan(baseline: number, today: Date): BurnDownPlan {
  const weeklyReductionTarget = weeklyReductionFor(baseline);
  const startDate = clampToDay(today);
  const targetErrorBudget = Math.max(0, baseline - weeklyReductionTarget * DEFAULT_WEEKS);

  return {
    startDate: isoDate(startDate),
    cadence: "weekly",
    weeklyReductionTarget,
    targetWeeks: DEFAULT_WEEKS,
    targetErrorBudget,
    nextCheckpointDate: isoDate(addDays(startDate, 7)),
  };
}

function getWeeklyBudget(baseline: number, weeklyReduction: number, week: number): number {
  return Math.max(0, baseline - weeklyReduction * week);
}

function main(): void {
  const today = new Date();
  const debtFiles = getPackageDebtFiles();

  if (debtFiles.length === 0) {
    console.error("No .ts-debt.json files found under apps/ or packages/.");
    process.exit(1);
  }

  const rows: Array<{ pkg: string; baseline: number; weeklyReduction: number; week4: number; week8: number; week12: number }> = [];

  for (const debtFile of debtFiles) {
    const raw = fs.readFileSync(debtFile, "utf8");
    const data = JSON.parse(raw) as TsDebtFile;

    if (typeof data.baseline !== "number") {
      console.warn(`Skipping ${path.relative(projectRoot, debtFile)}: missing numeric baseline.`);
      continue;
    }

    const plan = data.burnDown ?? createPlan(data.baseline, today);

    if (shouldSync) {
      const nextData: TsDebtFile = {
        baseline: data.baseline,
        burnDown: {
          ...plan,
          nextCheckpointDate: isoDate(addDays(clampToDay(today), 7)),
        },
      };
      fs.writeFileSync(debtFile, `${JSON.stringify(nextData, null, 2)}\n`);
    }

    const rel = path.relative(projectRoot, path.dirname(debtFile)).replace(/\\/g, "/");
    rows.push({
      pkg: rel,
      baseline: data.baseline,
      weeklyReduction: plan.weeklyReductionTarget,
      week4: getWeeklyBudget(data.baseline, plan.weeklyReductionTarget, 4),
      week8: getWeeklyBudget(data.baseline, plan.weeklyReductionTarget, 8),
      week12: getWeeklyBudget(data.baseline, plan.weeklyReductionTarget, 12),
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.baseline += row.baseline;
      acc.weeklyReduction += row.weeklyReduction;
      acc.week4 += row.week4;
      acc.week8 += row.week8;
      acc.week12 += row.week12;
      return acc;
    },
    { baseline: 0, weeklyReduction: 0, week4: 0, week8: 0, week12: 0 }
  );

  console.log("# TypeScript Debt Burn-down Targets\n");
  console.log(`Generated: ${isoDate(today)}`);
  console.log(`Cadence: weekly`);
  console.log(`Horizon: ${DEFAULT_WEEKS} weeks\n`);
  console.log("| Package | Baseline | Weekly Target (min errors removed) | Week 4 Budget | Week 8 Budget | Week 12 Budget |\n|---|---:|---:|---:|---:|---:|");

  for (const row of rows) {
    console.log(
      `| ${row.pkg} | ${row.baseline} | ${row.weeklyReduction} | ${row.week4} | ${row.week8} | ${row.week12} |`
    );
  }

  console.log(
    `| **Total** | **${totals.baseline}** | **${totals.weeklyReduction}** | **${totals.week4}** | **${totals.week8}** | **${totals.week12}** |`
  );
}

main();
