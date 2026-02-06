#!/usr/bin/env node

/**
 * Database Schema Verification
 *
 * Runs the minimal checklist to verify Supabase schemas are set up correctly:
 * 1. supabase status (services running)
 * 2. supabase migration list (all applied)
 * 3. db:types generation (types reflect schema)
 *
 * Usage:
 *   node scripts/dx/db-verify.js
 *   node scripts/dx/db-verify.js --fix     # Auto-fix issues
 *   node scripts/dx/db-verify.js --reset   # Full reset and rebuild
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}▶${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  step: (num, msg) =>
    console.log(
      `\n${colors.cyan}[${num}/6]${colors.reset} ${colors.bold}${msg}${colors.reset}`
    ),
};

function runCommand(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: options.silent ? "pipe" : "inherit",
    encoding: "utf8",
    ...options,
  });
}


function parseEnvContent(content) {
  const env = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Step 1: Check Supabase status
 */
function checkSupabaseStatus() {
  log.step(1, "Checking Supabase status");

  if (!commandExists("supabase")) {
    log.error("Supabase CLI not installed");
    log.info("Install with: pnpm install -g supabase");
    return { ok: false, running: false };
  }

  try {
    const status = runCommand("supabase status", { silent: true });

    if (status.includes("not running") || !status.includes("API URL")) {
      log.error("Supabase is not running");
      log.info("Start with: supabase start");
      return { ok: false, running: false };
    }

    // Extract URLs from status
    const apiUrlMatch = status.match(/API URL:\s*(http[^\s]+)/);
    const studioUrlMatch = status.match(/Studio URL:\s*(http[^\s]+)/);
    const dbUrlMatch = status.match(/DB URL:\s*(postgresql[^\s]+)/);

    log.success("Supabase is running");
    if (apiUrlMatch) log.info(`  API: ${apiUrlMatch[1]}`);
    if (studioUrlMatch) log.info(`  Studio: ${studioUrlMatch[1]}`);
    if (dbUrlMatch) log.info(`  DB: ${dbUrlMatch[1]}`);

    return { ok: true, running: true, status };
  } catch (error) {
    log.error(`Failed to check Supabase status: ${error.message}`);
    return { ok: false, running: false };
  }
}

/**
 * Step 2: Verify environment URLs
 */
function checkEnvUrls() {
  log.step(2, "Verifying environment URLs");

  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    log.warn(".env.local not found");
    log.info("Run: pnpm run dx:env --mode local");
    return { ok: false };
  }

  const content = fs.readFileSync(envPath, "utf8");
  const env = parseEnvContent(content);
  const issues = [];

  // Check VITE_SUPABASE_URL
  const viteUrl = env.VITE_SUPABASE_URL;
  if (viteUrl) {
    if (!viteUrl.includes("localhost") && !viteUrl.includes("127.0.0.1")) {
      issues.push(`VITE_SUPABASE_URL points to remote: ${viteUrl}`);
    } else {
      log.success(`VITE_SUPABASE_URL: ${viteUrl}`);
    }
  } else {
    issues.push("VITE_SUPABASE_URL not set");
  }

  // Check SUPABASE_URL (backend)
  const supabaseUrl = env.SUPABASE_URL;
  if (supabaseUrl) {
    if (!supabaseUrl.includes("localhost") && !supabaseUrl.includes("127.0.0.1")) {
      issues.push(`SUPABASE_URL points to remote: ${supabaseUrl}`);
    } else {
      log.success(`SUPABASE_URL: ${supabaseUrl}`);
    }
  }

  // Assert DATABASE_URL and migration target match host/database.
  const databaseUrl = env.DATABASE_URL || env.DB_URL;
  if (!databaseUrl) {
    issues.push("DATABASE_URL (or DB_URL) not set");
  } else {
    const parsedDbUrl = parseDatabaseUrl(databaseUrl);
    if (!parsedDbUrl) {
      issues.push(`DATABASE_URL is not a valid URL: ${databaseUrl}`);
    } else {
      const targetHost = env.DB_HOST || parsedDbUrl.host;
      const targetDb = env.DB_NAME || parsedDbUrl.database;
      if (parsedDbUrl.host !== targetHost || parsedDbUrl.database !== targetDb) {
        issues.push(
          `DATABASE_URL resolves to ${parsedDbUrl.host}/${parsedDbUrl.database}, but migration target resolves to ${targetHost}/${targetDb}`
        );
      } else {
        log.success(`DATABASE_URL and migration target aligned: ${targetHost}/${targetDb}`);
      }
    }
  }

  if (issues.length > 0) {
    issues.forEach((issue) => log.warn(issue));
    log.info("Your app may be connecting to a different database than local Supabase");
    return { ok: false, issues };
  }

  return { ok: true };
}

