import { describe, expect, it, vi } from "vitest";
import { sduiSandboxService } from "../../services/SDUISandboxService";

// Mock the SDUISanitizer
vi.mock("../../lib/security/SDUISanitizer", () => ({
  SDUISanitizer: {
    sanitize: vi.fn((input) => input),
  },
}));

describe("UI Registry Validation", () => {
  const testOrganizationId = "test-org";

  describe("Intent-based validation", () => {
    it("should validate visualize_graph intent with valid payload", async () => {
      const payload = {
        entities: [
          { id: "1", type: "system", properties: { name: "Test System" } },
          {
            id: "2",
            type: "component",
            properties: { name: "Test Component" },
          },
        ],
        relationships: [{ from: "1", to: "2", type: "contains" }],
        title: "Test Graph",
      };

      const result = await sduiSandboxService.validateComponent(
        "visualize_graph",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject visualize_graph intent with invalid entities", async () => {
      const payload = {
        entities: "invalid", // Should be array
        relationships: [],
      };

      const result = await sduiSandboxService.validateComponent(
        "visualize_graph",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate display_metric intent with valid payload", async () => {
      const payload = {
        value: 42,
        label: "Test Metric",
        trend: "up",
      };

      const result = await sduiSandboxService.validateComponent(
        "display_metric",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject display_metric intent with missing required fields", async () => {
      const payload = {
        value: 42,
        // Missing label
      };

      const result = await sduiSandboxService.validateComponent(
        "display_metric",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required");
    });
  });

  describe("Security validation", () => {
    it("should detect malicious script patterns", async () => {
      const payload = {
        title: '<script>alert("xss")</script>',
        content: 'javascript:alert("xss")',
      };

      const result = await sduiSandboxService.validateComponent(
        "show_info",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("Malicious pattern detected"),
        ),
      ).toBe(true);
    });

    it("should detect eval patterns", async () => {
      const payload = {
        data: 'eval("malicious code")',
      };

      const result = await sduiSandboxService.validateComponent(
        "show_info",
        payload,
        testOrganizationId,
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("Malicious pattern detected"),
        ),
      ).toBe(true);
    });
  });

  describe("Sandbox execution", () => {
    it("should execute allowed components successfully", async () => {
      const result = await sduiSandboxService.executeInSandbox(
        "SystemMapCanvas",
        { entities: [{ id: "1", type: "node" }] },
        testOrganizationId,
      );

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject disallowed components", async () => {
      const result = await sduiSandboxService.executeInSandbox(
        "DisallowedComponent",
        {},
        testOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Component DisallowedComponent not allowed for organization",
      );
    });

    it("should validate required props in sandbox", async () => {
      const result = await sduiSandboxService.executeInSandbox(
        "SystemMapCanvas",
        {}, // Missing required entities prop
        testOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(
        result.errors.some((error) => error.includes("Missing required prop")),
      ).toBe(true);
    });
  });

  describe("Organization-specific validation", () => {
    it("should apply organization-specific rules", async () => {
      const result = await sduiSandboxService.validateComponent(
        "enterprise_feature",
        { data: "test" },
        "non-premium-org",
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Enterprise features require premium subscription",
      );
    });

    it("should allow premium features for premium organizations", async () => {
      const result = await sduiSandboxService.validateComponent(
        "enterprise_feature",
        { data: "test" },
        "premium-org",
      );

      expect(result.valid).toBe(true);
    });
  });
});
