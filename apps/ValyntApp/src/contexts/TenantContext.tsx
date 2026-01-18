/**
 * Tenant Context Provider
 *
 * Provides multi-tenant context throughout the application.
 * Ensures tenant isolation by validating user access to tenants.
 *
 * SECURITY: Tenant ID is derived from server-provided tenant list,
 * never trusted from URL/browser without validation.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { fetchUserTenants, TenantInfo, isTenantApiEnabled } from "../api/tenant";
import { createLogger } from "@lib/logger";
import { analyticsClient } from "@lib/analyticsClient";

const logger = createLogger({ component: "TenantContext" });

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Tenant context state
 */
export interface TenantContextState {
  currentTenant: TenantInfo | null;
  tenants: TenantInfo[];
  isLoading: boolean;
  error: Error | null;
  isApiEnabled: boolean;
}

/**
 * Tenant context value (state + actions)
 */
export interface TenantContextValue extends TenantContextState {
  switchTenant: (tenantId: string) => Promise<boolean>;
  refreshTenants: () => Promise<void>;
  validateTenantAccess: (tenantId: string) => boolean;
  getTenantById: (tenantId: string) => TenantInfo | undefined;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

/**
 * Storage key for persisting selected tenant
 */
const TENANT_STORAGE_KEY = "vros_current_tenant_id";

/**
 * Get stored tenant ID from localStorage
 */
function getStoredTenantId(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Store tenant ID in localStorage
 */
function setStoredTenantId(tenantId: string): void {
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
  } catch {
    logger.warn("Failed to persist tenant ID to localStorage");
  }
}

/**
 * Clear stored tenant ID
 */
function clearStoredTenantId(): void {
  try {
    localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

interface TenantProviderProps {
  children: ReactNode;
  onTenantSwitch?: (fromTenant: TenantInfo | null, toTenant: TenantInfo) => void;
}

export function TenantProvider({ children, onTenantSwitch }: TenantProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isApiEnabled = useMemo(() => isTenantApiEnabled(), []);

  /**
   * Fetch tenants for the current user
   */
  const refreshTenants = useCallback(async () => {
    if (!user?.id) {
      setTenants([]);
      setCurrentTenant(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchUserTenants(user.id);

      if (fetchError) {
        setError(fetchError);
        setTenants([]);
        setCurrentTenant(null);
        logger.error("Failed to fetch tenants", fetchError);
        return;
      }

      const fetchedTenants = data || [];
      setTenants(fetchedTenants);

      if (fetchedTenants.length === 0) {
        setCurrentTenant(null);
        clearStoredTenantId();
        return;
      }

      const storedTenantId = getStoredTenantId();
      const urlTenantId = validateTenantId(extractTenantIdFromUrl(location.pathname));

      let selectedTenant: TenantInfo | null = null;

      if (urlTenantId) {
        selectedTenant =
          fetchedTenants.find((t) => t.id === urlTenantId || t.slug === urlTenantId) || null;
        if (!selectedTenant) {
          logger.warn("URL tenant not in user tenant list", { urlTenantId });
        }
      }

      if (!selectedTenant && storedTenantId) {
        selectedTenant = fetchedTenants.find((t) => t.id === storedTenantId) || null;
      }

      if (!selectedTenant && fetchedTenants.length > 0) {
        selectedTenant = fetchedTenants[0] ?? null;
      }

      if (selectedTenant) {
        setCurrentTenant(selectedTenant);
        setStoredTenantId(selectedTenant.id);

        analyticsClient.track("tenant_context_loaded", {
          tenantId: selectedTenant.id,
          tenantCount: fetchedTenants.length,
        });

        logger.info("Tenant context initialized", {
          currentTenant: selectedTenant.id,
          tenantCount: fetchedTenants.length,
        });
      }
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error("Failed to load tenants");
      setError(fetchError);
      logger.error("Exception loading tenants", fetchError);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, location.pathname]);

  /**
   * Switch to a different tenant
   */
  const switchTenant = useCallback(
    async (tenantId: string): Promise<boolean> => {
      const targetTenant = tenants.find((t) => t.id === tenantId);

      if (!targetTenant) {
        logger.error("Cannot switch to tenant - not in allowed list", { tenantId });
        setError(new Error(`You do not have access to tenant: ${tenantId}`));
        return false;
      }

      if (currentTenant?.id === tenantId) {
        return true;
      }

      const previousTenant = currentTenant;
      setCurrentTenant(targetTenant);
      setStoredTenantId(targetTenant.id);

      analyticsClient.track("tenant_switched", {
        fromTenantId: previousTenant?.id,
        toTenantId: targetTenant.id,
      });

      logger.info("Tenant switched", {
        from: previousTenant?.id,
        to: targetTenant.id,
      });

      if (onTenantSwitch) {
        onTenantSwitch(previousTenant, targetTenant);
      }

      return true;
    },
    [tenants, currentTenant, onTenantSwitch]
  );

  /**
   * Validate if user has access to a tenant
   */
  const validateTenantAccess = useCallback(
    (tenantId: string): boolean => {
      return tenants.some((t) => t.id === tenantId);
    },
    [tenants]
  );

  /**
   * Get tenant by ID
   */
  const getTenantById = useCallback(
    (tenantId: string): TenantInfo | undefined => {
      return tenants.find((t) => t.id === tenantId);
    },
    [tenants]
  );

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      refreshTenants();
    } else {
      setTenants([]);
      setCurrentTenant(null);
      setIsLoading(false);
      clearStoredTenantId();
    }
  }, [isAuthenticated, user?.id, refreshTenants]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearStoredTenantId();
    }
  }, [isAuthenticated]);

  const value: TenantContextValue = useMemo(
    () => ({
      currentTenant,
      tenants,
      isLoading,
      error,
      isApiEnabled,
      switchTenant,
      refreshTenants,
      validateTenantAccess,
      getTenantById,
    }),
    [
      currentTenant,
      tenants,
      isLoading,
      error,
      isApiEnabled,
      switchTenant,
      refreshTenants,
      validateTenantAccess,
      getTenantById,
    ]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

function validateTenantId(id: string | null): string | null {
  if (!id || typeof id !== "string" || id.length === 0 || !/^[a-zA-Z0-9-_]+$/.test(id)) {
    return null;
  }
  return id;
}

/**
 * Extract tenant ID from URL path
 * Supports patterns like /org/:orgId/... or /tenant/:tenantId/...
 */
function extractTenantIdFromUrl(pathname: string): string | null {
  const orgMatch = pathname.match(/^\/org\/([^/]+)/);
  if (orgMatch && orgMatch[1]) return orgMatch[1];

  const tenantMatch = pathname.match(/^\/tenant\/([^/]+)/);
  if (tenantMatch && tenantMatch[1]) return tenantMatch[1];

  return null;
}

/**
 * Hook to access tenant context
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/**
 * Hook to get current tenant (convenience)
 */
export function useCurrentTenant(): TenantInfo | null {
  const { currentTenant } = useTenant();
  return currentTenant;
}

/**
 * Hook to check if user has access to a specific tenant
 */
export function useHasTenantAccess(tenantId: string): boolean {
  const { validateTenantAccess } = useTenant();
  return validateTenantAccess(tenantId);
}

export { TenantContext };
