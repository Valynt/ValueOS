#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "../..");
const BASELINE_PATH = path.join(ROOT, ".quality/tsc-baseline.json");

function runTypecheckAndCountErrors() {
  const cmd = "pnpm";
  const args = ["exec", "tsc", "--noEmit", "--pretty", "false", "-p", "tsconfig.json"];

  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const matches = output.match(/error TS\d+:/g);
  const errorCount = matches ? matches.length : 0;

  return {
    errorCount,
    output,
    command: `${cmd} ${args.join(" ")}`,
  };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Missing baseline file: ${BASELINE_PATH}`);
  }

  const data = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  if (typeof data.errorCount !== "number") {
    throw new Error(`Invalid baseline file format in ${BASELINE_PATH}`);
  }

  return data;
}

function writeBaseline(errorCount, command) {
  const payload = {
    tool: "tsc-ratchet",
    command,
    errorCount,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

const mode = process.argv[2] ?? "check";
const { errorCount, command } = runTypecheckAndCountErrors();

if (mode === "update") {
  writeBaseline(errorCount, command);
  console.log(`Updated baseline at .quality/tsc-baseline.json to ${errorCount} errors.`);
  process.exit(0);
}

const baseline = readBaseline();
console.log(`Typecheck command: ${command}`);
console.log(`Baseline: ${baseline.errorCount} errors`);
console.log(`Current:  ${errorCount} errors`);

if (errorCount > baseline.errorCount) {
  console.error(`TypeScript debt increased by ${errorCount - baseline.errorCount} errors.`);
  process.exit(1);
}

if (errorCount < baseline.errorCount) {
  console.log(`TypeScript debt reduced by ${baseline.errorCount - errorCount} errors. Run update to ratchet down baseline.`);
} else {
  console.log("TypeScript debt unchanged.");
}
