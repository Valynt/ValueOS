// Legacy exports
export * from "./renderer";
export * from "./registry";
export * from "./schema";
export * from "./templates";

// Real-time schema updates
export { useSchemaStore } from "./SchemaStore";
export { SchemaPatcher } from "./SchemaPatcher";

// New SDUI Runtime Engine exports
export * from "./renderPage";
export * from "./types";
export * from "./hooks/useDataHydration";
export * from "./components/ComponentErrorBoundary";
export * from "./components/FallbackComponentRegistry";
export * from "./components/LoadingFallback";
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
