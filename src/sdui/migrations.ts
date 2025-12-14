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

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from './schema';

/**
 * Schema migration interface
 */
export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (_schema: SDUIPageDefinition) => SDUIPageDefinition;
}

/**
 * Registry of all schema migrations
 */
const migrations: SchemaMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    description: 'Add data binding support and new components',
    migrate: migrateV1ToV2
  }
];

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
    logger.warn('Schema downgrade requested but not supported', {
      currentVersion,
      targetVersion
    });
    // Return schema with clamped version
    return {
      ...schema,
      version: targetVersion
    };
  }

  // Apply migrations sequentially
  let migratedSchema = { ...schema };
  for (let v = currentVersion; v < targetVersion; v++) {
    const migration = migrations.find(m => m.fromVersion === v && m.toVersion === v + 1);
    
    if (!migration) {
      logger.error('No migration found', {
        fromVersion: v,
        toVersion: v + 1
      });
      throw new Error(`No migration found from version ${v} to ${v + 1}`);
    }

    logger.info('Applying schema migration', {
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      description: migration.description
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
function migrateV1ToV2(schema: SDUIPageDefinition): SDUIPageDefinition {
  return {
    ...schema,
    version: 2,
    components: schema.components.map(component => {
      // Migrate InfoBanner
      if (component.type === 'InfoBanner') {
        return {
          ...component,
          version: 2,
          props: {
            ...component.props,
            // Rename title to heading
            heading: component.props.title || component.props.heading,
            title: undefined,
            // Add default variant if missing
            variant: component.props.variant || 'info'
          }
        };
      }

      // Migrate DiscoveryCard
      if (component.type === 'DiscoveryCard') {
        return {
          ...component,
          version: 2,
          props: {
            ...component.props,
            // Add default variant if missing
            variant: component.props.variant || 'default'
          }
        };
      }

      // Migrate actions to new format
      if (component.props.actions) {
        return {
          ...component,
          version: 2,
          props: {
            ...component.props,
            actions: component.props.actions.map((action: Record<string, unknown>) => {
              // Old format: { type: 'click', handler: 'doSomething' }
              // New format: { type: 'EXECUTE_TOOL', tool_id: 'doSomething' }
              if (action.handler) {
                return {
                  type: 'EXECUTE_TOOL',
                  tool_id: action.handler,
                  params: action.params || {},
                  optimistic: false
                };
              }
              return action;
            })
          }
        };
      }

      // Default: just update version
      return {
        ...component,
        version: 2
      };
    })
  };
}

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
    const migration = migrations.find(m => m.fromVersion === v && m.toVersion === v + 1);
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
    const migration = migrations.find(m => m.fromVersion === v && m.toVersion === v + 1);
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
    errors.push('Version was not updated');
  }

  // Check components still exist
  if (!migrated.components || migrated.components.length === 0) {
    errors.push('Components were lost during migration');
  }

  // Check component count matches
  if (migrated.components.length !== original.components.length) {
    errors.push(`Component count mismatch: ${original.components.length} → ${migrated.components.length}`);
  }

  // Check component IDs are preserved
  const originalIds = new Set(original.components.map(c => c.id));
  const migratedIds = new Set(migrated.components.map(c => c.id));
  
  for (const id of originalIds) {
    if (!migratedIds.has(id)) {
      errors.push(`Component ID lost during migration: ${id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
