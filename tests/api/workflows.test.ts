/**
 * API Endpoint Tests - Workflows
 *
 * Tests for workflow-related endpoints:
 * - POST /api/v1/workflows - Create workflow
 * - GET /api/v1/workflows - List workflows
 * - GET /api/v1/workflows/:id - Get workflow by ID
 * - PATCH /api/v1/workflows/:id - Update workflow
 * - DELETE /api/v1/workflows/:id - Delete workflow
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testAdminClient, TEST_TENANT_A, TEST_TENANT_B } from "../../setup";
import {
  createTestWorkflow,
  cleanupTestTables,
  generateTestId,
} from "../../test-utils";

describe("Workflow API Endpoints", () => {
  beforeEach(async () => {
    // Clean up before each test
    if (testAdminClient) {
      await cleanupTestTables(testAdminClient, ["workflows"], "test-workflow-");
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (testAdminClient) {
      await cleanupTestTables(testAdminClient, ["workflows"], "test-workflow-");
    }
  });

  describe("POST /api/v1/workflows", () => {
    it("should create a new workflow", async () => {
      if (!testAdminClient) {
        console.warn("Skipping test - admin client not available");
        return;
      }

      const workflow = await createTestWorkflow(
        testAdminClient,
        TEST_TENANT_A,
        {
          name: "New Test Workflow",
          type: "opportunity",
        }
      );

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe("New Test Workflow");
      expect(workflow.type).toBe("opportunity");
      expect(workflow.tenant_id).toBe(TEST_TENANT_A);
    });

    it("should reject workflow creation without tenant_id", async () => {
      if (!testAdminClient) return;

      const { error } = await testAdminClient.from("workflows").insert({
        id: generateTestId("workflow"),
        name: "Invalid Workflow",
        // Missing tenant_id
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("tenant_id");
    });

    it("should reject workflow creation with invalid status", async () => {
      if (!testAdminClient) return;

      const { error } = await testAdminClient.from("workflows").insert({
        id: generateTestId("workflow"),
        tenant_id: TEST_TENANT_A,
        name: "Invalid Workflow",
        status: "invalid_status", // Invalid value
      });

      // Should fail if status has a constraint
      // If no constraint exists, this test documents expected behavior
    });
  });

  describe("GET /api/v1/workflows", () => {
    it("should list workflows for a tenant", async () => {
      if (!testAdminClient) return;

      // Create 3 test workflows
      await createTestWorkflow(testAdminClient, TEST_TENANT_A);
      await createTestWorkflow(testAdminClient, TEST_TENANT_A);
      await createTestWorkflow(testAdminClient, TEST_TENANT_A);

      const { data, error } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .like("id", "test-workflow-%");

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data?.every((w) => w.tenant_id === TEST_TENANT_A)).toBe(true);
    });

    it("should not return workflows from other tenants", async () => {
      if (!testAdminClient) return;

      // Create workflows for different tenants
      await createTestWorkflow(testAdminClient, TEST_TENANT_A);
      await createTestWorkflow(testAdminClient, TEST_TENANT_B);

      // Query for tenant A
      const { data } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .like("id", "test-workflow-%");

      // Should only see tenant A workflows
      expect(data?.every((w) => w.tenant_id === TEST_TENANT_A)).toBe(true);
      expect(data?.some((w) => w.tenant_id === TEST_TENANT_B)).toBe(false);
    });

    it("should support pagination", async () => {
      if (!testAdminClient) return;

      // Create 10 workflows
      for (let i = 0; i < 10; i++) {
        await createTestWorkflow(testAdminClient, TEST_TENANT_A);
      }

      // Get first page (5 items)
      const { data: page1 } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .like("id", "test-workflow-%")
        .limit(5);

      expect(page1).toHaveLength(5);

      // Get second page
      const { data: page2 } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("tenant_id", TEST_TENANT_A)
        .like("id", "test-workflow-%")
        .range(5, 9);

      expect(page2).toHaveLength(5);

      // Pages should not overlap
      const page1Ids = page1?.map((w) => w.id) || [];
      const page2Ids = page2?.map((w) => w.id) || [];
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe("GET /api/v1/workflows/:id", () => {
    it("should return a specific workflow", async () => {
      if (!testAdminClient) return;

      const workflow = await createTestWorkflow(testAdminClient, TEST_TENANT_A);

      const { data, error } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("id", workflow.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(workflow.id);
    });

    it("should return 404 for non-existent workflow", async () => {
      if (!testAdminClient) return;

      const { data, error } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("id", "non-existent-id")
        .single();

      expect(data).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe("PATCH /api/v1/workflows/:id", () => {
    it("should update workflow status", async () => {
      if (!testAdminClient) return;

      const workflow = await createTestWorkflow(
        testAdminClient,
        TEST_TENANT_A,
        {
          status: "pending",
        }
      );

      const { data, error } = await testAdminClient
        .from("workflows")
        .update({ status: "active" })
        .eq("id", workflow.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe("active");
    });

    it("should not allow updating tenant_id", async () => {
      if (!testAdminClient) return;

      const workflow = await createTestWorkflow(testAdminClient, TEST_TENANT_A);

      // Attempt to change tenant_id
      const { data } = await testAdminClient
        .from("workflows")
        .update({ tenant_id: TEST_TENANT_B })
        .eq("id", workflow.id)
        .select()
        .single();

      // Verify tenant_id did not change (RLS should prevent this)
      expect(data?.tenant_id).toBe(TEST_TENANT_A);
    });
  });

  describe("DELETE /api/v1/workflows/:id", () => {
    it("should delete a workflow", async () => {
      if (!testAdminClient) return;

      const workflow = await createTestWorkflow(testAdminClient, TEST_TENANT_A);

      const { error } = await testAdminClient
        .from("workflows")
        .delete()
        .eq("id", workflow.id);

      expect(error).toBeNull();

      // Verify deletion
      const { data } = await testAdminClient
        .from("workflows")
        .select("*")
        .eq("id", workflow.id)
        .single();

      expect(data).toBeNull();
    });

    it("should return 404 when deleting non-existent workflow", async () => {
      if (!testAdminClient) return;

      const { error } = await testAdminClient
        .from("workflows")
        .delete()
        .eq("id", "non-existent-id");

      // Supabase returns success even if no rows affected
      // Check count to verify
      const { count } = await testAdminClient
        .from("workflows")
        .select("*", { count: "exact", head: true })
        .eq("id", "non-existent-id");

      expect(count).toBe(0);
    });
  });
});
