#!/usr/bin/env node

/**
 * check-env-template-completeness.mjs
 *
 * Scans backend source for process.env.X references and verifies every
 * variable appears in ops/env/.env.base.
 *
 * Usage:
 *   node scripts/ci/check-env-template-completeness.mjs
 *
 * Exit codes:
 *   0 - all referenced variables are documented in .env.base
 *   1 - missing variables found (printed to stderr)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const ENV_BASE_PATH = join(ROOT, "ops/env/.env.base");
const SCAN_DIRS = [
  join(ROOT, "packages/backend/src"),
  join(ROOT, "packages/shared/src"),
];

// Well-known env vars that are set by the runtime or build tools, not by operators.
const IGNORED_VARS = new Set([
  "NODE_ENV",
  "PATH",
  "HOME",
  "USER",
  "PWD",
  "SHELL",
  "TERM",
  "LANG",
  "TZ",
  "CI",
  "GITHUB_ACTIONS",
  "GITHUB_SHA",
  "GITHUB_REF",
  "GITHUB_REPOSITORY",
  "npm_package_version",
  "npm_lifecycle_event",
  "SSR",
]);

/**
 * Parse .env.base and return a Set of variable names.
 */
function parseEnvBase(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const vars = new Set();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      vars.add(match[1]);
    }
  }
  return vars;
}

/**
 * Recursively collect .ts and .tsx files from a directory.
 */
function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip node_modules, dist, __tests__
        if (["node_modules", "dist", ".git"].includes(entry)) continue;
        collectFiles(fullPath, files);
      } else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry))) {
        files.push(fullPath);
      }
    } catch {
      // skip unreadable
    }
  }
  return files;
}

/**
 * Extract process.env.X references from source code.
 */
function extractEnvReferences(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const refs = new Set();

  // Match process.env.VAR_NAME and process.env['VAR_NAME'] and process.env["VAR_NAME"]
  const patterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    // Also match getEnvVar("VAR") and readEnv("VAR")
    /(?:getEnvVar|readEnv)\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      refs.add(match[1]);
    }
  }

  return refs;
}

// Main
const baseVars = parseEnvBase(ENV_BASE_PATH);
const allRefs = new Set();

for (const dir of SCAN_DIRS) {
  const files = collectFiles(dir);
  for (const file of files) {
    const refs = extractEnvReferences(file);
    for (const ref of refs) {
      allRefs.add(ref);
    }
  }
}

// Find missing
const missing = [];
for (const ref of allRefs) {
  if (!baseVars.has(ref) && !IGNORED_VARS.has(ref)) {
    missing.push(ref);
  }
}

missing.sort();

if (missing.length > 0) {
  process.stderr.write(
    `\n[env-completeness] ${missing.length} env var(s) referenced in source but missing from ops/env/.env.base:\n\n`
  );
  for (const v of missing) {
    process.stderr.write(`  - ${v}\n`);
  }
  process.stderr.write(
    `\nAdd them to ops/env/.env.base with appropriate defaults.\n\n`
  );
  process.exit(1);
} else {
  process.stdout.write(
    `[env-completeness] All ${allRefs.size} referenced env vars are documented in .env.base.\n`
  );
  process.exit(0);
}
