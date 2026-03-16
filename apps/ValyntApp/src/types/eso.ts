// ============================================================================
// Economic Structure Ontology (ESO) — Core Type Definitions
//
// Models causal relationships between business KPIs, industry benchmarks,
// and stakeholder personas for value engineering.
// ============================================================================

export type ESOIndustry = string;
export type IndustryType = string;
export type KPI_ID = string;
export type PersonaType = string;
export type ESOPersona = string;
export type FinancialDriver = string;

// ============================================================================
// KPI Benchmarks
// ============================================================================

export interface ESOBenchmarks {
  p25: number;
  p50: number;
  p75: number;
  worldClass?: number;
  source: string;
}

// ============================================================================
// KPI Node — a single metric in the ontology graph
// ============================================================================

export type ImprovementDirection = 'higher_is_better' | 'lower_is_better' | 'target_range';

export interface ESOKPINode {
  id: KPI_ID;
  name: string;
  description: string;
  unit: string;
  domain: string;
  category: 'saas' | 'financial' | 'operational' | 'customer' | 'workforce' | 'growth';
  improvementDirection: ImprovementDirection;
  dependencies: KPI_ID[];
  benchmarks: ESOBenchmarks;
}

// ============================================================================
// Edge — causal / correlational link between two KPIs
// ============================================================================

export type EdgeRelationship = 'drives' | 'inhibits' | 'correlates' | 'leads';

export interface ESOEdge {
  sourceId: KPI_ID;
  targetId: KPI_ID;
  relationship: EdgeRelationship;
  weight: number;           // 0–1 strength of relationship
  lagMonths?: number;       // time-lag before effect is observable
  description: string;
}

// ============================================================================
// Persona Value Map — links a stakeholder persona to the KPIs they care about
// ============================================================================

export interface ESOPersonaValueMap {
  persona: PersonaType;
  title: string;
  primaryPain: string;
  financialDriver: FinancialDriver;
  keyKPIs: KPI_ID[];
  communicationPreference: 'quantitative' | 'narrative' | 'visual' | 'executive_summary';
}

// Re-export checkBenchmarkAlignment from its own module to avoid
// a circular import between eso.ts and eso-data.ts.
export { checkBenchmarkAlignment } from './eso-checks';
export type { BenchmarkAlignmentResult } from './eso-checks';
