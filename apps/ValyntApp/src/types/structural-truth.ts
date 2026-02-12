// Structural truth type definitions for KPI graph modeling

export interface StructuralKPINode {
  id: string;
  name: string;
  category: string;
  unit: string;
  formula?: string;
  benchmark?: number;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface StructuralEdge {
  source: string;
  target: string;
  weight?: number;
  relationship?: string;
}

export interface FormulaRegistry {
  id: string;
  name: string;
  formula: string;
  inputs: string[];
  input_kpis?: string[];
  output: string;
  output_kpi?: string;
  description?: string;
  category?: string;
}

export interface StructuralGraph {
  nodes: StructuralKPINode[];
  edges: StructuralEdge[];
}

export interface StructuralPersona {
  id: string;
  name: string;
  role: string;
  priorities: string[];
}

export interface StructuralIndustry {
  id: string;
  name: string;
  benchmarks: Record<string, number>;
}

export type ImprovementDirection = "increase" | "decrease" | "maintain";

export interface FormulaResult {
  value: number;
  steps: FormulaStep[];
  confidence: number;
}

export interface FormulaStep {
  input: string;
  value: number;
  operation: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function checkBenchmarkAlignment(
  _actual: number,
  _benchmark: number,
  _tolerance?: number,
): boolean {
  return true;
}
