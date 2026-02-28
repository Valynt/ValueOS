/**
 * SDUI API Endpoints
 *
 * P1 GAP FIX: Provides HTTP endpoints for schema delivery with version negotiation
 *
 * Implements:
 * - Schema delivery via HTTP
 * - Version negotiation via Accept-Version header
 * - Schema caching with appropriate headers
 * - Backward compatibility via version downgrading
 * Enhanced with automatic migration and rollback capabilities
 */

// Define local types since imports are not available
type LifecycleStage = "opportunity" | "target" | "realization" | "expansion" | "integrity";

import { Request, Response, Router } from "express";

import { migrateSchema, migrationRunner } from "../../../sdui/src/migrations.js";
import { SDUI_VERSION, SDUIPageDefinition, validateSDUISchema } from "../../../sdui/src/schema.js";
import logger from "../../../shared/src/lib/logger.js";
import { canvasSchemaService } from "../services/CanvasSchemaService.js";

const router: Router = Router();

// Helper to validate lifecycle stage
function isValidStage(stage: string): stage is LifecycleStage {
  const stages: LifecycleStage[] = [
    "opportunity",
    "target",
    "realization",
    "expansion",
    "integrity",
  ];
  return stages.includes(stage as LifecycleStage);
}

interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  stage: LifecycleStage;
  lifecycleStage?: LifecycleStage;
  metadata?: {
    tenantId?: string;
    sessionId?: string;
  };
}

/**
 * Parse version from header
 */
function parseVersion(versionHeader: string | undefined): number | null {
  if (!versionHeader) return null;

  // Support formats: "v2", "2", "2.0"
  const match = versionHeader?.match(/v?(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Generate SDUI schema for agent
 *
 * Returns a basic schema wrapping the AgentWorkflowPanel
 */
async function generateSchemaForAgent(agentId: string): Promise<SDUIPageDefinition> {
  logger.info("Generating schema for agent", { agentId });

  // Basic schema for agent view
  return {
    type: "page",
    version: SDUI_VERSION,
    sections: [
      {
        type: "component",
        component: "AgentWorkflowPanel",
        version: 1,
        props: {
          agents: [
            // Minimal mock data for now
            { id: agentId, name: agentId, status: "active", role: "assistant" },
          ],
        },
      },
    ],
  };
}

/**
 * Get SDUI schema for a workspace
 *
 * Supports version negotiation via Accept-Version header
 * Returns schema compatible with requested version
 * Enhanced with automatic migration and rollback capabilities
 */
router.get("/api/sdui/schema/:workspaceId", async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const requestedVersion = parseVersion(req.headers["accept-version"] as string);
    const clientVersion = requestedVersion || SDUI_VERSION;
    const autoMigrate = req.headers["x-auto-migrate"] === "true";
    const createCheckpoint = req.headers["x-create-checkpoint"] === "true";

    logger.info("SDUI schema requested", {
      workspaceId,
      requestedVersion: clientVersion,
      serverVersion: SDUI_VERSION,
      autoMigrate,
      createCheckpoint,
    });

    const context: WorkspaceContext = {
      workspaceId: workspaceId || "",
      userId: (req as any).user?.id || "anonymous",
      stage: isValidStage(req.query.stage as string)
        ? (req.query.stage as LifecycleStage)
        : "opportunity",
      metadata: {
        tenantId: (req as any).tenantId || "",
        sessionId: (req.headers["x-session-id"] as string) || "",
      },
    };

    // Generate schema for workspace
    let schema = await canvasSchemaService.generateSchema(workspaceId || "", context);

    // Validate original schema
    const originalValidation = validateSDUISchema(schema);
    if (!originalValidation.success) {
      logger.error("Invalid SDUI schema generated", {
        workspaceId,
        errors: originalValidation.errors,
      });
      return res.status(500).json({
        error: "schema_generation_failed",
        message: "Failed to generate valid SDUI schema",
        errors: originalValidation.errors,
      });
    }

    // Handle automatic migration if requested
    if (autoMigrate && clientVersion !== (schema.version || SDUI_VERSION)) {
      logger.info("Automatic migration requested", {
        from: schema.version || SDUI_VERSION,
        to: clientVersion,
      });

      try {
        const migrationResult = await migrationRunner.runMigration(schema, clientVersion, {
          validateAfter: true,
          createCheckpoint,
          dryRun: req.headers["x-dry-run"] === "true",
        });

        if (!migrationResult.success) {
          logger.error("Automatic migration failed", {
            workspaceId,
            errors: migrationResult.errors,
          });
          return res.status(500).json({
            error: "migration_failed",
            message: "Automatic migration failed",
            errors: migrationResult.errors,
          });
        }

        // Update schema with migrated version
        schema = {
          ...schema,
          version: clientVersion,
        };

        logger.info("Automatic migration successful", {
          workspaceId,
          from: migrationResult.fromVersion,
          to: migrationResult.toVersion,
          duration: migrationResult.duration,
        });
      } catch (migrationError) {
        logger.error("Migration error occurred", {
          workspaceId,
          error: migrationError,
        });
        return res.status(500).json({
          error: "migration_error",
          message: "Migration process failed",
        });
      }
    }
    // Downgrade schema if client version is older (legacy behavior)
    else if (clientVersion < SDUI_VERSION) {
      logger.info("Downgrading schema for old client", {
        from: SDUI_VERSION,
        to: clientVersion,
      });
      schema = migrateSchema(schema, clientVersion);
    }

    // Final validation
    const finalValidation = validateSDUISchema(schema);
    if (!finalValidation.success) {
      logger.error("Final schema validation failed", {
        workspaceId,
        errors: finalValidation.errors,
      });
      return res.status(500).json({
        error: "schema_validation_failed",
        message: "Final schema validation failed",
        errors: finalValidation.errors,
      });
    }

    // Set response headers
    res.setHeader("SDUI-Version", schema.version || SDUI_VERSION);
    res.setHeader("SDUI-Server-Version", SDUI_VERSION);
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
    res.setHeader("Vary", "Accept-Version, X-Auto-Migrate, X-Create-Checkpoint");

    // Warn if client is using old version
    if (clientVersion < SDUI_VERSION) {
      res.setHeader(
        "Warning",
        `299 - "Client version ${clientVersion} is older than server version ${SDUI_VERSION}"`
      );
    }

    return res.json(schema);
  } catch (error) {
    logger.error("SDUI schema request failed", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to retrieve SDUI schema",
    });
  }
});

