#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const canonicalConfigPath = path.join(projectRoot, "config/strict-zones.json");
const deprecatedConfigPath = path.join(projectRoot, "packages/config-v2/strict-zones.config.js");

if (!fs.existsSync(canonicalConfigPath)) {
  console.error(`❌ Missing canonical strict-zone config: ${path.relative(projectRoot, canonicalConfigPath)}`);
  process.exit(1);
}

if (fs.existsSync(deprecatedConfigPath)) {
  console.error("❌ Duplicate strict-zone config detected.");
  console.error(
    `   Remove deprecated config: ${path.relative(projectRoot, deprecatedConfigPath)}\n` +
      `   Canonical source is: ${path.relative(projectRoot, canonicalConfigPath)}`
  );
  process.exit(1);
}

console.log("✅ Strict-zone config guard passed (single canonical config in use).");
