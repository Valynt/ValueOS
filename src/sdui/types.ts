/**
 * Type definitions for the SDUI runtime engine
 */

import { ReactElement, ComponentType } from 'react';
import { SDUIComponentSection, SDUIPageDefinition } from './schema';

/**
 * Status of a component during rendering
 */
export type ComponentRenderStatus =
  | 'pending'
  | 'loading'
  | 'hydrating'
  | 'rendered'
  | 'error'
  | 'unknown';

/**
 * Hydration status for a component
 */
export interface HydrationStatus {
  /**
   * Whether hydration is in progress
   */
  loading: boolean;

  /**
   * Whether hydration completed successfully
   */
  success: boolean;

  /**
   * Error if hydration failed
   */
  error?: Error;

  /**
   * Endpoints that were hydrated
   */
  endpoints: string[];

  /**
   * Time taken to hydrate (ms)
   */
  duration?: number;
}

/**
 * Metadata about a rendered component
 */
export interface ComponentMetadata {
  /**
   * Component name from registry
   */
  name: string;

  /**
   * Component version
   */
  version: number;

  /**
   * Render status
   */
  status: ComponentRenderStatus;

  /**
   * Hydration status (if applicable)
   */
  hydration?: HydrationStatus;

  /**
   * Props passed to component
   */
  props: Record<string, any>;

  /**
   * Timestamp when component started rendering
   */
  startTime: number;

  /**
   * Timestamp when component finished rendering
   */
  endTime?: number;

  /**
   * Error if rendering failed
   */
  error?: Error;
}

/**
 * Performance metrics for page rendering
 */
export interface RenderPerformanceMetrics {
  /**
   * Total time to render page (ms)
   */
  totalTime: number;

  /**
   * Time spent on validation (ms)
   */
  validationTime: number;

  /**
   * Time spent on hydration (ms)
   */
  hydrationTime: number;

  /**
   * Time spent on component rendering (ms)
   */
  renderTime: number;

  /**
   * Number of components rendered
   */
  componentCount: number;

  /**
   * Number of components that required hydration
   */
  hydratedComponentCount: number;

  /**
   * Number of components that failed to render
   */
  errorCount: number;

  /**
   * Detailed metrics per component
   */
  componentMetrics: ComponentMetadata[];
}

/**
 * Event emitted during page rendering
 */
export interface RenderEvent {
  /**
   * Event type
   */
  type:
    | 'validation_start'
    | 'validation_complete'
    | 'validation_error'
    | 'component_start'
    | 'component_complete'
    | 'component_error'
    | 'hydration_start'
    | 'hydration_complete'
    | 'hydration_error'
    | 'render_complete';

  /**
   * Timestamp of event
   */
  timestamp: number;

  /**
   * Component name (if applicable)
   */
  componentName?: string;

  /**
   * Event payload
   */
  payload?: any;
}

/**
 * Callback for render events
 */
export type RenderEventCallback = (event: RenderEvent) => void;

/**
 * Configuration for render event tracking
 */
export interface RenderEventTracking {
  /**
   * Whether to track events
   */
  enabled: boolean;

  /**
   * Callback for each event
   */
  onEvent?: RenderEventCallback;

  /**
   * Event types to track (empty = all)
   */
  eventTypes?: RenderEvent['type'][];
}

/**
 * Data source configuration for hydration
 */
export interface DataSource {
  /**
   * Unique identifier for the data source
   */
  id: string;

  /**
   * Type of data source
   */
  type: 'rest' | 'graphql' | 'websocket' | 'static';

  /**
   * Endpoint URL or connection string
   */
  endpoint: string;

  /**
   * HTTP method (for REST)
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Request body (for POST/PUT)
   */
  body?: any;

  /**
   * Query parameters
   */
  params?: Record<string, string>;

  /**
   * Transform function to process response data
   */
  transform?: (data: any) => any;

  /**
   * Cache configuration
   */
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: string;
  };
}

/**
 * Registry entry with extended metadata
 */
export interface ExtendedRegistryEntry {
  /**
   * React component
   */
  component: ComponentType<any>;

  /**
   * Supported versions
   */
  versions: number[];

  /**
   * Required props
   */
  requiredProps?: string[];

  /**
   * Optional props
   */
  optionalProps?: string[];

  /**
   * Component description
   */
  description?: string;

  /**
   * Component category
   */
  category?: string;

  /**
   * Tags for searching/filtering
   */
  tags?: string[];

  /**
   * Whether component supports hydration
   */
  supportsHydration?: boolean;

  /**
   * Default props
   */
  defaultProps?: Record<string, any>;

  /**
   * Prop validation schema
   */
  propSchema?: any;
}

/**
 * Result of component resolution
 */
export interface ComponentResolutionResult {
  /**
   * Whether component was found
   */
  found: boolean;

  /**
   * Registry entry (if found)
   */
  entry?: ExtendedRegistryEntry;

  /**
   * Reason if not found
   */
  reason?: string;

  /**
   * Suggested alternatives
   */
  alternatives?: string[];
}

/**
 * Configuration for component registry
 */
export interface RegistryConfig {
  /**
   * Whether to allow dynamic component registration
   */
  allowDynamicRegistration: boolean;

  /**
   * Whether to validate props against schema
   */
  validateProps: boolean;

  /**
   * Whether to warn about missing required props
   */
  warnMissingProps: boolean;

  /**
   * Whether to use strict version matching
   */
  strictVersions: boolean;
}

/**
 * Page render context passed to components
 */
export interface PageRenderContext {
  /**
   * Page definition being rendered
   */
  page: SDUIPageDefinition;

  /**
   * Current section being rendered
   */
  section?: SDUIComponentSection;

  /**
   * Render options
   */
  options: any;

  /**
   * Performance metrics
   */
  metrics?: RenderPerformanceMetrics;

  /**
   * Event emitter
   */
  emit?: (event: RenderEvent) => void;
}

/**
 * Utility type for component props with hydration support
 */
export type HydratableProps<T = any> = T & {
  /**
   * Hydrated data (injected by runtime)
   */
  _hydrated?: Record<string, any>;

  /**
   * Hydration status (injected by runtime)
   */
  _hydrationStatus?: HydrationStatus;
};

/**
 * Type guard to check if props have hydration data
 */
export function hasHydrationData<T>(
  props: T
): props is T & { _hydrated: Record<string, any> } {
  return (
    typeof props === 'object' &&
    props !== null &&
    '_hydrated' in props &&
    typeof (props as any)._hydrated === 'object'
  );
}

/**
 * Type guard to check if error is a hydration error
 */
export function isHydrationError(error: Error): boolean {
  return (
    error.message.includes('hydration') ||
    error.message.includes('fetch') ||
    error.message.includes('timeout')
  );
}

/**
 * Type guard to check if error is a validation error
 */
export function isValidationError(error: Error): boolean {
  return error.name === 'SDUIValidationError' || error.message.includes('validation');
}

/**
 * Type guard to check if error is a component error
 */
export function isComponentError(error: Error): boolean {
  return (
    error.message.includes('component') &&
    !isHydrationError(error) &&
    !isValidationError(error)
  );
}
