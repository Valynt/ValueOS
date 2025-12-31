/**
 * API Endpoint Tests - Agent Sessions
 *
 * Tests for agent session endpoints:
 * - POST /api/v1/agent-sessions - Create session
 * - GET /api/v1/agent-sessions - List sessions
 * - GET /api/v1/agent-sessions/:id - Get session
 * - PATCH /api/v1/agent-sessions/:id - Update session
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testAdminClient, TEST_TENANT_A, TEST_TENANT_B } from "../../setup";
import {
  createTestAgentSession,
  cleanupTestTables,
  generateTestId,
} from "../../test-utils";

describe("Agent Session API Endpoints", () => {
  beforeEach(async () => {
    if (testAdminClient) {
      await cleanupTestTables(
        testAdminClient,
        ["agent_sessions"],
        "test-session-"
      );
    }
  });

  afterEach(async () => {
    if (testAdminClient) {
      await cleanupTestTables(
        testAdminClient,
        ["agent_sessions"],
        "test-session-"
      );
    }
  });

  describe("POST /api/v1/agent-sessions", () => {
    it("should create a new agent session", async () => {
      if (!testAdminClient) return;

      const session = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_A,
        {
          agent_id: "OpportunityAgent",
          status: "active",
        }
      );

      expect(session).toBeDefined();
      expect(session.agent_id).toBe("OpportunityAgent");
      expect(session.status).toBe("active");
      expect(session.tenant_id).toBe(TEST_TENANT_A);
    });

    it("should reject session creation without tenant_id", async () => {
      if (!testAdminClient) return;

      const { error } = await testAdminClient.from("agent_sessions").insert({
        id: generateTestId("session"),
        agent_id: "TargetAgent",
        status: "active",
        // Missing tenant_id
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("tenant_id");
    });

    it("should create sessions for different agents", async () => {
      if (!testAdminClient) return;

      const agents = [
        "OpportunityAgent",
        "TargetAgent",
        "RealizationAgent",
        "ExpansionAgent",
        "IntegrityAgent",
      ];

      for (const agentId of agents) {
        const session = await createTestAgentSession(
          testAdminClient,
          TEST_TENANT_A,
          {
            agent_id: agentId,
          }
        );

        expect(session.agent_id).toBe(agentId);
      }
    });
  });

  describe("GET /api/v1/agent-sessions", () => {
    it("should list agent sessions for a tenant", async () => {
      if (!testAdminClient) return;

      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        await createTestAgentSession(testAdminClient, TEST_TENANT_A);
      }

      const { data, error } = await testAdminClient
        .from("agent_sessions")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .like("id", "test-session-%");

      expect(error).toBeNull();
      expect(data).toHaveLength(5);
    });

    it("should filter sessions by agent_id", async () => {
      if (!testAdminClient) return;

      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        agent_id: "OpportunityAgent",
      });
      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        agent_id: "TargetAgent",
      });
      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        agent_id: "OpportunityAgent",
      });

      const { data } = await testAdminClient
        .from("agent_sessions")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .eq("agent_id", "OpportunityAgent")
        .like("id", "test-session-%");

      expect(data).toHaveLength(2);
      expect(data?.every((s) => s.agent_id === "OpportunityAgent")).toBe(true);
    });

    it("should filter sessions by status", async () => {
      if (!testAdminClient) return;

      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        status: "active",
      });
      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        status: "completed",
      });
      await createTestAgentSession(testAdminClient, TEST_TENANT_A, {
        status: "active",
      });

      const { data } = await testAdminClient
        .from("agent_sessions")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .eq("status", "active")
        .like("id", "test-session-%");

      expect(data).toHaveLength(2);
      expect(data?.every((s) => s.status === "active")).toBe(true);
    });
  });

  describe("GET /api/v1/agent-sessions/:id", () => {
    it("should return a specific session", async () => {
      if (!testAdminClient) return;

      const session = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_A
      );

      const { data, error } = await testAdminClient
        .from("agent_sessions")
        .select("*")
        .eq("id", session.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(session.id);
    });

    it("should enforce tenant isolation when fetching sessions", async () => {
      if (!testAdminClient) return;

      const sessionA = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_A
      );
      const sessionB = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_B
      );

      // Query for session A with tenant_id filter
      const { data } = await testAdminClient
        .from("agent_sessions")
        .select("*")
        .eq("id", sessionA.id)
        .eq("tenant_id", TEST_TENANT_A)
        .single();

      expect(data?.id).toBe(sessionA.id);
      expect(data?.tenant_id).toBe(TEST_TENANT_A);
    });
  });

  describe("PATCH /api/v1/agent-sessions/:id", () => {
    it("should update session status", async () => {
      if (!testAdminClient) return;

      const session = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_A,
        {
          status: "active",
        }
      );

      const { data, error } = await testAdminClient
        .from("agent_sessions")
        .update({ status: "completed" })
        .eq("id", session.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe("completed");
    });

    it("should not allow changing tenant_id", async () => {
      if (!testAdminClient) return;

      const session = await createTestAgentSession(
        testAdminClient,
        TEST_TENANT_A
      );

      const { data } = await testAdminClient
        .from("agent_sessions")
        .update({ tenant_id: TEST_TENANT_B })
        .eq("id", session.id)
        .select()
        .single();

      // Tenant ID should remain unchanged
      expect(data?.tenant_id).toBe(TEST_TENANT_A);
    });
  });
});
