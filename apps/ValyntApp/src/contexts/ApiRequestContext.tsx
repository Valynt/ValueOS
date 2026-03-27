import React, { createContext, useContext, useEffect, useRef, useState } from "react";

import { RequestIdContext } from "@valueos/sdui";

// ============================================================================
// Types
// ============================================================================

interface ApiRequestState {
  /** ID of the most recent request, regardless of outcome. */
  lastRequestId: string | null;
  /** ID of the most recent failed request. Shown in error UI for support correlation. */
  lastFailedRequestId: string | null;
}

interface ApiRequestContextValue extends ApiRequestState {}

// ============================================================================
// Context
// ============================================================================

const ApiRequestContext = createContext<ApiRequestContextValue>({
  lastRequestId: null,
  lastFailedRequestId: null,
});

// ============================================================================
// Module-level setter registration
//
// UnifiedApiClient is instantiated outside React, so it cannot call useContext.
// Instead, it calls the registered setter after each request completes.
// The provider registers the setter on mount and clears it on unmount.
// ============================================================================

type ApiRequestSetter = (id: string, failed: boolean) => void;

let _registeredSetter: ApiRequestSetter | null = null;

/**
 * Register a setter to be called by UnifiedApiClient after each request.
 * Called once from ApiRequestProvider's useEffect on mount.
 */
export function registerApiRequestSetter(setter: ApiRequestSetter): void {
  _registeredSetter = setter;
}

/**
 * Called by UnifiedApiClient after every request completes.
 * Safe to call before the provider mounts — updates are silently dropped.
 */
export function notifyApiRequest(requestId: string, failed: boolean): void {
  _registeredSetter?.(requestId, failed);
}

// ============================================================================
// Provider
// ============================================================================

export function ApiRequestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApiRequestState>({
    lastRequestId: null,
    lastFailedRequestId: null,
  });

  // Use a ref so the setter closure always sees the latest setState without
  // needing to re-register on every render.
  const setterRef = useRef<ApiRequestSetter>((id, failed) => {
    setState((prev) => ({
      lastRequestId: id,
      lastFailedRequestId: failed ? id : prev.lastFailedRequestId,
    }));
  });

  useEffect(() => {
    registerApiRequestSetter(setterRef.current);
    return () => {
      // Clear on unmount so stale setters don't linger.
      _registeredSetter = null;
    };
  }, []);

  return (
    <ApiRequestContext.Provider value={state}>
      {/* Also populate the SDUI-package RequestIdContext so error boundaries
          in packages/sdui can read lastFailedRequestId without a circular dep. */}
      <RequestIdContext.Provider value={{ lastFailedRequestId: state.lastFailedRequestId }}>
        {children}
      </RequestIdContext.Provider>
    </ApiRequestContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useApiRequestContext(): ApiRequestContextValue {
  return useContext(ApiRequestContext);
}

export { ApiRequestContext };
