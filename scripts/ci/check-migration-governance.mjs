#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");
const ROLLBACKS_DIR = resolve(ROOT, "infra/supabase/supabase/rollbacks");
const OUTPUT_PATH = resolve(
  ROOT,
  getArgValue(process.argv.slice(2), "--report") ?? "ci-artifacts/migration-governance-report.json"
);
const BASE_BRANCH = process.env.BASE_BRANCH ?? "main";

const APPROVED_ARCHIVE_SEGMENT = /^_.*archived/i;
const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "to", "for", "with", "from", "in", "on", "by",
  "add", "create", "update", "remove", "drop", "fix", "patch", "refresh", "promote",
  "table", "tables", "column", "columns", "index", "indexes", "policy", "policies",
  "rollback", "sql", "migration",
]);

function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function walkSqlFiles(dir, root = dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSqlFiles(fullPath, root));
      continue;
    }
    if (!entry.name.endsWith(".sql")) continue;
    files.push({
      absPath: fullPath,
      relPath: relative(root, fullPath).replaceAll("\\", "/"),
      name: entry.name,
    });
  }
  return files;
}

function classifyState(relPath) {
  const segments = relPath.split("/");
  const first = segments[0] ?? ".";
  if (segments.some((segment) => APPROVED_ARCHIVE_SEGMENT.test(segment))) return "archived";
  if (first === "_deferred") return "deferred";
  return "active";
}

function isRollbackFile(fileName) {
  return fileName.endsWith(".rollback.sql") || fileName.endsWith("_rollback.sql");
}

function normalizedIntentStem(fileName) {
  const withoutSql = fileName.replace(/\.sql$/i, "");
  const withoutTimestamp = withoutSql.replace(/^\d{14}_/, "");
  return withoutTimestamp
    .replace(/(\.rollback|_rollback)$/i, "")
    .toLowerCase();
}

