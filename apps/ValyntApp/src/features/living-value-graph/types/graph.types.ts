/**
 * Graph Types - Core data structures for the Living Value Graph
 */

export interface ValueNode {
  id: string;
  type: 'driver' | 'metric' | 'input' | 'output' | 'assumption';
  label: string;
  value?: number;
  unit?: string;
  formula?: string;
  confidence?: number;
  evidence?: Evidence[];
  inputs?: string[]; // References to input node IDs
  outputs?: string[]; // References to output node IDs
  metadata?: {
    description?: string;
    owner?: string;
    lastModified?: string;
    version?: number;
    locked?: boolean;
  };
}

export interface ValueEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'calculation' | 'input';
  formula?: string;
}

export interface Evidence {
  id: string;
  type: '10-K' | '10-Q' | 'benchmark' | 'crm' | 'erp' | 'internal';
  source: string;
  title: string;
  location?: string; // Page, section, URL
  value?: number;
  confidence: number;
  date: string;
  isStale?: boolean;
  hasAttribution?: boolean;
  weight?: number;
}

export interface Graph {
  id: string;
  versionId: string | null;
  scenarioId: string;
  nodes: Record<string, ValueNode>;
  edges: Record<string, ValueEdge>;
  computedAt: string | null;
  globalMetrics: {
    npv: number;
    roi: number;
    paybackMonths: number;
    confidence: number;
    defensibilityScore: number;
  };
  evidenceCoverage: number;
}

export interface Scenario {
  id: string;
  name: string;
  type: 'baseline' | 'conservative' | 'expected' | 'upside' | 'custom';
  description?: string;
  parentId?: string;
  isActive: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  filters: {
    nodeTypes: string[];
    minConfidence: number | null;
    showLockedOnly: boolean;
    showEvidenceGapsOnly: boolean;
  };
  canvas: {
    zoom: number;
    panX: number;
    panY: number;
  };
}

export interface Artifact {
  id: string;
  type: 'executive_summary' | 'deck' | 'business_case' | 'approval_packet';
  name: string;
  generatedAt: string;
  derivedFrom: string;
  downloadUrl: string;
  isStale: boolean;
}

export interface OpportunitySummary {
  id: string;
  name: string;
  description: string;
  arr?: number;
  customerName?: string;
  createdAt: string;
}
