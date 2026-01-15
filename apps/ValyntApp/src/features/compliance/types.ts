export type ComplianceFramework = "soc2" | "gdpr" | "hipaa" | "pci" | "iso27001";
export type ComplianceStatus = "compliant" | "non_compliant" | "partial" | "not_applicable";

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  evidence?: ComplianceEvidence[];
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

export interface ComplianceEvidence {
  id: string;
  type: "document" | "screenshot" | "log" | "attestation";
  title: string;
  url?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: string;
  status: ComplianceStatus;
  totalControls: number;
  compliantControls: number;
  createdAt: string;
}

export interface ComplianceGap {
  controlId: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  remediation: string;
  dueDate?: string;
}
