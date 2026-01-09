import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import { getEnvVar, setEnvVarForTests } from "../lib/env";

const POSTGRES_PORT = 5432;
const REDIS_PORT = 6379;

// Store container instance globally to stop it later
let container: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer | undefined;

export async function setup() {
  // Allow skipping heavy testcontainers setup for fast local unit tests
  if (getEnvVar("SKIP_TESTCONTAINERS") === "1") {
    console.warn(
      "⚠️ SKIP_TESTCONTAINERS set — skipping Postgres/Redis testcontainers setup"
    );
    return;
  }

  console.warn("🐳 Starting Postgres Testcontainer...");

  // 1. Start the container (matching Supabase's Postgres version approx)
  container = await new PostgreSqlContainer("postgres:15.1")
    .withDatabase("postgres")
    .withUsername("postgres")
    .withPassword("postgres")
    .withExposedPorts(5432)
    .start();

  const dbUrl = container.getConnectionUri();
  console.warn(`✅ Postgres started at ${dbUrl}`);

  // 2. Set env var for tests to pick up - BOTH process.env and custom source
  setEnvVarForTests("DATABASE_URL", dbUrl);

  // 3. Write to temp file for worker processes to read (globalSetup runs in separate process)
  const envFilePath = path.resolve(__dirname, "../../.vitest-env.json");
  fs.writeFileSync(
    envFilePath,
    JSON.stringify({ DATABASE_URL: dbUrl }),
    "utf8"
  );

  // Ensure coverage folders exist (vitest coverage reporter writes here)
  try {
    fs.mkdirSync(path.resolve(__dirname, "../../coverage/.tmp"), {
      recursive: true,
    });
  } catch (_err) {
    // ignore
  }

  // Start Redis testcontainer and set REDIS_URL for tests
  try {
    console.warn("🐳 Starting Redis Testcontainer...");
    redisContainer = await new GenericContainer("redis:7.0")
      .withExposedPorts(6379)
      .start();
    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    const redisUrl = `redis://${redisHost}:${redisPort}`;
    setEnvVarForTests("REDIS_URL", redisUrl);
    console.warn(`✅ Redis started at ${redisUrl}`);
  } catch (err) {
    console.warn(
      "⚠️ Failed to start Redis testcontainer, continuing without it:",
      err
    );
  }

  // 3. Connect to apply migrations
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Create extensions and minimal auth schema for RLS policies that reference auth.uid()
    console.warn("   Setting up auth schema for tests...");
    await client.query(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT,
          raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Mock auth.uid() function for tests
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        BEGIN
          RETURN '00000000-0000-0000-0000-000000000001'::UUID;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Mock auth.role() function
        CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
        BEGIN
          RETURN 'authenticated'::TEXT;
        END;
        $$ LANGUAGE plpgsql;

        -- Mock auth.jwt() function returns JSON with role and organization
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
        BEGIN
          RETURN jsonb_build_object('role', 'service_role', 'organization_id', 'org-0001');
        END;
        $$ LANGUAGE plpgsql;

        -- Ensure commonly used roles exist in vanilla Postgres test container
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
          END IF;
        END $$;
      `);

    // Try to run full migrations first, fall back to minimal schema if they fail
    const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
    let migrationsSucceeded = false;

    if (fs.existsSync(migrationsDir)) {
      // Filter for numbered migrations and sort them to ensure correct order
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b));

      console.warn(`📂 Found ${files.length} migrations in ${migrationsDir}`);

      try {
        for (const file of files) {
          const filePath = path.join(migrationsDir, file);
          const sql = fs.readFileSync(filePath, "utf8");
          console.warn(`   Running ${file}...`);
          try {
            await client.query(sql);
          } catch (_err: any) {
            // If extensions like pgvector are unavailable when running against a vanilla Postgres,
            // log and continue. This keeps tests from failing due to optional extensions not present.
            if (
              _err &&
              (_err.code === "0A000" ||
                _err.message?.includes("extension") ||
                _err.message?.includes("vector.control"))
            ) {
              console.warn(
                `   ⚠️ Skipping ${file} due to missing DB extension: ${_err.message}`
              );
              continue;
            }
            // For other errors, log but don't throw - we'll use fallback schema
            console.warn(`   ⚠️ Migration ${file} failed: ${_err.message}`);
            throw _err; // Trigger fallback
          }
        }
        migrationsSucceeded = true;
        console.warn("✅ All migrations applied successfully");
      } catch (err) {
        console.warn("⚠️ Migrations failed, using minimal test schema instead");
        migrationsSucceeded = false;
      }
    } else {
      console.warn("⚠️ No migrations directory found at", migrationsDir);
    }

    // If migrations failed or don't exist, use minimal test schema
    if (!migrationsSucceeded) {
      console.warn("📂 Applying minimal test schema...");
      const testSchemaPath = path.resolve(__dirname, "./test-db-schema.sql");
      if (fs.existsSync(testSchemaPath)) {
        const testSchema = fs.readFileSync(testSchemaPath, "utf8");
        await client.query(testSchema);
        console.warn("✅ Minimal test schema applied");
      } else {
        console.error("❌ Test schema file not found at", testSchemaPath);
        throw new Error("Cannot initialize test database");
      }
    }
  } catch (e) {
    console.error("❌ Failed to apply migrations:", e);
    throw e;
  } finally {
    await client.end();
  }
}

export async function teardown() {
  if (container) {
    console.warn("🛑 Stopping Postgres Testcontainer...");
    await container.stop();
  }
  if (redisContainer) {
    console.warn("🛑 Stopping Redis Testcontainer...");
    await redisContainer.stop();
  }
}
