/**
 * Defensibility Types - CFO-defensibility metrics and tracking
 */

export interface DefensibilityScore {
  global: number;
  breakdown: {
    backedByEvidence: number;
    totalValue: number;
    coveragePercent: number;
  };
  threshold: number;
  isBlocking: boolean;
}

export interface DefensibilityIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  type: 'evidence_gap' | 'stale_citation' | 'low_confidence' | 'missing_attribution';
  severity: 'warning' | 'critical';
  valueAtRisk: number;
  suggestedAction: string;
}

export interface DefensibilityWarning {
  type: 'low_coverage' | 'single_source' | 'stale_evidence' | 'missing_attribution';
  severity: 'warning' | 'critical';
  message: string;
  remediation?: string;
}

export interface NodeDefensibility {
  nodeId: string;
  evidenceCoverage: number;
  sourceIndependence: number;
  auditTrailComplete: boolean;
  valueContribution: number;
  threshold: number;
  warnings: DefensibilityWarning[];
}

export interface DefensibilityCheck {
  rule: 'min_evidence_coverage' | 'source_independence' | 'freshness' | 'attribution';
  passed: boolean;
  details?: string;
}
