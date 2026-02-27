"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionErrorWrapper = exports.baseRegistry = exports.RegistryPlaceholderComponent = exports.versionedRegistry = void 0;
exports.resolveComponentWithVersion = resolveComponentWithVersion;
exports.resolveComponentLegacy = resolveComponentLegacy;
exports.resolveComponentFromLegacyRegistry = resolveComponentFromLegacyRegistry;
exports.resolveComponentFromVersionedRegistry = resolveComponentFromVersionedRegistry;
exports.listRegisteredComponents = listRegisteredComponents;
exports.getRegistryEntry = getRegistryEntry;
exports.registerComponent = registerComponent;
exports.resetRegistry = resetRegistry;
exports.hotSwapComponent = hotSwapComponent;
const jsx_runtime_1 = require("react/jsx-runtime");
const SDUI_1 = require("./components/SDUI");
const DiscoveryCard_1 = require("./components/SDUI/DiscoveryCard");
const KPIForm_1 = require("./components/SDUI/KPIForm");
const InteractiveChart_1 = require("./components/SDUI/InteractiveChart");
const ValueTreeCard_1 = require("./components/SDUI/ValueTreeCard");
const NarrativeBlock_1 = require("./components/SDUI/NarrativeBlock");
const WorkflowStatusBar_1 = require("./components/Workflow/WorkflowStatusBar");
const HumanCheckpoint_1 = require("./components/Workflow/HumanCheckpoint");
const ConfidenceDisplay_1 = require("./components/Agent/ConfidenceDisplay");
const IntegrityVetoPanel_1 = require("./components/Agent/IntegrityVetoPanel");
const SDUI_2 = require("./components/SDUI");
const logger_1 = require("@shared/lib/logger");
/**
 * Versioned Component Registry
 *
 * Manages component versions with backward compatibility and fallback support
 */
