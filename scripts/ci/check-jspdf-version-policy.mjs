#!/usr/bin/env node
import fs from "node:fs";

const lockfilePath = "pnpm-lock.yaml";
const vulnerableVersion = "4.2.0";

if (!fs.existsSync(lockfilePath)) {
  console.error(`Lockfile not found at ${lockfilePath}`);
  process.exit(1);
}

const lockfileText = fs.readFileSync(lockfilePath, "utf8");
const lines = lockfileText.split(/\r?\n/);

const matches = [];
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (/\bjspdf@4\.2\.0\b/.test(line)) {
    matches.push({ lineNumber: index + 1, line: line.trim() });
  }
}

if (matches.length > 0) {
  console.error(
    `Dependency policy violation: found vulnerable jspdf@${vulnerableVersion} in ${lockfilePath}.`,
  );
  console.error("Detected lockfile entries:");
  for (const match of matches) {
    console.error(`  - L${match.lineNumber}: ${match.line}`);
  }
  process.exit(1);
}

console.log(`Dependency policy check passed: no jspdf@${vulnerableVersion} lockfile resolutions detected.`);