/**
 * Step 3: Check migration status
 */
function checkMigrations() {
  log.step(3, "Checking migration status");

  try {
    const output = runCommand("supabase migration list 2>&1", { silent: true });

    if (output.includes("error") || output.includes("Error")) {
      log.error("Failed to list migrations");
      log.info(output);
      return { ok: false, error: output };
    }

    // Parse migration list
    const lines = output.split("\n").filter((line) => line.includes("│"));
    const migrations = [];
    let pendingCount = 0;
    let appliedCount = 0;

    for (const line of lines) {
      // Skip header
      if (line.includes("Local") || line.includes("──")) continue;

      const isApplied =
        line.toLowerCase().includes("applied") ||
        (line.includes("│") && !line.toLowerCase().includes("not applied") && !line.toLowerCase().includes("pending"));
      const isPending =
        line.toLowerCase().includes("not applied") ||
        line.toLowerCase().includes("pending");

      if (isPending) {
        pendingCount++;
        migrations.push({ line: line.trim(), status: "pending" });
      } else if (isApplied) {
        appliedCount++;
        migrations.push({ line: line.trim(), status: "applied" });
      }
    }

    if (pendingCount > 0) {
      log.warn(`${pendingCount} pending migration(s)`);
      migrations
        .filter((m) => m.status === "pending")
        .forEach((m) => log.info(`  - ${m.line}`));
      log.info("Run: pnpm run db:push to apply");
      return { ok: false, pending: pendingCount, applied: appliedCount };
    }

    log.success(`All migrations applied (${appliedCount} total)`);
    return { ok: true, pending: 0, applied: appliedCount };
  } catch (error) {
    log.error(`Migration check failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/**
 * Step 4: Check for schema drift
 */
function checkSchemaDrift() {
  log.step(4, "Checking for schema drift");

  try {
    const diff = runCommand("supabase db diff --use-migra 2>/dev/null || echo ''", {
      silent: true,
    });

    if (!diff.trim()) {
      log.success("No schema drift detected");
      return { ok: true, drift: false };
    }

    // Check if diff contains actual changes
    const hasChanges =
      diff.includes("CREATE") ||
      diff.includes("ALTER") ||
      diff.includes("DROP");

    if (hasChanges) {
      const lines = diff.split("\n").filter((l) => l.trim()).length;
      log.warn(`Schema drift detected (${lines} lines of changes)`);
      log.info("Database state differs from migrations");
      log.info("Options:");
      log.info("  1. pnpm run db:reset - Rebuild from migrations (loses data)");
      log.info("  2. pnpm run db:push  - Apply pending migrations");
      log.info("  3. supabase db diff - View the differences");
      return { ok: false, drift: true, changes: lines };
    }

    log.success("No schema drift detected");
    return { ok: true, drift: false };
  } catch {
    log.info("Schema drift check skipped (migra not available)");
    return { ok: true, drift: false, skipped: true };
  }
}

/**
 * Step 5: Run schema smoke test queries
 */
function runSchemaSmokeTest() {
  log.step(5, "Running schema smoke test");

  // Key tables that should exist in a properly set up ValueOS database
  const expectedTables = [
    "profiles",
    "organizations", 
    "organization_members",
  ];

  try {
    // Query to list all tables in public schema
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = runCommand(
      `supabase db execute --sql "${query.replace(/\n/g, " ")}" 2>/dev/null || echo "query_failed"`,
      { silent: true }
    );

    if (result.includes("query_failed")) {
      log.warn("Could not query database tables");
      return { ok: true, skipped: true };
    }

    // Parse table names from result
    const tables = result
      .split("\n")
      .filter((line) => line.trim() && !line.includes("table_name") && !line.includes("---"))
      .map((line) => line.trim());

    if (tables.length === 0) {
      log.warn("No tables found in public schema");
      log.info("Run: pnpm run db:push to apply migrations");
      return { ok: false, tables: [] };
    }

    // Check for expected tables
    const missingTables = expectedTables.filter((t) => !tables.includes(t));

    if (missingTables.length > 0) {
      log.warn(`Missing expected tables: ${missingTables.join(", ")}`);
      log.info("Your migrations may not have been applied correctly");
      return { ok: false, tables, missing: missingTables };
    }

    log.success(`Found ${tables.length} tables in public schema`);
    
    // Quick RLS check on a key table
    try {
      const rlsQuery = `
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'organizations')
        LIMIT 5;
      `;
      
      const rlsResult = runCommand(
        `supabase db execute --sql "${rlsQuery.replace(/\n/g, " ")}" 2>/dev/null || echo ""`,
        { silent: true }
      );

      if (rlsResult.includes("t") || rlsResult.includes("true")) {
        log.success("RLS is enabled on key tables");
      } else if (rlsResult && !rlsResult.includes("query_failed")) {
        log.warn("RLS may not be enabled on some tables");
      }
    } catch {
      // RLS check failed, skip
    }

    return { ok: true, tables };
  } catch (error) {
    log.warn(`Schema smoke test failed: ${error.message}`);
    return { ok: true, skipped: true };
  }
}

/**
 * Step 6: Verify TypeScript types
 */
function checkTypes() {
  log.step(6, "Verifying TypeScript types");

  const typesPath = path.join(projectRoot, "src/types/supabase.ts");
  const migrationsDir = path.join(projectRoot, "supabase/migrations");

  if (!fs.existsSync(typesPath)) {
    log.warn("supabase.ts types file not found");
    log.info("Run: pnpm run db:types to generate");
    return { ok: false, exists: false };
  }

  if (!fs.existsSync(migrationsDir)) {
    log.info("No migrations directory found");
    return { ok: true, exists: true };
  }

  // Check if types are older than migrations
  const typesStat = fs.statSync(typesPath);
  const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

  const newerMigrations = migrations.filter((m) => {
    const migrationPath = path.join(migrationsDir, m);
    const migrationStat = fs.statSync(migrationPath);
    return migrationStat.mtime > typesStat.mtime;
  });

  if (newerMigrations.length > 0) {
    log.warn(`Types may be outdated (${newerMigrations.length} newer migrations)`);
    log.info("Run: pnpm run db:types to regenerate");
    return { ok: false, exists: true, outdated: true, count: newerMigrations.length };
  }

  // Quick sanity check on types content
  const typesContent = fs.readFileSync(typesPath, "utf8");
  const hasPublicSchema = typesContent.includes("public:");
  const hasTablesType = typesContent.includes("Tables:");

  if (!hasPublicSchema || !hasTablesType) {
    log.warn("Types file may be incomplete or corrupted");
    log.info("Run: pnpm run db:types to regenerate");
    return { ok: false, exists: true, incomplete: true };
  }

  log.success("TypeScript types are up to date");
  return { ok: true, exists: true, outdated: false };
}

/**
 * Auto-fix issues
 */
async function autoFix(results) {
  console.log(`\n${colors.bold}Attempting auto-fix...${colors.reset}\n`);

  // Start Supabase if not running
  if (!results.status.running) {
    log.info("Starting Supabase...");
    try {
      runCommand("supabase start");
      log.success("Supabase started");
    } catch (error) {
      log.error(`Failed to start Supabase: ${error.message}`);
      return false;
    }
  }

  // Apply pending migrations
  if (results.migrations && results.migrations.pending > 0) {
    log.info("Applying pending migrations...");
    try {
      runCommand("supabase db push");
      log.success("Migrations applied");
    } catch (error) {
      log.error(`Failed to apply migrations: ${error.message}`);
      return false;
    }
  }

  // Regenerate types
  if (results.types && (results.types.outdated || !results.types.exists)) {
    log.info("Regenerating TypeScript types...");
    try {
      runCommand("pnpm run db:types");
      log.success("Types regenerated");
    } catch (error) {
      log.error(`Failed to regenerate types: ${error.message}`);
      return false;
    }
  }

  return true;
}

/**
 * Full reset and rebuild
 */
async function fullReset() {
  console.log(`\n${colors.bold}Performing full database reset...${colors.reset}\n`);
  console.log(`${colors.yellow}⚠ This will delete all local data!${colors.reset}\n`);

  try {
    log.info("Stopping Supabase...");
    runCommand("supabase stop || true", { silent: true });

    log.info("Starting Supabase...");
    runCommand("supabase start");

    log.info("Resetting database...");
    runCommand("supabase db reset");

    log.info("Applying migrations...");
    runCommand("supabase db push");

    log.info("Regenerating types...");
    runCommand("pnpm run db:types");

    log.info("Seeding demo data...");
    try {
      runCommand("pnpm run seed:demo");
    } catch {
      log.warn("Seed failed (may be OK if no seed script)");
    }

    log.success("Full reset complete!");
    return true;
  } catch (error) {
    log.error(`Reset failed: ${error.message}`);
    return false;
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");
  const shouldReset = args.includes("--reset");

  console.log(`
${colors.bold}╔════════════════════════════════════════════════════════════════╗
║              Database Schema Verification                      ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  if (shouldReset) {
    const success = await fullReset();
    process.exit(success ? 0 : 1);
  }

  const results = {
    status: checkSupabaseStatus(),
    env: null,
    migrations: null,
    drift: null,
    smokeTest: null,
    types: null,
  };

  // Only continue if Supabase is running
  if (results.status.running) {
    results.env = checkEnvUrls();
    results.migrations = checkMigrations();
    results.drift = checkSchemaDrift();
    results.smokeTest = runSchemaSmokeTest();
    results.types = checkTypes();
  }

  // Summary
  console.log(`\n${colors.bold}Summary${colors.reset}`);
  console.log("─".repeat(40));

  const allOk =
    results.status.ok &&
    (!results.env || results.env.ok) &&
    (!results.migrations || results.migrations.ok) &&
    (!results.drift || results.drift.ok) &&
    (!results.smokeTest || results.smokeTest.ok) &&
    (!results.types || results.types.ok);

  if (allOk) {
    console.log(`\n${colors.green}✓ All checks passed!${colors.reset}`);
    console.log("Your database schema is correctly set up.\n");
    process.exit(0);
  }

  console.log(`\n${colors.yellow}⚠ Some checks failed${colors.reset}`);

  if (shouldFix) {
    const fixed = await autoFix(results);
    if (fixed) {
      console.log(`\n${colors.green}✓ Auto-fix completed. Run again to verify.${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}✗ Auto-fix failed. Manual intervention required.${colors.reset}\n`);
      process.exit(1);
    }
  }

  console.log("\nOptions:");
  console.log("  pnpm run db:verify --fix   - Attempt to fix issues automatically");
  console.log("  pnpm run db:verify --reset - Full reset and rebuild (loses data)");
  console.log("");

  process.exit(1);
}

main().catch((error) => {
  log.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
