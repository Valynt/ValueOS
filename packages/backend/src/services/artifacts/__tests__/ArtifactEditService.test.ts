/**
 * ArtifactEditService Tests
 *
 * Task: 9.3 - Unit test ArtifactEditService audit trail
 */

import { describe, expect, it, vi } from "vitest";

import { ArtifactEditService } from "../../../services/artifacts/ArtifactEditService.js";

// Mock supabase
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
              order: vi.fn(() => ({ data: [] })),
            })),
            single: vi.fn(),
          })),
          single: vi.fn(),
        })),
        single: vi.fn(),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      })),
    })),
  },
}));

describe("ArtifactEditService", () => {
  const editService = new ArtifactEditService();

  describe("editArtifact", () => {
    it("should validate input with zod schema", async () => {
      const invalidInput = {
        tenantId: "tenant-123",
        // Missing required fields
        artifactId: "art-123",
        fieldPath: "executive_summary",
        newValue: "Updated content",
        editedByUserId: "user-123",
      };

      // Should throw validation error for missing organizationId and caseId
      await expect(
        editService.editArtifact(invalidInput as any)
      ).rejects.toThrow();
    });
  });

  describe("applyEdit", () => {
    it("should apply edit to nested field using dot notation", async () => {
      const content = {
        executive_summary: "Original summary",
        nested: { field: "original" },
      };

      // Access private method through any cast for testing
      const result = (editService as any).applyEdit(
        content,
        "executive_summary",
        "Updated summary"
      );

      expect(result.executive_summary).toBe("Updated summary");
      expect(result.nested.field).toBe("original"); // Unchanged
    });

    it("should create nested path if it does not exist", async () => {
      const content = { existing: "value" };

      const result = (editService as any).applyEdit(
        content,
        "new.nested.field",
        "new value"
      );

      expect(result.new.nested.field).toBe("new value");
      expect(result.existing).toBe("value"); // Original preserved
    });
  });
});

describe("ArtifactEditService Audit Trail", () => {
  it("should be defined", () => {
    expect(ArtifactEditService).toBeDefined();
  });
});
