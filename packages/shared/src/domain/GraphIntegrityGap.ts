/**
 * GraphIntegrityGap — Value Graph integrity check result.
 *
 * Emitted by IntegrityAgent when a hypothesis_claims_value_driver edge has no
 * corresponding evidence_supports_metric edge on the same target entity.
 *
 * Graph position: hypothesis_claims_value_driver edge → (missing) evidence_supports_metric
 *
 * Sprint 48: Initial definition. Read-only; IntegrityAgent detects gaps but
 * does not write remediation edges.
 */

export interface GraphIntegrityGap {
  /** ID of the hypothesis_claims_value_driver edge that lacks evidence support. */
  hypothesis_claims_edge_id: string;
  /** Entity ID of the hypothesis (from_entity_id on the claims edge). */
  from_entity_id: string;
  /** Entity ID of the target node that has no evidence_supports_metric edge. */
  to_entity_id: string;
  /** Type of gap detected. */
  gap_type: 'missing_evidence_support';
}