function intentKeywords(stem) {
  return stem
    .split(/[^a-z0-9]+/i)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function jaccardScore(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function concernKey(tokens, stem) {
  if (tokens.length === 0) return stem;
  return tokens.slice(0, 4).join("_");
}

function getChangedMigrationFiles() {
  const commands = [
    `git diff --name-status origin/${BASE_BRANCH}...HEAD`,
    `git diff --name-status ${BASE_BRANCH}...HEAD`,
  ];

  try {
    execSync(`git fetch origin ${BASE_BRANCH} --depth=1`, { cwd: ROOT, stdio: "ignore" });
  } catch {
    // ignore fetch failures in offline/local environments
  }

  for (const command of commands) {
    try {
      const output = execSync(command, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      if (!output) return { added: new Set(), raw: [] };
      const raw = output.split("\n").map((line) => line.trim()).filter(Boolean);
      const added = new Set();
      for (const line of raw) {
        const parts = line.split(/\s+/).filter(Boolean);
        const status = parts[0] ?? "";
        const path = parts.at(-1)?.replaceAll('"', "") ?? "";
        if (!path.startsWith("infra/supabase/supabase/migrations/")) continue;
        if (!status.startsWith("A")) continue;
        added.add(path.replace(/^infra\/supabase\/supabase\/migrations\//, ""));
      }
      return { added, raw };
    } catch {
      continue;
    }
  }

  return { added: new Set(), raw: [] };
}

function buildReport() {
  const migrationFiles = walkSqlFiles(MIGRATIONS_DIR);
  const rollbackFiles = walkSqlFiles(ROLLBACKS_DIR);

  const forwardMigrations = [];
  const embeddedRollbacks = [];

  for (const file of migrationFiles) {
    const state = classifyState(file.relPath);
    if (isRollbackFile(file.name)) {
      embeddedRollbacks.push({ ...file, state });
      continue;
    }
    const stem = normalizedIntentStem(file.name);
    const keywords = intentKeywords(stem);
    forwardMigrations.push({
      ...file,
      state,
      stem,
      keywords,
      concern: concernKey(keywords, stem),
      pathBucket: file.relPath.includes("/") ? file.relPath.split("/")[0] : ".",
    });
  }

  const liveForward = forwardMigrations.filter((migration) => migration.state !== "archived");

  const duplicateIntents = [];
  for (let i = 0; i < liveForward.length; i += 1) {
    for (let j = i + 1; j < liveForward.length; j += 1) {
      const left = liveForward[i];
      const right = liveForward[j];
      const exactMatch = left.stem === right.stem;
      const score = jaccardScore(left.keywords, right.keywords);
      const sharedKeywords = left.keywords.filter((token) => right.keywords.includes(token));
      const nearDuplicate =
        score >= 0.8 &&
        left.keywords.length >= 2 &&
        right.keywords.length >= 2 &&
        sharedKeywords.length >= 2;
      if (!exactMatch && !nearDuplicate) continue;
      duplicateIntents.push({
        type: exactMatch ? "exact" : "near",
        score: Number(score.toFixed(3)),
        left: left.relPath,
        right: right.relPath,
        leftConcern: left.concern,
        rightConcern: right.concern,
      });
    }
  }

  const forwardLookup = new Set([
    ...forwardMigrations.map((migration) => normalizedIntentStem(migration.name)),
  ]);

  const rollbackWithoutForward = [];
  const allRollbackFiles = [
    ...embeddedRollbacks.map((entry) => ({ ...entry, source: "migrations" })),
    ...rollbackFiles.map((entry) => ({ ...entry, state: "active", source: "rollbacks" })),
  ];

  for (const rollback of allRollbackFiles) {
    const stem = normalizedIntentStem(rollback.name);
    if (forwardLookup.has(stem)) continue;
    rollbackWithoutForward.push({
      file: rollback.source === "migrations"
        ? `infra/supabase/supabase/migrations/${rollback.relPath}`
        : `infra/supabase/supabase/rollbacks/${rollback.relPath}`,
      expectedForwardStem: stem,
      source: rollback.source,
    });
  }

  const concernPaths = new Map();
  for (const migration of liveForward) {
    const key = migration.concern;
    if (!concernPaths.has(key)) concernPaths.set(key, new Map());
    const paths = concernPaths.get(key);
    const bucket = migration.pathBucket;
    if (!paths.has(bucket)) paths.set(bucket, []);
    paths.get(bucket).push(migration.relPath);
  }

  const multiPathConcerns = [];
  for (const [concern, pathMap] of concernPaths.entries()) {
    if (pathMap.size <= 1) continue;
    multiPathConcerns.push({
      concern,
      paths: [...pathMap.entries()].map(([path, files]) => ({ path, files: files.sort() })),
    });
  }

  const changed = getChangedMigrationFiles();
  const introducedDuplicateIntents = duplicateIntents.filter((item) =>
    changed.added.has(item.left) || changed.added.has(item.right)
  );

  const status = introducedDuplicateIntents.length > 0 ? "fail" : "pass";

  return {
    status,
    generatedAt: new Date().toISOString(),
    baseBranch: BASE_BRANCH,
    paths: {
      migrations: relative(ROOT, MIGRATIONS_DIR).replaceAll("\\", "/"),
      rollbacks: relative(ROOT, ROLLBACKS_DIR).replaceAll("\\", "/"),
    },
    totals: {
      forwardMigrations: forwardMigrations.length,
      embeddedRollbacks: embeddedRollbacks.length,
      rollbacksDirectoryFiles: rollbackFiles.length,
      duplicateIntents: duplicateIntents.length,
      rollbackWithoutForward: rollbackWithoutForward.length,
      multiPathConcerns: multiPathConcerns.length,
      introducedDuplicateIntents: introducedDuplicateIntents.length,
    },
    checks: {
      duplicateIntents,
      introducedDuplicateIntents,
      rollbackWithoutForward,
      multiPathConcerns,
    },
    context: {
      changedMigrationFiles: [...changed.added].sort(),
      rawDiff: changed.raw,
    },
  };
}

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("[migration-governance] Migrations directory not found. Skipping.");
  process.exit(0);
}

const report = buildReport();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`[migration-governance] Report written: ${relative(ROOT, OUTPUT_PATH)}`);
console.log(`[migration-governance] Duplicate intents: ${report.totals.duplicateIntents}`);
console.log(`[migration-governance] Rollbacks without forward migration: ${report.totals.rollbackWithoutForward}`);
console.log(`[migration-governance] Multi-path schema concerns: ${report.totals.multiPathConcerns}`);

if (report.totals.introducedDuplicateIntents > 0) {
  console.error(
    `[migration-governance] FAIL: ${report.totals.introducedDuplicateIntents} introduced duplicate/near-duplicate migration intent(s).`
  );
  process.exit(1);
}

console.log("[migration-governance] PASS: no introduced duplicate migration intents.");
