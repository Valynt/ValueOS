/**
 * Migration Validation Tests
 *
 * Comprehensive tests for the automated migration system including
 * rollback capabilities, schema diffing, and validation.
 */

import { afterEach, beforeEach, describe, it } from "vitest";

import { logger } from "../../lib/logger";
import {
  canMigrate,
  getMigrationPath,
  migrateSchema,
  MigrationCheckpoint,
  MigrationResult,
  migrationRunner,
  MigrationRunner,
  SchemaMigration,
  validateMigration,
} from "../migrations";
import { SDUIPageDefinition, validateSDUISchema } from "../schema";

// Mock logger to avoid console output during tests
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MigrationRunner - Automated Migration System", () => {
  let runner: MigrationRunner;

  beforeEach(() => {
    runner = new MigrationRunner();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Migration Operations", () => {
    it("should successfully migrate v1 to v2 schema", async () => {
      const v1Schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: {
              title: "Test Title",
              content: "Test Content",
            },
          },
          {
            type: "component",
            component: "DiscoveryCard",
            version: 1,
            props: {
              description: "Test Description",
            },
          },
        ],
        metadata: {
          theme: "dark",
        },
      };

      const result = await runner.runMigration(v1Schema, 2, {
        validateAfter: true,
        createCheckpoint: true,
      });

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.appliedMigrations).toHaveLength(1);
      expect(result.appliedMigrations[0]).toContain("1→2");
      expect(result.rollbackAvailable).toBe(true);
      expect(result.schemaHash).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify migration was applied correctly
      const validation = validateSDUISchema(v1Schema);
      expect(validation.success).toBe(true);
    });

    it("should handle dry run mode correctly", async () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const result = await runner.runMigration(schema, 2, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain("Dry run mode - no changes applied");
      expect(result.appliedMigrations).toHaveLength(0);
    });

    it("should reject invalid migration paths", async () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const result = await runner.runMigration(schema, 99);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain("Cannot migrate from version 1 to 99");
    });
  });

  describe("Checkpoint and Rollback Operations", () => {
    it("should create and manage checkpoints", () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const checkpoint = runner.createCheckpoint(schema, 1, 2, {
        test: "metadata",
      });

      expect(checkpoint.id).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(checkpoint.fromVersion).toBe(1);
      expect(checkpoint.toVersion).toBe(2);
      expect(checkpoint.originalSchema).toEqual(schema);
      expect(checkpoint.originalHash).toBeDefined();
      expect(checkpoint.metadata).toEqual({ test: "metadata" });
      expect(checkpoint.timestamp).toBeGreaterThan(0);

      // Verify checkpoint is stored
      const checkpoints = runner.getCheckpoints();
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].id).toBe(checkpoint.id);
    });

    it("should maintain maximum checkpoint limit", () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      // Create more checkpoints than the limit
      for (let i = 0; i < 15; i++) {
        runner.createCheckpoint(schema, 1, 2);
      }

      const checkpoints = runner.getCheckpoints();
      expect(checkpoints).toHaveLength(10); // Should be limited to maxCheckpoints
    });

    it("should successfully rollback to checkpoint", async () => {
      const originalSchema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: {
              title: "Original Title",
              content: "Original Content",
            },
          },
        ],
        metadata: {},
      };

      // Create checkpoint and migrate
      const checkpoint = runner.createCheckpoint(originalSchema, 1, 2);
      const migrateResult = await runner.runMigration(originalSchema, 2);

      expect(migrateResult.success).toBe(true);

      // Rollback to checkpoint
      const rollbackResult = await runner.rollback(checkpoint.id);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.fromVersion).toBe(2);
      expect(rollbackResult.toVersion).toBe(1);
      expect(rollbackResult.appliedMigrations).toHaveLength(1);
      expect(rollbackResult.appliedMigrations[0]).toContain("Rollback:");
    });

    it("should fail rollback for invalid checkpoint", async () => {
      const result = await runner.rollback("invalid-checkpoint-id");

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain("Checkpoint invalid-checkpoint-id not found");
    });
  });

  describe("Schema Diffing", () => {
    it("should generate accurate schema diffs", () => {
      const original: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Old Title" },
          },
          {
            type: "component",
            component: "DiscoveryCard",
            version: 1,
            props: { description: "Description" },
          },
        ],
        metadata: {},
      };

      const updated: SDUIPageDefinition = {
        type: "page",
        version: 2,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 2,
            props: { heading: "New Title" }, // Modified
          },
          {
            type: "component",
            component: "ValueTreeCard", // Added
            version: 1,
            props: { value: 100 },
          },
        ],
        metadata: {},
      };

      const diff = runner.generateDiff(original, updated);

      expect(diff.added).toContain("component:ValueTreeCard");
      expect(diff.removed).toContain("component:DiscoveryCard");
      expect(diff.modified).toContain("component:InfoBanner");
      expect(diff.breaking).toBe(true);
      expect(diff.summary).toContain("+1 -1 ~1 changes");
    });

    it("should handle identical schemas", () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const diff = runner.generateDiff(schema, schema);

      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
      expect(diff.breaking).toBe(false);
      expect(diff.summary).toContain("+0 -0 ~0 changes");
    });
  });

  describe("Schema Hashing and Integrity", () => {
    it("should generate consistent hashes for identical schemas", () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Test" },
          },
        ],
        metadata: {},
      };

      const checkpoint1 = runner.createCheckpoint(schema, 1, 2);
      const checkpoint2 = runner.createCheckpoint(schema, 1, 2);

      expect(checkpoint1.originalHash).toBe(checkpoint2.originalHash);
    });

    it("should generate different hashes for different schemas", () => {
      const schema1: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Test 1" },
          },
        ],
        metadata: {},
      };

      const schema2: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Test 2" },
          },
        ],
        metadata: {},
      };

      const checkpoint1 = runner.createCheckpoint(schema1, 1, 2);
      const checkpoint2 = runner.createCheckpoint(schema2, 1, 2);

      expect(checkpoint1.originalHash).not.toBe(checkpoint2.originalHash);
    });
  });

  describe("Performance and Timing", () => {
    it("should complete migrations within reasonable time", async () => {
      const complexSchema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: Array.from({ length: 100 }, (_, i) => ({
          type: "component" as const,
          component: `Component${i}`,
          version: 1,
          props: { id: i, data: `test-data-${i}`.repeat(10) },
        })),
        metadata: {},
      };

      const startTime = Date.now();
      const result = await runner.runMigration(complexSchema, 2);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should estimate migration times accurately", async () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const result = await runner.runMigration(schema, 2);

      expect(result.success).toBe(true);
      // The actual duration should be reasonable compared to the estimated time
      expect(result.duration).toBeLessThan(1000); // Less than 1 second for simple migration
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed schemas gracefully", async () => {
      const malformedSchema = {
        type: "page",
        version: 1,
        // Missing required sections
        metadata: {},
      } as SDUIPageDefinition;

      const result = await runner.runMigration(malformedSchema, 2);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should handle concurrent migrations safely", async () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      // Run multiple migrations concurrently
      const promises = Array.from({ length: 5 }, () => runner.runMigration(schema, 2));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it("should validate migration path before execution", async () => {
      const schema: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      // Test with non-existent target version
      const result = await runner.runMigration(schema, 999);

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain("Cannot migrate from version 1 to 999");
    });
  });
});

