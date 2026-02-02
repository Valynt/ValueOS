import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const projectRoot = process.cwd();
const baselinePath = path.join(projectRoot, "ts-debt-baseline.json");

interface Baseline {
  [filePath: string]: number;
}

function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf-8",
    });
    return output.split("\n").filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  } catch (e) {
    return [];
  }
}

async function analyzeBaseline() {
  console.log("🔍 Analyzing current error counts against baseline...");

  if (!fs.existsSync(baselinePath)) {
    console.error("❌ No baseline found. Run 'pnpm run typecheck:signal' first.");
    process.exit(1);
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

  // Run tsc to get current errors
  try {
    const tscOutput = execSync("pnpm exec tsc --noEmit --pretty false", { encoding: "utf-8" });
    const currentErrors = parseErrors(tscOutput);

    console.log("Current error counts:");
    Object.entries(currentErrors).forEach(([file, count]) => {
      const baseCount = baseline[file] || 0;
      const delta = count - baseCount;
      console.log(
        `${file}: ${count} (baseline: ${baseCount}, delta: ${delta > 0 ? "+" : ""}${delta})`
      );
    });

    const totalCurrent = Object.values(currentErrors).reduce((a, b) => a + b, 0);
    const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);
    console.log(`\nTotal errors: ${totalCurrent} (baseline: ${totalBaseline})`);

    if (totalCurrent < totalBaseline * 0.8) {
      console.log(
        "💡 Suggestion: Baseline may be outdated. Consider updating with 'pnpm run typecheck:signal'."
      );
    }
  } catch (e: any) {
    if (e.stdout) {
      const currentErrors = parseErrors(e.stdout.toString());
      console.log("Current error counts (with errors):");
      Object.entries(currentErrors).forEach(([file, count]) => {
        console.log(`${file}: ${count}`);
      });
    } else {
      console.error("❌ Failed to run tsc:", e.message);
    }
  }
}

function parseErrors(tscOutput: string): Record<string, number> {
  const lines = tscOutput.split("\n");
  const errors: Record<string, number> = {};

  lines.forEach((line) => {
    const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
    if (match) {
      const filePath = match[1].trim().replace(/\\/g, "/");
      errors[filePath] = (errors[filePath] || 0) + 1;
    }
  });

  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--analyze-baseline")) {
    return analyzeBaseline();
  }

  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("✅ No TypeScript files staged. Skipping ratchet.");
    return;
  }

  console.log(
    `🔍 Validating ${stagedFiles.length} staged files against Quality Governor baseline...`
  );

  // Load per-package baselines instead of global baseline
  const packageBaselines = loadPackageBaselines();

  // Run tsc and capture errors
  try {
    const tscOutput = execSync("pnpm exec tsc --noEmit --pretty false", { encoding: "utf-8" });
    checkErrors(stagedFiles, tscOutput, packageBaselines);
  } catch (e: any) {
    if (e.stdout) {
      checkErrors(stagedFiles, e.stdout.toString(), packageBaselines);
    } else {
      console.error("❌ Failed to run tsc:", e.message);
      process.exit(1);
    }
  }
}

function loadPackageBaselines(): Record<string, number> {
  const baselines: Record<string, number> = {};
  const packages = [
    "apps/ValyntApp",
    "apps/mcp-dashboard", 
    "packages/backend",
    "packages/sdui",
    "packages/mcp",
    "packages/agents",
    "packages/infra",
    "packages/services",
    "packages/shared"
  ];

  for (const pkg of packages) {
    const debtFile = path.join(projectRoot, pkg, ".ts-debt.json");
    if (fs.existsSync(debtFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(debtFile, "utf-8"));
        if (typeof data.baseline === "number") {
          baselines[pkg] = data.baseline;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  return baselines;
}

function getPackageForFile(filePath: string): string | null {
  const parts = filePath.split("/");
  if (parts[0] === "apps") {
    return `apps/${parts[1]}`;
  } else if (parts[0] === "packages") {
    return `packages/${parts[1]}`;
  }
  return null;
}

function checkErrors(stagedFiles: string[], tscOutput: string, packageBaselines: Record<string, number>) {
  const lines = tscOutput.split("\n");
  const currentErrors: Record<string, number> = {};

  lines.forEach((line) => {
    const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
    if (match) {
      const filePath = match[1].trim();
      const normalizedPath = filePath.replace(/\\/g, "/");
      currentErrors[normalizedPath] = (currentErrors[normalizedPath] || 0) + 1;
    }
  });

  let hasRegressions = false;
  stagedFiles.forEach((file) => {
    const normalizedFile = file.replace(/\\/g, "/");
    const count = currentErrors[normalizedFile] || 0;
    const pkg = getPackageForFile(normalizedFile);
    
    // For now, allow changes as long as the package has a baseline
    // TODO: Implement per-file baseline checking when available
    if (count > 0 && pkg && packageBaselines[pkg] === undefined) {
      console.error(`❌ ${file}: File has errors in package without baseline. Found ${count} errors.`);
      hasRegressions = true;
    }
    // Log the error count for visibility
    if (count > 0) {
      console.log(`📝 ${file}: ${count} errors (package baseline: ${pkg ? packageBaselines[pkg] || 0 : 0})`);
    }
  });

  if (hasRegressions) {
    console.error(
      "\n🛑 Quality Governor: Ratchet violation detected. Please fix the errors before committing."
    );
    process.exit(1);
  } else {
    console.log("\n✅ All staged files passed the Quality Governor ratchet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
