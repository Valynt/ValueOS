import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";

describe("RLS - Organization Isolation (integration)", () => {
  let dbClient: Client;
  const sessionId = uuidv4();
  const userId = "00000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();

    // Insert test session and prediction
    await dbClient.query(
      `INSERT INTO agent_sessions (id, user_id, status, created_at, updated_at)
      VALUES ($1, $2, 'active', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [sessionId, userId],
    );
    await dbClient.query(
      `INSERT INTO agent_predictions (session_id, agent_id, agent_type, input_hash, input_data, prediction, confidence_level, confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [sessionId, "test-agent", "opportunity", "h1", "{}", "{}", "high", 0.95],
    );
  }, 120_000);

  afterAll(async () => {
    try {
      await dbClient.query(
        `DELETE FROM agent_predictions WHERE session_id = $1;`,
        [sessionId],
      );
      await dbClient.query(`DELETE FROM agent_sessions WHERE id = $1;`, [
        sessionId,
      ]);
    } finally {
      await dbClient.end();
    }
  });

  it("allows original org to query prediction", async () => {
    const { rows } = await dbClient.query(
      `SELECT id FROM agent_predictions WHERE session_id = $1;`,
      [sessionId],
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("denies cross organization access", async () => {
    // Override auth.jwt() to simulate a request from other org
    await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN jsonb_build_object('role', 'anon', 'organization_id', 'org-x');
      END; $$ LANGUAGE plpgsql;`);

    const { rows: crossRows } = await dbClient.query(
      `SELECT id FROM agent_predictions WHERE session_id = $1;`,
      [sessionId],
    );
    expect(crossRows.length).toBe(0);
  }, 60_000);
});
