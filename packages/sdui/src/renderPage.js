"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderPageComponent = exports.useRenderPageOptions = void 0;
exports.renderPage = renderPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const logger_1 = require("@shared/lib/logger");
const react_1 = __importDefault(require("react"));
const MotionMaster_1 = require("./MotionMaster");
const ErrorBoundary_1 = require("../components/Common/ErrorBoundary");
const SDUI_1 = require("../components/SDUI");
const schema_1 = require("./schema");
const LazyComponentRegistry_1 = require("./LazyComponentRegistry");
const registry_1 = require("./registry");
const useDataHydration_1 = require("./hooks/useDataHydration");
const ComponentErrorBoundary_1 = require("./components/ComponentErrorBoundary");
const LoadingFallback_1 = require("./components/LoadingFallback");
/**
 * Context for passing render options down to child components
 */
const RenderPageContext = react_1.default.createContext({});
/**
 * Hook to access render page options in child components
 */
const useRenderPageOptions = () => react_1.default.useContext(RenderPageContext);
exports.useRenderPageOptions = useRenderPageOptions;
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: `mt-2 rounded-md border px-3 py-2 text-xs ${statusColors[status]}`, "data-testid": "debug-overlay", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-mono font-semibold", children: statusIcons[status] }), (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: section.component }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide", children: ["v", section.version] })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[10px] uppercase tracking-wide opacity-70", children: status })] }), message && (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-[11px] opacity-80", children: message }), section.hydrateWith && section.hydrateWith.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-[11px] opacity-80", children: ["Hydration: ", section.hydrateWith.join(", ")] }))] }));
};
/**
 * Component that handles rendering a single section with hydration support
 */
const SectionRenderer = ({ section, index, options }) => {
    const { debug = false, onRenderError, onHydrationError, onComponentRender, onHydrationComplete, loadingComponent: LoadingComponent = LoadingFallback_1.LoadingFallback, unknownComponentFallback: UnknownComponent = SDUI_1.UnknownComponentFallback, errorFallback: ErrorFallback = SDUI_1.SectionErrorFallback, } = options;
    // Resolve component from lazy registry first, fallback to synchronous registry
    const entry = options.enableLazyLoading !== false ? (0, LazyComponentRegistry_1.resolveComponentLazy)(section) : (0, registry_1.resolveComponent)(section);
    // Use data hydration hook if hydrateWith is specified
    const { data: hydratedData, loading: isHydrating, error: hydrationError, } = (0, useDataHydration_1.useDataHydration)(section.hydrateWith || [], {
        enabled: !!section.hydrateWith && section.hydrateWith.length > 0,
        onError: (error, endpoint) => {
            logger_1.logger.error(`Hydration failed for ${section.component}:`, error);
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
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(UnknownComponent, { componentName: section.component }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "unknown", message: "Component not found in registry" }))] }, `${section.component}-${index}`));
    }
    // Show loading state during hydration
    if (isHydrating) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(LoadingComponent, { componentName: section.component }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "loading", message: "Fetching data from endpoints" }))] }, `${section.component}-${index}`));
    }
    // Show error state if hydration failed and no fallback is defined
    if (hydrationError && !section.fallback) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(ErrorFallback, { componentName: section.component, error: hydrationError }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "error", message: `Hydration error: ${hydrationError.message}` }))] }, `${section.component}-${index}`));
    }
    // Use fallback component if hydration failed and fallback is defined
    if (hydrationError && section.fallback) {
        const FallbackComponent = section.fallback.component
            ? (0, registry_1.resolveComponent)({
                type: "component",
                component: section.fallback.component,
                version: 1,
                props: section.fallback.props || {},
            })?.component
            : null;
        if (FallbackComponent) {
            return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(ComponentErrorBoundary_1.ComponentErrorBoundary, { componentName: section.fallback.component, onError: (error) => onRenderError?.(error, section.fallback.component), fallback: (0, jsx_runtime_1.jsx)(ErrorFallback, { componentName: section.fallback.component }), children: (0, jsx_runtime_1.jsx)(FallbackComponent, { ...(section.fallback.props || {}) }) }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "error", message: `Using fallback: ${section.fallback.message || "Hydration failed"}` }))] }, `${section.component}-${index}`));
        }
        // Show fallback message if no component specified
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900", children: (0, jsx_runtime_1.jsx)("p", { className: "text-sm", children: section.fallback.message || "Component unavailable" }) }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "error", message: "Using fallback message" }))] }, `${section.component}-${index}`));
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(ComponentErrorBoundary_1.ComponentErrorBoundary, { componentName: section.component, onError: (error) => onRenderError?.(error, section.component), fallback: (0, jsx_runtime_1.jsx)(ErrorFallback, { componentName: section.component }), children: (0, jsx_runtime_1.jsx)(Component, { ...mergedProps }) }), debug && ((0, jsx_runtime_1.jsx)(DebugOverlay, { section: section, status: "rendered", message: entry.description || "Rendered successfully" }))] }, `${section.component}-${index}`));
};
/**
 * Internal component that renders the page structure
 */
