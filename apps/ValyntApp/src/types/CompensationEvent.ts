// CompensationEvent type for ValueCase audit trail
export interface CompensationEvent {
  timestamp: string;
  reason: string;
  details: string;
  confidenceAdjustment?: number;
  previousFormulaSnapshotId?: string;
  triggeredBy: string; // e.g., 'IntegrityAgent', 'CircuitBreaker', etc.
  emergency?: boolean;
}
