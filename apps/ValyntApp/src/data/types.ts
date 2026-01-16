// /workspaces/ValueOS/src/data/types.ts
export type Role = "admin" | "revops" | "field";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  closeDate: string;
  contacts: string[];
}

export interface Stakeholder {
  id: string;
  dealId: string;
  name: string;
  role: string;
  influence: number;
  priorities: string[];
}

export interface ValueDriver {
  id: string;
  name: string;
  type: string;
  personaTags: string[];
  motionTags: string[];
  formula: string;
  defaultAssumptions: Record<string, number>;
  narrativePitch: string;
  status: "draft" | "published" | "archived";
  version: number;
}

export interface Benchmark {
  id: string;
  industry: string;
  metric: string;
  baselineMin: number;
  baselineMax: number;
  source: string;
  confidence: number;
}

export interface Hypothesis {
  id: string;
  dealId: string;
  driverId: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}

export interface ROIModel {
  id: string;
  dealId: string;
  components: {
    revenueUplift: number;
    costSavings: number;
    riskReduction: number;
  };
  paybackMonths: number;
  scenarios: { name: string; multiplier: number }[];
}

export interface Artifact {
  id: string;
  dealId: string;
  type: "exec-summary" | "one-page" | "qbr-report";
  content: string;
}

export interface ValueRealization {
  id: string;
  dealId: string;
  committed: Record<string, number>;
  actual: Record<string, number>;
  variance: Record<string, number>;
  rootCause: string;
  actions: string[];
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  before: any;
  after: any;
}
