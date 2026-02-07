import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { listWorkspacePackageDirsForUpdate, loadRatchetBaselines } from "./dx/ts-ratchet-baseline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

type ErrorCounts = {
  byPackage: Record<string, number>;
};

function getPackageForFile(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  if (parts[0] === "apps" && parts[1]) return `apps/${parts[1]}`;
  if (parts[0] === "packages" && parts[1]) return `packages/${parts[1]}`;
  return null;
}

function getErrorCounts(): ErrorCounts {
  console.log("Running TypeScript ratchet check...");
  const byPackage: Record<string, number> = {};

  try {
    execSync("pnpm exec tsc --noEmit --pretty false", { encoding: "utf8", stdio: "pipe" });
    return { byPackage };
  } catch (error: any) {
    const output = String(error.stdout ?? "");
    const lines = output.split("\n");

    for (const line of lines) {
      const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
      if (!match) continue;

      const filePath = match[1]?.trim() ?? "";
      const pkg = getPackageForFile(filePath);
      if (pkg) {
        byPackage[pkg] = (byPackage[pkg] ?? 0) + 1;
      }
    }

    return { byPackage };
  }
}

function runPerPackage(mode: string, currentByPackage: Record<string, number>): never {
  const baselines = loadRatchetBaselines(projectRoot);
  const baselineMap = baselines.packageBaselines;

  const packageDirs = listWorkspacePackageDirsForUpdate(projectRoot);
  const allPackages = Array.from(new Set([...packageDirs, ...Object.keys(baselineMap)])).sort();

  let regressions = 0;
  let improvements = 0;

  console.log(`\n📊 Status Report:`);
  console.log(`   Model: per-package`);

  for (const pkg of allPackages) {
    const baseline = baselineMap[pkg] ?? 0;
    const current = currentByPackage[pkg] ?? 0;

    if (mode === "update") {
      const baselinePath = path.join(projectRoot, pkg, ".ts-debt.json");
      fs.writeFileSync(baselinePath, JSON.stringify({ baseline: current }, null, 2));
      continue;
    }

    if (!(pkg in baselines.packageBaselinePaths)) continue;

    if (current > baseline) {
      console.error(`   ❌ ${pkg}: ${current} errors (baseline: ${baseline})`);
      regressions++;
    } else if (current < baseline) {
      console.log(`   🎉 ${pkg}: ${current} errors (baseline: ${baseline})`);
      improvements++;
    } else {
      console.log(`   ✅ ${pkg}: ${current} errors (baseline: ${baseline})`);
    }
  }

  if (mode === "update") {
    console.log(`✅ Updated per-package baselines for ${allPackages.length} workspaces.`);
    process.exit(0);
  }

  if (regressions > 0) {
    console.error(`\n⛔ RAT CHET FAILURE ⛔`);
    console.error(`Regression detected in ${regressions} package(s).`);
    process.exit(1);
  }

  if (improvements > 0) {
    console.log("\n⚠️  Improvements detected. Run 'pnpm ts:ratchet:update' to lock them in.");
  } else {
    console.log("\n✅ Ratchet check passed. No regressions detected.");
  }

  process.exit(0);
}

function main() {
  const mode = process.argv[2];
  if (mode !== "check" && mode !== "update") {
    console.error("Usage: tsx scripts/ts-ratchet.ts <check|update>");
    process.exit(1);
  }

  const counts = getErrorCounts();

  try {
    runPerPackage(mode, counts.byPackage);
  } catch (error: any) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
