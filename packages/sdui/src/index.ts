// Legacy exports
export * from "./renderer";
export * from "./registry";
export * from "./schema";
export * from "./templates";

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
export { NarrativeBlock } from "./components/SDUI/NarrativeBlock";
export { WorkflowStatusBar } from "./components/Workflow/WorkflowStatusBar";

// Atomic action system
export { AtomicActionExecutor } from "./AtomicActionExecutor";
export * from "./AtomicUIActions";
