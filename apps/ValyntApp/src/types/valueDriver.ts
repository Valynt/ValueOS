/**
 * Value Driver Types
 *
 * Strategic value drivers managed by admins, used by sellers in value cases.
 */

export type { CanvasComponent } from "./index";

import { useEffect, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

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

// ---------------------------------------------------------------------------
// API response shape (backend uses underscores; frontend uses hyphens)
// ---------------------------------------------------------------------------

interface ApiValueDriver {
  id: string;
  name: string;
  description?: string;
  type: string;
  personaTags: string[];
  salesMotionTags: string[];
  formula: ValueDriverFormula;
  narrativePitch: string;
  status: DriverStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy: string;
  version: number;
  usageCount: number;
  winRateCorrelation?: number;
}

interface ApiListResponse {
  data: ApiValueDriver[];
  pagination?: { total: number };
}

/** Normalise underscore-separated enum values to hyphen-separated. */
function toHyphen(value: string): string {
  return value.replace(/_/g, "-");
}

function mapApiDriver(d: ApiValueDriver): ValueDriver {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    type: toHyphen(d.type) as ValueDriverType,
    personaTags: d.personaTags.map(toHyphen) as PersonaTag[],
    salesMotionTags: d.salesMotionTags.map(toHyphen) as SalesMotionTag[],
    formula: d.formula,
    narrativePitch: d.narrativePitch,
    status: d.status,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : d.createdAt.toISOString(),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : d.updatedAt.toISOString(),
    createdBy: d.createdBy,
    version: d.version,
    usageCount: d.usageCount,
    winRateCorrelation: d.winRateCorrelation,
  };
}

/**
 * Fetch value drivers from the backend API.
 * Returns `{ drivers, loading, error }`.
 * Falls back to an empty array on network failure so callers can handle
 * the empty state rather than crashing.
 */
export function useValueDrivers(): {
  drivers: ValueDriver[];
  loading: boolean;
  error: string | null;
} {
  const [drivers, setDrivers] = useState<ValueDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<ApiListResponse>("/api/value-drivers")
      .then((res) => {
        if (!cancelled) {
          setDrivers((res.data?.data ?? []).map(mapApiDriver));
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load value drivers");
          setDrivers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { drivers, loading, error };
}


