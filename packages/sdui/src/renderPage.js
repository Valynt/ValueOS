import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { logger } from "@shared/lib/logger";
import React from "react";
import { MotionMasterProvider } from "./MotionMaster";
import { ErrorBoundary } from "../components/Common/ErrorBoundary";
import { SectionErrorFallback, UnknownComponentFallback } from "../components/SDUI";
import { SDUIValidationError, validateSDUISchema, } from "./schema";
import { resolveComponentLazy, preloadCriticalComponents } from "./LazyComponentRegistry";
import { resolveComponent } from "./registry";
import { useDataHydration } from "./hooks/useDataHydration";
import { ComponentErrorBoundary } from "./components/ComponentErrorBoundary";
import { LoadingFallback } from "./components/LoadingFallback";
/**
 * Context for passing render options down to child components
 */
const RenderPageContext = React.createContext({});
/**
 * Hook to access render page options in child components
 */
export const useRenderPageOptions = () => React.useContext(RenderPageContext);
/**
 * Debug overlay component to show component metadata
 */
const DebugOverlay = ({ section, status, message }) => {
    const statusColors = {
        rendered: "bg-emerald-50 text-emerald-700 border-emerald-200",
        loading: "bg-blue-50 text-blue-700 border-blue-200",
        error: "bg-red-50 text-red-700 border-red-200",
        unknown: "bg-amber-50 text-amber-700 border-amber-200",
    };
    const statusIcons = {
        rendered: "✓",
        loading: "⟳",
        error: "✗",
        unknown: "?",
    };
    return (_jsxs("div", { className: `mt-2 rounded-md border px-3 py-2 text-xs ${statusColors[status]}`, "data-testid": "debug-overlay", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono font-semibold", children: statusIcons[status] }), _jsx("span", { className: "font-semibold", children: section.component }), _jsxs("span", { className: "rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide", children: ["v", section.version] })] }), _jsx("span", { className: "text-[10px] uppercase tracking-wide opacity-70", children: status })] }), message && _jsx("p", { className: "mt-1 text-[11px] opacity-80", children: message }), section.hydrateWith && section.hydrateWith.length > 0 && (_jsxs("p", { className: "mt-1 text-[11px] opacity-80", children: ["Hydration: ", section.hydrateWith.join(", ")] }))] }));
};
/**
 * Component that handles rendering a single section with hydration support
 */
const SectionRenderer = ({ section, index, options }) => {
    const { debug = false, onRenderError, onHydrationError, onComponentRender, onHydrationComplete, loadingComponent: LoadingComponent = LoadingFallback, unknownComponentFallback: UnknownComponent = UnknownComponentFallback, errorFallback: ErrorFallback = SectionErrorFallback, } = options;
    // Resolve component from lazy registry first, fallback to synchronous registry
    const entry = options.enableLazyLoading !== false ? resolveComponentLazy(section) : resolveComponent(section);
    // Use data hydration hook if hydrateWith is specified
    const { data: hydratedData, loading: isHydrating, error: hydrationError, } = useDataHydration(section.hydrateWith || [], {
        enabled: !!section.hydrateWith && section.hydrateWith.length > 0,
        onError: (error, endpoint) => {
            logger.error(`Hydration failed for ${section.component}:`, error);
            onHydrationError?.(error, endpoint);
        },
        onSuccess: (data) => {
            onHydrationComplete?.(section.component, data);
        },
        timeout: options.hydrationTimeout,
        enableRetry: options.enableHydrationRetry,
        retryAttempts: options.hydrationRetryAttempts,
        fetcher: options.dataFetcher,
        enableCache: options.enableHydrationCache,
    });
    // Handle unknown component
    if (!entry) {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(UnknownComponent, { componentName: section.component }), debug && (_jsx(DebugOverlay, { section: section, status: "unknown", message: "Component not found in registry" }))] }, `${section.component}-${index}`));
    }
    // Show loading state during hydration
    if (isHydrating) {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(LoadingComponent, { componentName: section.component }), debug && (_jsx(DebugOverlay, { section: section, status: "loading", message: "Fetching data from endpoints" }))] }, `${section.component}-${index}`));
    }
    // Show error state if hydration failed and no fallback is defined
    if (hydrationError && !section.fallback) {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(ErrorFallback, { componentName: section.component, error: hydrationError }), debug && (_jsx(DebugOverlay, { section: section, status: "error", message: `Hydration error: ${hydrationError.message}` }))] }, `${section.component}-${index}`));
    }
    // Use fallback component if hydration failed and fallback is defined
    if (hydrationError && section.fallback) {
        const FallbackComponent = section.fallback.component
            ? resolveComponent({
                type: "component",
                component: section.fallback.component,
                version: 1,
                props: section.fallback.props || {},
            })?.component
            : null;
        if (FallbackComponent) {
            return (_jsxs("div", { className: "space-y-2", children: [_jsx(ComponentErrorBoundary, { componentName: section.fallback.component, onError: (error) => onRenderError?.(error, section.fallback.component), fallback: _jsx(ErrorFallback, { componentName: section.fallback.component }), children: _jsx(FallbackComponent, { ...(section.fallback.props || {}) }) }), debug && (_jsx(DebugOverlay, { section: section, status: "error", message: `Using fallback: ${section.fallback.message || "Hydration failed"}` }))] }, `${section.component}-${index}`));
        }
        // Show fallback message if no component specified
        return (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900", children: _jsx("p", { className: "text-sm", children: section.fallback.message || "Component unavailable" }) }), debug && (_jsx(DebugOverlay, { section: section, status: "error", message: "Using fallback message" }))] }, `${section.component}-${index}`));
    }
    // Merge hydrated data with props
    const Component = entry.component;
    const mergedProps = {
        ...section.props,
        ...hydratedData,
        onAction: options.onAction, // Inject standard action handler
    };
    // Notify that component is rendering
    onComponentRender?.(section.component, mergedProps);
    // Render the component with error boundary
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(ComponentErrorBoundary, { componentName: section.component, onError: (error) => onRenderError?.(error, section.component), fallback: _jsx(ErrorFallback, { componentName: section.component }), children: _jsx(Component, { ...mergedProps }) }), debug && (_jsx(DebugOverlay, { section: section, status: "rendered", message: entry.description || "Rendered successfully" }))] }, `${section.component}-${index}`));
};
/**
 * Internal component that renders the page structure
 */
