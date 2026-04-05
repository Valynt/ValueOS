import type { JsonObject } from "./json";

/**
 * Structural Data Types
 */

export interface StructuralElement {
  id: string;
  type: string;
  properties: JsonObject;
  relationships: Relationship[];
}

export interface Relationship {
  type: string;
  target_id: string;
  properties?: JsonObject;
}

export const EXTENDED_STRUCTURAL_PERSONA_MAPS: Record<string, Record<string, unknown>> = {};

// typed-debt-boundary-migration: structural-data.ts migrated generic contract bags from any→JsonObject; owner=@backend-platform, remaining debt=validate relationship/property key catalogs.
