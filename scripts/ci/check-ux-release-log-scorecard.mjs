#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const scorecardPath = resolve(ROOT, arg("--scorecard", "docs/quality/ux-quality-scorecard.md"));
const requiredSubstrings = [
  "accessibility-audit",
  "artifacts/accessibility/",
  "artifacts/i18n/",
  "artifacts/frontend-quality/",
  "regression-dashboard",
  "route-load-metrics",
];

const markdown = readFileSync(scorecardPath, "utf-8");
const lines = markdown.split("\n");

const reviewLogIndex = lines.findIndex((line) => line.trim() === "## Scorecard review log");
if (reviewLogIndex === -1) {
  console.error("❌ Missing '## Scorecard review log' section.");
  process.exit(1);
}

const tableRows = lines
  .slice(reviewLogIndex)
  .filter((line) => line.trim().startsWith("|"))
  .filter((line) => !line.includes("---"));

if (tableRows.length < 2) {
  console.error("❌ Scorecard review log has no release rows.");
  process.exit(1);
}

const latestRow = tableRows[tableRows.length - 1];
if (/pending next ci promotion/i.test(latestRow)) {
  console.error("❌ Latest scorecard review log entry is still pending.");
  process.exit(1);
}

for (const required of requiredSubstrings) {
  if (!latestRow.toLowerCase().includes(required.toLowerCase()) && !markdown.toLowerCase().includes(required.toLowerCase())) {
    console.error(`❌ Missing required release-log evidence marker: ${required}`);
    process.exit(1);
  }
}

if (!/https?:\/\//i.test(latestRow) && !/\[[^\]]+\]\((https?:\/\/[^)]+)\)/i.test(markdown)) {
  console.error("❌ Release log must include at least one artifact link (URL).\n");
  process.exit(1);
}

console.log("✅ UX scorecard release log gate passed");