class VersionedComponentRegistry {
    components = new Map();
    fallbackRegistry = new Map();
    defaultStrategy = "compatible";
    /**
     * Register a component version
     */
    register(entry) {
        const componentName = this.getComponentName(entry.component);
        const existing = this.components.get(componentName) || [];
        // Remove existing entry for same version
        const filtered = existing.filter((e) => e.version !== entry.version);
        const updated = [...filtered, entry].sort((a, b) => b.version - a.version);
        this.components.set(componentName, updated);
        logger_1.logger.info("Component version registered", {
            componentName,
            version: entry.version,
            deprecated: entry.deprecated,
            totalVersions: updated.length,
        });
    }
    /**
     * Register a fallback component
     */
    registerFallback(entry) {
        const componentName = this.getComponentName(entry.component);
        const existing = this.fallbackRegistry.get(componentName) || [];
        const filtered = existing.filter((e) => e.version !== entry.version);
        const updated = [...filtered, entry].sort((a, b) => b.version - a.version);
        this.fallbackRegistry.set(componentName, updated);
        logger_1.logger.info("Fallback component registered", {
            componentName,
            version: entry.version,
        });
    }
    /**
     * Resolve component with version negotiation
     */
    resolve(componentName, requestedVersion, strategy = this.defaultStrategy) {
        const entries = this.components.get(componentName);
        if (!entries || entries.length === 0) {
            return this.resolveFallback(componentName, requestedVersion, strategy);
        }
        let targetEntry;
        switch (strategy) {
            case "exact":
                targetEntry = entries.find((e) => e.version === requestedVersion);
                break;
            case "latest":
                targetEntry = entries[0]; // Sorted by version descending
                break;
            case "compatible":
                targetEntry = this.findCompatibleVersion(entries, requestedVersion);
                break;
            case "fallback":
                targetEntry = entries.find((e) => e.version === requestedVersion);
                if (!targetEntry) {
                    return this.resolveFallback(componentName, requestedVersion, strategy);
                }
                break;
            default:
                targetEntry = this.findCompatibleVersion(entries, requestedVersion);
        }
        if (!targetEntry) {
            return this.resolveFallback(componentName, requestedVersion, strategy);
        }
        return {
            component: targetEntry.component,
            version: targetEntry.version,
            isFallback: false,
            isDeprecated: !!targetEntry.deprecated,
            deprecationMessage: targetEntry.deprecationMessage,
            migrationPath: targetEntry.migrationPath,
        };
    }
    /**
     * Find compatible version for requested version
     */
    findCompatibleVersion(entries, requestedVersion) {
        if (!requestedVersion) {
            return entries[0]; // Latest version
        }
        // Try exact match first
        const exact = entries.find((e) => e.version === requestedVersion);
        if (exact)
            return exact;
        // Find compatible version
        for (const entry of entries) {
            if (this.isVersionCompatible(entry, requestedVersion)) {
                return entry;
            }
        }
        // Fallback to latest version
        return entries[0];
    }
    /**
     * Check if version is compatible with requested version
     */
    isVersionCompatible(entry, requestedVersion) {
        const { version, minCompatibleVersion, maxCompatibleVersion } = entry;
        if (version === requestedVersion)
            return true;
        // Check if requested version is in compatible range
        if (minCompatibleVersion && maxCompatibleVersion) {
            return requestedVersion >= minCompatibleVersion && requestedVersion <= maxCompatibleVersion;
        }
        // Default compatibility: newer versions are backward compatible
        return version > requestedVersion;
    }
    /**
     * Resolve fallback component
     */
    resolveFallback(componentName, requestedVersion, strategy = "fallback") {
        const fallbacks = this.fallbackRegistry.get(componentName);
        if (fallbacks && fallbacks.length > 0) {
            const fallback = fallbacks[0]; // Latest fallback version
            logger_1.logger.warn("Using fallback component", {
                componentName,
                requestedVersion,
                fallbackVersion: fallback.version,
            });
            return {
                component: fallback.component,
                version: fallback.version,
                isFallback: true,
                isDeprecated: false,
            };
        }
        // No fallback available - use unknown component fallback
        logger_1.logger.error("Component not found and no fallback available", {
            componentName,
            requestedVersion,
        });
        return {
            component: SDUI_1.UnknownComponentFallback,
            version: 1,
            isFallback: true,
            isDeprecated: false,
        };
    }
    /**
     * Get all available versions for a component
     */
    getVersions(componentName) {
        const entries = this.components.get(componentName);
        return entries ? entries.map((e) => e.version).sort((a, b) => b - a) : [];
    }
    /**
     * Get component metadata
     */
    getMetadata(componentName, version) {
        const entries = this.components.get(componentName);
        if (!entries)
            return null;
        if (version) {
            const entry = entries.find((e) => e.version === version);
            return entry ? { ...entry } : null;
        }
        // Return latest version metadata
        const latest = entries[0];
        return latest ? { ...latest } : null;
    }
    /**
     * Set default negotiation strategy
     */
    setDefaultStrategy(strategy) {
        this.defaultStrategy = strategy;
        logger_1.logger.info("Default version negotiation strategy updated", { strategy });
    }
    /**
     * Get component name from component
     */
    getComponentName(component) {
        return component.displayName || component.name || "UnknownComponent";
    }
    /**
     * Get registry statistics
     */
    getStats() {
        let totalVersions = 0;
        let deprecatedCount = 0;
        const componentBreakdown = {};
        for (const [componentName, entries] of this.components.entries()) {
            const versions = entries.length;
            const latest = entries[0]?.version || 0;
            const deprecated = entries.some((e) => e.deprecated);
            totalVersions += versions;
            if (deprecated)
                deprecatedCount++;
            componentBreakdown[componentName] = {
                versions,
                latest,
                deprecated,
            };
        }
        return {
            totalComponents: this.components.size,
            totalVersions,
            deprecatedCount,
            componentBreakdown,
        };
    }
    /**
     * Clear all registered components
     */
    clear() {
        this.components.clear();
        this.fallbackRegistry.clear();
        logger_1.logger.info("Versioned component registry cleared");
    }
}
// Global registry instance
exports.versionedRegistry = new VersionedComponentRegistry();
// Register existing components with version information
exports.versionedRegistry.register({
    component: SDUI_1.InfoBanner,
    version: 2,
    minCompatibleVersion: 1,
    maxCompatibleVersion: 2,
    description: "Information banner with title and content",
    requiredProps: ["title"],
    optionalProps: ["variant", "actions"],
    tags: ["ui", "information"],
});
exports.versionedRegistry.register({
    component: DiscoveryCard_1.DiscoveryCard,
    version: 2,
    minCompatibleVersion: 1,
    maxCompatibleVersion: 2,
    description: "Discovery card for exploring content",
    requiredProps: ["title"],
    optionalProps: ["description", "variant"],
    tags: ["ui", "discovery"],
});
exports.versionedRegistry.register({
    component: ValueTreeCard_1.ValueTreeCard,
    version: 1,
    description: "Value tree visualization card",
    requiredProps: ["value"],
    optionalProps: ["title", "description"],
    tags: ["ui", "value", "visualization"],
});
exports.versionedRegistry.register({
    component: SDUI_1.DataTable,
    version: 1,
    description: "Data table with sorting and filtering",
    requiredProps: ["data"],
    optionalProps: ["columns", "sortable", "filterable"],
    tags: ["ui", "data", "table"],
});
exports.versionedRegistry.register({
    component: KPIForm_1.KPIForm,
    version: 1,
    description: "Form for entering/editing KPI values",
    requiredProps: ["kpis"],
    optionalProps: ["values", "onChange", "onSubmit", "readOnly"],
    tags: ["ui", "form", "kpi"],
});
exports.versionedRegistry.register({
    component: InteractiveChart_1.InteractiveChart,
    version: 1,
    description: "Recharts-based chart supporting bar, line, area, and pie types",
    requiredProps: ["type", "data"],
    optionalProps: ["title", "xAxisLabel", "yAxisLabel", "colors", "height", "showLegend", "showTooltip"],
    tags: ["ui", "chart", "visualization"],
});
exports.versionedRegistry.register({
    component: NarrativeBlock_1.NarrativeBlock,
    version: 1,
    description: "Typed narrative text block with metadata and sources",
    requiredProps: ["content"],
    optionalProps: ["author", "timestamp", "type", "confidence", "sources"],
    tags: ["ui", "narrative", "text"],
});
exports.versionedRegistry.register({
    component: IntegrityVetoPanel_1.IntegrityVetoPanel,
    version: 1,
    description: "Integrity review panel with issue list, severity colors, and resolve modal",
    requiredProps: ["issues", "onResolve", "onDismiss"],
    tags: ["ui", "integrity", "agent"],
});
exports.versionedRegistry.register({
    component: WorkflowStatusBar_1.WorkflowStatusBar,
    version: 1,
    description: "Horizontal progress bar showing workflow stages",
    requiredProps: ["stages", "currentStageId"],
    optionalProps: ["agentName", "confidence", "startedAt"],
    tags: ["ui", "workflow", "status"],
});
// Register fallback components
exports.versionedRegistry.registerFallback({
    component: SDUI_1.UnknownComponentFallback,
    version: 1,
    description: "Fallback for unknown components",
    tags: ["fallback", "error"],
});
/**
 * Resolve component with version negotiation
 */
