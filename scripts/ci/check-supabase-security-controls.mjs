#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");
const OUTPUT_DIR = resolve(ROOT, "ci-artifacts");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "security-controls-summary.json");

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => /^\d{14}_.*\.sql$/.test(file))
  .filter((file) => file !== "20260213000002_baseline_schema.sql")
  .sort();

const state = {
  rlsEnabledTables: new Set(),
  rlsDynamicHintTables: new Set(),
  policyCountByTable: new Map(),
  activePolicies: new Map(),
  plaintextCredentialColumns: [],
};

const addPolicy = (table, name, body) => {
  const key = `${table}::${name}`;
  state.activePolicies.set(key, { table, name, body });
  state.policyCountByTable.set(table, (state.policyCountByTable.get(table) ?? 0) + 1);
};

const dropPolicy = (table, name) => {
  const key = `${table}::${name}`;
  const existing = state.activePolicies.get(key);
  if (existing) {
    const current = state.policyCountByTable.get(table) ?? 0;
    state.policyCountByTable.set(table, Math.max(0, current - 1));
  }
  state.activePolicies.delete(key);
};

const extractStatements = (sql) =>
  sql
    .replace(/--.*$/gm, "")
    .split(/;\s*(?:\n|$)/g)
    .map((statement) => statement.trim())
    .filter(Boolean);

for (const file of migrationFiles) {
  const fullPath = resolve(MIGRATIONS_DIR, file);
  const sql = readFileSync(fullPath, "utf8");

  const credentialPattern = /\bcredentials\s+jsonb\b/gi;
  let match;
  while ((match = credentialPattern.exec(sql)) !== null) {
    state.plaintextCredentialColumns.push({
      file,
      token: match[0],
    });
  }

  for (const statement of extractStatements(sql)) {
    const rlsMatch = statement.match(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    if (rlsMatch) {
      state.rlsEnabledTables.add(rlsMatch[1]);
      const tableName = rlsMatch[1];
      if (/CREATE\s+POLICY/is.test(sql) && new RegExp(`\\b${tableName}\\b`, "i").test(sql)) {
        state.rlsDynamicHintTables.add(tableName);
      }
      continue;
    }

    const dropPolicyMatch = statement.match(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([^"\s]+(?:\s+[^"\s]+)*)"?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
    if (dropPolicyMatch) {
      dropPolicy(dropPolicyMatch[2], dropPolicyMatch[1]);
      continue;
    }

    const createPolicyMatch = statement.match(/CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([^"\n]+?)"?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
    if (createPolicyMatch) {
      addPolicy(createPolicyMatch[2], createPolicyMatch[1].trim(), statement);
    }
  }
}

const tablesMissingPolicies = [...state.rlsEnabledTables]
  .filter((table) => (state.policyCountByTable.get(table) ?? 0) === 0)
  .filter((table) => !state.rlsDynamicHintTables.has(table))
  .sort();

const jwtOnlyTenantPolicies = [...state.activePolicies.values()]
  .filter(({ body }) => {
    const hasTenantJwtClaim = /auth\.jwt\(\).*?(organization_id|tenant_id)/is.test(body);
    if (!hasTenantJwtClaim) return false;

    const hasServiceRoleException = /(auth\.role\(\)\s*=\s*'service_role'|is_service_role\s*\()/i.test(body);
    return !hasServiceRoleException;
  })
  .map(({ table, name }) => ({ table, policy: name }))
  .sort((a, b) => `${a.table}:${a.policy}`.localeCompare(`${b.table}:${b.policy}`));

const commitSha = process.env.GITHUB_SHA || execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
const summary = {
  commitSha,
  controls: {
    tablesWithRlsMissingPolicies: {
      passed: tablesMissingPolicies.length === 0,
      violations: tablesMissingPolicies,
    },
    plaintextCredentialColumns: {
      passed: state.plaintextCredentialColumns.length === 0,
      violations: state.plaintextCredentialColumns,
    },
    jwtClaimOnlyTenantPolicies: {
      passed: jwtOnlyTenantPolicies.length === 0,
      violations: jwtOnlyTenantPolicies,
    },
  },
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(`Wrote security control summary: ${OUTPUT_FILE}`);

const failed = Object.entries(summary.controls)
  .filter(([, control]) => !control.passed)
  .map(([name]) => name);

if (failed.length > 0) {
  console.error(`\n❌ Supabase security controls failed: ${failed.join(", ")}`);
  for (const [name, control] of Object.entries(summary.controls)) {
    if (!control.passed) {
      console.error(`- ${name}: ${JSON.stringify(control.violations)}`);
    }
  }
  process.exit(1);
}

console.log("✅ Supabase security controls passed");
