/**
 * useHydratePage Hook
 * 
 * React hook for hydrating SDUI pages from agent responses.
 * Handles agent invocation, schema validation, and state management.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { SDUIPageDefinition, validateSDUISchema, SDUIValidationError } from '../sdui/schema';
import { getAgentAPI, AgentType, AgentContext, SDUIPageResponse } from '../services/AgentAPI';
import { renderPage, RenderPageOptions, RenderPageResult } from '../sdui/renderPage';

/**
 * Hydration state
 */
export type HydrationState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Options for useHydratePage hook
 */
export interface UseHydratePageOptions {
  /**
   * Agent type to invoke
   */
  agent: AgentType;

  /**
   * Agent context
   */
  context?: AgentContext;

  /**
   * Render page options
   */
  renderOptions?: RenderPageOptions;

  /**
   * Auto-hydrate on mount
   */
  autoHydrate?: boolean;

  /**
   * Initial query for auto-hydration
   */
  initialQuery?: string;

  /**
   * Callback when hydration starts
   */
  onHydrationStart?: (query: string) => void;

  /**
   * Callback when hydration succeeds
   */
  onHydrationSuccess?: (page: SDUIPageDefinition) => void;

  /**
   * Callback when hydration fails
   */
  onHydrationError?: (error: Error) => void;

  /**
   * Callback when validation fails
   */
  onValidationError?: (errors: string[]) => void;

  /**
   * Enable retry on failure
   * @default true
   */
  enableRetry?: boolean;

  /**
   * Maximum retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * Hydration result
 */
export interface HydrationResult {
  /**
   * Current hydration state
   */
  state: HydrationState;

  /**
   * Hydrated page definition
   */
  page: SDUIPageDefinition | null;

  /**
   * Rendered page result
   */
  rendered: RenderPageResult | null;

  /**
   * Error if hydration failed
   */
  error: Error | null;

  /**
   * Validation errors
   */
  validationErrors: string[];

  /**
   * Validation warnings
   */
  warnings: string[];

  /**
   * Agent confidence score
   */
  confidence: number | null;

  /**
   * Response metadata
   */
  metadata: {
    agent: AgentType;
    duration: number;
    timestamp: string;
  } | null;

  /**
   * Retry count
   */
  retryCount: number;

  /**
   * Whether circuit breaker is open
   */
  circuitBreakerOpen: boolean;
}

/**
 * Hydration actions
 */
export interface HydrationActions {
  /**
   * Hydrate page with query
   */
  hydrate: (query: string) => Promise<void>;

  /**
   * Retry last failed hydration
   */
  retry: () => Promise<void>;