/**
 * Get SDUI schema for a specific agent
 *
 * Returns schema for agent's current state
 */
router.get("/api/sdui/agent/:agentId/schema", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const requestedVersion = parseVersion(req.headers["accept-version"] as string);
    const clientVersion = requestedVersion || SDUI_VERSION;

    logger.info("Agent SDUI schema requested", {
      agentId,
      requestedVersion: clientVersion || "none",
    });

    // Generate schema for agent
    let schema = await generateSchemaForAgent(agentId);

    // Validate schema
    const validation = validateSDUISchema(schema);
    if (!validation.success) {
      logger.error("Invalid agent SDUI schema generated", {
        agentId,
        errors: validation.errors,
      });
      return res.status(500).json({
        error: "schema_generation_failed",
        message: "Failed to generate valid agent SDUI schema",
        errors: validation.errors,
      });
    }

    // Downgrade schema if needed
    if (clientVersion < SDUI_VERSION) {
      schema = migrateSchema(schema, clientVersion);
    }

    // Set response headers
    res.setHeader("SDUI-Version", schema.version || SDUI_VERSION);
    res.setHeader("Cache-Control", "private, max-age=60"); // 1 minute (agent state changes frequently)
    res.setHeader("Vary", "Accept-Version");

    return res.json(schema);
  } catch (error) {
    logger.error("Agent SDUI schema request failed", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to retrieve agent SDUI schema",
    });
  }
});

/**
 * Get supported SDUI versions
 *
 * Returns list of supported schema versions and their features
 */
