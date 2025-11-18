import React, { ReactElement } from 'react';
import { ErrorBoundary } from '../components/Common/ErrorBoundary';
import { SectionErrorFallback, UnknownComponentFallback } from '../components/SDUI';
import {
  SDUIComponentSection,
  SDUIPageDefinition,
  validateSDUISchema,
  SDUIValidationError,
} from './schema';
import { resolveComponent, RegistryPlaceholderComponent } from './registry';
import { useDataHydration } from './hooks/useDataHydration';
import { ComponentErrorBoundary } from './components/ComponentErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';

/**
 * Options for configuring the renderPage function behavior
 */
export interface RenderPageOptions {
  /**
   * Enable debug mode to show component metadata and hydration traces
   */
  debug?: boolean;

  /**
   * Custom error handler for validation errors
   */
  onValidationError?: (errors: string[]) => void;

  /**
   * Custom handler for validation warnings
   */
  onWarning?: (warnings: string[]) => void;

  /**
   * Custom error handler for component rendering errors
   */
  onRenderError?: (error: Error, componentName: string) => void;

  /**
   * Custom handler for data hydration errors
   */
  onHydrationError?: (error: Error, endpoint: string) => void;

  /**
   * Custom loading component to show during data hydration
   */
  loadingComponent?: React.ComponentType<{ componentName: string }>;

  /**
   * Custom fallback component for unknown/missing components
   */
  unknownComponentFallback?: React.ComponentType<{ componentName: string }>;

  /**
   * Custom fallback component for component errors
   */
  errorFallback?: React.ComponentType<{ componentName: string; error?: Error }>;

  /**
   * Maximum time (ms) to wait for data hydration before showing error
   * @default 10000
   */
  hydrationTimeout?: number;

  /**
   * Enable automatic retry for failed hydration requests
   * @default true
   */
  enableHydrationRetry?: boolean;

  /**
   * Number of retry attempts for failed hydration
   * @default 3
   */
  hydrationRetryAttempts?: number;

  /**
   * Custom data fetcher function for hydration
   */
  dataFetcher?: (endpoint: string) => Promise<any>;

  /**
   * Cache hydrated data to avoid redundant fetches
   * @default true
   */
  enableHydrationCache?: boolean;

  /**
   * Callback when a component successfully renders
   */
  onComponentRender?: (componentName: string, props: any) => void;

  /**
   * Callback when data hydration completes
   */
  onHydrationComplete?: (componentName: string, data: any) => void;
}

/**
 * Result of the renderPage function
 */
export interface RenderPageResult {
  /**
   * The rendered React element
   */
  element: ReactElement;

  /**
   * Validation warnings (if any)
   */
  warnings: string[];

  /**
   * Metadata about the rendered page
   */
  metadata: {
    componentCount: number;
    hydratedComponentCount: number;
    version: number;
  };
}

/**
 * Context for passing render options down to child components
 */
const RenderPageContext = React.createContext<RenderPageOptions>({});

/**
 * Hook to access render page options in child components
 */
export const useRenderPageOptions = () => React.useContext(RenderPageContext);

/**
 * Props for the internal PageRenderer component
 */
interface PageRendererProps {
  page: SDUIPageDefinition;
  options: RenderPageOptions;
  warnings: string[];
}

/**
 * Debug overlay component to show component metadata
 */
