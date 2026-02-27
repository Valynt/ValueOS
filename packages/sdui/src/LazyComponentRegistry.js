"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyComponentRegistry = void 0;
exports.resolveComponentLazy = resolveComponentLazy;
exports.preloadCriticalComponents = preloadCriticalComponents;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Lazy Component Registry
 *
 * Implements lazy loading for SDUI components to improve initial bundle size
 * and runtime performance. Components are loaded on-demand when first used.
 */
const react_1 = require("react");
const logger_1 = require("@shared/lib/logger");
const SDUITelemetry_1 = require("../lib/telemetry/SDUITelemetry");
// Lazy component loaders
const lazyComponents = {
    // Layout components
    VerticalSplit: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/CanvasLayout"))).then((mod) => ({ default: mod.VerticalSplit }))),
    HorizontalSplit: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/CanvasLayout"))).then((mod) => ({ default: mod.HorizontalSplit }))),
    Grid: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/CanvasLayout"))).then((mod) => ({ default: mod.Grid }))),
    DashboardPanel: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/CanvasLayout"))).then((mod) => ({ default: mod.DashboardPanel }))),
    // Core components
    InfoBanner: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.InfoBanner }))),
    DiscoveryCard: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/DiscoveryCard"))).then((mod) => ({ default: mod.DiscoveryCard }))),
    ValueTreeCard: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/ValueTreeCard"))).then((mod) => ({ default: mod.ValueTreeCard }))),
    ValueHypothesisCard: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ValueHypothesisCard }))),
    ExpansionBlock: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ExpansionBlock }))),
    InteractiveChart: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/InteractiveChart"))).then((mod) => ({ default: mod.InteractiveChart }))),
    // Metrics and forms
    MetricBadge: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.MetricBadge }))),
    KPIForm: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/KPIForm"))).then((mod) => ({ default: mod.KPIForm }))),
    ValueCommitForm: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ValueCommitForm }))),
    RealizationDashboard: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.RealizationDashboard }))),
    // Navigation
    SideNavigation: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.SideNavigation }))),
    TabBar: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.TabBar }))),
    Breadcrumbs: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.Breadcrumbs }))),
    // Data display
    DataTable: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.DataTable }))),
    ConfidenceIndicator: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ConfidenceIndicator }))),
    // Agent components
    AgentResponseCard: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.AgentResponseCard }))),
    AgentWorkflowPanel: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.AgentWorkflowPanel }))),
    NarrativeBlock: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/NarrativeBlock"))).then((mod) => ({ default: mod.NarrativeBlock }))),
    SDUIForm: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.SDUIForm }))),
    ScenarioSelector: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ScenarioSelector }))),
    // Workflow components
    WorkflowStatusBar: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("../components/Workflow/WorkflowStatusBar"))).then((mod) => ({
        default: mod.WorkflowStatusBar,
    }))),
    HumanCheckpoint: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("../components/Workflow/HumanCheckpoint"))).then((mod) => ({
        default: mod.HumanCheckpoint,
    }))),
    ConfidenceDisplay: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("../components/Agent/ConfidenceDisplay"))).then((mod) => ({
        default: mod.ConfidenceDisplay,
    }))),
    // Utility components
    JsonViewer: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.JsonViewer }))),
    TextBlock: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.TextBlock }))),
    ConfirmationDialog: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ConfirmationDialog }))),
    ProgressBar: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.ProgressBar }))),
    // Panels and containers
    LifecyclePanel: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.LifecyclePanel }))),
    IntegrityReviewPanel: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.IntegrityReviewPanel }))),
    IntegrityVetoPanel: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("../components/Agent/IntegrityVetoPanel"))).then((mod) => ({
        default: mod.IntegrityVetoPanel,
    }))),
    // Development tools
    ComponentPreview: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI/ComponentPreview"))).then((mod) => ({ default: mod.ComponentPreview }))),
    // Fallback components (loaded immediately as they're essential)
    UnknownComponentFallback: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.UnknownComponentFallback }))),
    SectionErrorFallback: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require("./components/SDUI"))).then((mod) => ({ default: mod.SectionErrorFallback }))),
};
// Component metadata registry (loaded immediately)
const componentMetadata = {
    // Layout components
    VerticalSplit: {
        versions: [1],
        requiredProps: ["ratios", "children"],
        description: "Vertical split layout with configurable ratios",
    },
    HorizontalSplit: {
        versions: [1],
        requiredProps: ["ratios", "children"],
        description: "Horizontal split layout with configurable ratios",
    },
    Grid: {
        versions: [1],
        requiredProps: ["columns", "children"],
        description: "Responsive grid layout with configurable columns",
    },
    DashboardPanel: {
        versions: [1],
        requiredProps: ["children"],
        description: "Collapsible panel container for dashboard sections",
    },
    // Core components
    InfoBanner: {
        versions: [1, 2],
        requiredProps: ["title"],
        description: "High-level lifecycle banner for SDUI templates.",
    },
    DiscoveryCard: {
        versions: [1, 2],
        requiredProps: ["questions"],
        description: "Discovery prompts for opportunity framing.",
    },
    ValueTreeCard: {
        versions: [1, 2],
        requiredProps: ["title", "nodes"],
        description: "Nested value drivers for target outcomes.",
    },
    ValueHypothesisCard: {
        versions: [1],
        requiredProps: ["hypothesis"],
        description: "Displays a specialized card for a value hypothesis with confidence/impact.",
    },
    ExpansionBlock: {
        versions: [1, 2],
        requiredProps: ["gaps", "roi"],
        description: "ROI snapshot for expansion stage.",
    },
    // Metrics and forms
    MetricBadge: {
        versions: [1],
        requiredProps: ["label", "value"],
        description: "Displays a KPI label with numeric or percentage value.",
    },
    KPIForm: {
        versions: [1],
        requiredProps: ["kpiName", "onSubmit"],
        description: "Form for entering baseline and target values for a KPI.",
    },
    ValueCommitForm: {
        versions: [1],
        requiredProps: ["kpis", "onCommit"],
        description: "Extended form for multiple KPI entries with assumptions.",
    },
    RealizationDashboard: {
        versions: [1],
        requiredProps: [],
        description: "Displays baseline vs. target vs. actual results for realized value.",
    },
    // Navigation
    SideNavigation: {
        versions: [1],
        requiredProps: ["items"],
        description: "Collapsible sidebar navigation with workflow stages.",
    },
    TabBar: {
        versions: [1],
        requiredProps: ["tabs"],
        description: "Secondary navigation with neon green active indicator.",
    },
    Breadcrumbs: {
        versions: [1],
        requiredProps: ["items"],
        description: "Path indicators with separators for navigation hierarchy.",
    },
    // Data display
    DataTable: {
        versions: [1],
        requiredProps: ["data", "columns"],
        description: "Sortable, filterable data grid with pagination and virtual scrolling.",
    },
    ConfidenceIndicator: {
        versions: [1],
        requiredProps: ["value"],
        description: "Visual confidence meter for AI outputs (0-100%).",
    },
    // Agent components
    AgentResponseCard: {
        versions: [1],
        requiredProps: ["response"],
        description: "Displays agent outputs with reasoning transparency and actions.",
    },
    AgentWorkflowPanel: {
        versions: [1],
        requiredProps: ["agents"],
        description: "Shows active agents, collaboration status, and communication log.",
    },
    NarrativeBlock: {
        versions: [1],
        requiredProps: ["title", "content"],
        description: "Displays AI-generated narrative content with optional editing and transparency.",
    },
    SDUIForm: {
        versions: [1],
        requiredProps: ["id", "onSubmit"],
        description: "Dynamic form generation from JSON schema with validation and AI suggestions.",
    },
    ScenarioSelector: {
        versions: [1],
        requiredProps: ["scenarios", "onSelect"],
        description: "Template/scenario selection interface with AI recommendations.",
    },
    // Workflow components
    WorkflowStatusBar: {
        versions: [1],
        requiredProps: [],
        description: "Real-time workflow progress bar showing current stage, agent, and confidence.",
    },
    HumanCheckpoint: {
        versions: [1],
        requiredProps: ["stageId", "agentName", "action", "riskLevel", "onApprove", "onReject"],
        description: "Human approval interface for high-risk workflow stages.",
    },
    ConfidenceDisplay: {
        versions: [1],
        requiredProps: [],
        description: "Displays agent confidence levels and hallucination status with regeneration options.",
    },
    // Utility components
    JsonViewer: {
        versions: [1],
        requiredProps: ["data"],
        description: "Displays raw JSON data in a formatted viewer",
    },
    TextBlock: {
        versions: [1],
        requiredProps: ["text"],
        description: "Displays plain or formatted text content",
    },
    ConfirmationDialog: {
        versions: [1],
        requiredProps: ["message", "onConfirm", "onCancel"],
        description: "Dialog for user confirmation with actions",
    },
    ProgressBar: {
        versions: [1],
        requiredProps: ["progress"],
        description: "Linear progress bar for workflow or loading states",
    },
    // Charts
    InteractiveChart: {
        versions: [1],
        requiredProps: ["type", "data"],
        description: "Recharts-based chart supporting bar, line, area, and pie types.",
    },
    // Panels and containers
    LifecyclePanel: {
        versions: [1],
        requiredProps: ["stage", "children"],
        description: "Generic panel container for each lifecycle stage.",
    },
    IntegrityReviewPanel: {
        versions: [1],
        requiredProps: ["results"],
        description: "Displays manifesto rule validation results.",
    },
    IntegrityVetoPanel: {
        versions: [1],
        requiredProps: ["issues", "onResolve", "onDismiss"],
        description: "Integrity review panel with issue list, severity colors, and resolve modal.",
    },
    // Development tools
    ComponentPreview: {
        versions: [1],
        requiredProps: ["intentType", "componentName", "registryEntry", "organizationId"],
        description: "Developer preview tool for ui-registry.json entries with validation.",
    },
    // Fallback components
    UnknownComponentFallback: {
        versions: [1],
        requiredProps: ["componentName"],
        description: "Fallback component for unknown SDUI components",
    },
    SectionErrorFallback: {
        versions: [1],
        requiredProps: ["componentName"],
        description: "Error boundary fallback for component sections",
    },
};
// Component load cache
const componentCache = new Map();
const loadingPromises = new Map();
// Loading fallback component
const ComponentLoadingFallback = ({ componentName }) => ((0, jsx_runtime_1.jsx)("div", { className: "animate-pulse bg-gray-100 rounded-lg p-4 border border-gray-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-4 h-4 bg-blue-500 rounded-full animate-pulse" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: ["Loading ", componentName, "..."] })] }) }));
/**
 * Lazy component registry with on-demand loading and robust async resolution
 */