router.get("/api/sdui/versions", (_req: Request, res: Response) => {
  return res.json({
    current: SDUI_VERSION,
    supported: [1, 2],
    deprecated: [],
    features: {
      1: {
        components: ["InfoBanner", "DiscoveryCard", "ValueTreeCard"],
        actions: ["mutate_component", "add_component", "remove_component"],
        dataBinding: false,
      },
      2: {
        components: [
          "InfoBanner",
          "DiscoveryCard",
          "ValueTreeCard",
          "MetricBadge",
          "KPIForm",
          "DataTable",
        ],
        actions: [
          "mutate_component",
          "add_component",
          "remove_component",
          "reorder_components",
          "update_layout",
          "batch",
        ],
        dataBinding: true,
        realtime: true,
      },
    },
  });
});

/**
 * Validate SDUI schema
 *
 * Allows clients to validate schemas before rendering
 */
router.post("/api/sdui/validate", (req: Request, res: Response) => {
  try {
    const schema = req.body;
    const validation = validateSDUISchema(schema);

    if (validation.success) {
      return res.json({
        valid: true,
        warnings: validation.warnings || [],
      });
    } else {
      return res.status(400).json({
        valid: false,
        errors: validation.errors,
      });
    }
  } catch (error) {
    logger.error("Schema validation failed", { error });
    return res.status(500).json({
      error: "validation_error",
      message: "Failed to validate schema",
    });
  }
});

/**
 * Get migration checkpoints
 *
 * Returns available rollback checkpoints for migration management
 */
router.get("/api/sdui/migrations/checkpoints", (_req: Request, res: Response) => {
  try {
    const checkpoints = migrationRunner.getCheckpoints();

    logger.info("Migration checkpoints requested", {
      count: checkpoints.length,
    });

    return res.json({
      checkpoints: checkpoints.map((cp) => ({
        id: cp.id,
        timestamp: cp.timestamp,
        fromVersion: cp.fromVersion,
        toVersion: cp.toVersion,
        originalHash: cp.originalHash,
        appliedMigrations: cp.appliedMigrations,
        metadata: cp.metadata,
      })),
    });
  } catch (error) {
    logger.error("Failed to get migration checkpoints", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to retrieve migration checkpoints",
    });
  }
});

/**
 * Rollback to a specific checkpoint
 *
 * Performs rollback to a previous migration checkpoint
 */
router.post("/api/sdui/migrations/rollback/:checkpointId", async (req: Request, res: Response) => {
  try {
    const { checkpointId } = req.params;

    logger.info("Migration rollback requested", { checkpointId: checkpointId || "" });

    const result = await migrationRunner.rollback(checkpointId);

    if (result.success) {
      return res.json({
        success: true,
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        duration: result.duration,
        appliedMigrations: result.appliedMigrations,
        warnings: result.warnings,
      });
    } else {
      return res.status(500).json({
        error: "rollback_failed",
        message: "Rollback operation failed",
        errors: result.errors,
      });
    }
  } catch (error) {
    logger.error("Migration rollback failed", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to perform rollback",
    });
  }
});

/**
 * Generate schema diff
 *
 * Compares two schemas and shows differences
 */
router.post("/api/sdui/migrations/diff", (req: Request, res: Response) => {
  try {
    const { original, updated } = req.body;

    if (!original || !updated) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Both original and updated schemas are required",
      });
    }

    const diff = migrationRunner.generateDiff(original || {}, updated || {});

    logger.info("Schema diff generated", {
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      breaking: diff.breaking,
    });

    return res.json(diff);
  } catch (error) {
    logger.error("Schema diff generation failed", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to generate schema diff",
    });
  }
});

/**
 * Get available migrations
 *
 * Returns list of available schema migrations with metadata
 */
router.get("/api/sdui/migrations/available", (_req: Request, res: Response) => {
  try {
    // Placeholder implementation - method doesn't exist yet
    const availableMigrations: any[] = [];

    return res.json({
      migrations: availableMigrations.map((migration: any) => ({
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        description: migration.description,
        estimatedTimeMs: migration.estimatedTimeMs,
        breakingChanges: migration.breakingChanges,
        hasRollback: !!migration.rollback,
      })),
    });
  } catch (error) {
    logger.error("Failed to get available migrations", { error });
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to retrieve available migrations",
    });
  }
});

export default router;
