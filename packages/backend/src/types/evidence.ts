export const EVIDENCE_TIER = {
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
} as const;

export type EvidenceTierLabel = 'silver' | 'gold' | 'platinum';
export type EvidenceTierNumeric = typeof EVIDENCE_TIER[keyof typeof EVIDENCE_TIER];

export const EVIDENCE_TIER_LABEL_TO_NUMERIC: Record<EvidenceTierLabel, EvidenceTierNumeric> = {
  silver: EVIDENCE_TIER.SILVER,
  gold: EVIDENCE_TIER.GOLD,
  platinum: EVIDENCE_TIER.PLATINUM,
};

export const EVIDENCE_TIER_NUMERIC_TO_LABEL: Record<EvidenceTierNumeric, EvidenceTierLabel> = {
  1: 'silver',
  2: 'gold',
  3: 'platinum',
};

export type SourceProvenance =
  | 'crm'
  | 'erp'
  | 'agent_inference'
  | 'user'
  | 'benchmark'
  | 'system';

export function evidenceTierToLabel(tier: EvidenceTierNumeric): EvidenceTierLabel {
  return EVIDENCE_TIER_NUMERIC_TO_LABEL[tier];
}

export function evidenceTierToNumeric(tier: EvidenceTierLabel): EvidenceTierNumeric {
  return EVIDENCE_TIER_LABEL_TO_NUMERIC[tier];
}
