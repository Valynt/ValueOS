#!/usr/bin/env node

/**
 * CI guard: static analysis of active migration files for schema consistency.
 *
 * Checks (no live DB required):
 *
 *   1. Index column existence
 *      Every column named in a CREATE INDEX must appear in the CREATE TABLE
 *      for the same table within the active migration set.
 *
 *   2. Tenant column presence
 *      Every CREATE TABLE in the active chain must include at least one of:
 *      tenant_id, organization_id. Tables on an explicit allowlist are exempt
 *      (lookup/reference tables with no tenant scope).
 *
 *   3. RLS coverage
 *      Every CREATE TABLE must be followed by ENABLE ROW LEVEL SECURITY
 *      somewhere in the active migration set. Tables on the allowlist are exempt.
 *
 *   4. Rollback file pairing
 *      Every migration >= 20260320 must have a paired .rollback.sql file.
 *      (Earlier migrations predate the rollback convention.)
 *
 * Run locally:  node scripts/ci/check-migration-schema-consistency.mjs
 * Run in CI:    same command (no env vars needed)
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");

// Tables that legitimately have no tenant_id / organization_id.
const TENANT_EXEMPT_TABLES = new Set([
  "billing_meters",              // global catalog
  "domain_packs",                // global + optional tenant override (tenant_id nullable)
  "domain_pack_kpis",            // child of domain_packs
  "domain_pack_assumptions",     // child of domain_packs
  "audit_logs_archive",          // inherits from audit_logs via LIKE
  "tenants",                     // root identity table — IS the tenant
  "feature_flags",               // global feature flag catalog
  "feature_flag_evaluations",    // evaluation log, scoped by user_id not tenant
  "approval_attachments",        // child of approval_requests (inherits tenant scope via FK)
]);

// Tables that legitimately have no RLS (e.g., global reference data, service-only tables).
const RLS_EXEMPT_TABLES = new Set([
  "billing_meters",
  "audit_logs_archive",          // read-only archive, protected by audit_logs RLS
  "feature_flags",               // global catalog, read-only for authenticated
  "feature_flag_evaluations",    // service_role only
  "approval_attachments",        // access controlled via parent approval_requests
  "tenants",                     // provisioned by service_role only
  "tenant_provisioning_requests",// service_role only
  "subscription_items",          // access controlled via parent subscriptions
  "usage_alerts",                // service_role only
]);

// Tables whose index references are inside DO $$ ... IF NOT EXISTS guards and
// will not fail at apply time even if the table is absent. The checker cannot
// parse PL/pgSQL blocks, so we exempt these from the static index-table check.
const INDEX_GUARD_EXEMPT_TABLES = new Set([
  "usage_records", // ALTER TABLE inside DO $$ IF NOT EXISTS in 20260302100000
]);

// Rollback convention introduced at this timestamp prefix.
const ROLLBACK_REQUIRED_FROM = "20260320";

// ─── helpers ─────────────────────────────────────────────────────────────────

function stripComments(sql) {
  // Remove -- line comments and /* */ block comments.
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

function extractTableNames(sql) {
  const clean = stripComments(sql);
  const pattern = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?(\w+)/gi;
  const tables = new Set();
  let m;
  while ((m = pattern.exec(clean)) !== null) {
    tables.add(m[1].toLowerCase());
  }
  return tables;
}

function extractTableColumns(sql, tableName) {
  // Extract column names from the CREATE TABLE block for a given table.
  const clean = stripComments(sql);
  const tablePattern = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    "i"
  );
  const m = tablePattern.exec(clean);
  if (!m) return new Set();

  const body = m[1];
  const cols = new Set();
  // Match column definitions: word at start of line (after optional whitespace),
  // followed by a type keyword. Excludes CONSTRAINT, PRIMARY, UNIQUE, CHECK, FOREIGN.
  const colPattern = /^\s{1,8}(\w+)\s+(?!CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|LIKE)(\w)/gim;
  let cm;
  while ((cm = colPattern.exec(body)) !== null) {
    cols.add(cm[1].toLowerCase());
  }
  return cols;
}

function extractIndexes(sql) {
  // Returns [{indexName, tableName, columns[]}]
  const clean = stripComments(sql);
  const pattern =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:public\.)?(\w+)\s*(?:USING\s+\w+\s*)?\(([^)]+)\)/gi;
  const indexes = [];
  let m;
  while ((m = pattern.exec(clean)) !== null) {
    const rawCols = m[3];
    // Extract bare column names (strip expressions, operators, ASC/DESC, NULLS)
    const cols = rawCols
      .split(",")
      .map((c) =>
        c
          .trim()
          .replace(/\s+(ASC|DESC|NULLS\s+FIRST|NULLS\s+LAST).*/i, "")
          .replace(/\(.*\)/, "") // strip function calls
          .trim()
          .toLowerCase()
      )
      .filter((c) => /^\w+$/.test(c)); // keep only plain identifiers
    indexes.push({ indexName: m[1], tableName: m[2].toLowerCase(), columns: cols });
  }
  return indexes;
}

function hasRLS(sql, tableName) {
  const clean = stripComments(sql);
  const pattern = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    "i"
  );
  return pattern.test(clean);
}

function hasTenantColumn(sql, tableName) {
  const cols = extractTableColumns(sql, tableName);
  return cols.has("tenant_id") || cols.has("organization_id");
}

