#!/usr/bin/env node

/**
 * CI guard: migration chain integrity.
 *
 * Checks that:
 *   1. Every CREATE INDEX references columns that exist in the corresponding
 *      CREATE TABLE definition within the migration chain.
 *   2. Every table referenced by an index has a CREATE TABLE statement
 *      somewhere in the active migration chain (catches IF NOT EXISTS masking
 *      drift where a table was dropped but indexes remain).
 *
 * Skips archived/deferred directories outside the active top-level chain.
 * Skips rollback files (*.rollback.sql).
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more violations found
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");

// Archived directories that are already applied to the DB and serve as the
// schema foundation. We read their CREATE TABLE definitions for column
// extraction but do not validate their indexes (they are immutable).
const FOUNDATION_DIRS = [
  resolve(MIGRATIONS_DIR, "archive/monolith-20260213"),
  resolve(MIGRATIONS_DIR, "archive/pre-initial-release-2026-03"),
  resolve(MIGRATIONS_DIR, "archive/deferred-superseded"),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise SQL: strip line comments, collapse whitespace. */
function normalise(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")   // strip line comments
    .replace(/\s+/g, " ")        // collapse whitespace
    .trim();
}

/**
 * Extract column names from a CREATE TABLE body.
 * Returns a Set of lowercase column names.
 *
 * Strategy: find the parenthesised body after CREATE TABLE name, then split
 * on commas at depth 1 and take the first token of each clause.
 */
function extractTableColumns(createTableSql) {
  const parenStart = createTableSql.indexOf("(");
  if (parenStart === -1) return new Set();

  // Walk to find the matching closing paren at depth 1.
  let depth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < createTableSql.length; i++) {
    if (createTableSql[i] === "(") depth++;
    else if (createTableSql[i] === ")") {
      depth--;
      if (depth === 0) { parenEnd = i; break; }
    }
  }
  if (parenEnd === -1) return new Set();

  const body = createTableSql.slice(parenStart + 1, parenEnd);

  // Split on commas at depth 0 within the body.
  const clauses = [];
  let clause = "";
  let d = 0;
  for (const ch of body) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (ch === "," && d === 0) {
      clauses.push(clause.trim());
      clause = "";
    } else {
      clause += ch;
    }
  }
  if (clause.trim()) clauses.push(clause.trim());

  const columns = new Set();
  for (const c of clauses) {
    const upper = c.trim().toUpperCase();
    // Skip table-level constraints.
    if (
      upper.startsWith("CONSTRAINT") ||
      upper.startsWith("PRIMARY KEY") ||
      upper.startsWith("UNIQUE") ||
      upper.startsWith("CHECK") ||
      upper.startsWith("FOREIGN KEY") ||
      upper.startsWith("EXCLUDE")
    ) continue;

    // First token is the column name (strip quotes).
    const firstToken = c.trim().split(/\s+/)[0];
    if (firstToken) {
      columns.add(firstToken.toLowerCase().replace(/"/g, ""));
    }
  }
  return columns;
}

/**
 * Parse all CREATE TABLE statements from SQL text.
 * Returns Map<tableName, Set<columnName>>.
 */
function parseCreateTables(sql, knownTables = new Map()) {
  const tables = new Map();
  // Match CREATE [OR REPLACE] TABLE [IF NOT EXISTS] [schema.]name (...)
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?(\w+)\s*\(/gi;
  let match;
  while ((match = re.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const fromParen = sql.indexOf("(", match.index + match[0].length - 1);
    if (fromParen === -1) continue;
    // Grab enough context to extract columns (up to 8 KB from the paren).
    const snippet = sql.slice(match.index, fromParen + 8192);
    const cols = extractTableColumns(snippet);
    if (!tables.has(tableName)) {
      tables.set(tableName, new Set());
    }

    const likeMatch = snippet.match(/LIKE\s+(?:\w+\.)?(\w+)\s+INCLUDING\s+ALL/i);
    if (likeMatch) {
      const sourceTable = likeMatch[1].toLowerCase();
      const inheritedColumns = knownTables.get(sourceTable) ?? tables.get(sourceTable);
      if (inheritedColumns) {
        for (const c of inheritedColumns) tables.get(tableName).add(c);
      }
    }

    for (const c of cols) tables.get(tableName).add(c);
  }
  return tables;
}

/**
 * Parse all CREATE INDEX statements from SQL text.
 * Returns array of { indexName, tableName, columns, file }.
 */
function parseCreateIndexes(sql, file) {
  const indexes = [];
  // Match CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] name ON [schema.]table (cols)
  const re =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:\w+\.)?(\w+)\s*\(([^)]+)\)/gi;
  let match;
  while ((match = re.exec(sql)) !== null) {
    const indexName = match[1].toLowerCase();
    const tableName = match[2].toLowerCase();
    // Extract column names from the index column list (strip expressions, cast, DESC/ASC).
    const rawCols = match[3]
      .split(",")
      .map((c) => c.trim())
      .filter((c) => !/[()]/.test(c))
      .map((c) => c.split(/[\s:]/)[0].toLowerCase().replace(/"/g, ""))
      .filter(Boolean);
    indexes.push({ indexName, tableName, columns: rawCols, file });
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Checking migration chain integrity...\n");

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("  ⚠️  Migrations directory not found, skipping");
  process.exit(0);
}

/**
 * Extract columns added via ALTER TABLE ... ADD COLUMN.
 * Handles both single-column and multi-column (comma-separated ADD COLUMN)
 * forms, e.g.:
 *   ALTER TABLE t ADD COLUMN a int, ADD COLUMN b text;
 * Returns Map<tableName, Set<columnName>>.
 */
function parseAlterTableAddColumn(sql) {
  const additions = new Map();

  // Match the ALTER TABLE header to capture the table name, then scan forward
  // for every ADD COLUMN clause that belongs to the same statement.
  const tableRe =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:\w+\.)?(\w+)\s+ADD\s+COLUMN/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(sql)) !== null) {
    const tableName = tableMatch[1].toLowerCase();
    if (!additions.has(tableName)) additions.set(tableName, new Set());

    // Scan all ADD COLUMN clauses from this ALTER TABLE position until the
    // first semicolon (end of statement).
    const colRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
    colRe.lastIndex = tableMatch.index;
    let colMatch;
    while ((colMatch = colRe.exec(sql)) !== null) {
      // Stop once we cross a semicolon — that ends the ALTER TABLE statement.
      const between = sql.slice(tableMatch.index, colMatch.index);
      if ((between.match(/;/g) || []).length > 0) break;
      const colName = colMatch[1].toLowerCase().replace(/"/g, "");
      additions.get(tableName).add(colName);
    }
  }
  return additions;
}

// Accumulate table definitions and index definitions across the full chain.
const allTables = new Map();   // tableName → Set<columnName>
const allIndexes = [];         // { indexName, tableName, columns, file }

/** Merge a Map<string, Set<string>> into allTables. */
function mergeTables(source) {
  for (const [name, cols] of source) {
    if (!allTables.has(name)) allTables.set(name, new Set());
    for (const c of cols) allTables.get(name).add(c);
  }
}

// Phase 1: seed table definitions from archived foundation directories.
// These are already applied; we only need their column definitions.
for (const dir of FOUNDATION_DIRS) {
  if (!existsSync(dir)) continue;
  const foundationFiles = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of foundationFiles) {
    const raw = readFileSync(resolve(dir, entry.name), "utf8");
    const sql = normalise(raw);
    mergeTables(parseCreateTables(sql, allTables));
    mergeTables(parseAlterTableAddColumn(sql));
  }
}

// Phase 2: process active migration files in timestamp order.
const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".sql"))
  .filter((e) => !e.name.includes(".rollback."))
  .filter((e) => /^\d{14}_/.test(e.name))
  .sort((a, b) => a.name.localeCompare(b.name));

