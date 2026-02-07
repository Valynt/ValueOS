#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function run(command) {
  return execSync(command, { cwd: projectRoot, encoding: "utf8" }).trim();
}

function getDiffFiles() {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    try {
      run(`git fetch origin ${baseRef} --depth=1`);
    } catch {
      // ignore
    }
    return run(`git diff --name-only origin/${baseRef}...HEAD`).split("\n").filter(Boolean);
  }

  if (process.env.BASE_SHA && process.env.HEAD_SHA) {
    return run(`git diff --name-only ${process.env.BASE_SHA}...${process.env.HEAD_SHA}`)
      .split("\n")
      .filter(Boolean);
  }

  return run("git diff --name-only HEAD~1...HEAD").split("\n").filter(Boolean);
}

function checkLockfileSync() {
  const files = getDiffFiles();
  const packageJsonChanged = files.some((file) => file.endsWith("package.json"));
  const lockfileChanged = files.includes("pnpm-lock.yaml");

  if (packageJsonChanged && !lockfileChanged) {
    console.error("❌ package.json changed without pnpm-lock.yaml update.");
    process.exit(1);
  }
}

function checkMixedLockfiles() {
  const lockfiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
  const present = lockfiles.filter((file) => fs.existsSync(path.join(projectRoot, file)));
  if (present.length > 1) {
    console.error(`❌ Multiple lockfiles present: ${present.join(", ")}`);
    process.exit(1);
  }
}

checkLockfileSync();
checkMixedLockfiles();
console.log("✅ Lockfile policy checks passed.");
