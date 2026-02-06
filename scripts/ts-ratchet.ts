import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type Baseline = {
  totalErrors: number;
  command: string;
  generatedAt: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const baselinePath = path.join(repoRoot, ".quality", "tsc-baseline.json");
const tscArgs = ["tsc", "--noEmit", "--pretty", "false"];
const tscCommand = `pnpm ${tscArgs.join(" ")}`;

function countTypeScriptErrors(output: string): number {
  const matches = output.match(/^.*error TS\d+:.*$/gm);
  return matches ? matches.length : 0;
}

function runTypecheckAndCount(): number {
  try {
    execFileSync("pnpm", tscArgs, { cwd: repoRoot, stdio: "pipe", encoding: "utf8" });
    return 0;
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout ?? "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr ?? "") : "";
    return countTypeScriptErrors(`${stdout}\n${stderr}`);
  }
}

function readBaseline(): Baseline {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing baseline file at ${baselinePath}. Run 'pnpm ts:ratchet:update' once.`);
  }

  return JSON.parse(fs.readFileSync(baselinePath, "utf8")) as Baseline;
}

function writeBaseline(totalErrors: number): void {
  const baseline: Baseline = {
    totalErrors,
    command: tscCommand,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

function main(): void {
  const mode = process.argv[2] ?? "check";
  const currentErrors = runTypecheckAndCount();

  if (mode === "update") {
    writeBaseline(currentErrors);
    console.log(`📝 Updated TypeScript baseline to ${currentErrors} errors.`);
    return;
  }

  if (mode !== "check") {
    throw new Error(`Unsupported mode '${mode}'. Use 'check' or 'update'.`);
  }

  const baseline = readBaseline();
  console.log(`📊 TypeScript debt count (legacy scope): current=${currentErrors}, baseline=${baseline.totalErrors}`);

  if (currentErrors > baseline.totalErrors) {
    const increase = currentErrors - baseline.totalErrors;
    throw new Error(`TypeScript ratchet failed: ${increase} new errors introduced.`);
  }

  if (currentErrors < baseline.totalErrors) {
    console.log("✅ TypeScript debt reduced. Run 'pnpm ts:ratchet:update' to ratchet baseline down.");
    return;
  }

  console.log("✅ TypeScript ratchet passed (no debt growth).");
}

main();
