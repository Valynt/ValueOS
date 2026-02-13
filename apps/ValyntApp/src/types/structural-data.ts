/**
 * Structural Data Types
 */

import type { StructuralKPINode, StructuralEdge, FormulaRegistry, StructuralPersona } from "./structural-truth";

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

export const ALL_STRUCTURAL_KPIS: StructuralKPINode[] = [];

export const EXTENDED_STRUCTURAL_EDGES: StructuralEdge[] = [];

export const INITIAL_FORMULA_REGISTRY: FormulaRegistry[] = [];

export const EXTENDED_STRUCTURAL_PERSONA_MAPS: Record<string, StructuralPersona[]> = {};
