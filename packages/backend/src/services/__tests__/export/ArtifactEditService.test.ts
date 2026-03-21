import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArtifactEditService } from "../../export/ArtifactEditService.js";
import { createMockSupabase } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, XSS_PAYLOADS, TENANT_ISOLATION_SCENARIOS } from "../fixtures/securityFixtures.js";

vi.mock("../../../lib/supabase.js");

describe("ArtifactEditService", () => {
  let service: ArtifactEditService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new ArtifactEditService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in fieldPath", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { title: "Test" } },
      ]);

      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          service.applyEdit({
            tenantId: "tenant-1",
            artifactId: "art-1",
            fieldPath: payload,
            newValue: "new value",
            editedByUserId: "user-1",
          }),
        ).rejects.toThrow();
      }
    });

    it("should sanitize XSS in edit values", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { title: "Test" } },
      ]);

      const xssPayload = XSS_PAYLOADS[0];

      await service.applyEdit({
        tenantId: "tenant-1",
        artifactId: "art-1",
        fieldPath: "title",
        newValue: xssPayload,
        editedByUserId: "user-1",
      });

      const edits = mockSupabase._mockData.get("artifact_edits");
      const edit = edits?.[0] as Record<string, unknown>;
      const value = JSON.stringify(edit?.new_value);

      expect(value).not.toContain("<script>");
    });

    it("should enforce tenant isolation", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-a", content_json: { title: "Test" } },
      ]);

      await expect(
        service.applyEdit({
          tenantId: "tenant-b",
          artifactId: "art-1",
          fieldPath: "title",
          newValue: "new value",
          editedByUserId: "user-1",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Audit Trail", () => {
    it("should record old and new values", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { title: "Original Title" } },
      ]);

      await service.applyEdit({
        tenantId: "tenant-1",
        artifactId: "art-1",
        fieldPath: "title",
        newValue: "New Title",
        editedByUserId: "user-1",
      });

      const edits = mockSupabase._mockData.get("artifact_edits");
      const edit = edits?.[0] as Record<string, unknown>;

      expect(edit?.old_value).toBe("Original Title");
      expect(edit?.new_value).toBe("New Title");
    });

    it("should record editor user ID", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { title: "Test" } },
      ]);

      await service.applyEdit({
        tenantId: "tenant-1",
        artifactId: "art-1",
        fieldPath: "title",
        newValue: "New Title",
        editedByUserId: "user-123",
        reason: "Update title",
      });

      const edits = mockSupabase._mockData.get("artifact_edits");
      const edit = edits?.[0] as Record<string, unknown>;

      expect(edit?.edited_by_user_id).toBe("user-123");
      expect(edit?.reason).toBe("Update title");
    });

    it("should support nested field paths", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { summary: { value: "Old" } } },
      ]);

      await service.applyEdit({
        tenantId: "tenant-1",
        artifactId: "art-1",
        fieldPath: "summary.value",
        newValue: "New",
        editedByUserId: "user-1",
      });

      const edits = mockSupabase._mockData.get("artifact_edits");
      const edit = edits?.[0] as Record<string, unknown>;

      expect(edit?.field_path).toBe("summary.value");
    });
  });

  describe("Edit History", () => {
    it("should retrieve edit history for artifact", async () => {
      mockSupabase._mockData.set("artifact_edits", [
        { id: "edit-1", tenant_id: "tenant-1", artifact_id: "art-1", field_path: "title", old_value: "A", new_value: "B" },
        { id: "edit-2", tenant_id: "tenant-1", artifact_id: "art-1", field_path: "title", old_value: "B", new_value: "C" },
      ]);

      const history = await service.getEditHistory("tenant-1", "art-1");

      expect(history).toHaveLength(2);
    });

    it("should order by created_at descending", async () => {
      mockSupabase._mockData.set("artifact_edits", [
        { id: "edit-1", tenant_id: "tenant-1", artifact_id: "art-1", created_at: "2024-01-01" },
        { id: "edit-2", tenant_id: "tenant-1", artifact_id: "art-1", created_at: "2024-01-02" },
      ]);

      const history = await service.getEditHistory("tenant-1", "art-1");

      expect(history[0].id).toBe("edit-2"); // Most recent first
    });
  });

  describe("Idempotency", () => {
    it("should apply edit consistently on retry", async () => {
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", content_json: { title: "Test" } },
      ]);

      const input = {
        tenantId: "tenant-1",
        artifactId: "art-1",
        fieldPath: "title",
        newValue: "New Title",
        editedByUserId: "user-1",
      };

      const result1 = await service.applyEdit(input);
      const result2 = await service.applyEdit(input);

      // Both should succeed but create separate edit records
      expect(result1.applied).toBe(true);
      expect(result2.applied).toBe(true);
    });
  });
});
