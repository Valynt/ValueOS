#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const mdPath = path.join(repoRoot, "docs/debt/top-20-dead-exports.md");
const jsonPath = path.join(repoRoot, "docs/debt/inventory-report.json");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(mdPath)) {
  fail("Missing docs/debt/top-20-dead-exports.md. Run node scripts/debt/inventory.mjs first.");
}

if (!fs.existsSync(jsonPath)) {
  fail("Missing docs/debt/inventory-report.json. Run node scripts/debt/inventory.mjs first.");
}

const md = fs.readFileSync(mdPath, "utf8");
const generatedLineMatch = md.match(/^Generated at: `([^`]+)`\.$/m);
if (!generatedLineMatch) {
  fail("top-20-dead-exports.md must include a Generated at timestamp line.");
}

const generatedDate = new Date(generatedLineMatch[1]);
if (Number.isNaN(generatedDate.getTime())) {
  fail("top-20-dead-exports.md has an invalid Generated at timestamp.");
}

const hasFindings = /^\d+\.\s+`.+`\s+—\s+`.*`$/m.test(md);
const hasZeroFindings = /^0 findings\.$/m.test(md);

if (!hasFindings && !hasZeroFindings) {
  fail(
    "top-20-dead-exports.md is syntactically present but semantically empty; include findings or the explicit '0 findings.' marker."
  );
}

let inventory;
try {
  inventory = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} catch {
  fail("inventory-report.json is not valid JSON.");
}

if (typeof inventory.generated_at !== "string" || Number.isNaN(new Date(inventory.generated_at).getTime())) {
  fail("inventory-report.json must include a valid generated_at timestamp.");
}

if (!inventory.dead_exports || typeof inventory.dead_exports.total !== "number") {
  fail("inventory-report.json must include dead_exports.total.");
}

if (!Array.isArray(inventory.dead_exports.top20)) {
  fail("inventory-report.json must include dead_exports.top20 as an array.");
}

if (inventory.dead_exports.total > 0 && inventory.dead_exports.top20.length === 0) {
  fail("inventory-report.json dead_exports.total > 0 but top20 is empty.");
}

if (inventory.dead_exports.top20.length > 20) {
  fail("inventory-report.json dead_exports.top20 cannot contain more than 20 entries.");
}

console.log(
  `✅ Debt report semantic guard passed: ${inventory.dead_exports.top20.length} top-20 entries at ${inventory.generated_at}`
);
