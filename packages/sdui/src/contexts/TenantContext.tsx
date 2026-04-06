/**
 * Tenant Context Provider for SDUI
 *
 * Provides strict multi-tenant context for SDUI rendering and data isolation.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { TenantContext } from '../TenantContext';

/**
 * React Context for Tenant information
 */
const SDUI_TenantContext = createContext<TenantContext | null>(null);

/**
 * Props for the TenantProvider
 */
interface TenantProviderProps {
  value: TenantContext;
  children: React.ReactNode;
}

/**
 * Tenant Provider Component
 */
export const TenantProvider: React.FC<TenantProviderProps> = ({ value, children }) => {
  return (
    <SDUI_TenantContext.Provider value={value}>
      {children}
    </SDUI_TenantContext.Provider>
  );
};

/**
 * Hook to access the current TenantContext in SDUI components
 * Throws an error if used outside of a TenantProvider.
 */
export const useTenantContext = () => {
  const context = useContext(SDUI_TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a <TenantProvider />. Ensure strict multi-tenant isolation is enforced at the page level.');
  }
  return context;
};
