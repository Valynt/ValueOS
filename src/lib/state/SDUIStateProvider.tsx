/**
 * SDUI State Provider
 * 
 * React context provider for SDUI state management
 */

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { SDUIStateManager, getSDUIStateManager, SDUIStateManagerConfig } from './SDUIStateManager';

/**
 * Context for SDUI State Manager
 */
const SDUIStateContext = createContext<SDUIStateManager | null>(null);

/**
 * Props for SDUIStateProvider
 */
export interface SDUIStateProviderProps {
  children: React.ReactNode;
  supabase?: SupabaseClient;
  sessionId?: string;
  persistence?: boolean;
  debug?: boolean;
  maxCacheSize?: number;
}

/**
 * SDUI State Provider Component
 * 
 * Provides SDUI state management to child components
 */
export const SDUIStateProvider: React.FC<SDUIStateProviderProps> = ({
  children,
  supabase,
  sessionId,
  persistence = false,
  debug = false,
  maxCacheSize = 1000
}) => {
  const stateManagerRef = useRef<SDUIStateManager | null>(null);

  // Initialize state manager
  if (!stateManagerRef.current) {
    const config: SDUIStateManagerConfig = {
      supabase,
      persistence: {
        enabled: persistence,
        sessionId
      },
      debug,
      maxCacheSize
    };

    stateManagerRef.current = getSDUIStateManager(config);
  }

  // Flush state on unmount
  useEffect(() => {
    return () => {
      if (stateManagerRef.current) {
        stateManagerRef.current.flush();
      }
    };
  }, []);

  return (
    <SDUIStateContext.Provider value={stateManagerRef.current}>
      {children}
    </SDUIStateContext.Provider>
  );
};

/**
 * Hook to access SDUI State Manager from context
 * 
 * @returns SDUIStateManager instance
 * @throws Error if used outside SDUIStateProvider
 */
export function useSDUIStateManager(): SDUIStateManager {
  const stateManager = useContext(SDUIStateContext);

  if (!stateManager) {
    throw new Error('useSDUIStateManager must be used within SDUIStateProvider');
  }

  return stateManager;
}

/**
 * Hook to check if SDUIStateProvider is available
 * 
 * @returns boolean
 */
export function useHasSDUIStateProvider(): boolean {
  const stateManager = useContext(SDUIStateContext);
  return stateManager !== null;
}