  /**
   * Reset hydration state
   */
  reset: () => void;

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker: () => void;
}

/**
 * useHydratePage Hook
 * 
 * Manages SDUI page hydration from agent responses with validation,
 * error handling, and automatic retry.
 * 
 * @example
 * ```tsx
 * const { state, rendered, hydrate, retry } = useHydratePage({
 *   agent: 'opportunity',
 *   onHydrationSuccess: (page) => logger.debug('Hydrated:', page),
 * });
 * 
 * // Trigger hydration
 * await hydrate('Generate opportunity discovery page');
 * 
 * // Render result
 * return rendered?.element || <div>Loading...</div>;
 * ```
 */
export function useHydratePage(
  options: UseHydratePageOptions
): [HydrationResult, HydrationActions] {
  const {
    agent,
    context,
    renderOptions,
    autoHydrate = false,
    initialQuery,
    onHydrationStart,
    onHydrationSuccess,
    onHydrationError,
    onValidationError,
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  // State
  const [state, setState] = useState<HydrationState>('idle');
  const [page, setPage] = useState<SDUIPageDefinition | null>(null);
  const [rendered, setRendered] = useState<RenderPageResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<HydrationResult['metadata']>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);

  // Refs
  const lastQueryRef = useRef<string>('');
  const isMountedRef = useRef(true);
  const agentAPI = useRef(getAgentAPI());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Check circuit breaker status
   */
  const checkCircuitBreaker = useCallback(() => {
    const status = agentAPI.current.getCircuitBreakerStatus(agent);
    const isOpen = status ? status.state === 'open' : false;
    setCircuitBreakerOpen(isOpen);
    return isOpen;
  }, [agent]);

  /**
   * Hydrate page from agent
   */
  const hydrate = useCallback(
    async (query: string) => {
      if (!isMountedRef.current) return;

      // Check circuit breaker
      if (checkCircuitBreaker()) {
        setError(new Error('Circuit breaker is open. Please try again later.'));
        setState('error');
        return;
      }

      // Reset state
      setState('loading');
      setError(null);
      setValidationErrors([]);
      setWarnings([]);
      lastQueryRef.current = query;

      // Notify start
      onHydrationStart?.(query);

      try {
        // Invoke agent based on type
        let response: SDUIPageResponse;

        switch (agent) {
          case 'opportunity':
            response = await agentAPI.current.generateValueCase(query, context);
            break;
          case 'realization':
            response = await agentAPI.current.generateRealizationDashboard(query, context);
            break;
          case 'expansion':
            response = await agentAPI.current.generateExpansionOpportunities(query, context);
            break;
          default:
            // Generic invocation
            response = (await agentAPI.current.invokeAgent({
              agent,
              query,
              context,
            })) as SDUIPageResponse;
        }

        if (!isMountedRef.current) return;

        // Handle failure
        if (!response.success) {
          throw new Error(response.error || 'Agent request failed');
        }

        // Handle validation errors
        if (response.validation && !response.validation.valid) {
          const errors = response.validation.errors || [];
          setValidationErrors(errors);
          onValidationError?.(errors);
          throw new SDUIValidationError(
            'Page definition validation failed',
            errors
          );
        }

        // Set page data
        const pageData = response.data!;
        setPage(pageData);
        setConfidence(response.confidence || null);
        setMetadata(response.metadata || null);
        setWarnings(response.validation?.warnings || response.warnings || []);

        // Render page
        try {
          const renderResult = renderPage(pageData, renderOptions);
          setRendered(renderResult);
        } catch (renderError) {
          logger.error('Render error:', renderError);
          throw new Error(`Failed to render page: ${(renderError as Error).message}`);
        }

        // Success
        setState('success');
        setRetryCount(0);
        onHydrationSuccess?.(pageData);
      } catch (err) {
        if (!isMountedRef.current) return;

        const error = err as Error;
        setError(error);
        setState('error');
        onHydrationError?.(error);

        // Auto-retry if enabled
        if (enableRetry && retryCount < maxRetries) {
          setTimeout(() => {
            if (isMountedRef.current) {
              setRetryCount((prev) => prev + 1);
              hydrate(query);
            }
          }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        }
      }
    },
    [
      agent,
      context,
      renderOptions,
      onHydrationStart,
      onHydrationSuccess,
      onHydrationError,
      onValidationError,
      enableRetry,
      maxRetries,
      retryDelay,
      retryCount,
      checkCircuitBreaker,
    ]
  );

  /**
   * Retry last failed hydration
   */
  const retry = useCallback(async () => {
    if (lastQueryRef.current) {
      setRetryCount(0);
      await hydrate(lastQueryRef.current);
    }
  }, [hydrate]);

  /**
   * Reset hydration state
   */
  const reset = useCallback(() => {
    setState('idle');
    setPage(null);
    setRendered(null);
    setError(null);
    setValidationErrors([]);
    setWarnings([]);
    setConfidence(null);
    setMetadata(null);
    setRetryCount(0);
    lastQueryRef.current = '';
  }, []);

  /**
   * Reset circuit breaker
   */
  const resetCircuitBreaker = useCallback(() => {
    agentAPI.current.resetCircuitBreaker(agent);
    setCircuitBreakerOpen(false);
  }, [agent]);

  /**
   * Auto-hydrate on mount
   */
  useEffect(() => {
    if (autoHydrate && initialQuery) {
      hydrate(initialQuery);
    }
  }, [autoHydrate, initialQuery]); // Only run on mount

  // Result
  const result: HydrationResult = {
    state,
    page,
    rendered,
    error,
    validationErrors,
    warnings,
    confidence,
    metadata,
    retryCount,
    circuitBreakerOpen,
  };

  // Actions
  const actions: HydrationActions = {
    hydrate,
    retry,
    reset,
    resetCircuitBreaker,
  };

  return [result, actions];
}

/**
 * Hook for hydrating multiple pages
 */
export function useHydratePages(
  agents: AgentType[]
): Record<AgentType, [HydrationResult, HydrationActions]> {
  const results: Record<string, [HydrationResult, HydrationActions]> = {};

  agents.forEach((agent) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[agent] = useHydratePage({ agent });
  });

  return results;
}

/**
 * Hook for checking circuit breaker status
 */
export function useCircuitBreakerStatus(agent: AgentType) {
  const [status, setStatus] = useState<{
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime: number | null;
  } | null>(null);

  const agentAPI = useRef(getAgentAPI());

  const checkStatus = useCallback(() => {
    const currentStatus = agentAPI.current.getCircuitBreakerStatus(agent);
    setStatus(currentStatus);
  }, [agent]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [checkStatus]);

  return status;
}