const DebugOverlay: React.FC<{
  section: SDUIComponentSection;
  status: 'rendered' | 'loading' | 'error' | 'unknown';
  message?: string;
}> = ({ section, status, message }) => {
  const statusColors = {
    rendered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    loading: 'bg-blue-50 text-blue-700 border-blue-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    unknown: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const statusIcons = {
    rendered: '✓',
    loading: '⟳',
    error: '✗',
    unknown: '?',
  };

  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-xs ${statusColors[status]}`}
      data-testid="debug-overlay"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{statusIcons[status]}</span>
          <span className="font-semibold">{section.component}</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
            v{section.version}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wide opacity-70">{status}</span>
      </div>
      {message && <p className="mt-1 text-[11px] opacity-80">{message}</p>}
      {section.hydrateWith && section.hydrateWith.length > 0 && (
        <p className="mt-1 text-[11px] opacity-80">
          Hydration: {section.hydrateWith.join(', ')}
        </p>
      )}
    </div>
  );
};

/**
 * Component that handles rendering a single section with hydration support
 */
const SectionRenderer: React.FC<{
  section: SDUIComponentSection;
  index: number;
  options: RenderPageOptions;
}> = ({ section, index, options }) => {
  const {
    debug = false,
    onRenderError,
    onHydrationError,
    onComponentRender,
    onHydrationComplete,
    loadingComponent: LoadingComponent = LoadingFallback,
    unknownComponentFallback: UnknownComponent = UnknownComponentFallback,
    errorFallback: ErrorFallback = SectionErrorFallback,
  } = options;

  // Resolve component from registry
  const entry = resolveComponent(section);

  // Use data hydration hook if hydrateWith is specified
  const {
    data: hydratedData,
    loading: isHydrating,
    error: hydrationError,
  } = useDataHydration(section.hydrateWith || [], {
    enabled: !!section.hydrateWith && section.hydrateWith.length > 0,
    onError: (error, endpoint) => {
      console.error(`Hydration failed for ${section.component}:`, error);
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
    return (
      <div key={`${section.component}-${index}`} className="space-y-2">
        <UnknownComponent componentName={section.component} />
        {debug && (
          <DebugOverlay
            section={section}
            status="unknown"
            message="Component not found in registry"
          />
        )}
      </div>
    );
  }

  // Show loading state during hydration
  if (isHydrating) {
    return (
      <div key={`${section.component}-${index}`} className="space-y-2">
        <LoadingComponent componentName={section.component} />
        {debug && (
          <DebugOverlay
            section={section}
            status="loading"
            message="Fetching data from endpoints"
          />
        )}
      </div>
    );
  }

  // Show error state if hydration failed and no fallback is defined
  if (hydrationError && !section.fallback) {
    return (
      <div key={`${section.component}-${index}`} className="space-y-2">
        <ErrorFallback componentName={section.component} error={hydrationError} />
        {debug && (
          <DebugOverlay
            section={section}
            status="error"
            message={`Hydration error: ${hydrationError.message}`}
          />
        )}
      </div>
    );
  }

  // Use fallback component if hydration failed and fallback is defined
  if (hydrationError && section.fallback) {
    const FallbackComponent = section.fallback.component
      ? resolveComponent({
          type: 'component',
          component: section.fallback.component,
          version: 1,
          props: section.fallback.props || {},
        })?.component
      : null;

    if (FallbackComponent) {
      return (
        <div key={`${section.component}-${index}`} className="space-y-2">
          <ComponentErrorBoundary
            componentName={section.fallback.component!}
            onError={(error) => onRenderError?.(error, section.fallback!.component!)}
            fallback={<ErrorFallback componentName={section.fallback.component!} />}
          >
            <FallbackComponent {...(section.fallback.props || {})} />
          </ComponentErrorBoundary>
          {debug && (
            <DebugOverlay
              section={section}
              status="error"
              message={`Using fallback: ${section.fallback.message || 'Hydration failed'}`}
            />
          )}
        </div>
      );
    }

    // Show fallback message if no component specified
    return (
      <div key={`${section.component}-${index}`} className="space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">{section.fallback.message || 'Component unavailable'}</p>
        </div>
        {debug && (
          <DebugOverlay
            section={section}
            status="error"
            message="Using fallback message"
          />
        )}
      </div>
    );
  }

  // Merge hydrated data with props
  const Component = entry.component;
  const mergedProps = {
    ...section.props,
    ...hydratedData,
  };

  // Notify that component is rendering
  onComponentRender?.(section.component, mergedProps);

  // Render the component with error boundary
  return (
    <div key={`${section.component}-${index}`} className="space-y-2">
      <ComponentErrorBoundary
        componentName={section.component}
        onError={(error) => onRenderError?.(error, section.component)}
        fallback={<ErrorFallback componentName={section.component} />}
      >
        <Component {...mergedProps} />
      </ComponentErrorBoundary>
      {debug && (
        <DebugOverlay
          section={section}
          status="rendered"
          message={entry.description || 'Rendered successfully'}
        />
      )}
    </div>
  );
};

/**
 * Internal component that renders the page structure
 */
const PageRenderer: React.FC<PageRendererProps> = ({ page, options, warnings }) => {
  const { debug = false, onWarning } = options;

  // Log warnings if handler provided
  React.useEffect(() => {
    if (warnings.length > 0) {
      onWarning?.(warnings);
    }
  }, [warnings, onWarning]);

  return (
    <RenderPageContext.Provider value={options}>
      <div className="space-y-4" data-testid="sdui-page-renderer">
        {/* Show warnings in debug mode */}
        {debug && warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold mb-2">⚠️ Validation Warnings</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Render all sections */}
        {page.sections.map((section, index) => (
          <SectionRenderer
            key={`section-${index}`}
            section={section}
            index={index}
            options={options}
          />
        ))}
      </div>
    </RenderPageContext.Provider>
  );
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
 *   onValidationError: (errors) => console.error('Validation failed:', errors),
 *   onHydrationError: (error, endpoint) => logError(error, endpoint),
 * });
 *
 * return result.element;
 * ```
 */
export function renderPage(
  pageDefinition: unknown,
  options: RenderPageOptions = {}
): RenderPageResult {
  // Step 1: Validate the page definition against the schema
  const validation = validateSDUISchema(pageDefinition);

  // Step 2: Handle validation failure
  if (!validation.success) {
    const errors = validation.errors;

    // Call error handler if provided
    options.onValidationError?.(errors);

    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('SDUI Schema Validation Failed:', errors);
    }

    // Throw validation error for caller to handle
    throw new SDUIValidationError(
      `Page definition failed validation: ${errors.join(', ')}`,
      errors
    );
  }

  // Step 3: Extract validated page and warnings
  const page = validation.page;
  const warnings = validation.warnings;

  // Step 4: Calculate metadata
  const hydratedComponentCount = page.sections.filter(
    (section) => section.hydrateWith && section.hydrateWith.length > 0
  ).length;

  const metadata = {
    componentCount: page.sections.length,
    hydratedComponentCount,
    version: page.version,
  };

  // Step 5: Enable debug mode from page metadata if not explicitly set
  const effectiveOptions = {
    ...options,
    debug: options.debug ?? page.metadata?.debug ?? false,
  };

  // Step 6: Render the page with error boundary
  const element = (
    <ErrorBoundary
      onError={(error) => {
        console.error('Fatal error rendering SDUI page:', error);
        options.onRenderError?.(error, 'PageRenderer');
      }}
    >
      <PageRenderer page={page} options={effectiveOptions} warnings={warnings} />
    </ErrorBoundary>
  );

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
export const RenderPageComponent: React.FC<{
  pageDefinition: unknown;
  options?: RenderPageOptions;
  onError?: (error: Error) => void;
}> = ({ pageDefinition, options, onError }) => {
  try {
    const result = renderPage(pageDefinition, options);
    return result.element;
  } catch (error) {
    // Handle validation errors
    if (error instanceof SDUIValidationError) {
      onError?.(error);
      return (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
          role="alert"
        >
          <p className="text-sm font-semibold mb-2">Invalid Page Definition</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {error.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      );
    }

    // Handle unexpected errors
    onError?.(error as Error);
    throw error;
  }
};
