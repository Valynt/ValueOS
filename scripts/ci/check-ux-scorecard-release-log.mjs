#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const scorecardPath = resolve(ROOT, "docs/quality/ux-quality-scorecard.md");
const sha = process.env.GITHUB_SHA ?? "";

if (!existsSync(scorecardPath)) {
  console.error("❌ Missing docs/quality/ux-quality-scorecard.md");
  process.exit(1);
}

const scorecard = readFileSync(scorecardPath, "utf-8");
const shortSha = sha ? sha.slice(0, 7) : "";
const lines = scorecard.split("\n");
const tableLines = lines.filter((line) => line.startsWith("| 20"));
const latest = tableLines[tableLines.length - 1] ?? "";

if (!latest) {
  console.error("❌ Scorecard review log has no dated entries.");
  process.exit(1);
}

if (shortSha && !latest.includes(shortSha) && !latest.includes(sha)) {
  console.error(`❌ Latest scorecard release log row does not reference current SHA (${shortSha}).`);
  process.exit(1);
}

const linkMatches = latest.match(/\[[^\]]+\]\([^\)]+\)/g) ?? [];
if (linkMatches.length < 3) {
  console.error("❌ Latest scorecard release log row must include at least three artifact links (a11y, l10n, performance).");
  process.exit(1);
}

console.log("✅ UX scorecard release log gate passed");
