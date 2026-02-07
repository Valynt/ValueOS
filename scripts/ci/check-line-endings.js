#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function run(command) {
  return execSync(command, { cwd: projectRoot, encoding: "utf8" });
}

const files = run("git ls-files -z").split("\0").filter(Boolean);
const offenders = [];

files.forEach((file) => {
  const fullPath = path.join(projectRoot, file);
  const buffer = fs.readFileSync(fullPath);

  if (buffer.includes(0)) {
    return;
  }

  const content = buffer.toString("utf8");
  if (content.includes("\r\n")) {
    offenders.push(file);
  }
});

if (offenders.length > 0) {
  console.error("❌ CRLF line endings detected in:");
  offenders.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log("✅ Line ending check passed (LF only).");
