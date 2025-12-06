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
        await client.query(sql);
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
