import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_FILE = path.join(__dirname, "../.github/ts-error-baseline.json");

interface Baseline {
  total_errors: number;
  last_updated: string;
}

function getErrorCount(): number {
  console.log("Running global TypeCheck...");
  try {
    execSync("pnpm tsc --noEmit", { stdio: "pipe" });
    return 0;
  } catch (e: any) {
    const output = e.stdout.toString();
    const lines = output.split("\n");
    const errors = lines.filter((l: string) => l.includes("error TS")).length;
    return errors;
  }
}

function main() {
  const mode = process.argv[2]; // 'check' or 'update'

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`Baseline file not found at ${BASELINE_FILE}`);
    process.exit(1);
  }

  const currentErrors = getErrorCount();
  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8"));

  console.log(`\n📊 Status Report:`);
  console.log(`   Baseline Errors: ${baseline.total_errors}`);
  console.log(`   Current Errors:  ${currentErrors}`);

  if (mode === "update") {
    if (currentErrors < baseline.total_errors) {
      console.log(`🎉 Improvements detected! Updating baseline to ${currentErrors}.`);
      const newBaseline: Baseline = {
        total_errors: currentErrors,
        last_updated: new Date().toISOString(),
      };
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(newBaseline, null, 2));
      process.exit(0);
    } else {
      console.log(`No improvement. Baseline remains at ${baseline.total_errors}.`);
      process.exit(0);
    }
  } else {
    // Check mode (CI)
    if (currentErrors > baseline.total_errors) {
      console.error(`\n⛔ RAT CHET FAILURE ⛔`);
      console.error(
        `Technical debt has increased! You introduced ${currentErrors - baseline.total_errors} new errors.`
      );
      process.exit(1);
    } else if (currentErrors < baseline.total_errors) {
      console.log(`\n⚠️  Excellent work, but you forgot to lock in the gains.`);
      console.log(`   Please run 'pnpm ts:ratchet:update' to lower the baseline.`);
      process.exit(0);
    } else {
      console.log(`\n✅ Ratchet check passed. Error count static.`);
      process.exit(0);
    }
  }
}

main();
