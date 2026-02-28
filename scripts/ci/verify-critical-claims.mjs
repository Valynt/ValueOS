#!/usr/bin/env node

/**
 * Verify that artifacts referenced in the critical claims checklist exist.
 *
 * Parses docs/processes/critical-claims-checklist.md, extracts file paths
 * from the "Artifact" column, and checks that each exists and is non-empty.
 *
 * Exit code 1 if any referenced artifact is missing.
 */

import { readFileSync, statSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const CHECKLIST_PATH = resolve(ROOT, "docs/processes/critical-claims-checklist.md");

// Extract backtick-quoted file paths from markdown table rows
function extractArtifactPaths(markdown) {
  const paths = new Set();
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (!line.includes("|")) continue;

    // Match backtick-quoted paths that look like file paths
    const matches = line.match(/`([^`]+)`/g);
    if (!matches) continue;

    for (const match of matches) {
      const path = match.replace(/`/g, "").trim();
      // Filter to file-like paths (contain / or .)
      // Strip parenthetical notes like "(job: sast)" or "(backup_retention_period)"
      const cleanPath = path.split(" ")[0];
      if (cleanPath.includes("/") || cleanPath.includes(".")) {
        // Remove trailing parenthetical
        const finalPath = cleanPath.replace(/\s*\(.*\)$/, "");
        if (finalPath.length > 0) {
          paths.add(finalPath);
        }
      }
    }
  }

  return [...paths];
}

console.log("🔍 Verifying critical claims checklist artifacts...\n");

if (!existsSync(CHECKLIST_PATH)) {
  console.error("❌ Checklist not found: docs/processes/critical-claims-checklist.md");
  process.exit(1);
}

const markdown = readFileSync(CHECKLIST_PATH, "utf-8");
const paths = extractArtifactPaths(markdown);

let failures = 0;
let checked = 0;

for (const relPath of paths) {
  const absPath = resolve(ROOT, relPath);
  checked++;

  if (!existsSync(absPath)) {
    console.error(`  ❌ Missing: ${relPath}`);
    failures++;
    continue;
  }

  try {
    const stat = statSync(absPath);
    if (stat.isFile() && stat.size === 0) {
      console.error(`  ❌ Empty file: ${relPath}`);
      failures++;
      continue;
    }
  } catch {
    // Directory or special file — existence is sufficient
  }

  console.log(`  ✅ ${relPath}`);
}

console.log(`\nChecked ${checked} artifacts, ${failures} failures.`);

if (failures > 0) {
  console.error("\n❌ Critical claims verification failed");
  process.exit(1);
} else {
  console.log("\n✅ All critical claims artifacts verified");
}
