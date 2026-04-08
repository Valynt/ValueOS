#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_SRC = path.join(ROOT, "apps/ValyntApp/src");
const BASELINE_PATH = path.join(
  ROOT,
  "scripts/ci/valyntapp-default-export-allowlist.json"
);

const INCLUDE_EXTENSIONS = new Set([".ts", ".tsx"]);

const collected = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!INCLUDE_EXTENSIONS.has(ext)) continue;
    if (entry.name.endsWith(".stories.tsx")) continue;
    if (entry.name.endsWith(".d.ts")) continue;

    const source = fs.readFileSync(fullPath, "utf8");
    if (source.includes("export default")) {
      collected.push(path.relative(ROOT, fullPath).replaceAll(path.sep, "/"));
    }
  }
}

walk(APP_SRC);

const current = Array.from(new Set(collected)).sort();
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));

const baselineSet = new Set(baseline.files ?? []);
const currentSet = new Set(current);

const added = current.filter((file) => !baselineSet.has(file));
const removed = (baseline.files ?? []).filter((file) => !currentSet.has(file));

if (added.length > 0) {
  console.error("❌ ValyntApp default-export regression detected.");
  console.error("New default-export files:");
  for (const file of added) console.error(`  - ${file}`);
  console.error("\nMigrate these files to named exports and update imports.");
  process.exit(1);
}

console.log(
  `✅ ValyntApp default-export regression check passed (${current.length} allowlisted files).`
);

if (removed.length > 0) {
  console.log("ℹ️ Default-export debt reduced in this change set:");
  for (const file of removed) console.log(`  - ${file}`);
}
