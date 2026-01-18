/**
 * Value Driver Types
 * 
 * Strategic value drivers managed by admins, used by sellers in value cases.
 */

export type ValueDriverType = 
  | "cost-savings"
  | "revenue-lift"
  | "productivity-gain"
  | "risk-mitigation";

export type PersonaTag = 
  | "cro"
  | "cmo"
  | "cfo"
  | "cto"
  | "vp-sales"
  | "se-director"
  | "cs-leader"
  | "procurement";

export type SalesMotionTag = 
  | "new-logo"
  | "renewal"
  | "expansion"
  | "land-expand"
  | "competitive-displacement";

export type DriverStatus = "draft" | "published" | "archived";

export interface FormulaVariable {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
  unit: string;
  description?: string;
}

export interface ValueDriverFormula {
  expression: string;
  variables: FormulaVariable[];
  resultUnit: "currency" | "percentage" | "hours" | "count";
}

export interface ValueDriver {
  id: string;
  name: string;
  description: string;
  type: ValueDriverType;
  personaTags: PersonaTag[];
  salesMotionTags: SalesMotionTag[];
  formula: ValueDriverFormula;
  narrativePitch: string;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  usageCount: number;
  winRateCorrelation?: number;
}

export const VALUE_DRIVER_TYPE_LABELS: Record<ValueDriverType, string> = {
  "cost-savings": "Cost Savings",
  "revenue-lift": "Revenue Lift",
  "productivity-gain": "Productivity Gain",
  "risk-mitigation": "Risk Mitigation",
};

export const PERSONA_TAG_LABELS: Record<PersonaTag, string> = {
  "cro": "CRO",
  "cmo": "CMO",
  "cfo": "CFO",
  "cto": "CTO",
  "vp-sales": "VP Sales",
  "se-director": "SE Director",
  "cs-leader": "CS Leader",
  "procurement": "Procurement",
};

export const SALES_MOTION_LABELS: Record<SalesMotionTag, string> = {
  "new-logo": "New Logo",
  "renewal": "Renewal",
  "expansion": "Expansion",
  "land-expand": "Land & Expand",
  "competitive-displacement": "Competitive Displacement",
};