const PageRenderer = ({ page, options, warnings }) => {
    const { debug = false, onWarning } = options;
    // Log warnings if handler provided
    React.useEffect(() => {
        if (warnings.length > 0) {
            onWarning?.(warnings);
        }
    }, [warnings, onWarning]);
    return (_jsx(RenderPageContext.Provider, { value: options, children: _jsxs("div", { className: "space-y-4", "data-testid": "sdui-page-renderer", children: [debug && warnings.length > 0 && (_jsxs("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900", children: [_jsx("p", { className: "text-sm font-semibold mb-2", children: "\u26A0\uFE0F Validation Warnings" }), _jsx("ul", { className: "list-disc pl-5 space-y-1 text-sm", children: warnings.map((warning, idx) => (_jsx("li", { children: warning }, idx))) })] })), page.sections.map((section, index) => (_jsx(SectionRenderer, { section: section, index: index, options: options }, `section-${index}`)))] }) }));
};
/**
 * Production-ready SDUI runtime engine that dynamically renders UI components
 * based on server-provided configurations.
 *
 * @param pageDefinition - The page structure and component configurations from the server
 * @param options - Optional configuration for error handling, loading states, and behavior
 * @returns RenderPageResult containing the rendered element, warnings, and metadata
 *
 * @throws {SDUIValidationError} If the pageDefinition fails schema validation
 *
 * @example
 * ```tsx
 * const result = renderPage(serverPageDefinition, {
 *   debug: true,
 *   onValidationError: (errors) => logger.error('Validation failed:', errors),
 *   onHydrationError: (error, endpoint) => logError(error, endpoint),
 * });
 *
 * return result.element;
 * ```
 */
export function renderPage(pageDefinition, options = {}) {
    // Step 1: Validate the page definition against the schema
    const validation = validateSDUISchema(pageDefinition);
    // Step 2: Handle validation failure
    if (!validation.success) {
        const errors = validation.errors;
        // Call error handler if provided
        options.onValidationError?.(errors);
        // Log errors in development
        if (process.env.NODE_ENV === "development") {
            logger.error("SDUI Schema Validation Failed:", errors);
        }
        // Throw validation error for caller to handle
        throw new SDUIValidationError(`Page definition failed validation: ${errors.join(", ")}`, errors);
    }
    // Step 3: Extract validated page and warnings
    const page = validation.page;
    const warnings = validation.warnings;
    // Step 4: Calculate metadata
    const hydratedComponentCount = page.sections.filter((section) => section.hydrateWith && section.hydrateWith.length > 0).length;
    const metadata = {
        componentCount: page.sections.length,
        hydratedComponentCount,
        version: page.version,
    };
    // Step 5: Preload critical components if lazy loading is enabled
    if (options.enableLazyLoading !== false) {
        // Extract component names from page sections
        const componentNames = page.sections.map((section) => section.component);
        // Preload critical components asynchronously (don't block rendering)
        preloadCriticalComponents().catch((error) => {
            logger.warn("Failed to preload critical components", { error });
        });
    }
    // Step 6: Enable debug mode from page metadata if not explicitly set
    const effectiveOptions = {
        ...options,
        debug: options.debug ?? page.metadata?.debug ?? false,
    };
    // Step 7: Render the page with error boundary
    const element = (_jsx(ErrorBoundary, { onError: (error) => {
            logger.error("Fatal error rendering SDUI page:", error);
            options.onRenderError?.(error, "PageRenderer");
        }, children: _jsx(MotionMasterProvider, { children: _jsx(PageRenderer, { page: page, options: effectiveOptions, warnings: warnings }) }) }));
    // Step 7: Return result with metadata
    return {
        element,
        warnings,
        metadata,
    };
}
/**
 * React component wrapper for renderPage that handles errors gracefully
 */
export const RenderPageComponent = ({ pageDefinition, options, onError }) => {
    try {
        const result = renderPage(pageDefinition, options);
        return result.element;
    }
    catch (error) {
        // Handle validation errors
        if (error instanceof SDUIValidationError) {
            onError?.(error);
            return (_jsxs("div", { className: "rounded-lg border border-red-200 bg-red-50 p-4 text-red-900", role: "alert", children: [_jsx("p", { className: "text-sm font-semibold mb-2", children: "Invalid Page Definition" }), _jsx("ul", { className: "list-disc pl-5 space-y-1 text-sm", children: error.errors.map((err, idx) => (_jsx("li", { children: err }, idx))) })] }));
        }
        // Handle unexpected errors
        onError?.(error);
        throw error;
    }
};
//# sourceMappingURL=renderPage.js.map