/**
 * useSettings
 *
 * React Query hooks for tenant-scoped settings CRUD with optimistic updates,
 * validation, and permission-aware access.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { useToast } from "@/components/ui/use-toast";
import { handleSettingsError } from "@/utils/settingsErrorHandler";

import type { AccessLevel } from "@/config/settingsMatrix";

// ============================================================================
// Types
// ============================================================================

export type SettingScope = "user" | "team" | "organization";

export type SettingType = "string" | "number" | "boolean" | "object" | "array";

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  type: SettingType;
  scope: SettingScope;
  scopeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingUpdateInput {
  value: unknown;
}

export interface SettingsQueryOptions {
  scope: SettingScope;
  scopeId: string;
  keys?: string[];
}

export interface UseSettingsOptions {
  scope: SettingScope;
  scopeId: string;
  keys?: string[];
  /** Validate value before sending to API */
  validation?: Record<string, (value: string) => string | undefined>;
  /** User's access level for permission checking */
  accessLevel?: AccessLevel;
}

export interface SettingsGroupResult {
  /** Current setting values by key */
  values: Record<string, unknown>;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Update a single setting */
  updateSetting: (key: string, value: unknown) => Promise<void>;
  /** Pending states for individual fields */
  pendingFields: Set<string>;
  /** Dirty tracking for unsaved changes */
  dirtyFields: Set<string>;
  /** Mark field as dirty (for bulk save) */
  markDirty: (key: string) => void;
  /** Mark field as clean */
  markClean: (key: string) => void;
  /** Revert to original values */
  revert: () => void;
  /** Whether user has edit access */
  canEdit: boolean;
  /** Optimistic error states by field */
  fieldErrors: Record<string, string>;
  /** Clear error for a field */
  clearFieldError: (key: string) => void;
}

// ============================================================================
// Query Keys
// ============================================================================

const SETTINGS_KEY = "settings";
const SETTINGS_AUDIT_KEY = "settings-audit";

function buildSettingsKey(scope: SettingScope, scopeId: string, keys?: string[]): string[] {
  const base = [SETTINGS_KEY, scope, scopeId];
  if (keys?.length) {
    base.push(...keys);
  }
  return base;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchSettings(options: SettingsQueryOptions): Promise<Setting[]> {
  const params: Record<string, unknown> = {
    scope: options.scope,
    scopeId: options.scopeId,
  };
  if (options.keys?.length) {
    params.keys = options.keys.join(",");
  }

  const res = await apiClient.get<{ settings: Setting[] }>("/api/v1/settings", params);
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? "Failed to fetch settings");
  }
  return res.data.settings;
}

async function updateSettingApi(
  key: string,
  scope: SettingScope,
  scopeId: string,
  input: SettingUpdateInput
): Promise<Setting> {
  const res = await apiClient.put<Setting>(`/api/v1/settings/${key}`, {
    ...input,
    scope,
    scopeId,
  });
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? "Failed to update setting");
  }
  return res.data;
}

async function bulkUpdateSettingsApi(
  scope: SettingScope,
  scopeId: string,
  settings: Record<string, unknown>
): Promise<Setting[]> {
  const res = await apiClient.put<{ settings: Setting[] }>("/api/v1/settings/bulk", {
    scope,
    scopeId,
    settings,
  });
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? "Failed to update settings");
  }
  return res.data.settings;
}

// ============================================================================
// Validation
// ============================================================================

const defaultValidators: Record<string, (value: string) => string | undefined> = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return undefined;
  },
  username: (value) => {
    if (value.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Username can only contain letters, numbers, and underscores";
    return undefined;
  },
  required: (value) => {
    if (!value || value.trim().length === 0) return "This field is required";
    return undefined;
  },
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch settings for a given scope
 */
export function useSettings(
  options: SettingsQueryOptions,
  queryOpts?: Omit<UseQueryOptions<Setting[], Error>, "queryKey" | "queryFn">
) {
  return useQuery<Setting[]>({
    queryKey: buildSettingsKey(options.scope, options.scopeId, options.keys),
    queryFn: () => fetchSettings(options),
    staleTime: 30_000,
    ...queryOpts,
  });
}

/**
 * Fetch a single setting by key
 */
export function useSetting(
  key: string,
  scope: SettingScope,
  scopeId: string,
  queryOpts?: Omit<UseQueryOptions<Setting | null, Error>, "queryKey" | "queryFn">
) {
  const { data: settings, ...rest } = useSettings(
    { scope, scopeId, keys: [key] },
    queryOpts
  );
  return {
    setting: settings?.[0] ?? null,
    ...rest,
  };
}

/**
 * Mutation hook for updating a single setting with optimistic updates
 */
export function useUpdateSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Setting, Error, { key: string; scope: SettingScope; scopeId: string; value: unknown }>({
    mutationFn: async ({ key, scope, scopeId, value }) => {
      return updateSettingApi(key, scope, scopeId, { value });
    },
    onMutate: async ({ key, scope, scopeId, value }) => {
      // Cancel outgoing refetches
      const queryKey = buildSettingsKey(scope, scopeId);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<Setting[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<Setting[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((s) => (s.key === key ? { ...s, value } : s));
      });

      return { previousSettings };
    },
    onError: (error, { key, scope, scopeId }, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(buildSettingsKey(scope, scopeId), context.previousSettings);
      }

      handleSettingsError(error, {
        showToast: true,
        context: { settingKey: key },
      });
    },
    onSuccess: (data, { key }) => {
      toast({
        title: "Setting saved",
        description: `${key} has been updated successfully.`,
        duration: 2000,
      });
    },
    onSettled: (_data, _error, { scope, scopeId }) => {
      // Always refetch after error or success to ensure sync
      void queryClient.invalidateQueries({
        queryKey: buildSettingsKey(scope, scopeId),
      });
    },
  });
}

