#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();

const allowlistPath = path.join(repoRoot, "scripts/ci/deprecated-supabase-import-allowlist.json");
const allowlistFile = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));

const migrationExceptionPaths = new Set(allowlistFile.migrationExceptions ?? []);
const allowedLegacyPaths = new Set(allowlistFile.allowedLegacyPaths ?? []);

const targets = ["createServerSupabaseClient", "getSupabaseClient", "supabase"];
const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

function listBackendSourceFiles() {
  const out = execFileSync("rg", ["--files", "packages/backend/src", "-g", "*.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => !filePath.includes("__tests__") && !filePath.endsWith(".test.ts") && !filePath.endsWith(".spec.ts"));
}

function findsDeprecatedImport(source, specifier) {
  if (!specifier.includes("lib/supabase") && specifier !== "@shared/lib/supabase") {
    return false;
  }

  return targets.some((name) => new RegExp(`\\b${name}\\b`).test(source));
}

const detected = new Set();
for (const filePath of listBackendSourceFiles()) {
  if (migrationExceptionPaths.has(filePath)) continue;

  const content = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  importRegex.lastIndex = 0;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const bindings = match[1] ?? "";
    const specifier = match[2] ?? "";

    if (findsDeprecatedImport(bindings, specifier)) {
      detected.add(filePath);
      break;
    }
  }
}

const unexpected = Array.from(detected).filter((filePath) => !allowedLegacyPaths.has(filePath)).sort();
const stale = Array.from(allowedLegacyPaths).filter((filePath) => !detected.has(filePath)).sort();

if (unexpected.length > 0) {
  console.error("❌ Deprecated Supabase import gate failed. New deprecated imports detected:");
  for (const filePath of unexpected) {
    console.error(` - ${filePath}`);
  }
  console.error("\nUse src/lib/supabase/privileged/* factories with explicit service-role justification literals.");
  process.exit(1);
}

if (stale.length > 0) {
  console.log("ℹ️ Deprecated import allowlist contains removable legacy entries:");
  for (const filePath of stale) {
    console.log(` - ${filePath}`);
  }
}

console.log(`✅ Deprecated Supabase import gate passed (${detected.size} tracked legacy import file(s)).`);
