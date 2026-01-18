import React from "react";
import { SDUIComponentSection } from "./schema";
import {
  AgentResponseCard,
  AgentWorkflowPanel,
  Breadcrumbs,
  ConfidenceIndicator,
  DataTable,
  DiscoveryCard,
  ExpansionBlock,
  InfoBanner,
  IntegrityReviewPanel,
  KPIForm,
  LifecyclePanel,
  MetricBadge,
  NarrativeBlock,
  RealizationDashboard,
  ScenarioSelector,
  SDUIForm,
  SectionErrorFallback,
  SideNavigation,
  TabBar,
  UnknownComponentFallback,
  ValueCommitForm,
  ValueTreeCard,
  // Fallbacks
  JsonViewer,
  TextBlock,
  ConfirmationDialog,
  ValueHypothesisCard,
  ProgressBar,
} from "./components/SDUI";
import {
  DashboardPanel,
  Grid,
  HorizontalSplit,
  VerticalSplit,
} from "./components/SDUI/CanvasLayout";
import { WorkflowStatusBar } from "./components/Workflow/WorkflowStatusBar";
import { HumanCheckpoint } from "./components/Workflow/HumanCheckpoint";
import { ConfidenceDisplay } from "./components/Agent/ConfidenceDisplay";
import { ComponentPreview } from "./components/SDUI";
import { logger } from "@shared/lib/logger";

/**
 * Versioned component entry with compatibility information
 */
export interface VersionedComponentEntry {
  component: React.ComponentType<any>;
  version: number;
  minCompatibleVersion?: number;
  maxCompatibleVersion?: number;
  deprecated?: boolean;
  deprecationMessage?: string;
  migrationPath?: string;
  requiredProps?: string[];
  optionalProps?: string[];
  description?: string;
  author?: string;
  tags?: string[];
}

/**
 * Legacy registry entry for backward compatibility
 */
export interface RegistryEntry {
  component: React.ComponentType<any>;
  versions: number[];
  requiredProps?: string[];
  description?: string;
}

/**
 * Component resolution result
 */
export interface ComponentResolutionResult {
  component: React.ComponentType<any>;
  version: number;
  isFallback: boolean;
  isDeprecated: boolean;
  deprecationMessage?: string;
  migrationPath?: string;
}

/**
 * Version negotiation strategy
 */
export type VersionNegotiationStrategy =
  | "exact" // Only exact version match
  | "compatible" // Use compatible version range
  | "latest" // Always use latest version
  | "fallback"; // Use fallback if exact not found

/**
 * Versioned Component Registry
 *
 * Manages component versions with backward compatibility and fallback support
 */
class VersionedComponentRegistry {
  private components: Map<string, VersionedComponentEntry[]> = new Map();
  private fallbackRegistry: Map<string, VersionedComponentEntry[]> = new Map();
  private defaultStrategy: VersionNegotiationStrategy = "compatible";