function resolveComponentWithVersion(componentName, requestedVersion, strategy) {
    return exports.versionedRegistry.resolve(componentName, requestedVersion, strategy);
}
/**
 * Legacy resolveComponent for backward compatibility
 */
function resolveComponentLegacy(componentName) {
    const result = exports.versionedRegistry.resolve(componentName);
    return result.component;
}
/**
 * Get registry placeholder component for unknown components
 */
const RegistryPlaceholderComponent = ({ componentName, }) => ((0, jsx_runtime_1.jsx)("div", { className: "p-4 border border-gray-300 rounded bg-gray-50 text-center text-gray-500", children: (0, jsx_runtime_1.jsxs)("span", { className: "text-sm", children: ["Component not found: ", componentName] }) }));
exports.RegistryPlaceholderComponent = RegistryPlaceholderComponent;
// Legacy registry placeholder for backward compatibility
exports.baseRegistry = {
    WorkflowStatusBar: {
        component: WorkflowStatusBar_1.WorkflowStatusBar,
        versions: [1],
        requiredProps: ["stages", "currentStageId"],
        description: "Real-time workflow progress bar showing current stage, agent, and confidence.",
    },
    HumanCheckpoint: {
        component: HumanCheckpoint_1.HumanCheckpoint,
        versions: [1],
        requiredProps: ["stageId", "agentName", "action", "riskLevel", "onApprove", "onReject"],
        description: "Human approval interface for high-risk workflow stages.",
    },
    ConfidenceDisplay: {
        component: ConfidenceDisplay_1.ConfidenceDisplay,
        versions: [1],
        requiredProps: [],
        description: "Displays agent confidence levels and hallucination status with regeneration options.",
    },
    ComponentPreview: {
        component: SDUI_2.ComponentPreview,
        versions: [1],
        requiredProps: ["intentType", "componentName", "registryEntry", "organizationId"],
        description: "Developer preview tool for ui-registry.json entries with validation.",
    },
    DiscoveryCard: {
        component: DiscoveryCard_1.DiscoveryCard,
        versions: [1],
        requiredProps: ["title"],
        description: "Card showing a discovered value opportunity with status and confidence.",
    },
    KPIForm: {
        component: KPIForm_1.KPIForm,
        versions: [1],
        requiredProps: ["kpis"],
        description: "Form for entering/editing KPI values with type-appropriate inputs.",
    },
    InteractiveChart: {
        component: InteractiveChart_1.InteractiveChart,
        versions: [1],
        requiredProps: ["type", "data"],
        description: "Recharts-based chart supporting bar, line, area, and pie types.",
    },
    ValueTreeCard: {
        component: ValueTreeCard_1.ValueTreeCard,
        versions: [1],
        requiredProps: ["nodes"],
        description: "Hierarchical tree visualization of value decomposition.",
    },
    NarrativeBlock: {
        component: NarrativeBlock_1.NarrativeBlock,
        versions: [1],
        requiredProps: ["content"],
        description: "Typed narrative text block with metadata and sources.",
    },
    IntegrityVetoPanel: {
        component: IntegrityVetoPanel_1.IntegrityVetoPanel,
        versions: [1],
        requiredProps: ["issues", "onResolve", "onDismiss"],
        description: "Integrity review panel with issue list, severity colors, and resolve modal.",
    },
};
// Initialize registry after baseRegistry is defined
const registry = new Map(Object.entries(exports.baseRegistry));
/**
 * Resolve component from registry (legacy function)
 */
