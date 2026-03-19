// packages/backend/src/components/Compliance/ComplianceStamp.ts
export interface ComplianceStampProps {
  compliant: boolean;
  standards: string[];
}

export class ComplianceStamp {
  constructor(public props: ComplianceStampProps) {}
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category?: string;
  check: (data: unknown) => boolean | Promise<boolean>;
  [key: string]: unknown;
}

export interface ComplianceMetadata {
  passed: boolean;
  rules_checked: number;
  violations: Array<{ ruleId: string; message: string; severity: string }>;
  checked_at: string;
  reportId?: string;
  [key: string]: unknown;
}
