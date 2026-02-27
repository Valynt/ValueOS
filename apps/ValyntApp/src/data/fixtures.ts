// /workspaces/ValueOS/src/data/fixtures.ts
import {
  Artifact,
  AuditEvent,
  Benchmark,
  Deal,
  Hypothesis,
  ROIModel,
  Stakeholder,
  User,
  ValueDriver,
  ValueRealization,
} from "./types";

export const users: User[] = [
  { id: "1", name: "Admin User", email: "admin@valueos.com", role: "admin" },
  { id: "2", name: "RevOps User", email: "revops@valueos.com", role: "revops" },
  { id: "3", name: "Field User", email: "field@valueos.com", role: "field" },
];

export const deals: Deal[] = [
  {
    id: "1",
    name: "Deal A",
    stage: "discovery",
    amount: 100000,
    closeDate: "2024-12-01",
    contacts: ["contact1"],
  },
  {
    id: "2",
    name: "Deal B",
    stage: "negotiation",
    amount: 200000,
    closeDate: "2024-11-15",
    contacts: ["contact2"],
  },
  // Add more up to 10
];

export const stakeholders: Stakeholder[] = [
  {
    id: "1",
    dealId: "1",
    name: "CEO",
    role: "decision-maker",
    influence: 9,
    priorities: ["revenue", "efficiency"],
  },
  // More
];

export const valueDrivers: ValueDriver[] = [
  {
    id: "1",
    name: "Revenue Accelerator",
    type: "revenue",
    personaTags: ["CEO", "CFO"],
    motionTags: ["expansion"],
    formula: "baseline * uplift",
    defaultAssumptions: { baseline: 1000000, uplift: 0.2 },
    narrativePitch: "Accelerate revenue growth",
    status: "published",
    version: 1,
  },
  // Add 24 more
];

export const benchmarks: Benchmark[] = [
  {
    id: "1",
    industry: "SaaS",
    metric: "revenue uplift",
    baselineMin: 0.1,
    baselineMax: 0.3,
    source: "Gartner",
    confidence: 0.8,
  },
  // Add 29 more
];

export const hypotheses: Hypothesis[] = [
  {
    id: "1",
    dealId: "1",
    driverId: "1",
    inputs: { baseline: 1000000, uplift: 0.2 },
    outputs: { output: 200000 },
  },
];

export const roiModels: ROIModel[] = [
  {
    id: "1",
    dealId: "1",
    components: { revenueUplift: 200000, costSavings: 50000, riskReduction: 10000 },
    paybackMonths: 12,
    scenarios: [{ name: "Conservative", multiplier: 0.8 }],
  },
];

export const artifacts: Artifact[] = [
  { id: "1", dealId: "1", type: "exec-summary", content: "Executive summary content..." },
];

export const valueRealizations: ValueRealization[] = [
  {
    id: "1",
    dealId: "1",
    committed: { revenue: 200000 },
    actual: { revenue: 180000 },
    variance: { revenue: -20000 },
    rootCause: "Delayed implementation",
    actions: ["Follow up"],
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "1",
    userId: "1",
    action: "created",
    entity: "deal",
    entityId: "1",
    timestamp: "2024-01-01T00:00:00.000Z",
    before: null,
    after: deals[0],
  },
];