function resolveComponentFromLegacyRegistry(section) {
    const entry = registry.get(section.component);
    if (!entry)
        return undefined;
    if (!entry.versions.includes(section.version)) {
        return {
            ...entry,
            description: `${entry.description ?? ""} (coerced version)`,
        };
    }
    return entry;
}
/**
 * Resolve component from registry (legacy function)
 */
function resolveComponentFromVersionedRegistry(section) {
    const result = exports.versionedRegistry.resolve(section.component || section.type, section.version);
    return result.component;
}
function listRegisteredComponents() {
    return Array.from(registry.values());
}
function getRegistryEntry(name) {
    return registry.get(name);
}
function registerComponent(name, entry) {
    registry.set(name, entry);
}
function resetRegistry() {
    registry.clear();
    Object.entries(exports.baseRegistry).forEach(([name, entry]) => registry.set(name, entry));
}
function hotSwapComponent(name, component) {
    const current = registry.get(name);
    if (!current)
        return undefined;
    const updated = { ...current, component };
    registry.set(name, updated);
    return updated;
}
const SectionErrorWrapper = ({ componentName, children }) => ((0, jsx_runtime_1.jsx)(SDUI_1.SectionErrorFallback, { componentName: componentName, children: children }));
exports.SectionErrorWrapper = SectionErrorWrapper;
//# sourceMappingURL=registry.js.map