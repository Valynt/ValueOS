import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const shouldRun = process.env.RUN_MIGRATION_TESTS === 'true';

const loadModule = async (name: string) => {
  try {
    // Use dynamic import indirection to avoid type resolution when module is absent
    return await (Function('m', 'return import(m)')(name) as Promise<any>);
  } catch {
    return null;
  }
};

const applyMigrations = async (client: any) => {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await client.query(sql);
  }
};

(shouldRun ? describe : describe.skip)('Database migrations', () => {
  it('applies Supabase migrations and enforces invariants', async () => {
    const tc = await loadModule('testcontainers');
    const pg = await loadModule('pg');

    if (!tc || !pg) {
      throw new Error('testcontainers/pg not available. Install them and set RUN_MIGRATION_TESTS=true.');
    }

    const { GenericContainer } = tc;
    const { Client } = pg;

    const container = await new GenericContainer('postgres')
      .withEnv('POSTGRES_PASSWORD', 'postgres')
      .withEnv('POSTGRES_USER', 'postgres')
      .withExposedPorts(5432)
      .start();

    const client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
    });

    try {
      await client.connect();
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      await applyMigrations(client);

      // Core tables exist
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cases','workflows','messages','login_attempts');`,
      );
      expect(tables.rows.map((r: any) => r.table_name).sort()).toEqual(
        ['cases', 'login_attempts', 'messages', 'workflows'],
      );

      // Password validation function exists
      const pwdFunc = await client.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='validate_password_strength';`,
      );
      expect(pwdFunc.rowCount).toBe(1);

      // Status check constraint present on cases
      const caseChecks = await client.query(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'public.cases'::regclass AND contype='c';`,
      );
      expect(caseChecks.rows.some((r: any) => r.conname.includes('status'))).toBe(true);
    } finally {
      await client.end();
      await container.stop();
    }
  });
});
