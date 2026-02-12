/**
 * Structural Data Types
 */

export interface StructuralElement {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships: Relationship[];
}

export interface Relationship {
  type: string;
  target_id: string;
  properties?: Record<string, any>;
}