// ─── load active migrations ───────────────────────────────────────────────────

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("  Migrations directory not found, skipping.");
  process.exit(0);
}

const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });

const migrationFiles = entries
  .filter(
    (e) =>
      e.isFile() &&
      e.name.endsWith(".sql") &&
      !e.name.endsWith(".rollback.sql") &&
      /^\d{14}_/.test(e.name)
  )
  .map((e) => e.name)
  .sort();

// Concatenate all active migration SQL for cross-file analysis.
let allSql = "";
const sqlByFile = {};
for (const file of migrationFiles) {
  const content = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
  sqlByFile[file] = content;
  allSql += "\n" + content;
}

// ─── build schema map ────────────────────────────────────────────────────────

function extractAddedColumns(sql) {
  // Returns Map<tableName, Set<columnName>> for ALTER TABLE ... ADD COLUMN statements.
  // Handles both single-line and multi-line ALTER TABLE blocks.
  const clean = stripComments(sql);
  const result = new Map();

  // Strategy: find each ALTER TABLE block, extract the table name, then find
  // all ADD COLUMN clauses within that block (up to the next semicolon).
  const alterPattern =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)([\s\S]*?);/gi;
  let am;
  while ((am = alterPattern.exec(clean)) !== null) {
    const table = am[1].toLowerCase();
    const body  = am[2];
    // Find ADD COLUMN [IF NOT EXISTS] colName within the block.
    const addColPattern =
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s/gi;
    let cm;
    while ((cm = addColPattern.exec(body)) !== null) {
      const col = cm[1].toLowerCase();
      if (!result.has(table)) result.set(table, new Set());
      result.get(table).add(col);
    }
  }
  return result;
}

// Map: tableName → { columns: Set, definedInFile: string }
const tableMap = new Map();

for (const [file, sql] of Object.entries(sqlByFile)) {
  // Register tables created in this file.
  for (const tableName of extractTableNames(sql)) {
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, {
        columns: extractTableColumns(sql, tableName),
        definedInFile: file,
      });
    } else {
      // Merge columns from a second CREATE TABLE IF NOT EXISTS in a later file.
      const existing = tableMap.get(tableName);
      for (const col of extractTableColumns(sql, tableName)) {
        existing.columns.add(col);
      }
    }
  }

  // Merge columns added via ALTER TABLE ADD COLUMN.
  for (const [tableName, cols] of extractAddedColumns(sql)) {
    if (tableMap.has(tableName)) {
      for (const col of cols) tableMap.get(tableName).columns.add(col);
    }
    // If the table isn't in the map yet (defined in a later file), we'll
    // pick up the ADD COLUMN on the next pass — acceptable for static analysis.
  }
}

// ─── checks ──────────────────────────────────────────────────────────────────

const violations = [];

// 1. Index column existence
for (const [file, sql] of Object.entries(sqlByFile)) {
  for (const { indexName, tableName, columns } of extractIndexes(sql)) {
    if (INDEX_GUARD_EXEMPT_TABLES.has(tableName)) continue;

    const tableInfo = tableMap.get(tableName);
    if (!tableInfo) {
      violations.push(
        `[index-missing-table] ${file}: index "${indexName}" references table "${tableName}" which has no CREATE TABLE in the active chain.`
      );
      continue;
    }
    for (const col of columns) {
      if (!tableInfo.columns.has(col)) {
        violations.push(
          `[index-missing-column] ${file}: index "${indexName}" on "${tableName}" references column "${col}" which does not exist in the table definition (defined in ${tableInfo.definedInFile}).`
        );
      }
    }
  }
}

// 2. Tenant column presence
for (const [tableName, { definedInFile, columns }] of tableMap.entries()) {
  if (TENANT_EXEMPT_TABLES.has(tableName)) continue;
  if (!columns.has("tenant_id") && !columns.has("organization_id")) {
    violations.push(
      `[missing-tenant-column] ${definedInFile}: table "${tableName}" has neither tenant_id nor organization_id. Add the appropriate tenant-scoping column or add it to TENANT_EXEMPT_TABLES if it is a global reference table.`
    );
  }
}

// 3. RLS coverage
for (const [tableName, { definedInFile }] of tableMap.entries()) {
  if (RLS_EXEMPT_TABLES.has(tableName)) continue;
  if (!hasRLS(allSql, tableName)) {
    violations.push(
      `[missing-rls] ${definedInFile}: table "${tableName}" does not have ENABLE ROW LEVEL SECURITY in the active migration chain.`
    );
  }
}

// 4. Rollback file pairing
for (const file of migrationFiles) {
  const prefix = file.slice(0, 14);
  if (prefix < ROLLBACK_REQUIRED_FROM) continue;
  const rollbackName = file.replace(/\.sql$/, ".rollback.sql");
  if (!existsSync(resolve(MIGRATIONS_DIR, rollbackName))) {
    violations.push(
      `[missing-rollback] ${file}: no paired rollback file "${rollbackName}". Create it or add an explicit "-- no rollback: <reason>" comment in the migration.`
    );
  }
}

// ─── report ──────────────────────────────────────────────────────────────────

console.log("Checking migration schema consistency...\n");
console.log(`  Active migrations: ${migrationFiles.length}`);
console.log(`  Tables found:      ${tableMap.size}\n`);

if (violations.length === 0) {
  console.log("✅  No schema consistency violations found.");
  process.exit(0);
} else {
  console.error(`❌  ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}