class LazyComponentRegistry {
    /**
     * Resolve a component with lazy loading (async, with Suspense fallback)
     */
    static async resolveComponentAsync(section) {
        const componentName = section.component;
        const startTime = Date.now();
        SDUITelemetry_1.sduiTelemetry.recordEvent({
            type: SDUITelemetry_1.TelemetryEventType.COMPONENT_RESOLVE,
            metadata: {
                component: componentName,
                version: section.version,
            },
        });
        try {
            // Check cache first
            if (componentCache.has(componentName)) {
                const cachedComponent = componentCache.get(componentName);
                const metadata = componentMetadata[componentName];
                if (!metadata) {
                    logger_1.logger.warn(`No metadata found for component: ${componentName}`);
                    return undefined;
                }
                SDUITelemetry_1.sduiTelemetry.recordEvent({
                    type: SDUITelemetry_1.TelemetryEventType.HYDRATION_CACHE_HIT,
                    metadata: { component: componentName },
                });
                return { component: cachedComponent, ...metadata };
            }
            // Check if component is being loaded
            if (loadingPromises.has(componentName)) {
                const component = await loadingPromises.get(componentName);
                const metadata = componentMetadata[componentName];
                if (!metadata) {
                    logger_1.logger.warn(`No metadata found for component: ${componentName}`);
                    return undefined;
                }
                return { component, ...metadata };
            }
            // Load component lazily
            const lazyLoader = lazyComponents[componentName];
            if (!lazyLoader) {
                logger_1.logger.warn(`Component not found in lazy registry: ${componentName}`);
                return undefined;
            }
            // Create and cache loading promise
            const loadingPromise = this.loadComponent(componentName, lazyLoader);
            loadingPromises.set(componentName, loadingPromise);
            try {
                const component = await loadingPromise;
                const metadata = componentMetadata[componentName];
                if (!metadata) {
                    logger_1.logger.warn(`No metadata found for component: ${componentName}`);
                    return undefined;
                }
                // Cache the loaded component
                componentCache.set(componentName, component);
                loadingPromises.delete(componentName);
                const loadTime = Date.now() - startTime;
                SDUITelemetry_1.sduiTelemetry.recordEvent({
                    type: SDUITelemetry_1.TelemetryEventType.COMPONENT_MOUNT,
                    duration: loadTime,
                    metadata: { component: componentName, version: section.version, loadTime },
                });
                logger_1.logger.info(`Component loaded lazily: ${componentName}`, { loadTime, componentName });
                return { component, ...metadata };
            }
            catch (error) {
                loadingPromises.delete(componentName);
                throw error;
            }
        }
        catch (error) {
            const loadTime = Date.now() - startTime;
            SDUITelemetry_1.sduiTelemetry.recordEvent({
                type: SDUITelemetry_1.TelemetryEventType.COMPONENT_ERROR,
                metadata: {
                    component: componentName,
                    error: error instanceof Error ? error.message : String(error),
                    loadTime,
                },
            });
            logger_1.logger.error(`Failed to load component: ${componentName}`, {
                error: error instanceof Error ? error : new Error(String(error)),
                componentName,
                loadTime,
            });
            return undefined;
        }
    }
    /**
     * Load a component from its lazy loader
     */
    static async loadComponent(componentName, lazyLoader) {
        try {
            // Trigger the lazy load
            const Component = lazyLoader;
            // Pre-warm the component by attempting to render it
            // This will trigger the actual module loading
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Component load timeout: ${componentName}`));
                }, 10000); // 10 second timeout
                // Try to access the component to trigger loading
                try {
                    const result = Component;
                    if (result && typeof result === "function") {
                        clearTimeout(timeout);
                        resolve();
                    }
                    else {
                        clearTimeout(timeout);
                        reject(new Error(`Invalid component format: ${componentName}`));
                    }
                }
                catch (e) {
                    clearTimeout(timeout);
                    reject(e);
                }
            });
            return Component;
        }
        catch (error) {
            throw new Error(`Failed to load component ${componentName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Preload commonly used components
     */
    static async preloadComponents(componentNames) {
        const preloadPromises = componentNames
            .filter((name) => !componentCache.has(name) && !loadingPromises.has(name))
            .map(async (componentName) => {
            const lazyLoader = lazyComponents[componentName];
            if (lazyLoader) {
                try {
                    await this.loadComponent(componentName, lazyLoader);
                    componentCache.set(componentName, lazyLoader);
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to preload component: ${componentName}`, { error });
                }
            }
        });
        await Promise.allSettled(preloadPromises);
        logger_1.logger.info(`Preloaded ${componentNames.length} components`, {
            requested: componentNames.length,
            successful: preloadPromises.filter((p) => p.status === "fulfilled").length,
        });
    }
    /**
     * Get component metadata without loading the component
     */
    static getComponentMetadata(componentName) {
        return componentMetadata[componentName];
    }
    /**
     * Check if a component is loaded
     */
    static isComponentLoaded(componentName) {
        return componentCache.has(componentName);
    }
    /**
     * Get registry statistics
     */
    static getRegistryStats() {
        return {
            totalComponents: Object.keys(lazyComponents).length,
            loadedComponents: componentCache.size,
            loadingComponents: loadingPromises.size,
            cachedComponents: componentCache.size,
        };
    }
    /**
     * Clear component cache
     */
    static clearCache() {
        componentCache.clear();
        loadingPromises.clear();
        logger_1.logger.info("Component cache cleared");
    }
}
exports.LazyComponentRegistry = LazyComponentRegistry;
/**
 * Resolve component with lazy loading and suspense wrapper
 */
/**
 * Resolve a component with lazy loading and Suspense fallback.
 * Returns a RegistryEntry with a Suspense-wrapped component.
 */
function resolveComponentLazy(section) {
    const metadata = LazyComponentRegistry.getComponentMetadata(section.component);
    if (!metadata) {
        return undefined;
    }
    // Create a lazy component that will be loaded when rendered
    const LazyComponent = (0, react_1.lazy)(async () => {
        const entry = await LazyComponentRegistry.resolveComponentAsync(section);
        if (!entry) {
            throw new Error(`Component not found: ${section.component}`);
        }
        return { default: entry.component };
    });
    // Wrap with Suspense for loading states and error boundary for resilience
    const WrappedComponent = (props) => ((0, jsx_runtime_1.jsx)(react_1.Suspense, { fallback: (0, jsx_runtime_1.jsx)(ComponentLoadingFallback, { componentName: section.component }), children: (0, jsx_runtime_1.jsx)(LazyComponent, { ...props }) }));
    return {
        component: WrappedComponent,
        ...metadata,
    };
}
/**
 * Preload critical components for better performance
 */
function preloadCriticalComponents() {
    const criticalComponents = [
        "AgentResponseCard",
        "TextBlock",
        "MetricBadge",
        "ValueHypothesisCard",
        "InfoBanner",
    ];
    LazyComponentRegistry.preloadComponents(criticalComponents).catch((error) => {
        logger_1.logger.warn("Failed to preload critical components", { error });
    });
}
//# sourceMappingURL=LazyComponentRegistry.js.map