const PageRenderer = ({ page, options, warnings }) => {
    const { debug = false, onWarning } = options;
    // Log warnings if handler provided
    react_1.default.useEffect(() => {
        if (warnings.length > 0) {
            onWarning?.(warnings);
        }
    }, [warnings, onWarning]);
    return ((0, jsx_runtime_1.jsx)(RenderPageContext.Provider, { value: options, children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", "data-testid": "sdui-page-renderer", children: [debug && warnings.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold mb-2", children: "\u26A0\uFE0F Validation Warnings" }), (0, jsx_runtime_1.jsx)("ul", { className: "list-disc pl-5 space-y-1 text-sm", children: warnings.map((warning, idx) => ((0, jsx_runtime_1.jsx)("li", { children: warning }, idx))) })] })), page.sections.map((section, index) => ((0, jsx_runtime_1.jsx)(SectionRenderer, { section: section, index: index, options: options }, `section-${index}`)))] }) }));
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
function renderPage(pageDefinition, options = {}) {
    // Step 1: Validate the page definition against the schema
    const validation = (0, schema_1.validateSDUISchema)(pageDefinition);
    // Step 2: Handle validation failure
    if (!validation.success) {
        const errors = validation.errors;
        // Call error handler if provided
        options.onValidationError?.(errors);
        // Log errors in development
        if (process.env.NODE_ENV === "development") {
            logger_1.logger.error("SDUI Schema Validation Failed:", errors);
        }
        // Throw validation error for caller to handle
        throw new schema_1.SDUIValidationError(`Page definition failed validation: ${errors.join(", ")}`, errors);
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
        (0, LazyComponentRegistry_1.preloadCriticalComponents)().catch((error) => {
            logger_1.logger.warn("Failed to preload critical components", { error });
        });
    }
    // Step 6: Enable debug mode from page metadata if not explicitly set
    const effectiveOptions = {
        ...options,
        debug: options.debug ?? page.metadata?.debug ?? false,
    };
    // Step 7: Render the page with error boundary
    const element = ((0, jsx_runtime_1.jsx)(ErrorBoundary_1.ErrorBoundary, { onError: (error) => {
            logger_1.logger.error("Fatal error rendering SDUI page:", error);
            options.onRenderError?.(error, "PageRenderer");
        }, children: (0, jsx_runtime_1.jsx)(MotionMaster_1.MotionMasterProvider, { children: (0, jsx_runtime_1.jsx)(PageRenderer, { page: page, options: effectiveOptions, warnings: warnings }) }) }));
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
const RenderPageComponent = ({ pageDefinition, options, onError }) => {
    try {
        const result = renderPage(pageDefinition, options);
        return result.element;
    }
    catch (error) {
        // Handle validation errors
        if (error instanceof schema_1.SDUIValidationError) {
            onError?.(error);
            return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-red-200 bg-red-50 p-4 text-red-900", role: "alert", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold mb-2", children: "Invalid Page Definition" }), (0, jsx_runtime_1.jsx)("ul", { className: "list-disc pl-5 space-y-1 text-sm", children: error.errors.map((err, idx) => ((0, jsx_runtime_1.jsx)("li", { children: err }, idx))) })] }));
        }
        // Handle unexpected errors
        onError?.(error);
        throw error;
    }
};
exports.RenderPageComponent = RenderPageComponent;
//# sourceMappingURL=renderPage.js.map