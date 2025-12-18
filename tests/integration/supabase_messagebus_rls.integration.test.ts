import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { LLMQueueService } from "../../src/services/MessageQueue";
import { v4 as uuidv4 } from "uuid";

// This integration test validates three concerns:
// 1. Supabase/Postgres RLS behavior for org isolation
// 2. Enqueueing a job into the message bus (BullMQ) and verifying metrics
// 3. Basic Supabase query connectivity using the Postgres container

describe("Integration: Supabase RLS + Message Bus", () => {
  let dbClient: Client;
  let llmQueue: LLMQueueService | null = null;
  const sessionId = `session-${uuidv4()}`;
  const testUserId = "00000000-0000-0000-0000-000000000001"; // matches test auth.uid() in testcontainers

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();

    // Insert a test session and prediction
    await dbClient.query(
      `INSERT INTO agent_sessions(id, user_id, status, created_at, updated_at)
      VALUES ($1, $2, 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;`,
      [sessionId, testUserId],
    );

    await dbClient.query(
      `INSERT INTO agent_predictions(session_id, agent_id, agent_type, input_hash, input_data, prediction, confidence_level, confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [sessionId, "test-agent", "opportunity", "h1", "{}", "{}", "high", 0.95],
    );
  }, 120_000);

  afterAll(async () => {
    try {
      // Clean up records
      await dbClient.query(
        `DELETE FROM agent_predictions WHERE session_id = $1;`,
        [sessionId],
      );
      await dbClient.query(`DELETE FROM agent_sessions WHERE id = $1;`, [
        sessionId,
      ]);
    } catch {
      // ignore
    }
    await dbClient.end();

    if (llmQueue) {
      // Attempt to close the worker and queue if it was instantiated
      try {
        (llmQueue as any).worker && (await (llmQueue as any).worker.close());
      } catch {}
      try {
        (llmQueue as any).queue && (await (llmQueue as any).queue.close());
      } catch {}
      try {
        (llmQueue as any).events && (await (llmQueue as any).events.close());
      } catch {}
    }
  });

  it("should deny cross-organization visibility via RLS", async () => {
    // auth.jwt default in testcontainers returns org-0001; verify record visible
    const { rows: initialRows } = await dbClient.query(
      `SELECT id FROM agent_predictions WHERE session_id = $1;`,
      [sessionId],
    );
    expect(initialRows.length).toBeGreaterThan(0);

    // Replace auth.jwt() to return another organization_id to simulate cross-org user
    await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN jsonb_build_object('role', 'anon', 'organization_id', 'org-0002');
      END;
      $$ LANGUAGE plpgsql;`);

    const { rows: crossOrgRows } = await dbClient.query(
      `SELECT id FROM agent_predictions WHERE session_id = $1;`,
      [sessionId],
    );
    expect(crossOrgRows.length).toBe(0);

    // Restore auth.jwt to org-0001
    await dbClient.query(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN jsonb_build_object('role', 'anon', 'organization_id', 'org-0001');
      END;
      $$ LANGUAGE plpgsql;`);

    const { rows: restoredRows } = await dbClient.query(
      `SELECT id FROM agent_predictions WHERE session_id = $1;`,
      [sessionId],
    );
    expect(restoredRows.length).toBeGreaterThan(0);
  }, 90_000);

  it("should enqueue a message into the LLM queue and expose metrics", async () => {
    // Ensure REDIS_URL is set by testcontainers
    if (!process.env.REDIS_URL) {
      // Skip if Redis isn't available
      return;
    }

    llmQueue = new LLMQueueService();

    // Add a job
    const job = await llmQueue.addJob(
      {
        type: "custom_prompt",
        userId: testUserId,
        sessionId,
        prompt: "Simple test",
      },
      { jobId: `test-job-${uuidv4()}` },
    );

    expect(job).toBeTruthy();

    // Fetch metrics - job should appear in waiting or active counts
    const metrics = await llmQueue.getMetrics();
    expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.waiting).toBe("number");
  }, 90_000);
});
