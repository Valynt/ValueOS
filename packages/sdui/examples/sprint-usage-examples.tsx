/* eslint-disable no-console */
/**
 * SDUI Sprint Usage Examples
 *
 * Demonstrates how to use the new features implemented in the sprint
 */

import { cached, globalCache } from "@sdui/cache";
import { ComponentErrorBoundary } from "@sdui/components/ComponentErrorBoundary";
import { migrateSchema, migrationRunner } from "@sdui/migrations";
import { resolveComponent, versionedRegistry } from "@sdui/registry";
import { renderPage } from "@sdui/renderPage";
import React from "react";

// Example 1: Enhanced Error Boundary with Circuit Breaker
function RobustComponent({ data }: { data: Record<string, unknown> }) {
  return (
    <ComponentErrorBoundary
      componentName="RobustComponent"
      circuitBreaker={{
        failureThreshold: 3,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 300000, // 5 minutes
      }}
      retryConfig={{
        maxAttempts: 5,
        initialDelay: 1000, // 1 second
        backoffMultiplier: 2,
        maxDelay: 30000, // 30 seconds
      }}
      correlationContext={{
        sessionId: "session-123",
        userId: "user-456",
        userAgent: navigator.userAgent,
      }}
      onError={(error, errorInfo) => {
        console.error("Component error:", error, errorInfo);
      }}
    >
      <div className="robust-component">
        <h2>Robust Component</h2>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </ComponentErrorBoundary>
  );
}

