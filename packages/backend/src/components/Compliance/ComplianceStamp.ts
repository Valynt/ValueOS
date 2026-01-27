// packages/backend/src/components/Compliance/ComplianceStamp.ts
export interface ComplianceStampProps {
  compliant: boolean;
  standards: string[];
}

export class ComplianceStamp {
  constructor(public props: ComplianceStampProps) {}
}