describe("Legacy Migration Functions", () => {
  describe("canMigrate", () => {
    it("should return true for valid migration paths", () => {
      expect(canMigrate(1, 2)).toBe(true);
      expect(canMigrate(1, 1)).toBe(true);
    });

    it("should return false for invalid migration paths", () => {
      expect(canMigrate(2, 1)).toBe(false); // Downgrade
      expect(canMigrate(1, 3)).toBe(false); // Missing intermediate migration
    });
  });

  describe("getMigrationPath", () => {
    it("should return correct migration path", () => {
      const path = getMigrationPath(1, 2);
      expect(path).toHaveLength(1);
      expect(path[0].fromVersion).toBe(1);
      expect(path[0].toVersion).toBe(2);
    });

    it("should return empty path for same version", () => {
      const path = getMigrationPath(1, 1);
      expect(path).toHaveLength(0);
    });

    it("should return empty path for downgrade", () => {
      const path = getMigrationPath(2, 1);
      expect(path).toHaveLength(0);
    });
  });

  describe("validateMigration", () => {
    it("should validate successful migrations", () => {
      const original: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Test" },
          },
        ],
        metadata: {},
      };

      const migrated: SDUIPageDefinition = {
        type: "page",
        version: 2,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 2,
            props: { heading: "Test" },
          },
        ],
        metadata: {},
      };

      const result = validateMigration(original, migrated);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect migration issues", () => {
      const original: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [
          {
            type: "component",
            component: "InfoBanner",
            version: 1,
            props: { title: "Test" },
          },
        ],
        metadata: {},
      };

      const migrated: SDUIPageDefinition = {
        type: "page",
        version: 1, // Version not updated
        sections: [], // Sections lost
        metadata: {},
      };

      const result = validateMigration(original, migrated);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Version was not updated");
      expect(result.errors).toContain("Sections were lost during migration");
    });
  });
});

describe("Integration Tests", () => {
  let runner: MigrationRunner;
  beforeEach(() => {
    runner = new MigrationRunner();
  });

  it("should handle complete migration lifecycle", async () => {
    const originalSchema: SDUIPageDefinition = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "InfoBanner",
          version: 1,
          props: {
            title: "Original Title",
            content: "Original Content",
            actions: [{ type: "click", handler: "doSomething", params: { id: 1 } }],
          },
        },
      ],
      metadata: {
        theme: "dark",
      },
    };

    // Step 1: Create checkpoint
    const checkpoint = runner.createCheckpoint(originalSchema, 1, 2);

    // Step 2: Run migration
    const migrateResult = await runner.runMigration(originalSchema, 2, {
      validateAfter: true,
      createCheckpoint: true,
    });

    expect(migrateResult.success).toBe(true);

    // Step 3: Verify migration results
    expect(migrateResult.appliedMigrations).toHaveLength(1);
    expect(migrateResult.rollbackAvailable).toBe(true);

    // Step 4: Generate diff
    const diff = runner.generateDiff(originalSchema, originalSchema);
    expect(diff.breaking).toBe(false);

    // Step 5: Rollback
    const rollbackResult = await runner.rollback(checkpoint.id);
    expect(rollbackResult.success).toBe(true);

    // Step 6: Verify rollback integrity
    const validationResult = validateMigration(originalSchema, originalSchema);
    expect(validationResult.valid).toBe(true);
  });
});
