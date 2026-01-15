export type UserRole =
  | "Admin"
  | "Value Engineer"
  | "Customer Success"
  | "Viewer";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
}

export interface DashboardStats {
  activeModels: number;
  pipelines: number;
  valueAtStakeUsd: number;
  avgPaybackMonths: number;
  alerts: number;
}

export type ActivityType =
  | "MODEL_CREATED"
  | "MODEL_UPDATED"
  | "STAKEHOLDER_SHARED"
  | "ASSUMPTION_APPROVED"
  | "DATA_INGESTED"
  | "RISK_FLAGGED";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timestampIso: string;
  actor: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}

export interface AppStateFixture {
  currentUser: CurrentUser;
  stats: DashboardStats;
  activityLog: ActivityEvent[];
}

export const MOCK_APP_STATE: AppStateFixture = {
  currentUser: {
    id: "usr_2f8a1b",
    name: "Avery Chen",
    email: "avery.chen@acme.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=256&q=80",
    role: "Value Engineer",
  },
  stats: {
    activeModels: 12,
    pipelines: 4,
    valueAtStakeUsd: 1840000,
    avgPaybackMonths: 7.8,
    alerts: 3,
  },
  activityLog: [
    {
      id: "evt_9c1a",
      type: "MODEL_UPDATED",
      title: "Updated ROI model assumptions",
      detail:
        "Adjusted automation adoption from 35% to 45% and rebalanced cost savings by team.",
      timestampIso: "2026-01-14T22:18:00.000Z",
      actor: {
        id: "usr_2f8a1b",
        name: "Avery Chen",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=256&q=80",
      },
    },
    {
      id: "evt_1a77",
      type: "ASSUMPTION_APPROVED",
      title: "Finance approved cost baseline",
      detail:
        "Validated current-state fully loaded cost rates for Support and Professional Services.",
      timestampIso: "2026-01-14T19:42:00.000Z",
      actor: {
        id: "usr_fin_01",
        name: "Jordan Patel",
        avatarUrl:
          "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=256&q=80",
      },
    },
    {
      id: "evt_b3d2",
      type: "STAKEHOLDER_SHARED",
      title: "Shared dashboard with stakeholders",
      detail:
        "Sent read-only link to VP Sales, RevOps, and CS leadership with key value drivers highlighted.",
      timestampIso: "2026-01-14T16:10:00.000Z",
      actor: {
        id: "usr_ops_07",
        name: "Sam Rivera",
        avatarUrl:
          "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=256&q=80",
      },
    },
    {
      id: "evt_45aa",
      type: "DATA_INGESTED",
      title: "Ingested CRM pipeline snapshot",
      detail:
        "Pulled 68 opportunities from Salesforce (last 30 days) for value opportunity mapping.",
      timestampIso: "2026-01-14T14:03:00.000Z",
      actor: {
        id: "usr_sys",
        name: "System",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
      },
    },
    {
      id: "evt_0f21",
      type: "RISK_FLAGGED",
      title: "Risk flagged: data quality variance",
      detail:
        "Observed 12% variance between product analytics and reported user counts for Segment A.",
      timestampIso: "2026-01-14T11:28:00.000Z",
      actor: {
        id: "usr_audit_03",
        name: "Morgan Lee",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
      },
    },
    {
      id: "evt_6d90",
      type: "MODEL_CREATED",
      title: "Created new value model",
      detail:
        "Initialized model template for ACME Enterprise: Revenue Uplift + Cost Savings + Risk Reduction.",
      timestampIso: "2026-01-13T21:56:00.000Z",
      actor: {
        id: "usr_2f8a1b",
        name: "Avery Chen",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=256&q=80",
      },
    },
  ],
};
