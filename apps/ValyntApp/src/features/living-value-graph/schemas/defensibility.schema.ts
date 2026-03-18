/**
 * Defensibility Schemas - Zod validation for defensibility types
 */

import { z } from 'zod';

export const DefensibilityScoreSchema = z.object({
  global: z.number().min(0).max(1),
  breakdown: z.object({
    backedByEvidence: z.number(),
    totalValue: z.number(),
    coveragePercent: z.number(),
  }),
  threshold: z.number().default(0.7),
  isBlocking: z.boolean(),
});

export const DefensibilityIssueSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  type: z.enum(['evidence_gap', 'stale_citation', 'low_confidence', 'missing_attribution']),
  severity: z.enum(['warning', 'critical']),
  valueAtRisk: z.number(),
  suggestedAction: z.string(),
});

export const DefensibilityWarningSchema = z.object({
  type: z.enum(['low_coverage', 'single_source', 'stale_evidence', 'missing_attribution']),
  severity: z.enum(['warning', 'critical']),
  message: z.string(),
  remediation: z.string().optional(),
});

export const NodeDefensibilitySchema = z.object({
  nodeId: z.string(),
  evidenceCoverage: z.number().min(0).max(1),
  sourceIndependence: z.number(),
  auditTrailComplete: z.boolean(),
  valueContribution: z.number(),
  threshold: z.number().default(0.8),
  warnings: z.array(DefensibilityWarningSchema),
});

export const DefensibilityCheckSchema = z.object({
  rule: z.enum(['min_evidence_coverage', 'source_independence', 'freshness', 'attribution']),
  passed: z.boolean(),
  details: z.string().optional(),
});

export type DefensibilityScore = z.infer<typeof DefensibilityScoreSchema>;
export type DefensibilityIssue = z.infer<typeof DefensibilityIssueSchema>;
export type DefensibilityWarning = z.infer<typeof DefensibilityWarningSchema>;
export type NodeDefensibility = z.infer<typeof NodeDefensibilitySchema>;
export type DefensibilityCheck = z.infer<typeof DefensibilityCheckSchema>;