for (const entry of entries) {
  const filePath = resolve(MIGRATIONS_DIR, entry.name);
  const raw = readFileSync(filePath, "utf8");
  const sql = normalise(raw);

  // Merge CREATE TABLE and ALTER TABLE ADD COLUMN definitions.
  mergeTables(parseCreateTables(sql, allTables));
  mergeTables(parseAlterTableAddColumn(sql));

  // Collect index definitions.
  allIndexes.push(...parseCreateIndexes(sql, entry.name));
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

const violations = [];

for (const idx of allIndexes) {
  const tableCols = allTables.get(idx.tableName);

  // Check 1: table must exist in the chain.
  if (!tableCols) {
    violations.push(
      `  ❌ [${idx.file}] Index "${idx.indexName}" references table ` +
      `"${idx.tableName}" which has no CREATE TABLE in the active migration chain.`
    );
    continue;
  }

  // Check 2: every indexed column must exist in the table definition.
  for (const col of idx.columns) {
    if (!tableCols.has(col)) {
      violations.push(
        `  ❌ [${idx.file}] Index "${idx.indexName}" on "${idx.tableName}" ` +
        `references column "${col}" which is not defined in the table. ` +
        `Known columns: ${[...tableCols].sort().join(", ")}`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Migration chain integrity violations:\n");
  for (const v of violations) console.error(v);
  console.error(
    `\n  ${violations.length} violation(s) found. ` +
    "Fix column references before merging."
  );
  process.exit(1);
} else {
  console.log(
    `  ✅ Migration chain integrity OK ` +
    `(${allTables.size} tables, ${allIndexes.length} indexes checked)`
  );
}
