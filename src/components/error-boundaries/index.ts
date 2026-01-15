/**
 * Error Boundary Index
 * Exports all error boundary components
 */

export { RootErrorBoundary } from "./RootErrorBoundary";
export { RouteErrorBoundary } from "./RouteErrorBoundary";
export { AsyncErrorBoundary } from "./AsyncErrorBoundary";
export { TemplateErrorBoundary } from "./TemplateErrorBoundary";
export { DashboardErrorBoundary } from "./DashboardErrorBoundary";

// Re-export for convenience
export { default as Root } from "./RootErrorBoundary";
export { default as Template } from "./TemplateErrorBoundary";
export { default as Dashboard } from "./DashboardErrorBoundary";
