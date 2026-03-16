import React, { useEffect, useMemo } from "react";

import { ComponentErrorBoundary } from "./components/ComponentErrorBoundary";
import { SectionErrorFallback } from "./components/SDUI";
import {
  DashboardPanel,
  Grid,
  HorizontalSplit,
  VerticalSplit,
} from "./components/SDUI/CanvasLayout/index";
import { DataBindingResolver } from "./DataBindingResolver";
import { DataSourceContext } from "./DataBindingSchema";
import {
  preloadCriticalComponents,
  resolveComponentLazy,
} from "./LazyComponentRegistry";
import { createLogger } from "./lib/logger";
import { RegistryPlaceholderComponent, resolveComponentWithVersion } from "./registry";
import { SDUIComponentSection, SDUIPageDefinition, validateSDUISchema } from "./schema";
import { useSchemaStore } from "./SchemaStore";
import { incrementSecurityMetric } from "./security/metrics";
import { sanitizeProps } from "./security/sanitization";
import { useValidatedDataBindings } from "./typeSafeHydration";

const logger = createLogger({ component: "SDUIRenderer" });

interface SDUIRendererProps {
  schema?: unknown; // Optional when using streaming
  schemaId?: string; // For streaming mode
  enableStreaming?: boolean;
  wsUrl?: string; // WebSocket URL for streaming
  debugOverlay?: boolean;
  onValidationError?: (errors: string[]) => void;
  onHydrationWarning?: (warnings: string[]) => void;
  dataBindingResolver?: DataBindingResolver;
  dataSourceContext?: DataSourceContext;
}

interface HydrationTraceProps {
  section: SDUIComponentSection;
  status: "rendered" | "placeholder" | "error";
  warning?: string;
}

const HydrationTrace: React.FC<HydrationTraceProps> = ({ section, status, warning }) => {
  const tone =
    status === "rendered"
      ? "text-emerald-700 bg-emerald-50"
      : status === "error"
        ? "text-red-700 bg-red-50"
        : "text-amber-700 bg-amber-50";
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{section.component}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
          v{section.version}
        </span>
      </div>
      <p className="text-[11px] text-current/80">Status: {status}</p>
      {warning && <p className="text-[11px] text-current/80">{warning}</p>}
    </div>
  );
};

const InvalidSchemaFallback: React.FC<{ errors: string[] }> = ({ errors }) => (
  <div
    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
    role="alert"
    data-testid="invalid-schema"
  >
    <p className="text-sm font-semibold mb-2">SDUI schema failed validation</p>
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  </div>
);

/**
 * Component wrapper that resolves data bindings with type validation
 */
