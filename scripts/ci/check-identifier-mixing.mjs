#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, "../..");

const SENSITIVE_ROOTS = [
  "packages/backend/src/services/auth",
  "packages/backend/src/services/tenant",
  "packages/backend/src/repositories",
];

const MIXING_BASELINE_ALLOWLIST = new Set([
  "packages/backend/src/repositories/ExpansionOpportunityRepository.ts",
  "packages/backend/src/repositories/IntegrityResultRepository.ts",
  "packages/backend/src/repositories/NarrativeDraftRepository.ts",
  "packages/backend/src/repositories/RealizationReportRepository.ts",
  "packages/backend/src/services/auth/SecureSharedContext.ts",
  "packages/backend/src/services/auth/SettingsService.ts",
  "packages/backend/src/services/tenant/TenantArchivalService.ts",
  "packages/backend/src/services/tenant/TenantBillingProvisioning.ts",
  "packages/backend/src/services/tenant/TenantDeletionService.ts",
  "packages/backend/src/services/tenant/TenantOrganizationProvisioning.ts",
  "packages/backend/src/services/tenant/TenantProvisioningEmail.ts",
]);

const SENSITIVE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_NAME_PARTS = [".test.", ".spec.", "__tests__", ".d.ts"];
const ADAPTER_ALLOWLIST_PARTS = ["/types/identity", "identity-adapter"];

const canonicalPattern = /\b(organization_id|organizationId)\b/;
const legacyPattern = /\b(tenant_id|tenantId|org_id|orgId|tid)\b/;
const forbiddenLegacyShortAliasPattern = /\borg_id\b/;

const migrationDir = path.join(repoRoot, "infra/supabase/supabase/migrations");
const migrationIgnoreRoots = [
  path.join(migrationDir, "archive"),
  path.join(migrationDir, "_deferred"),
];

const migrationForbiddenPattern = /\borg_id\b/;

const walkFiles = (rootDir, onFile) => {
  if (!fs.existsSync(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, onFile);
      continue;
    }
    onFile(fullPath);
  }
};

const errors = [];

for (const root of SENSITIVE_ROOTS) {
  const absoluteRoot = path.join(repoRoot, root);
  walkFiles(absoluteRoot, (filePath) => {
    const relative = path.relative(repoRoot, filePath).split(path.sep).join("/");
    const ext = path.extname(filePath);

    if (!SENSITIVE_EXTENSIONS.has(ext)) return;
    if (IGNORED_NAME_PARTS.some((part) => relative.includes(part))) return;

    const source = fs.readFileSync(filePath, "utf8");

    if (forbiddenLegacyShortAliasPattern.test(source) && !ADAPTER_ALLOWLIST_PARTS.some((part) => relative.includes(part))) {
      errors.push(
        `${relative}: uses forbidden org_id alias directly. Route legacy alias projection through packages/backend/src/types/identity.ts adapters.`,
      );
    }

    if (canonicalPattern.test(source) && legacyPattern.test(source)) {
      if (!MIXING_BASELINE_ALLOWLIST.has(relative) && !ADAPTER_ALLOWLIST_PARTS.some((part) => relative.includes(part))) {
        errors.push(
          `${relative}: mixes canonical (organization_id/organizationId) and legacy (tenant_id/tenantId/org_id/orgId/tid) identifiers in one module. Use canonical identifiers and isolate translation in adapters.`,
        );
      }
    }
  });
}

walkFiles(migrationDir, (filePath) => {
  const relative = path.relative(repoRoot, filePath).split(path.sep).join("/");
  if (!filePath.endsWith(".sql")) return;
  if (migrationIgnoreRoots.some((ignoredRoot) => filePath.startsWith(ignoredRoot))) return;

  const source = fs.readFileSync(filePath, "utf8");
  if (migrationForbiddenPattern.test(source)) {
    errors.push(
      `${relative}: found org_id token in active migration chain. Use organization_id as canonical identity key and add explicit adapter comments only in archived/deferred migrations.`,
    );
  }
});

if (errors.length > 0) {
  console.error("Identity contract lint failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log("Identity contract lint passed.");
