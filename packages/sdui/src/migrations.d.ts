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
import { SDUIPageDefinition } from "./schema";
/**
 * Schema migration interface
 */
export interface SchemaMigration {
    fromVersion: number;
    toVersion: number;
    description: string;
    migrate: (_schema: SDUIPageDefinition) => SDUIPageDefinition;
    rollback?: (_schema: SDUIPageDefinition) => SDUIPageDefinition;
    estimatedTimeMs?: number;
    breakingChanges?: boolean;
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
 * Migrate schema to target version
 *
 * Applies migrations sequentially from current version to target version
 */
export declare function migrateSchema(schema: SDUIPageDefinition, targetVersion: number): SDUIPageDefinition;
/**
 * Automated Migration Runner
 *
 * Provides comprehensive migration execution with validation, rollback, and checkpointing
 */
export declare class MigrationRunner {
    private checkpoints;
    private maxCheckpoints;
    /**
     * Run migration with full validation and checkpointing
     */
    runMigration(schema: SDUIPageDefinition, targetVersion: number, options?: {
        createCheckpoint?: boolean;
        validateAfter?: boolean;
        dryRun?: boolean;
    }): Promise<MigrationResult>;
    /**
     * Rollback to a previous checkpoint
     */
    rollback(checkpointId: string): Promise<MigrationResult>;
    /**
     * Create a migration checkpoint
     */
    createCheckpoint(schema: SDUIPageDefinition, fromVersion: number, toVersion: number, metadata?: Record<string, any>): MigrationCheckpoint;
    /**
     * Get all available checkpoints
     */
    getCheckpoints(): MigrationCheckpoint[];
    /**
     * Calculate schema hash for integrity checking
     */
    private calculateSchemaHash;
    /**
     * Generate unique checkpoint ID
     */
    private generateCheckpointId;
    /**
     * Generate schema diff
     */
    generateDiff(original: SDUIPageDefinition, updated: SDUIPageDefinition): SchemaDiff;
}
export declare const migrationRunner: MigrationRunner;
/**
 * Get available migrations
 */
export declare function getAvailableMigrations(): SchemaMigration[];
/**
 * Check if migration is available
 */
export declare function canMigrate(fromVersion: number, toVersion: number): boolean;
/**
 * Get migration path
 */
export declare function getMigrationPath(fromVersion: number, toVersion: number): SchemaMigration[];
/**
 * Validate migrated schema
 *
 * Ensures migration didn't break schema structure
 */
export declare function validateMigration(original: SDUIPageDefinition, migrated: SDUIPageDefinition): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=migrations.d.ts.map