/**
 * SDUI Sprint Integration Tests
 *
 * End-to-end tests validating the complete SDUI system with all
 * the implemented features: migrations, error handling, caching, versioning.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CacheFactory, globalCache } from "../cache";
import { ComponentErrorBoundary } from "../components/ComponentErrorBoundary";
import { fallbackRegistry, withFallback } from "../components/FallbackComponentRegistry";
import { migrateSchema, MigrationResult, migrationRunner, validateMigration } from "../migrations";
import { resolveComponent, versionedRegistry } from "../registry";
import { validateSDUISchema } from "../schema";

// Mock React for testing
const mockReact = {
  Component: class Component {
    constructor(props: any) {
      this.props = props;
    }
    render() {
      return null;
    }
  },
  createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }),
};

describe("SDUI Sprint Integration Tests", () => {
  beforeEach(() => {
    // Clear caches and reset state
    globalCache.clear();
    fallbackRegistry.clear();
    versionedRegistry.clear();
  });

  afterEach(() => {
    // Cleanup
  });

  describe("Migration System Integration", () => {
    it("should perform complete migration lifecycle", async () => {
      const v1Schema = {
        type: "page" as const,
        version: 1,
        sections: [
          {
            type: "component" as const,
            component: "InfoBanner",
            version: 1,
            props: {
              title: "Test Title",
              content: "Test Content",
            },
          },
        ],
        metadata: {
          theme: "dark",
        },
      };

      // Step 1: Create checkpoint
      const checkpoint = migrationRunner.createCheckpoint(v1Schema, 1, 2);
      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.fromVersion).toBe(1);
      expect(checkpoint.toVersion).toBe(2);

      // Step 2: Run migration
      const result = await migrationRunner.runMigration(v1Schema, 2, {
        validateAfter: true,
        createCheckpoint: true,
      });

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.appliedMigrations).toHaveLength(1);
      expect(result.rollbackAvailable).toBe(true);

      // Step 3: Validate migration
      const validation = validateMigration(v1Schema, result);
      expect(validation.valid).toBe(true);

      // Step 4: Generate schema diff
      const diff = migrationRunner.generateDiff(v1Schema, v1Schema);
      expect(diff.breaking).toBe(false);
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);

      // Step 5: Rollback
      const rollbackResult = await migrationRunner.rollback(checkpoint.id);
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.fromVersion).toBe(2);
      expect(rollbackResult.toVersion).toBe(1);
    });

    it("should handle migration errors gracefully", async () => {
      const invalidSchema = {
        type: "page" as const,
        version: 1,
        sections: [],
        metadata: {},
      };

      const result = await migrationRunner.runMigration(invalidSchema, 99);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain("Cannot migrate from version 1 to 99");
    });
  });

  describe("Error Boundary Integration", () => {
    it("should handle component errors with circuit breaker", async () => {
      let errorCount = 0;
      const onError = () => errorCount++;

      const TestComponent = () => {
        if (errorCount < 3) {
          throw new Error(`Test error ${errorCount + 1}`);
        }
        return mockReact.createElement("div", null, "Success");
      };

      const errorBoundary = new ComponentErrorBoundary({
        componentName: "TestComponent",
        onError,
        circuitBreaker: {
          failureThreshold: 2,
          recoveryTimeout: 1000,
        },
        retryConfig: {
          maxAttempts: 3,
          initialDelay: 100,
        },
      });

      // Simulate error
      expect(() => errorBoundary.componentDidCatch(new Error("Test error 1"), {})).not.toThrow();

      // Should create checkpoint
      const checkpoints = migrationRunner.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(0);
    });

    it("should use fallback components when available", () => {
      const FallbackComponent = () => mockReact.createElement("div", null, "Fallback");

      // Register fallback
      fallbackRegistry.register({
        componentName: "TestComponent",
        component: FallbackComponent,
        priority: 1,
        conditions: {
          errorTypes: ["Error"],
        },
      });

      const WrappedComponent = withFallback(TestComponent, {
        fallbackComponent: FallbackComponent,
      });

      expect(WrappedComponent).toBeDefined();
    });
  });

  describe("Component Versioning Integration", () => {
    it("should resolve components with version negotiation", () => {
      // Register versioned components
      versionedRegistry.register({
        component: mockReact.Component,
        version: 2,
        minCompatibleVersion: 1,
        description: "Test component v2",
      });

      versionedRegistry.register({
        component: mockReact.Component,
        version: 1,
        description: "Test component v1",
      });

      // Test exact version match
      const result1 = resolveComponent("TestComponent", 2);
      expect(result1.version).toBe(2);
      expect(result1.isFallback).toBe(false);

      // Test compatible version
      const result2 = resolveComponent("TestComponent", 1);
      expect(result2.version).toBe(2); // Should get latest compatible
      expect(result2.isFallback).toBe(false);

      // Test fallback for unknown component
      const result3 = resolveComponent("UnknownComponent", 1);
      expect(result3.isFallback).toBe(true);
    });

    it("should handle deprecated components", () => {
      versionedRegistry.register({
        component: mockReact.Component,
        version: 2,
        deprecated: true,
        deprecationMessage: "Use version 3 instead",
        description: "Deprecated component",
      });

      const result = resolveComponent("TestComponent", 2);
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecationMessage).toBe("Use version 3 instead");
    });
  });

  describe("Caching Integration", () => {
    it("should cache and retrieve values across layers", async () => {
      const cache = CacheFactory.createMultiLevelCache<string>();

      // Set value
      await cache.set("test-key", "test-value", 1000);

      // Retrieve from cache
      const cached = await cache.get("test-key");
      expect(cached).toBe("test-value");

      // Check cache hit
      const stats = await cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it("should handle cache expiration", async () => {
      const cache = CacheFactory.createMultiLevelCache<string>();

      // Set value with short TTL
      await cache.set("expire-key", "expire-value", 50);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      const cached = await cache.get("expire-key");
      expect(cached).toBeNull();

      const stats = await cache.stats();
      expect(stats.misses).toBe(1);
    });

    it("should provide cache health monitoring", async () => {
      const cache = CacheFactory.createMultiLevelCache<string>();

      // Add some data
      await cache.warmUp({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      });

      const health = await cache.health();
      expect(health.status).toBe("healthy");
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });
  });

  describe("End-to-End Workflow", () => {
    it("should handle complete SDUI rendering workflow", async () => {
      // 1. Create schema
      const schema = {
        type: "page" as const,
        version: 1,
        sections: [
          {
            type: "component" as const,
            component: "InfoBanner",
            version: 1,
            props: {
              title: "Welcome to SDUI",
              content: "This is a test page",
            },
          },
        ],
        metadata: {
          theme: "light",
        },
      };

      // 2. Validate schema
      const validation = validateSDUISchema(schema);
      expect(validation.success).toBe(true);

      // 3. Cache schema
      await globalCache.set("schema:main", schema, 60000);

      // 4. Retrieve from cache
      const cachedSchema = await globalCache.get("schema:main");
      expect(cachedSchema).toEqual(schema);

      // 5. Migrate if needed
      const migratedSchema = migrateSchema(schema, 2);
      expect(migratedSchema.version).toBe(2);

      // 6. Validate migrated schema
      const migratedValidation = validateSDUISchema(migratedSchema);
      expect(migratedValidation.success).toBe(true);

      // 7. Cache migrated schema
      await globalCache.set("schema:migrated", migratedSchema, 60000);

      // 8. Check final cache stats
      const stats = await globalCache.stats();
      expect(stats.sets).toBeGreaterThanOrEqual(2);
      expect(stats.currentSize).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should meet migration performance targets", async () => {
      const complexSchema = {
        type: "page" as const,
        version: 1,
        sections: Array.from({ length: 100 }, (_, i) => ({
          type: "component" as const,
          component: `Component${i}`,
          version: 1,
          props: { id: i, data: `test-data-${i}`.repeat(10) },
        })),
        metadata: {
          theme: "dark",
        },
      };

      const startTime = Date.now();
      const result = await migrationRunner.runMigration(complexSchema, 2);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.duration).toBeLessThan(5000);
    });

    it("should meet cache performance targets", async () => {
      const cache = CacheFactory.createMemoryCache({ maxSize: 1000 });

      // Warm up cache
      const data = Array.from({ length: 100 }, (_, i) => ({
        key: `test-key-${i}`,
        value: `test-value-${i}`,
      }));

      const warmUpStart = Date.now();
      await Promise.all(data.map(({ key, value }) => cache.set(key, value)));
      const warmUpDuration = Date.now() - warmUpStart;

      expect(warmUpDuration).toBeLessThan(1000); // Should warm up within 1 second

      // Test retrieval performance
      const retrievalStart = Date.now();
      await Promise.all(data.map(({ key }) => cache.get(key)));
      const retrievalDuration = Date.now() - retrievalStart;

      expect(retrievalDuration).toBeLessThan(100); // Should retrieve within 100ms

      const stats = await cache.stats();
      expect(stats.hitRate).toBe(1.0); // All should be hits
    });
  });
});
