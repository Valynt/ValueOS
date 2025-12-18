import React, { useMemo } from "react";
import {
  DashboardPanel,
  Grid,
  HorizontalSplit,
  VerticalSplit,
} from "../components/SDUI/CanvasLayout";
import { ErrorBoundary } from "../components/Common/ErrorBoundary";
import {
  SectionErrorFallback,
  UnknownComponentFallback,
} from "../components/SDUI";
import {
  SDUIComponentSection,
  SDUIPageDefinition,
  validateSDUISchema,
} from "./schema";
import { RegistryPlaceholderComponent, resolveComponent } from "./registry";
import { DataBindingResolver } from "./DataBindingResolver";
import { DataSourceContext } from "./DataBindingSchema";
import { useDataBindings } from "./useDataBinding";
import { sanitizeProps } from "./security/sanitization";
import { incrementSecurityMetric } from "./security/metrics";
import { logger } from "../lib/logger";

interface SDUIRendererProps {
  schema: unknown;
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

const HydrationTrace: React.FC<HydrationTraceProps> = ({
  section,
  status,
  warning,
}) => {
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
 * Component wrapper that resolves data bindings
 */
const ComponentWithBindings: React.FC<{
  section: SDUIComponentSection;
  Component: React.ComponentType<any>;
  resolver?: DataBindingResolver;
  context?: DataSourceContext;
  debugOverlay?: boolean;
}> = ({ section, Component, resolver, context, debugOverlay }) => {
  // If no resolver or context, render without binding resolution
  if (!resolver || !context) {
    return (
      <>
        <Component {...section.props} />
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

  // Resolve data bindings in props
  const {
    props: resolvedProps,
    loading,
    errors,
  } = useDataBindings(section.props, {
    resolver,
    context,
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (Object.keys(errors).length > 0) {
    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded">
        Failed to resolve data bindings: {errors._global || "Unknown error"}
      </div>
    );
  }

  // Sanitize props before rendering
  const sanitizedProps = sanitizeProps(resolvedProps, section.component);

  return (
    <>
      <Component {...sanitizedProps} />
      {debugOverlay && (
        <HydrationTrace
          section={section}
          status="rendered"
          warning="Data bindings resolved successfully"
        />
      )}
    </>
  );
};

/**
 * Maximum recursion depth for nested layouts
 */
const MAX_RENDER_DEPTH = 10;

const renderSection = (
  section: any,
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
        component: section?.component || "unknown",
        type: section?.type || "unknown",
      }
    );
    incrementSecurityMetric("recursion_limit", {
      depth,
      section: section?.component,
    });
    return (
      <div
        key={`depth-limit-${index}`}
        className="p-4 border border-red-500 bg-red-50 text-red-900"
      >
        <p className="font-semibold">Layout too deeply nested</p>
        <p className="text-sm">
          Maximum nesting depth ({MAX_RENDER_DEPTH}) exceeded. This may indicate
          a malformed schema.
        </p>
      </div>
    );
  }
  // Handle layout types (VerticalSplit, HorizontalSplit, Grid, DashboardPanel)
  if (
    section.type &&
    ["VerticalSplit", "HorizontalSplit", "Grid", "DashboardPanel"].includes(
      section.type
    )
  ) {
    const key = `layout-${section.type}-${index}`;

    // Recursively render children with depth tracking
    const childNodes =
      section.children?.map((child: any, i: number) =>
        renderSection(child, i, debugOverlay, resolver, context, depth + 1)
      ) || [];

    switch (section.type) {
      case "VerticalSplit":
        return (
          <VerticalSplit
            key={key}
            ratios={section.ratios || [1, 1]}
            gap={section.gap}
          >
            {childNodes}
          </VerticalSplit>
        );

      case "HorizontalSplit":
        return (
          <HorizontalSplit
            key={key}
            ratios={section.ratios || [1, 1]}
            gap={section.gap}
          >
            {childNodes}
          </HorizontalSplit>
        );

      case "Grid":
        return (
          <Grid
            key={key}
            columns={section.columns || 2}
            rows={section.rows}
            gap={section.gap}
            responsive={section.responsive}
          >
            {childNodes}
          </Grid>
        );

      case "DashboardPanel":
        return (
          <DashboardPanel
            key={key}
            title={section.title}
            collapsible={section.collapsible}
            defaultExpanded={section.defaultExpanded}
          >
            {childNodes}
          </DashboardPanel>
        );
    }
  }

  // Handle component types (original logic)
  const entry = resolveComponent(section as SDUIComponentSection);
  if (!entry) {
    // Log missing component for monitoring
    incrementSecurityMetric("component_not_found", {
      component: section.component,
      version: section.version,
    });

    return (
      <div key={`${section.component}-${index}`}>
        <RegistryPlaceholderComponent componentName={section.component} />
        {debugOverlay && (
          <HydrationTrace
            section={section}
            status="placeholder"
            warning="Component not found in registry"
          />
        )}
      </div>
    );
  }

  const Component = entry.component;

  return (
    <div key={`${section.component}-${index}`} className="space-y-2">
      <ErrorBoundary
        fallback={<SectionErrorFallback componentName={section.component} />}
      >
        <ComponentWithBindings
          section={section}
          Component={Component}
          resolver={resolver}
          context={context}
          debugOverlay={debugOverlay}
        />
      </ErrorBoundary>
    </div>
  );
};

export const SDUIRenderer: React.FC<SDUIRendererProps> = ({
  schema,
  debugOverlay = false,
  onValidationError,
  onHydrationWarning,
  dataBindingResolver,
  dataSourceContext,
}) => {
  const validation = useMemo(() => validateSDUISchema(schema), [schema]);

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