export const MOCK_VALUE_DRIVERS: ValueDriver[] = [
  {
    id: "vd-1",
    name: "Demo Prep Time Reduction",
    description: "Reduce time spent preparing for product demonstrations",
    type: "productivity-gain",
    personaTags: ["se-director", "vp-sales"],
    salesMotionTags: ["new-logo", "expansion"],
    formula: {
      expression: "demosPerMonth * timeSavedPerDemo * hourlyRate * 12",
      variables: [
        { id: "demosPerMonth", name: "demosPerMonth", label: "Demos per month", defaultValue: 20, unit: "demos" },
        { id: "timeSavedPerDemo", name: "timeSavedPerDemo", label: "Time saved per demo", defaultValue: 1.5, unit: "hours" },
        { id: "hourlyRate", name: "hourlyRate", label: "SE hourly rate", defaultValue: 80, unit: "$/hour" },
      ],
      resultUnit: "currency",
    },
    narrativePitch: "We cut demo prep time in half—freeing SEs to run more demos or focus on complex use cases.",
    status: "published",
    createdAt: "2025-11-15T10:00:00Z",
    updatedAt: "2026-01-10T14:30:00Z",
    createdBy: "admin@acme.com",
    version: 3,
    usageCount: 47,
    winRateCorrelation: 0.72,
  },
  {
    id: "vd-2",
    name: "Sales Cycle Acceleration",
    description: "Shorten deal cycles with better value articulation",
    type: "revenue-lift",
    personaTags: ["cro", "vp-sales"],
    salesMotionTags: ["new-logo", "competitive-displacement"],
    formula: {
      expression: "(avgDealSize * dealsPerQuarter * 4) * (cycleDaysReduced / avgCycleDays)",
      variables: [
        { id: "avgDealSize", name: "avgDealSize", label: "Average deal size", defaultValue: 150000, unit: "$" },
        { id: "dealsPerQuarter", name: "dealsPerQuarter", label: "Deals per quarter", defaultValue: 12, unit: "deals" },
        { id: "cycleDaysReduced", name: "cycleDaysReduced", label: "Days reduced", defaultValue: 14, unit: "days" },
        { id: "avgCycleDays", name: "avgCycleDays", label: "Average cycle length", defaultValue: 90, unit: "days" },
      ],
      resultUnit: "currency",
    },
    narrativePitch: "Close deals 15% faster by leading with quantified business impact from day one.",
    status: "published",
    createdAt: "2025-10-20T09:00:00Z",
    updatedAt: "2026-01-05T11:00:00Z",
    createdBy: "admin@acme.com",
    version: 2,
    usageCount: 89,
    winRateCorrelation: 0.81,
  },
  {
    id: "vd-3",
    name: "Renewal Risk Reduction",
    description: "Reduce churn by demonstrating ongoing value realization",
    type: "risk-mitigation",
    personaTags: ["cs-leader", "cfo"],
    salesMotionTags: ["renewal"],
    formula: {
      expression: "annualContractValue * churnRateReduction",
      variables: [
        { id: "annualContractValue", name: "annualContractValue", label: "Annual contract value", defaultValue: 500000, unit: "$" },
        { id: "churnRateReduction", name: "churnRateReduction", label: "Churn rate reduction", defaultValue: 0.05, unit: "%" },
      ],
      resultUnit: "currency",
    },
    narrativePitch: "Customers who track value realization renew at 95%+ rates—we make that tracking effortless.",
    status: "published",
    createdAt: "2025-12-01T08:00:00Z",
    updatedAt: "2026-01-08T16:00:00Z",
    createdBy: "admin@acme.com",
    version: 1,
    usageCount: 34,
    winRateCorrelation: 0.68,
  },
  {
    id: "vd-4",
    name: "Marketing Attribution Clarity",
    description: "Improve marketing ROI visibility and budget allocation",
    type: "cost-savings",
    personaTags: ["cmo", "cfo"],
    salesMotionTags: ["new-logo", "land-expand"],
    formula: {
      expression: "marketingBudget * wastedSpendPercent",
      variables: [
        { id: "marketingBudget", name: "marketingBudget", label: "Annual marketing budget", defaultValue: 2000000, unit: "$" },
        { id: "wastedSpendPercent", name: "wastedSpendPercent", label: "Wasted spend reduction", defaultValue: 0.12, unit: "%" },
      ],
      resultUnit: "currency",
    },
    narrativePitch: "Stop wasting 12% of your marketing budget on channels that don't convert.",
    status: "draft",
    createdAt: "2026-01-12T10:00:00Z",
    updatedAt: "2026-01-12T10:00:00Z",
    createdBy: "admin@acme.com",
    version: 1,
    usageCount: 0,
  },
  {
    id: "vd-5",
    name: "Compliance Audit Efficiency",
    description: "Reduce time and cost of compliance audits",
    type: "cost-savings",
    personaTags: ["cfo", "procurement"],
    salesMotionTags: ["renewal", "expansion"],
    formula: {
      expression: "auditsPerYear * hoursPerAudit * auditTeamRate * efficiencyGain",
      variables: [
        { id: "auditsPerYear", name: "auditsPerYear", label: "Audits per year", defaultValue: 4, unit: "audits" },
        { id: "hoursPerAudit", name: "hoursPerAudit", label: "Hours per audit", defaultValue: 120, unit: "hours" },
        { id: "auditTeamRate", name: "auditTeamRate", label: "Team hourly rate", defaultValue: 150, unit: "$/hour" },
        { id: "efficiencyGain", name: "efficiencyGain", label: "Efficiency gain", defaultValue: 0.40, unit: "%" },
      ],
      resultUnit: "currency",
    },
    narrativePitch: "Cut audit prep time by 40% with automated evidence collection and reporting.",
    status: "archived",
    createdAt: "2025-06-15T09:00:00Z",
    updatedAt: "2025-12-01T10:00:00Z",
    createdBy: "admin@acme.com",
    version: 4,
    usageCount: 12,
    winRateCorrelation: 0.55,
  },
];
