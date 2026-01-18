/**
 * SDUI Schema Migrations
 *
 * P1 GAP FIX: Provides utilities to migrate schemas between versions
 *
 * Implements:
 * - Schema migration interface
 * - Migration runner
 * - v1 → v2 migration
 * - Backward compatibility
 */

import logger from "../../shared/src/lib/logger.js";
import { SDUIPageDefinition, SDUI_VERSION } from "./schema";
import { validateSDUISchema } from "./schema";
import { createHash } from "crypto";

/**
 * Schema migration interface
 */
export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (_schema: SDUIPageDefinition) => SDUIPageDefinition;
  rollback?: (_schema: SDUIPageDefinition) => SDUIPageDefinition; // Optional rollback function
  estimatedTimeMs?: number; // Estimated migration time
  breakingChanges?: boolean; // Whether this migration has breaking changes
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  appliedMigrations: string[];
  duration: number;
  errors?: string[];
  warnings?: string[];
  rollbackAvailable: boolean;
  schemaHash?: string;
}

/**
 * Schema diff result
 */
export interface SchemaDiff {
  added: string[];
  removed: string[];
  modified: string[];
  breaking: boolean;
  summary: string;
}

/**
 * Migration checkpoint for rollback
 */
export interface MigrationCheckpoint {
  id: string;
  timestamp: number;
  fromVersion: number;
  toVersion: number;
  originalSchema: SDUIPageDefinition;
  originalHash: string;
  appliedMigrations: string[];
  metadata?: Record<string, any>;
}

/**
 * Registry of all schema migrations
 */
const migrations: SchemaMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    description: "Add data binding support and new components",
    estimatedTimeMs: 100,
    breakingChanges: false,
    migrate: migrateV1ToV2,
    rollback: rollbackV2ToV1,
  },
];

/**
 * Migrate schema from v1 to v2
 *
 * Changes:
 * - Add data binding support
 * - Rename 'title' prop to 'heading' in InfoBanner
 * - Add 'variant' prop to components
 * - Convert old action format to new format
 */
function migrateV1ToV2(schema: SDUIPageDefinition): SDUIPageDefinition {
  return {
    ...schema,
    version: 2,
    sections: schema.sections.map((section) => {
      // Migrate InfoBanner
      if (section.type === "component" && section.component === "InfoBanner") {
        return {
          ...section,
          version: 2,
          props: {
            ...section.props,
            // Rename title to heading
            heading: section.props.title || section.props.heading,
            title: undefined,
            // Add default variant if missing
            variant: section.props.variant || "info",
          },
        };
      }

      // Migrate DiscoveryCard
      if (section.type === "component" && section.component === "DiscoveryCard") {
        return {
          ...section,
          version: 2,
          props: {
            ...section.props,
            // Add default variant if missing
            variant: section.props.variant || "default",
          },
        };
      }

      // Migrate actions to new format
      if (section.props.actions) {
        return {
          ...section,
          version: 2,
          props: {
            ...section.props,
            actions: section.props.actions.map((action: Record<string, unknown>) => {
              // Old format: { type: 'click', handler: 'doSomething' }
              // New format: { type: 'EXECUTE_TOOL', tool_id: 'doSomething' }
              if (action.handler) {
                return {
                  type: "EXECUTE_TOOL",
                  tool_id: action.handler,
                  params: action.params || {},
                  optimistic: false,
                };
              }
              return action;
            }),
          },
        };
      }

      // Default: just update version
      return {
        ...section,
        version: 2,
      };
    }),
  };
}

/**
 * Rollback schema from v2 to v1
 *
 * Reverses the v1→v2 migration changes
 */
function rollbackV2ToV1(schema: SDUIPageDefinition): SDUIPageDefinition {
  return {
    ...schema,
    version: 1,
    sections: schema.sections.map((section) => {
      // Rollback InfoBanner
      if (section.type === "component" && section.component === "InfoBanner") {
        return {
          ...section,
          version: 1,
          props: {
            ...section.props,
            // Rename heading back to title
            title: section.props.heading || section.props.title,
            heading: undefined,
            // Remove variant prop
            variant: undefined,
          },
        };
      }

      // Rollback DiscoveryCard
      if (section.type === "component" && section.component === "DiscoveryCard") {
        return {
          ...section,
          version: 1,
          props: {
            ...section.props,
            // Remove variant prop
            variant: undefined,
          },
        };
      }

      // Rollback actions to old format
      if (section.props.actions) {
        return {
          ...section,
          version: 1,
          props: {
            ...section.props,
            actions: section.props.actions.map((action: Record<string, unknown>) => {
              // New format: { type: 'EXECUTE_TOOL', tool_id: 'doSomething' }
              // Old format: { type: 'click', handler: 'doSomething' }
              if (action.type === "EXECUTE_TOOL" && action.tool_id) {
                return {
                  type: "click",
                  handler: action.tool_id,
                  params: action.params || {},
                };
              }
              return action;
            }),
          },
        };
      }

      // Default: just update version
      return {
        ...section,
        version: 1,
      };
    }),
  };
}

