#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const PLACEHOLDER_PATTERN = /^(todo|replace_me|tbd|unknown|none|n\/a|-|team:replace_me)$/i;
const TARGET_GLOBS = [
  "config/release-risk/**/*.json",
  "docs/security-compliance/*waiver*.json",
];

const today = new Date().toISOString().slice(0, 10);
let hasFailure = false;

function fail(message) {
  hasFailure = true;
  console.error(`❌ ${message}`);
}

function getFiles() {
  const files = new Set();
  for (const glob of TARGET_GLOBS) {
    const output = execSync(`rg --files -g '${glob}'`, {
      cwd: ROOT,
      encoding: "utf8",
    });
    for (const file of output.split(/\r?\n/).filter(Boolean)) {
      files.add(file);
    }
  }
  return [...files].sort();
}

function isPlaceholder(value) {
  if (typeof value !== "string") return true;
  const normalized = value.trim();
  return normalized.length === 0 || PLACEHOLDER_PATTERN.test(normalized);
}

function resolveExpiry(waiver) {
  if (typeof waiver.expires_at === "string") return waiver.expires_at;
  if (typeof waiver.expiresOn === "string") return waiver.expiresOn;
  if (typeof waiver.expires === "string") return waiver.expires;
  return "";
}

function validateWaiver(waiver, context) {
  const owner = waiver.owner;
  const expiry = resolveExpiry(waiver);

  if (isPlaceholder(owner)) {
    fail(`${context} is missing owner metadata or has placeholder owner value.`);
  }

  if (!expiry) {
    fail(`${context} is missing expiry metadata (expires_at | expiresOn | expires).`);
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    fail(`${context} has non-ISO expiry date '${expiry}'. Expected YYYY-MM-DD.`);
    return;
  }

  if (expiry < today) {
    fail(`${context} is expired (${expiry}).`);
  }
}

for (const relativeFile of getFiles()) {
  const absoluteFile = path.join(ROOT, relativeFile);
  const payload = JSON.parse(readFileSync(absoluteFile, "utf8"));
  const waivers = Array.isArray(payload?.waivers) ? payload.waivers : [];

  for (let index = 0; index < waivers.length; index += 1) {
    validateWaiver(waivers[index], `${relativeFile} waivers[${index}]`);
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log("✅ Waiver ownership metadata is present and non-expired across release-risk and security waiver registries.");
