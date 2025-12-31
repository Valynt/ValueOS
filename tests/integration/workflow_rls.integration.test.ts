import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";

describe("Workflow RLS - Organization Isolation", () => {
  let dbClient: Client;
  const workflowId = uuidv4();
  const organizationId = "org-0001";

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();

    // Insert a workflow state row
    await dbClient.query(
      `INSERT INTO workflow_states (id, user_id, organization_id, state, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
      [
        workflowId,
        "00000000-0000-0000-0000-000000000001",
        organizationId,
        "{}",
      ],
    );
  });

  afterAll(async () => {
    try {
      await dbClient.query(`DELETE FROM workflow_states WHERE id = $1;`, [
        workflowId,
      ]);
    } finally {
      await dbClient.end();
    }
  });

  it("should be visible to same organization", async () => {
    const res = await dbClient.query(
      `SELECT id, organization_id FROM workflow_states WHERE id = $1;`,
      [workflowId],
    );
    expect(res.rowCount).toBeGreaterThan(0);
    expect(res.rows[0].organization_id).toBe(organizationId);
  });

  it("should not be visible to different organization (RLS)", async () => {
    // Simulate a JWT function to a different org
    await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN jsonb_build_object('role', 'anon', 'organization_id', 'org-999');
      END; $$ LANGUAGE plpgsql;`);
    const res = await dbClient.query(
      `SELECT id FROM workflow_states WHERE id = $1;`,
      [workflowId],
    );
    expect(res.rowCount).toBe(0);
  });
});
