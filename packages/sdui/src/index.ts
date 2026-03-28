// Legacy exports
export * from "./renderer";
export * from "./registry";
export * from "./schema";
export * from "./templates";

// Agent contract types (migrated from @valueos/sdui-types)
export * from "./agentContract";

// Real-time schema updates
export { useSchemaStore } from "./SchemaStore";
export { SchemaPatcher } from "./SchemaPatcher";

// SDUI Runtime Engine exports
export { renderPage, RenderPageComponent, useRenderPageOptions } from "./renderPage";
export type { RenderPageOptions, RenderPageResult } from "./renderPage";
export * from "./types";
export * from "./hooks/useDataHydration";
export { ComponentErrorBoundary, EnhancedComponentErrorBoundary, withEnhancedComponentErrorBoundary } from "./components/ComponentErrorBoundary";
export { fallbackRegistry, withFallback } from "./components/FallbackComponentRegistry";
export { LoadingFallback } from "./components/LoadingFallback";
export * from "./utils/renderUtils";

// Schema migration system
export * from "./migrations";

// Multi-tenant support
export * from "./TenantContext";
export * from "./TenantAwareDataBinding";

// Theme system
export * from "./theme/SDUITheme";
export * from "./theme/SDUIThemeProvider";

// Real-time WebSocket
export * from "./realtime";

// Performance optimization
export * from "./performance";

// Request ID context for error boundary correlation
export { RequestIdContext, RequestIdRow, useRequestId } from "./lib/RequestIdContext";
export type { RequestIdContextValue } from "./lib/RequestIdContext";

// Caching system
export * from "./cache";

// Agent components
export { ConfidenceDisplay } from "./components/Agent/ConfidenceDisplay";
export { IntegrityVetoPanel } from "./components/Agent/IntegrityVetoPanel";

// Core workflow components
export { DiscoveryCard } from "./components/SDUI/DiscoveryCard";
export { KPIForm } from "./components/SDUI/KPIForm";
export { InteractiveChart } from "./components/SDUI/InteractiveChart";
export { ValueTreeCard } from "./components/SDUI/ValueTreeCard";
export { MetricCard } from "./components/SDUI/MetricCard";
export type { MetricCardProps, MetricCardMetric } from "./components/SDUI/MetricCard";
export { ValuePathCard } from "./components/SDUI/ValuePathCard";
export type { ValuePathCardProps, ValuePathCardPath } from "./components/SDUI/ValuePathCard";
export { NarrativeBlock } from "./components/SDUI/NarrativeBlock";
export {
  DashboardPanel,
  Grid,
  HorizontalSplit,
  VerticalSplit,
} from "./components/SDUI/CanvasLayout";
export type {
  DashboardPanelProps,
  GridProps,
  LayoutBaseProps,
  LayoutSlots,
  ResponsiveBreakpoint,
  SplitProps,
} from "./components/SDUI/CanvasLayout";
export { WorkflowStatusBar } from "./components/Workflow/WorkflowStatusBar";
export { HumanCheckpointDependenciesProvider, useHumanCheckpointDependencies } from "./components/Workflow/HumanCheckpointDependencies";
export type { HumanCheckpointAuth, HumanCheckpointBroker, HumanCheckpointDependencies, HumanCheckpointEvent, HumanCheckpointEventPayload } from "./components/Workflow/HumanCheckpointDependencies";

// Atomic action system
export { AtomicActionExecutor } from "./AtomicActionExecutor";
export * from "./AtomicUIActions";

// Experience Model — State to UI mappings (Sprint 55)
export * from "./StateUIMap";
