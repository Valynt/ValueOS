import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DataTable, InfoBanner, SectionErrorFallback, UnknownComponentFallback,
// Fallbacks
 } from "./components/SDUI";
import { DiscoveryCard } from "./components/SDUI/DiscoveryCard";
import { KPIForm } from "./components/SDUI/KPIForm";
import { InteractiveChart } from "./components/SDUI/InteractiveChart";
import { ValueTreeCard } from "./components/SDUI/ValueTreeCard";
import { NarrativeBlock } from "./components/SDUI/NarrativeBlock";
import { WorkflowStatusBar } from "./components/Workflow/WorkflowStatusBar";
import { HumanCheckpoint } from "./components/Workflow/HumanCheckpoint";
import { ConfidenceDisplay } from "./components/Agent/ConfidenceDisplay";
import { IntegrityVetoPanel } from "./components/Agent/IntegrityVetoPanel";
import { ComponentPreview } from "./components/SDUI";
import { logger } from "@shared/lib/logger";
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
        logger.info("Component version registered", {
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
        logger.info("Fallback component registered", {
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
            logger.warn("Using fallback component", {
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
        logger.error("Component not found and no fallback available", {
            componentName,
            requestedVersion,
        });
        return {
            component: UnknownComponentFallback,
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
        logger.info("Default version negotiation strategy updated", { strategy });
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
        logger.info("Versioned component registry cleared");
    }
}
// Global registry instance
export const versionedRegistry = new VersionedComponentRegistry();
// Register existing components with version information
versionedRegistry.register({
    component: InfoBanner,
    version: 2,
    minCompatibleVersion: 1,
    maxCompatibleVersion: 2,
    description: "Information banner with title and content",
    requiredProps: ["title"],
    optionalProps: ["variant", "actions"],
    tags: ["ui", "information"],
});
versionedRegistry.register({
    component: DiscoveryCard,
    version: 2,
    minCompatibleVersion: 1,
    maxCompatibleVersion: 2,
    description: "Discovery card for exploring content",
    requiredProps: ["title"],
    optionalProps: ["description", "variant"],
    tags: ["ui", "discovery"],
});
versionedRegistry.register({
    component: ValueTreeCard,
    version: 1,
    description: "Value tree visualization card",
    requiredProps: ["value"],
    optionalProps: ["title", "description"],
    tags: ["ui", "value", "visualization"],
});
versionedRegistry.register({
    component: DataTable,
    version: 1,
    description: "Data table with sorting and filtering",
    requiredProps: ["data"],
    optionalProps: ["columns", "sortable", "filterable"],
    tags: ["ui", "data", "table"],
});
versionedRegistry.register({
    component: KPIForm,
    version: 1,
    description: "Form for entering/editing KPI values",
    requiredProps: ["kpis"],
    optionalProps: ["values", "onChange", "onSubmit", "readOnly"],
    tags: ["ui", "form", "kpi"],
});
versionedRegistry.register({
    component: InteractiveChart,
    version: 1,
    description: "Recharts-based chart supporting bar, line, area, and pie types",
    requiredProps: ["type", "data"],
    optionalProps: ["title", "xAxisLabel", "yAxisLabel", "colors", "height", "showLegend", "showTooltip"],
    tags: ["ui", "chart", "visualization"],
});
versionedRegistry.register({
    component: NarrativeBlock,
    version: 1,
    description: "Typed narrative text block with metadata and sources",
    requiredProps: ["content"],
    optionalProps: ["author", "timestamp", "type", "confidence", "sources"],
    tags: ["ui", "narrative", "text"],
});
versionedRegistry.register({
    component: IntegrityVetoPanel,
    version: 1,
    description: "Integrity review panel with issue list, severity colors, and resolve modal",
    requiredProps: ["issues", "onResolve", "onDismiss"],
    tags: ["ui", "integrity", "agent"],
});
versionedRegistry.register({
    component: WorkflowStatusBar,
    version: 1,
    description: "Horizontal progress bar showing workflow stages",
    requiredProps: ["stages", "currentStageId"],
    optionalProps: ["agentName", "confidence", "startedAt"],
    tags: ["ui", "workflow", "status"],
});
// Register fallback components
versionedRegistry.registerFallback({
    component: UnknownComponentFallback,
    version: 1,
    description: "Fallback for unknown components",
    tags: ["fallback", "error"],
});
/**
 * Resolve component with version negotiation
 */
export function resolveComponentWithVersion(componentName, requestedVersion, strategy) {
    return versionedRegistry.resolve(componentName, requestedVersion, strategy);
}
/**
 * Legacy resolveComponent for backward compatibility
 */
export function resolveComponentLegacy(componentName) {
    const result = versionedRegistry.resolve(componentName);
    return result.component;
}
/**
 * Get registry placeholder component for unknown components
 */
export const RegistryPlaceholderComponent = ({ componentName, }) => (_jsx("div", { className: "p-4 border border-gray-300 rounded bg-gray-50 text-center text-gray-500", children: _jsxs("span", { className: "text-sm", children: ["Component not found: ", componentName] }) }));
// Legacy registry placeholder for backward compatibility
export const baseRegistry = {
    WorkflowStatusBar: {
        component: WorkflowStatusBar,
        versions: [1],
        requiredProps: ["stages", "currentStageId"],
        description: "Real-time workflow progress bar showing current stage, agent, and confidence.",
    },
    HumanCheckpoint: {
        component: HumanCheckpoint,
        versions: [1],
        requiredProps: ["stageId", "agentName", "action", "riskLevel", "onApprove", "onReject"],
        description: "Human approval interface for high-risk workflow stages.",
    },
    ConfidenceDisplay: {
        component: ConfidenceDisplay,
        versions: [1],
        requiredProps: [],
        description: "Displays agent confidence levels and hallucination status with regeneration options.",
    },
    ComponentPreview: {
        component: ComponentPreview,
        versions: [1],
        requiredProps: ["intentType", "componentName", "registryEntry", "organizationId"],
        description: "Developer preview tool for ui-registry.json entries with validation.",
    },
    DiscoveryCard: {
        component: DiscoveryCard,
        versions: [1],
        requiredProps: ["title"],
        description: "Card showing a discovered value opportunity with status and confidence.",
    },
    KPIForm: {
        component: KPIForm,
        versions: [1],
        requiredProps: ["kpis"],
        description: "Form for entering/editing KPI values with type-appropriate inputs.",
    },
    InteractiveChart: {
        component: InteractiveChart,
        versions: [1],
        requiredProps: ["type", "data"],
        description: "Recharts-based chart supporting bar, line, area, and pie types.",
    },
    ValueTreeCard: {
        component: ValueTreeCard,
        versions: [1],
        requiredProps: ["nodes"],
        description: "Hierarchical tree visualization of value decomposition.",
    },
    NarrativeBlock: {
        component: NarrativeBlock,
        versions: [1],
        requiredProps: ["content"],
        description: "Typed narrative text block with metadata and sources.",
    },
    IntegrityVetoPanel: {
        component: IntegrityVetoPanel,
        versions: [1],
        requiredProps: ["issues", "onResolve", "onDismiss"],
        description: "Integrity review panel with issue list, severity colors, and resolve modal.",
    },
};
// Initialize registry after baseRegistry is defined
const registry = new Map(Object.entries(baseRegistry));
/**
 * Resolve component from registry (legacy function)
 */
export function resolveComponentFromLegacyRegistry(section) {
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
export function resolveComponentFromVersionedRegistry(section) {
    const result = versionedRegistry.resolve(section.component || section.type, section.version);
    return result.component;
}
export function listRegisteredComponents() {
    return Array.from(registry.values());
}
export function getRegistryEntry(name) {
    return registry.get(name);
}
export function registerComponent(name, entry) {
    registry.set(name, entry);
}
export function resetRegistry() {
    registry.clear();
    Object.entries(baseRegistry).forEach(([name, entry]) => registry.set(name, entry));
}
export function hotSwapComponent(name, component) {
    const current = registry.get(name);
    if (!current)
        return undefined;
    const updated = { ...current, component };
    registry.set(name, updated);
    return updated;
}
export const SectionErrorWrapper = ({ componentName, children }) => (_jsx(SectionErrorFallback, { componentName: componentName, children: children }));
//# sourceMappingURL=registry.js.map