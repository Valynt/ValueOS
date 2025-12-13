import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Store container instance globally to stop it later
let container: StartedPostgreSqlContainer;

export async function setup() {
  console.log('🐳 Starting Postgres Testcontainer...');

  // 1. Start the container (matching Supabase's Postgres version approx)
  container = await new PostgreSqlContainer('postgres:15.1')
    .withDatabase('postgres')
    .withUsername('postgres')
    .withPassword('postgres')
    .withExposedPorts(5432)
    .start();

  const dbUrl = container.getConnectionUri();
  console.log(`✅ Postgres started at ${dbUrl}`);

  // 2. Set env var for tests to pick up
  process.env.DATABASE_URL = dbUrl;

  // 3. Connect to apply migrations
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

    try {
      // Create extensions and minimal auth schema for RLS policies that reference auth.uid()
      console.log('   Setting up auth schema for tests...');
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

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

    if (fs.existsSync(migrationsDir)) {
      // Filter for numbered migrations and sort them to ensure correct order
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

      console.log(`📂 Found ${files.length} migrations in ${migrationsDir}`);

      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`   Running ${file}...`);
        try {
          await client.query(sql);
        } catch (err: any) {
          // If extensions like pgvector are unavailable when running against a vanilla Postgres,
          // log and continue. This keeps tests from failing due to optional extensions not present.
          if (err && (err.code === '0A000' || err.message?.includes('extension') || err.message?.includes('vector.control'))) {
            console.warn(`   ⚠️ Skipping ${file} due to missing DB extension: ${err.message}`);
            continue;
          }
          console.error('❌ Failed to apply migrations:', err);
          throw err;
        }
      }
    } else {
      console.warn('⚠️ No migrations directory found at', migrationsDir);
    }
  } catch (e) {
    console.error('❌ Failed to apply migrations:', e);
    throw e;
  } finally {
    await client.end();
  }
}

export async function teardown() {
  if (container) {
    console.log('🛑 Stopping Postgres Testcontainer...');
    await container.stop();
  }
}