const ComponentWithBindings: React.FC<{
  section: SDUIComponentSection;
  Component: React.ComponentType<Record<string, unknown>>;
  resolver?: DataBindingResolver;
  context?: DataSourceContext;
  debugOverlay?: boolean;
}> = ({ section, Component, resolver, context, debugOverlay }) => {
  // If no resolver or context, render with sanitized props (no binding resolution)
  if (!resolver || !context) {
    const sanitized = sanitizeProps(section.props as Record<string, unknown>, section.component);
    return (
      <>
        <Component {...sanitized} />
        {debugOverlay && (
          <HydrationTrace
            section={section}
            status="rendered"
            warning="No data binding resolver configured"
          />
        )}
      </>
    );
  }

  // Resolve data bindings with type validation
  const {
    props: resolvedProps,
    loading,
    errors: bindingErrors,
    validationErrors,
    validationWarnings,
    refresh,
  } = useValidatedDataBindings(section.props as Record<string, unknown>, {
    resolver,
    context,
    componentName: section.component,
    componentVersion: section.version,
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  // Check for validation errors
  if (validationErrors.length > 0) {
    logger.error("Component prop validation failed", {
      component: section.component,
      version: section.version,
      errors: validationErrors,
    });

    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded">
        <p className="font-semibold">Schema Validation Error</p>
        <ul className="list-disc pl-5 mt-2">
          {validationErrors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
        {debugOverlay && (
          <HydrationTrace
            section={section}
            status="error"
            warning={`Validation errors: ${validationErrors.length}`}
          />
        )}
      </div>
    );
  }

  // Check for binding resolution errors
  if (Object.keys(bindingErrors).length > 0) {
    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded">
        Failed to resolve data bindings: {bindingErrors._global || "Unknown error"}
      </div>
    );
  }

  // Sanitize props before rendering
  const sanitizedProps = sanitizeProps(resolvedProps, section.component);

  // Log validation warnings
  if (validationWarnings.length > 0 && debugOverlay) {
    logger.warn("Component validation warnings", {
      component: section.component,
      warnings: validationWarnings,
    });
  }

  return (
    <>
      <Component {...sanitizedProps} />
      {debugOverlay && (
        <HydrationTrace
          section={section}
          status="rendered"
          warning={
            validationWarnings.length > 0
              ? `Warnings: ${validationWarnings.join(", ")}`
              : "Data bindings resolved successfully"
          }
        />
      )}
    </>
  );
};

/**
 * Maximum recursion depth for nested layouts
 */
const MAX_RENDER_DEPTH = 10;

/**
 * Renders a single SDUI section with full error isolation, type-safe hydration, and lazy loading for non-critical widgets.
 */
const renderSection = (
  section: unknown,
  index: number,
  debugOverlay?: boolean,
  resolver?: DataBindingResolver,
  context?: DataSourceContext,
  depth: number = 0
): React.ReactNode => {
  // SECURITY: Prevent stack overflow from deeply nested schemas
  if (depth > MAX_RENDER_DEPTH) {
    logger.error(
      "Max render depth exceeded - possible malicious schema",
      new Error("Stack overflow"),
      {
        depth,
        component: (section as Record<string, unknown>)?.component || "unknown",
        type: (section as Record<string, unknown>)?.type || "unknown",
      }
    );
    incrementSecurityMetric("recursion_limit", {
      depth,
      section: (section as Record<string, unknown>)?.component,
    });
    return (
      <div
        key={`depth-limit-${index}`}
        className="p-4 border border-red-500 bg-red-50 text-red-900"
      >
        <p className="font-semibold">Layout too deeply nested</p>
        <p className="text-sm">
          Maximum nesting depth ({MAX_RENDER_DEPTH}) exceeded. This may indicate a malformed schema.
        </p>
      </div>
    );
  }
  // Handle layout types (VerticalSplit, HorizontalSplit, Grid, DashboardPanel)
  if (
    typeof section === "object" && section !== null &&
    "type" in section &&
    typeof (section as Record<string, unknown>).type === "string" &&
    ["VerticalSplit", "HorizontalSplit", "Grid", "DashboardPanel"].includes(
      (section as Record<string, string>).type
    )
  ) {
    const sec = section as Record<string, unknown> & { type: string; children?: unknown[]; slots?: Record<string, unknown> };
    const key = `layout-${sec.type}-${index}`;
    // Recursively render children with depth tracking
    const childNodes =
      Array.isArray(sec.children)
        ? sec.children.map((child, i) =>
            renderSection(child, i, debugOverlay, resolver, context, depth + 1)
          )
        : [];
    const slotNodes = sec.slots
      ? {
          primary: sec.slots.primary
            ? renderSection(sec.slots.primary, 0, debugOverlay, resolver, context, depth + 1)
            : undefined,
          secondary: sec.slots.secondary
            ? renderSection(sec.slots.secondary, 1, debugOverlay, resolver, context, depth + 1)
            : undefined,
          header: sec.slots.header
            ? renderSection(sec.slots.header, 2, debugOverlay, resolver, context, depth + 1)
            : undefined,
          footer: sec.slots.footer
            ? renderSection(sec.slots.footer, 3, debugOverlay, resolver, context, depth + 1)
            : undefined,
        }
      : undefined;
    // Always wrap layout in error boundary for isolation
    const LayoutComponent =
      sec.type === "VerticalSplit"
        ? VerticalSplit
        : sec.type === "HorizontalSplit"
          ? HorizontalSplit
          : sec.type === "Grid"
            ? Grid
            : DashboardPanel;
    return (
      <ComponentErrorBoundary
        key={key}
        componentName={sec.type}
        fallback={<SectionErrorFallback componentName={sec.type} />}
        circuitBreaker={{ failureThreshold: 3, recoveryTimeout: 30000, monitoringPeriod: 300000 }}
      >
        <LayoutComponent {...sec} key={key} slots={slotNodes}>
          {childNodes}
        </LayoutComponent>
      </ComponentErrorBoundary>
    );
  }

  // Handle component types (original logic)
  const componentSection = section as SDUIComponentSection;

  // Determine if component should be lazy loaded (non-critical widgets)
  const criticalComponents = [
    "AgentResponseCard",
    "TextBlock",
    "InfoBanner",
    "SectionErrorFallback",
    "UnknownComponentFallback",
    "MetricBadge",
  ];
  const shouldLazyLoad = !criticalComponents.includes(componentSection.component);
  let entry;
  if (shouldLazyLoad) {
    entry = resolveComponentLazy(componentSection);
    // Fall back to versionedRegistry when LazyComponentRegistry has no metadata
    if (!entry || !entry.component) {
      entry = resolveComponentWithVersion(componentSection.component, componentSection.version);
    }
  } else {
    entry = resolveComponentWithVersion(componentSection.component, componentSection.version);
  }
  if (!entry || !entry.component) {
    // Log missing component for monitoring
    incrementSecurityMetric("component_not_found", {
      component: componentSection.component,
      version: componentSection.version,
    });
    return (
      <div key={`${componentSection.component}-${index}`}>
        <RegistryPlaceholderComponent componentName={componentSection.component} />
        {debugOverlay && (
          <HydrationTrace
            section={componentSection}
            status="placeholder"
            warning="Component not found in registry"
          />
        )}
      </div>
    );
  }
  const Component = entry.component;
  // Always wrap every widget in an error boundary for full isolation
  return (
    <div key={`${componentSection.component}-${index}`} className="space-y-2">
      <ComponentErrorBoundary
        componentName={componentSection.component}
        fallback={<SectionErrorFallback componentName={componentSection.component} />}
        circuitBreaker={{
          failureThreshold: 3,
          recoveryTimeout: 30000,
          monitoringPeriod: 300000,
        }}
        retryConfig={{
          maxAttempts: 2,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 10000,
        }}
      >
        {/* Strict type-safe hydration: only render if validation passes */}
        <ComponentWithBindings
          section={componentSection}
          Component={Component}
          resolver={resolver}
          context={context}
          debugOverlay={debugOverlay}
        />
      </ComponentErrorBoundary>
    </div>
  );
};

export const SDUIRenderer: React.FC<SDUIRendererProps> = ({
  schema,
  schemaId,
  enableStreaming = false,
  wsUrl,
  debugOverlay = false,
  onValidationError,
  onHydrationWarning,
  dataBindingResolver,
  dataSourceContext,
}) => {
  const schemaStore = useSchemaStore();

  // Preload critical components on mount
  useEffect(() => {
    preloadCriticalComponents();
  }, []);

  // Start streaming if enabled and schemaId provided
  useEffect(() => {
    if (enableStreaming && schemaId) {
      schemaStore.startStreaming(schemaId, wsUrl);
      return () => {
        schemaStore.stopStreaming();
      };
    }
    return;
  }, [enableStreaming, schemaId, wsUrl, schemaStore]);

  // Determine which schema to use
  const currentSchema = enableStreaming ? schemaStore.current : schema;

  // If streaming and no schema yet, show loading
  if (enableStreaming && !currentSchema) {
    return (
      <div className="space-y-4" data-testid="sdui-renderer">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
        <p className="text-sm text-gray-500">Waiting for schema...</p>
      </div>
    );
  }

  // If no schema at all, return empty
  if (!currentSchema) {
    return (
      <div className="space-y-4" data-testid="sdui-renderer">
        <p className="text-sm text-gray-500">No schema provided</p>
      </div>
    );
  }

  // Check nesting depth before schema validation so deeply nested schemas
  // show a meaningful error rather than a generic Zod validation failure.
  const nestingDepth = useMemo(() => {
    function measureDepth(node: unknown, d: number): number {
      if (!node || typeof node !== "object" || d > MAX_RENDER_DEPTH + 5) return d;
      const n = node as Record<string, unknown>;
      const children = Array.isArray(n.children) ? (n.children as unknown[]) : [];
      const sections = Array.isArray(n.sections) ? (n.sections as unknown[]) : [];
      const all = [...children, ...sections];
      if (all.length === 0) return d;
      return Math.max(...all.map((c) => measureDepth(c, d + 1)));
    }
    return measureDepth(currentSchema, 0);
  }, [currentSchema]);

  if (nestingDepth > MAX_RENDER_DEPTH) {
    incrementSecurityMetric("recursion_limit", { depth: nestingDepth });
    return (
      <div className="p-4 border border-red-500 bg-red-50 text-red-900">
        <p className="font-semibold">Layout too deeply nested</p>
        <p className="text-sm">
          Maximum nesting depth ({MAX_RENDER_DEPTH}) exceeded. This may indicate a malformed schema.
        </p>
      </div>
    );
  }

  const validation = useMemo(() => validateSDUISchema(currentSchema), [currentSchema]);

  if (!validation.success) {
    // Track invalid schemas for security monitoring
    incrementSecurityMetric("invalid_schema", {
      errors: validation.errors,
    });
    onValidationError?.(validation.errors);
    return <InvalidSchemaFallback errors={validation.errors} />;
  }

  if (validation.warnings.length) {
    onHydrationWarning?.(validation.warnings);
  }

  const page: SDUIPageDefinition = validation.page;

  return (
    <div className="space-y-4" data-testid="sdui-renderer">
      {page.sections.map((section, index) =>
        renderSection(
          section,
          index,
          debugOverlay || page.metadata?.debug,
          dataBindingResolver,
          dataSourceContext
        )
      )}
    </div>
  );
};