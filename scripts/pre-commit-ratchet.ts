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
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf-8" });
    return output.split("\n").filter(f => f.endsWith(".ts") || f.endsWith(".tsx"));
  } catch (e) {
    return [];
  }
}

async function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("✅ No TypeScript files staged. Skipping ratchet.");
    return;
  }

  console.log(`🔍 Validating ${stagedFiles.length} staged files against Quality Governor baseline...`);

  if (!fs.existsSync(baselinePath)) {
    console.error("❌ No baseline found. Run 'pnpm run typecheck:signal' first.");
    process.exit(1);
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

  // Run tsc and capture errors
  // We use --noEmit to just get type errors
  try {
    // Note: We run tsc project-wide to ensure context, but we will filter the output
    const tscOutput = execSync("pnpm exec tsc --noEmit --pretty false", { encoding: "utf-8" });
    checkErrors(stagedFiles, tscOutput, baseline);
  } catch (e: any) {
    if (e.stdout) {
      checkErrors(stagedFiles, e.stdout.toString(), baseline);
    } else {
      console.error("❌ Failed to run tsc:", e.message);
      process.exit(1);
    }
  }
}

function checkErrors(stagedFiles: string[], tscOutput: string, baseline: Baseline) {
  const lines = tscOutput.split("\n");
  const currentErrors: Record<string, number> = {};

  lines.forEach(line => {
    const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
    if (match) {
      const filePath = match[1].trim();
      const normalizedPath = filePath.replace(/\\/g, "/");
      currentErrors[normalizedPath] = (currentErrors[normalizedPath] || 0) + 1;
    }
  });

  let hasRegressions = false;
  stagedFiles.forEach(file => {
    const normalizedFile = file.replace(/\\/g, "/");
    const count = currentErrors[normalizedFile] || 0;
    const baseCount = baseline[normalizedFile] || 0;

    if (count > baseCount) {
      console.error(`❌ ${file}: Error count increased from ${baseCount} to ${count}`);
      hasRegressions = true;
    } else if (count < baseCount) {
      console.log(`✨ ${file}: Improved! Errors reduced from ${baseCount} to ${count}`);
    } else {
       // Check if it's a new file (not in baseline) but has errors
       if (!baseline[normalizedFile] && count > 0) {
         console.error(`❌ ${file}: New file must have 0 errors. Found ${count}.`);
         hasRegressions = true;
       }
    }
  });

  if (hasRegressions) {
    console.error("\n🛑 Quality Governor: Ratchet violation detected. Please fix the errors before committing.");
    process.exit(1);
  } else {
    console.log("\n✅ All staged files passed the Quality Governor ratchet.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