// Example 2: Schema Migration with Checkpoints
async function migrateWithCheckpoints(schema: Record<string, unknown>, targetVersion: number) {
  try {
    // Create checkpoint before migration
    const checkpoint = migrationRunner.createCheckpoint(
      schema,
      schema.version || 1,
      targetVersion,
      { source: "manual-migration" }
    );

    console.log("Checkpoint created:", checkpoint.id);

    // Run migration with validation
    const result = await migrationRunner.runMigration(schema, targetVersion, {
      validateAfter: true,
      createCheckpoint: true,
      dryRun: false,
    });

    if (result.success) {
      console.log("Migration successful:", {
        from: result.fromVersion,
        to: result.toVersion,
        duration: result.duration,
        appliedMigrations: result.appliedMigrations,
      });

      return result;
    } else {
      console.error("Migration failed:", result.errors);

      // Rollback to checkpoint
      const rollbackResult = await migrationRunner.rollback(checkpoint.id);
      console.log("Rolled back to:", rollbackResult.toVersion);

      throw new Error("Migration failed, rolled back to checkpoint");
    }
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

// Example 3: Versioned Component Registration
function registerVersionedComponents() {
  // Register v1 component
  versionedRegistry.register({
    component: LegacyInfoBanner,
    version: 1,
    description: "Legacy info banner component",
    requiredProps: ["title"],
    tags: ["legacy", "ui"],
  });

  // Register v2 component with compatibility
  versionedRegistry.register({
    component: EnhancedInfoBanner,
    version: 2,
    minCompatibleVersion: 1,
    maxCompatibleVersion: 2,
    deprecated: false,
    description: "Enhanced info banner with animations",
    requiredProps: ["title"],
    optionalProps: ["variant", "actions"],
    tags: ["ui", "enhanced", "v2"],
  });

  // Register v3 component (breaking changes)
  versionedRegistry.register({
    component: ModernInfoBanner,
    version: 3,
    minCompatibleVersion: 3,
    deprecated: false,
    description: "Modern info banner with new API",
    requiredProps: ["content"],
    optionalProps: ["variant", "actions", "theme"],
    tags: ["ui", "modern", "v3"],
  });
}

// Example 4: Component Resolution with Version Negotiation
function renderVersionedComponent(componentName: string, requestedVersion?: number) {
  const result = resolveComponent(componentName, requestedVersion, "compatible");

  const Component = result.component;

  if (result.isDeprecated) {
    console.warn("Using deprecated component:", result.deprecationMessage);
  }

  if (result.isFallback) {
    console.warn("Using fallback component for:", componentName);
  }

  return (
    <div className="versioned-component">
      <Component
        version={result.version}
        isFallback={result.isFallback}
        isDeprecated={result.isDeprecated}
      />
      <div className="version-info">
        Component: {componentName}, Version: {result.version}
        {result.isFallback && " (Fallback)"}
        {result.isDeprecated && " (Deprecated)"}
      </div>
    </div>
  );
}

// Example 5: Caching with Decorators
class SchemaService {
  @cached(5 * 60 * 1000) // 5 minutes cache
  async generateSchema(workspaceId: string): Promise<Record<string, unknown>> {
    console.log("Generating schema for workspace:", workspaceId);

    // Expensive schema generation logic
    return {
      type: "page",
      version: 2,
      sections: [
        {
          type: "component",
          component: "InfoBanner",
          version: 2,
          props: {
            title: `Schema for ${workspaceId}`,
            content: "Generated schema",
          },
        },
      ],
      metadata: {
        workspaceId,
        generatedAt: Date.now(),
      },
    };
  }

  @cached(10 * 60 * 1000) // 10 minutes cache
  async validateSchema(schema: Record<string, unknown>): Promise<boolean> {
    console.log("Validating schema");

    // Schema validation logic
    try {
      // Simulate validation
      return schema.type === "page" && schema.sections && Array.isArray(schema.sections);
    } catch (error) {
      console.error("Schema validation error:", error);
      return false;
    }
  }
}

// Example 6: Multi-level Cache Usage
async function demonstrateCaching() {
  const schemaService = new SchemaService();

  // First call - will generate and cache
  console.time("First call (cache miss)");
  const schema1 = await schemaService.generateSchema("workspace-123");
  console.timeEnd("First call (cache miss)");

  // Second call - will retrieve from cache
  console.time("Second call (cache hit)");
  const schema2 = await schemaService.generateSchema("workspace-123");
  console.timeEnd("Second call (cache hit)");

  // Cache stats
  const stats = await globalCache.stats();
  console.log("Cache stats:", {
    hitRate: Math.round(stats.hitRate * 100) + "%",
    hits: stats.hits,
    misses: stats.misses,
    currentSize: stats.currentSize,
  });

  // Cache health check
  const health = await globalCache.health();
  console.log("Cache health:", health);
}

// Example 7: Complete SDUI Rendering with All Features
function SDUIPage({ workspaceId }: { workspaceId: string }) {
  const [schema, setSchema] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError(null);

        const schemaService = new SchemaService();

        // Get cached or generate schema
        let pageSchema = await globalCache.get(`schema:${workspaceId}`);

        if (!pageSchema) {
          pageSchema = await schemaService.generateSchema(workspaceId);

          // Validate schema
          const isValid = await schemaService.validateSchema(pageSchema);
          if (!isValid) {
            throw new Error("Invalid schema generated");
          }

          // Cache the schema
          await globalCache.set(`schema:${workspaceId}`, pageSchema, 10 * 60 * 1000); // 10 minutes
        }

        // Migrate if needed
        const migratedSchema = migrateSchema(pageSchema, 2);

        setSchema(migratedSchema);
      } catch (err) {
        console.error("Failed to load SDUI page:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [workspaceId]);

  if (loading) {
    return <div className="loading">Loading SDUI page...</div>;
  }

  if (error) {
    return (
      <ComponentErrorBoundary
        componentName="SDUIPage"
        fallback={
          <div className="error-fallback">
            <h2>Error Loading Page</h2>
            <p>{error.message}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        }
      >
        <div className="error-state" />
      </ComponentErrorBoundary>
    );
  }

  if (!schema) {
    return <div className="no-schema">No schema available</div>;
  }

  return (
    <div className="sdui-page">
      <ComponentErrorBoundary
        componentName="SDUIRenderer"
        circuitBreaker={{
          failureThreshold: 5,
          recoveryTimeout: 15000,
        }}
      >
        {renderPage(schema, {
          onError: (error) => setError(error),
          onSchemaChange: setSchema,
        })}
      </ComponentErrorBoundary>
    </div>
  );
}

// Example 8: Usage in Application
function App() {
  return (
    <div className="app">
      <h1>SDUI Sprint Demo</h1>

      <section>
        <h2>1. Enhanced Error Boundary</h2>
        <RobustComponent data={{ message: "Test error handling" }} />
      </section>

      <section>
        <h2>2. Versioned Components</h2>
        {registerVersionedComponents()}
        {renderVersionedComponent("InfoBanner", 1)}
        {renderVersionedComponent("InfoBanner", 2)}
      </section>

      <section>
        <h2>3. Caching Performance</h2>
        <button onClick={demonstrateCaching}>Test Caching Performance</button>
      </section>

      <section>
        <h2>4. Complete SDUI Page</h2>
        <SDUIPage workspaceId="demo-workspace" />
      </section>
    </div>
  );
}

export default App;
