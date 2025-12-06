import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

describe('ValueTreeRepository Integration', () => {
  let pool: Pool;

  beforeAll(() => {
    // This ENV var is set by our global setup
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set. Is the test container running?');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should be able to write and read from the value_trees table', async () => {
    const orgId = '00000000-0000-0000-0000-000000000000'; // UUID format
    const treeName = 'Integration Test Tree';

    // 1. Direct Insert (Simulating repository action)
    // Since we are testing against a raw Postgres container, we use SQL directly
    // to verify the Schema and constraints are correct.
    const insertQuery = `
      INSERT INTO value_trees (name, organization_id, description)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const insertResult = await pool.query(insertQuery, [
      treeName,
      orgId,
      'Created via integration test'
    ]);

    expect(insertResult.rows[0]).toBeDefined();
    expect(insertResult.rows[0].name).toBe(treeName);
    expect(insertResult.rows[0].id).toBeDefined();

    // 2. Read Verification
    const selectResult = await pool.query(
      'SELECT * FROM value_trees WHERE id = $1',
      [insertResult.rows[0].id]
    );

    expect(selectResult.rows).toHaveLength(1);
    expect(selectResult.rows[0].organization_id).toBe(orgId);
  });
});
