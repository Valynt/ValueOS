import { afterAll, beforeAll } from 'vitest';
import { setup, teardown } from './testcontainers-global-setup';
import { Client } from 'pg';

// Increase timeout for Docker operations (pulling images can take time)
const DOCKER_TIMEOUT = 120_000;

beforeAll(async () => {
  await setup();
  // Quick verification: confirm minimal auth schema and objects exist
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set by testcontainers-global-setup');

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const schemaExists = await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth';`);
    if (schemaExists.rowCount === 0) throw new Error('auth schema not created');

    const tableExists = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users';`);
    if (tableExists.rowCount === 0) throw new Error('auth.users table not created');

    const uidFunc = await client.query(`SELECT 1 FROM information_schema.routines WHERE routine_schema='auth' AND routine_name='uid';`);
    if (uidFunc.rowCount === 0) throw new Error('auth.uid() function not created');
  } finally {
    await client.end();
  }
}, DOCKER_TIMEOUT);

afterAll(async () => {
  await teardown();
});
