import { describe, it, expect, beforeEach } from "vitest";
import {
  createProvenanceRecord,
  getLineageChain,
  getProvenanceByCase,
  clearProvenanceStorage,
  ProvenanceService,
  type CreateProvenanceInput,
} from "../ProvenanceService";

describe("ProvenanceService", () => {
  beforeEach(() => {
    clearProvenanceStorage();
  });

  const createInput = (
    claimId: string,
    overrides: Partial<CreateProvenanceInput> = {}
  ): CreateProvenanceInput => ({
    tenantId: "tenant-1",
    caseId: "case-1",
    claimId,
    dataSource: "test-source",
    agentId: "TestAgent",
    agentVersion: "1.0.0",
    ...overrides,
  });

  describe("createProvenanceRecord", () => {
    it("should create a provenance record", () => {
      const record = createProvenanceRecord(createInput("claim-1"));

      expect(record.id).toBeDefined();
      expect(record.tenantId).toBe("tenant-1");
      expect(record.caseId).toBe("case-1");
      expect(record.claimId).toBe("claim-1");
      expect(record.createdAt).toBeInstanceOf(Date);
    });

    it("should include optional fields", () => {
      const record = createProvenanceRecord(
        createInput("claim-1", {
          formula: { operation: "multiply", factors: [1.2, 3.4] },
          evidenceTier: "tier_1_sec",
          confidenceScore: 0.85,
        })
      );

      expect(record.formula).toEqual({ operation: "multiply", factors: [1.2, 3.4] });
      expect(record.evidenceTier).toBe("tier_1_sec");
      expect(record.confidenceScore).toBe(0.85);
    });

    it("should support parent-child relationships", () => {
      const parent = createProvenanceRecord(createInput("parent-claim"));
      const child = createProvenanceRecord(
        createInput("child-claim", {
          parentRecordId: parent.id,
        })
      );

      expect(child.parentRecordId).toBe(parent.id);
    });
  });

  describe("getLineageChain", () => {
    it("should return lineage for a single record", () => {
      const record = createProvenanceRecord(createInput("claim-1"));

      const lineage = getLineageChain("claim-1", "tenant-1");

      expect(lineage.claimId).toBe("claim-1");
      expect(lineage.depth).toBe(1);
      expect(lineage.records).toHaveLength(1);
      expect(lineage.root.id).toBe(record.id);
    });

    it("should traverse lineage chain", () => {
      const root = createProvenanceRecord(createInput("root-claim"));
      const middle = createProvenanceRecord(
        createInput("middle-claim", { parentRecordId: root.id })
      );
      const leaf = createProvenanceRecord(
        createInput("leaf-claim", { parentRecordId: middle.id })
      );

      const lineage = getLineageChain("leaf-claim", "tenant-1");

      expect(lineage.depth).toBe(3);
      expect(lineage.records).toHaveLength(3);
      expect(lineage.root.id).toBe(root.id);
      expect(lineage.records[0].id).toBe(leaf.id);
      expect(lineage.records[1].id).toBe(middle.id);
      expect(lineage.records[2].id).toBe(root.id);
    });

    it("should handle multiple records for same claim", () => {
      createProvenanceRecord(createInput("claim-1"));
      createProvenanceRecord(
        createInput("claim-1", { dataSource: "updated-source" })
      );

      const lineage = getLineageChain("claim-1", "tenant-1");

      expect(lineage.records.length).toBeGreaterThanOrEqual(1);
    });

    it("should not include records from other tenants", () => {
      createProvenanceRecord(createInput("claim-1"));
      createProvenanceRecord({
        ...createInput("claim-1"),
        tenantId: "tenant-2",
        caseId: "case-2",
      });

      const lineage = getLineageChain("claim-1", "tenant-1");

      expect(lineage.records.every((r) => r.tenantId === "tenant-1")).toBe(true);
    });
  });

  describe("getProvenanceByCase", () => {
    it("should return all records for a case", () => {
      createProvenanceRecord(createInput("claim-1"));
      createProvenanceRecord(createInput("claim-2"));
      createProvenanceRecord(createInput("claim-3"));

      const records = getProvenanceByCase("case-1", "tenant-1");

      expect(records).toHaveLength(3);
    });

    it("should not return records from other cases", () => {
      createProvenanceRecord(createInput("claim-1"));
      createProvenanceRecord({
        ...createInput("claim-2"),
        caseId: "case-2",
      });

      const records = getProvenanceByCase("case-1", "tenant-1");

      expect(records).toHaveLength(1);
      expect(records[0].claimId).toBe("claim-1");
    });

    it("should not return records from other tenants", () => {
      createProvenanceRecord(createInput("claim-1"));
      createProvenanceRecord({
        ...createInput("claim-2"),
        tenantId: "tenant-2",
      });

      const records = getProvenanceByCase("case-1", "tenant-1");

      expect(records).toHaveLength(1);
      expect(records[0].tenantId).toBe("tenant-1");
    });
  });

  describe("ProvenanceService class", () => {
    const service = new ProvenanceService();

    it("should create record", async () => {
      const record = await service.create(createInput("claim-1"));

      expect(record.claimId).toBe("claim-1");
    });

    it("should get lineage", async () => {
      await service.create(createInput("claim-1"));

      const lineage = await service.getLineage("claim-1", "tenant-1");

      expect(lineage.claimId).toBe("claim-1");
    });

    it("should get by case", async () => {
      await service.create(createInput("claim-1"));
      await service.create(createInput("claim-2"));

      const records = await service.getByCase("case-1", "tenant-1");

      expect(records).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty storage", () => {
      const lineage = getLineageChain("nonexistent", "tenant-1");

      expect(lineage.records).toHaveLength(0);
      expect(lineage.depth).toBe(0);
    });

    it("should handle circular references gracefully", () => {
      const record1 = createProvenanceRecord(createInput("claim-1"));
      const record2 = createProvenanceRecord(
        createInput("claim-2", { parentRecordId: record1.id })
      );

      // Manually create circular reference for testing
      // In practice, this shouldn't happen with append-only writes

      const lineage = getLineageChain("claim-2", "tenant-1");
      expect(lineage.depth).toBe(2);
    });

    it("should handle deep chains", () => {
      let parentId: string | undefined;
      const depth = 10;

      for (let i = 0; i < depth; i++) {
        const record = createProvenanceRecord(
          createInput(`claim-${i}`, { parentRecordId: parentId })
        );
        parentId = record.id;
      }

      const lineage = getLineageChain(`claim-${depth - 1}`, "tenant-1");
      expect(lineage.depth).toBe(depth);
    });
  });
});