/**
 * Migrate schema to target version
 *
 * Applies migrations sequentially from current version to target version
 */
export function migrateSchema(
  schema: SDUIPageDefinition,
  targetVersion: number
): SDUIPageDefinition {
  const currentVersion = schema.version || 1;

  // No migration needed
  if (currentVersion === targetVersion) {
    return schema;
  }

  // Downgrade not supported - return as-is with warning
  if (currentVersion > targetVersion) {
    logger.warn("Schema downgrade requested but not supported", {
      currentVersion,
      targetVersion,
    });
    // Return schema with clamped version
    return {
      ...schema,
      version: targetVersion,
    };
  }

  // Apply migrations sequentially
  let migratedSchema = { ...schema };
  for (let v = currentVersion; v < targetVersion; v++) {
    const migration = migrations.find((m) => m.fromVersion === v && m.toVersion === v + 1);

    if (!migration) {
      logger.error("No migration found", {
        fromVersion: v,
        toVersion: v + 1,
      });
      throw new Error(`No migration found from version ${v} to ${v + 1}`);
    }

    logger.info("Applying schema migration", {
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      description: migration.description,
    });

    migratedSchema = migration.migrate(migratedSchema);
    migratedSchema.version = migration.toVersion;
  }

  return migratedSchema;
}

/**
 * Migrate schema from v1 to v2
 *
 * Changes:
 * - Add data binding support
 * - Rename 'title' prop to 'heading' in InfoBanner
 * - Add 'variant' prop to components
 * - Convert old action format to new format
 */
function migrateV1ToV2Duplicate(schema: SDUIPageDefinition): SDUIPageDefinition {
  // This is a duplicate function that needs to be removed
  return schema;
}

/**
 * Automated Migration Runner
 *
 * Provides comprehensive migration execution with validation, rollback, and checkpointing
 */
export class MigrationRunner {
  private checkpoints: Map<string, MigrationCheckpoint> = new Map();
  private maxCheckpoints = 10; // Keep last 10 checkpoints

