#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

const toolManifest = JSON.parse(read("scripts/ci/security-tool-versions.json"));
const failures = [];

const checks = [
  {
    id: "headers-middleware-registered",
    file: "packages/backend/src/server.ts",
    test: (content) => content.includes("app.use(securityHeadersMiddleware);") ,
    error: "Expected app.use(securityHeadersMiddleware); in packages/backend/src/server.ts",
  },
  {
    id: "security-pack-enables-headers",
    file: "packages/backend/src/middleware/security/index.ts",
    test: (content) => content.includes("if (headersOptions.enabled !== false)") && content.includes("createSecurityHeadersMiddleware"),
    error: "Expected security middleware pack to conditionally apply createSecurityHeadersMiddleware in packages/backend/src/middleware/security/index.ts",
  },
  {
    id: "codeql-dedicated-workflow",
    file: ".github/workflows/codeql.yml",
    test: (content) => toolManifest.scannerActions.filter(({ id }) => id === "codeql-init" || id === "codeql-analyze").every(({ uses }) => content.includes(uses)),
    error: "Expected CodeQL init/analyze refs from scripts/ci/security-tool-versions.json in .github/workflows/codeql.yml",
  },
  {
    id: "pr-fast-has-tenant-controls-guard",
    file: ".github/workflows/pr-fast.yml",
    test: (content) => content.includes("check-supabase-tenant-controls.mjs"),
    error: "Expected check-supabase-tenant-controls.mjs in .github/workflows/pr-fast.yml",
  },
  {
    id: "main-verify-has-tenant-controls-guard",
    file: ".github/workflows/main-verify.yml",
    test: (content) => content.includes("check-supabase-tenant-controls.mjs"),
    error: "Expected check-supabase-tenant-controls.mjs in .github/workflows/main-verify.yml",
  },
];

for (const scannerAction of toolManifest.scannerActions.filter(({ workflow }) => !workflow.endsWith("codeql.yml"))) {
  checks.push({
    id: `${scannerAction.workflow}:${scannerAction.id}`,
    file: scannerAction.workflow,
    test: (content) => content.includes(scannerAction.uses),
    error: `Expected ${scannerAction.uses} in ${scannerAction.workflow}`,
  });
}

for (const check of checks) {
  const content = read(check.file);
  if (!check.test(content)) {
    failures.push(`- [${check.id}] ${check.error}`);
  }
}

if (failures.length > 0) {
  console.error("❌ Security baseline verification failed:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`✅ Security baseline verification passed (${checks.length} checks)`);