/**
 * Mutation hook for bulk updating settings
 */
export function useBulkUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Setting[], Error, { scope: SettingScope; scopeId: string; settings: Record<string, unknown> }>({
    mutationFn: bulkUpdateSettingsApi,
    onSuccess: (_data, { scope, scopeId }) => {
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
        duration: 2000,
      });
      void queryClient.invalidateQueries({
        queryKey: buildSettingsKey(scope, scopeId),
      });
    },
    onError: (error) => {
      handleSettingsError(error, { showToast: true });
    },
  });
}

/**
 * High-level hook for managing a group of settings with dirty tracking,
 * validation, and permission checks
 */
export function useSettingsGroup(options: UseSettingsOptions): SettingsGroupResult {
  const { scope, scopeId, keys, validation = {}, accessLevel = "tenant_admin" } = options;
  const { toast } = useToast();

  // Track original values for revert
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  // Track current values (optimistic)
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  // Track dirty fields
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  // Track pending fields during save
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  // Track field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canEdit = accessLevel === "tenant_admin" || accessLevel === "vendor_admin";

  // Fetch settings
  const { data: settings, isLoading, error } = useSettings({ scope, scopeId, keys });

  // Update local state when data arrives
  useMemo(() => {
    if (settings) {
      const values = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      setOriginalValues(values);
      setLocalValues(values);
    }
  }, [settings]);

  const updateMutation = useUpdateSetting();

  // Validate and update a single setting
  const updateSetting = useCallback(
    async (key: string, value: unknown): Promise<void> => {
      // Clear any previous error
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      // Run validation if provided
      const validator = validation[key];
      if (validator && typeof value === "string") {
        const error = validator(value);
        if (error) {
          setFieldErrors((prev) => ({ ...prev, [key]: error }));
          throw new Error(error);
        }
      }

      // Optimistic local update
      setLocalValues((prev) => ({ ...prev, [key]: value }));
      setPendingFields((prev) => new Set(prev).add(key));

      try {
        await updateMutation.mutateAsync({ key, scope, scopeId, value });
        setDirtyFields((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } finally {
        setPendingFields((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [scope, scopeId, validation, updateMutation]
  );

  // Mark field as dirty (for bulk save pattern)
  const markDirty = useCallback((key: string) => {
    setDirtyFields((prev) => new Set(prev).add(key));
  }, []);

  // Mark field as clean
  const markClean = useCallback((key: string) => {
    setDirtyFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Revert to original values
  const revert = useCallback(() => {
    setLocalValues(originalValues);
    setDirtyFields(new Set());
    setFieldErrors({});
    toast({
      title: "Changes discarded",
      description: "Your unsaved changes have been reverted.",
      duration: 2000,
    });
  }, [originalValues, toast]);

  // Clear field error
  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return {
    values: localValues,
    isLoading,
    error: error ?? null,
    updateSetting,
    pendingFields,
    dirtyFields,
    markDirty,
    markClean,
    revert,
    canEdit,
    fieldErrors,
    clearFieldError,
  };
}

/**
 * Hook for fetching settings audit history
 */
export function useSettingsAudit(scope: SettingScope, scopeId: string, limit = 10) {
  return useQuery({
    queryKey: [SETTINGS_AUDIT_KEY, scope, scopeId, limit],
    queryFn: async () => {
      const res = await apiClient.get<{ logs: AuditLogEntry[] }>("/api/v1/settings/audit", {
        scope,
        scopeId,
        limit,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to fetch audit log");
      }
      return res.data.logs;
    },
    staleTime: 60_000,
  });
}

export interface AuditLogEntry {
  id: string;
  settingKey: string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userEmail: string;
  timestamp: string;
}

/**
 * Hook for real-time settings synchronization (multi-tab)
 */
export function useSettingsSubscription(scope: SettingScope, scopeId: string) {
  const queryClient = useQueryClient();

  useMemo(() => {
    if (typeof window === "undefined") return;

    // Listen for storage events from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `settings:${scope}:${scopeId}`) {
        void queryClient.invalidateQueries({
          queryKey: buildSettingsKey(scope, scopeId),
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [scope, scopeId, queryClient]);
}