  /**
   * Run migration with full validation and checkpointing
   */
  async runMigration(
    schema: SDUIPageDefinition,
    targetVersion: number,
    options: {
      createCheckpoint?: boolean;
      validateAfter?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const originalHash = this.calculateSchemaHash(schema);
    const fromVersion = schema.version || 1;

    logger.info("Starting schema migration", {
      fromVersion,
      targetVersion,
      schemaHash: originalHash,
      options,
    });

    const result: MigrationResult = {
      success: false,
      fromVersion,
      toVersion: targetVersion,
      appliedMigrations: [],
      duration: 0,
      rollbackAvailable: false,
    };

    try {
      // Create checkpoint if requested
      let checkpoint: MigrationCheckpoint | undefined;
      if (options.createCheckpoint) {
        checkpoint = this.createCheckpoint(schema, fromVersion, targetVersion);
        result.rollbackAvailable = true;
      }

      // Validate migration path exists
      if (!canMigrate(fromVersion, targetVersion)) {
        throw new Error(`Cannot migrate from version ${fromVersion} to ${targetVersion}`);
      }

      // Get migration path
      const migrationPath = getMigrationPath(fromVersion, targetVersion);
      const estimatedTime = migrationPath.reduce((sum, m) => sum + (m.estimatedTimeMs || 0), 0);

      logger.info("Migration path determined", {
        steps: migrationPath.length,
        estimatedTime: `${estimatedTime}ms`,
        breakingChanges: migrationPath.some((m) => m.breakingChanges),
      });

      // Dry run validation
      if (options.dryRun) {
        logger.info("Dry run mode - no changes will be applied");
        result.success = true;
        result.warnings = ["Dry run mode - no changes applied"];
        return result;
      }

      // Apply migrations sequentially
      let migratedSchema = { ...schema };
      for (const migration of migrationPath) {
        logger.info("Applying migration", {
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          description: migration.description,
        });

        const migrationStart = Date.now();
        migratedSchema = migration.migrate(migratedSchema);
        migratedSchema.version = migration.toVersion;

        const migrationDuration = Date.now() - migrationStart;
        result.appliedMigrations.push(
          `${migration.fromVersion}→${migration.toVersion}: ${migration.description}`
        );

        logger.info("Migration applied", {
          duration: `${migrationDuration}ms`,
          estimated: `${migration.estimatedTimeMs || 0}ms`,
        });

        // Validate after each migration if requested
        if (options.validateAfter) {
          const validation = validateSDUISchema(migratedSchema);
          if (!validation.success) {
            throw new Error(
              `Schema validation failed after migration ${migration.fromVersion}→${migration.toVersion}: ${validation.errors.join(", ")}`
            );
          }
        }
      }

      // Final validation
      const finalValidation = validateSDUISchema(migratedSchema);
      if (!finalValidation.success) {
        throw new Error(`Final schema validation failed: ${finalValidation.errors.join(", ")}`);
      }

      // Calculate final schema hash
      const finalHash = this.calculateSchemaHash(migratedSchema);

      result.success = true;
      result.schemaHash = finalHash;
      result.warnings = finalValidation.warnings;

      logger.info("Migration completed successfully", {
        fromVersion,
        toVersion: targetVersion,
        duration: `${Date.now() - startTime}ms`,
        originalHash,
        finalHash,
        appliedMigrations: result.appliedMigrations.length,
      });

      return result;
    } catch (error) {
      result.errors = [error instanceof Error ? error.message : "Unknown error"];

      logger.error("Migration failed", {
        fromVersion,
        toVersion: targetVersion,
        error: result.errors[0],
        duration: `${Date.now() - startTime}ms`,
      });

      return result;
    } finally {
      result.duration = Date.now() - startTime;
    }
  }

  /**
   * Rollback to a previous checkpoint
   */
  async rollback(checkpointId: string): Promise<MigrationResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    logger.info("Starting rollback", {
      checkpointId,
      fromVersion: checkpoint.toVersion,
      toVersion: checkpoint.fromVersion,
      timestamp: checkpoint.timestamp,
    });

    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      fromVersion: checkpoint.toVersion,
      toVersion: checkpoint.fromVersion,
      appliedMigrations: [],
      duration: 0,
      rollbackAvailable: false,
    };