  /**
   * Register a component version
   */
  register(entry: VersionedComponentEntry): void {
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
  registerFallback(entry: VersionedComponentEntry): void {
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
  resolve(
    componentName: string,
    requestedVersion?: number,
    strategy: VersionNegotiationStrategy = this.defaultStrategy
  ): ComponentResolutionResult {
    const entries = this.components.get(componentName);

    if (!entries || entries.length === 0) {
      return this.resolveFallback(componentName, requestedVersion, strategy);
    }

    let targetEntry: VersionedComponentEntry | undefined;

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
  private findCompatibleVersion(
    entries: VersionedComponentEntry[],
    requestedVersion?: number
  ): VersionedComponentEntry | undefined {
    if (!requestedVersion) {
      return entries[0]; // Latest version
    }

    // Try exact match first
    const exact = entries.find((e) => e.version === requestedVersion);
    if (exact) return exact;

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
  private isVersionCompatible(entry: VersionedComponentEntry, requestedVersion: number): boolean {
    const { version, minCompatibleVersion, maxCompatibleVersion } = entry;

    if (version === requestedVersion) return true;

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
  private resolveFallback(
    componentName: string,
    requestedVersion?: number,
    strategy: VersionNegotiationStrategy = "fallback"
  ): ComponentResolutionResult {
    const fallbacks = this.fallbackRegistry.get(componentName);

    if (fallbacks && fallbacks.length > 0) {
      const fallback = fallbacks[0]!; // Latest fallback version

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
  getVersions(componentName: string): number[] {
    const entries = this.components.get(componentName);
    return entries ? entries.map((e) => e.version).sort((a, b) => b - a) : [];
  }

  /**
   * Get component metadata
   */
  getMetadata(
    componentName: string,
    version?: number
  ): Omit<VersionedComponentEntry, "component"> | null {
    const entries = this.components.get(componentName);
    if (!entries) return null;

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
  setDefaultStrategy(strategy: VersionNegotiationStrategy): void {
    this.defaultStrategy = strategy;
    logger.info("Default version negotiation strategy updated", { strategy });
  }

  /**
   * Get component name from component
   */
  private getComponentName(component: React.ComponentType<any>): string {
    return component.displayName || component.name || "UnknownComponent";
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalComponents: number;
    totalVersions: number;
    deprecatedCount: number;
    componentBreakdown: Record<string, { versions: number; latest: number; deprecated: boolean }>;
  } {
    let totalVersions = 0;
    let deprecatedCount = 0;
    const componentBreakdown: Record<
      string,
      { versions: number; latest: number; deprecated: boolean }
    > = {};

    for (const [componentName, entries] of this.components.entries()) {
      const versions = entries.length;
      const latest = entries[0]?.version || 0;
      const deprecated = entries.some((e) => e.deprecated);

      totalVersions += versions;
      if (deprecated) deprecatedCount++;

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
  clear(): void {
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
export function resolveComponentWithVersion(
  componentName: string,
  requestedVersion?: number,
  strategy?: VersionNegotiationStrategy
): ComponentResolutionResult {
  return versionedRegistry.resolve(componentName, requestedVersion, strategy);
}

/**
 * Legacy resolveComponent for backward compatibility
 */
export function resolveComponentLegacy(componentName: string): React.ComponentType<any> | null {
  const result = versionedRegistry.resolve(componentName);
  return result.component;
}

/**
 * Get registry placeholder component for unknown components
 */
export const RegistryPlaceholderComponent: React.ComponentType<any> = ({
  componentName,
}: {
  componentName: string;
}) => (
  <div className="p-4 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
    <span className="text-sm">Component not found: {componentName}</span>
  </div>
);

// Legacy registry placeholder for backward compatibility
export const baseRegistry: Record<string, RegistryEntry> = {
  WorkflowStatusBar: {
    component: WorkflowStatusBar,
    versions: [1],
    requiredProps: [],
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
    description:
      "Displays agent confidence levels and hallucination status with regeneration options.",
  },
  ComponentPreview: {
    component: ComponentPreview,
    versions: [1],
    requiredProps: ["intentType", "componentName", "registryEntry", "organizationId"],
    description: "Developer preview tool for ui-registry.json entries with validation.",
  },
};

// Initialize registry after baseRegistry is defined
const registry = new Map<string, RegistryEntry>(Object.entries(baseRegistry));

/**
 * Resolve component from registry (legacy function)
 */
export function resolveComponentFromLegacyRegistry(
  section: SDUIComponentSection
): RegistryEntry | undefined {
  const entry = registry.get(section.component);
  if (!entry) return undefined;
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
export function resolveComponentFromVersionedRegistry(
  section: any
): React.ComponentType<any> | null {
  const result = versionedRegistry.resolve(section.component || section.type, section.version);
  return result.component;
}

export function listRegisteredComponents(): RegistryEntry[] {
  return Array.from(registry.values());
}

export function getRegistryEntry(name: string): RegistryEntry | undefined {
  return registry.get(name);
}

export function registerComponent(name: string, entry: RegistryEntry): void {
  registry.set(name, entry);
}

export function resetRegistry(): void {
  registry.clear();
  Object.entries(baseRegistry).forEach(([name, entry]) => registry.set(name, entry));
}

export function hotSwapComponent(
  name: string,
  component: React.ComponentType<any>
): RegistryEntry | undefined {
  const current = registry.get(name);
  if (!current) return undefined;
  const updated: RegistryEntry = { ...current, component };
  registry.set(name, updated);
  return updated;
}

export const SectionErrorWrapper: React.FC<{
  componentName: string;
  children: React.ReactNode;
}> = ({ componentName, children }) => (
  <SectionErrorFallback componentName={componentName}>{children}</SectionErrorFallback>
);
