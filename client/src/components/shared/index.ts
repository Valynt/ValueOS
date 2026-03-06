/*
 * Shared Component Library — Barrel Export
 * Import all standardized components from a single path:
 *   import { StatCard, PageHeader, StatusBadge } from "@/components/shared";
 */
export { StatCard } from "./StatCard";
export type { TrendDirection, BadgeVariant } from "./StatCard";

export { PageHeader } from "./PageHeader";

export { StatusBadge, stageColors, statusColors, statusDotColors, runColors, tierColors } from "./StatusBadge";

export { EmptyState } from "./EmptyState";

export { DataTable } from "./DataTable";
export type { Column } from "./DataTable";

export { ActivityItem } from "./ActivityItem";

export { SectionCard } from "./SectionCard";

export { SearchToolbar } from "./SearchToolbar";