    try {
      let rolledBackSchema = { ...checkpoint.originalSchema };

      // Apply rollback migrations in reverse order
      for (let i = checkpoint.appliedMigrations.length - 1; i >= 0; i--) {
        const migrationId = checkpoint.appliedMigrations[i];
        if (!migrationId) continue;

        const [from, to] = migrationId.split("→").map(Number);
        const migration = migrations.find((m) => m.fromVersion === from && m.toVersion === to);

        if (migration?.rollback) {
          logger.info("Applying rollback migration", {
            migrationId,
            description: `Rollback: ${migration.description}`,
          });

          rolledBackSchema = migration.rollback(rolledBackSchema);
          rolledBackSchema.version = migration.fromVersion;
          result.appliedMigrations.push(`Rollback: ${migrationId}`);
        }
      }

      // Validate rolled back schema
      const validation = validateSDUISchema(rolledBackSchema);
      if (!validation.success) {
        throw new Error(`Rollback validation failed: ${validation.errors.join(", ")}`);
      }

      result.success = true;
      result.schemaHash = this.calculateSchemaHash(rolledBackSchema);
      result.warnings = validation.warnings;

      logger.info("Rollback completed successfully", {
        checkpointId,
        duration: `${Date.now() - startTime}ms`,
        appliedMigrations: result.appliedMigrations.length,
      });

      return result;
    } catch (error) {
      result.errors = [error instanceof Error ? error.message : "Unknown error"];

      logger.error("Rollback failed", {
        checkpointId,
        error: result.errors[0],
        duration: `${Date.now() - startTime}ms`,
      });

      return result;
    } finally {
      result.duration = Date.now() - startTime;
    }
  }

  /**
   * Create a migration checkpoint
   */
  createCheckpoint(
    schema: SDUIPageDefinition,
    fromVersion: number,
    toVersion: number,
    metadata?: Record<string, any>
  ): MigrationCheckpoint {
    const checkpoint: MigrationCheckpoint = {
      id: this.generateCheckpointId(),
      timestamp: Date.now(),
      fromVersion,
      toVersion,
      originalSchema: JSON.parse(JSON.stringify(schema)), // Deep clone
      originalHash: this.calculateSchemaHash(schema),
      appliedMigrations: [],
      metadata,
    };

    // Store checkpoint (maintain max size)
    this.checkpoints.set(checkpoint.id, checkpoint);
    if (this.checkpoints.size > this.maxCheckpoints) {
      const oldestKey = this.checkpoints.keys().next().value;
      this.checkpoints.delete(oldestKey);
    }

    logger.info("Migration checkpoint created", {
      checkpointId: checkpoint.id,
      fromVersion,
      toVersion,
      schemaHash: checkpoint.originalHash,
    });

    return checkpoint;
  }

  /**
   * Get all available checkpoints
   */
  getCheckpoints(): MigrationCheckpoint[] {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Calculate schema hash for integrity checking
   */
  private calculateSchemaHash(schema: SDUIPageDefinition): string {
    const schemaString = JSON.stringify(schema, Object.keys(schema).sort());
    return createHash("sha256").update(schemaString).digest("hex");
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateCheckpointId(): string {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate schema diff
   */
  generateDiff(original: SDUIPageDefinition, updated: SDUIPageDefinition): SchemaDiff {
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    let breaking = false;

    // Compare sections
    const originalSections = new Set(original.sections.map((s) => `${s.type}:${s.component}`));
    const updatedSections = new Set(updated.sections.map((s) => `${s.type}:${s.component}`));

    for (const section of originalSections) {
      if (!updatedSections.has(section)) {
        removed.push(section);
        breaking = true;
      }
    }

    for (const section of updatedSections) {
      if (!originalSections.has(section)) {
        added.push(section);
      }
    }

    // Check for modified sections
    for (const updatedSection of updated.sections) {
      const originalSection = original.sections.find(
        (s) => s.type === updatedSection.type && s.component === updatedSection.component
      );

      if (originalSection) {
        const originalProps = JSON.stringify(originalSection.props);
        const updatedProps = JSON.stringify(updatedSection.props);

        if (originalProps !== updatedProps) {
          modified.push(`${updatedSection.type}:${updatedSection.component}`);
        }
      }
    }

    const summary = `Schema diff: +${added.length} -${removed.length} ~${modified.length} changes`;

    return {
      added,
      removed,
      modified,
      breaking,
      summary,
    };
  }
}

// Global migration runner instance
export const migrationRunner = new MigrationRunner();

/**
 * Get available migrations
 */
export function getAvailableMigrations(): SchemaMigration[] {
  return migrations;
}

/**
 * Check if migration is available
 */
export function canMigrate(fromVersion: number, toVersion: number): boolean {
  if (fromVersion === toVersion) return true;
  if (fromVersion > toVersion) return false; // Downgrade not supported

  // Check if all migrations exist
  for (let v = fromVersion; v < toVersion; v++) {
    const migration = migrations.find((m) => m.fromVersion === v && m.toVersion === v + 1);
    if (!migration) return false;
  }

  return true;
}

/**
 * Get migration path
 */
export function getMigrationPath(fromVersion: number, toVersion: number): SchemaMigration[] {
  if (fromVersion === toVersion) return [];
  if (fromVersion > toVersion) return []; // Downgrade not supported

  const path: SchemaMigration[] = [];
  for (let v = fromVersion; v < toVersion; v++) {
    const migration = migrations.find((m) => m.fromVersion === v && m.toVersion === v + 1);
    if (migration) {
      path.push(migration);
    }
  }

  return path;
}

/**
 * Validate migrated schema
 *
 * Ensures migration didn't break schema structure
 */
export function validateMigration(
  original: SDUIPageDefinition,
  migrated: SDUIPageDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check version was updated
  if (migrated.version === original.version) {
    errors.push("Version was not updated");
  }

  // Check sections still exist
  if (!migrated.sections || migrated.sections.length === 0) {
    errors.push("Sections were lost during migration");
  }

  // Check section count matches
  if (migrated.sections.length !== original.sections.length) {
    errors.push(
      `Section count mismatch: ${original.sections.length} → ${migrated.sections.length}`
    );
  }

  // Check section types and components are preserved
  const originalSections = new Set(original.sections.map((s) => `${s.type}:${s.component}`));
  const migratedSections = new Set(migrated.sections.map((s) => `${s.type}:${s.component}`));

  for (const section of originalSections) {
    if (!migratedSections.has(section)) {
      errors.push(`Section lost during migration: ${section}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
