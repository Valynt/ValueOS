import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsContextType, SettingsPermission, UserPermissions } from "../legacy-migrated/types";
import { settingsRegistry } from "@lib/settingsRegistry";

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: React.ReactNode;
  defaultRoute?: string;
  permissions?: UserPermissions;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
  defaultRoute = "/user/profile",
  permissions = {
    permissions: ["team.view", "team.manage"],
    role: "Member",
  },
}) => {
  const navigate = useNavigate();
  const [currentRoute, setCurrentRoute] = useState<string>(defaultRoute);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const hash = window.location.hash.replace("#/settings", "");
    if (hash && hash !== currentRoute) {
      setCurrentRoute(hash);
    }
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      if (!path || typeof path !== "string" || !path.startsWith("/")) {
        return;
      }
      setCurrentRoute(path);
      navigate(path);

      window.dispatchEvent(new CustomEvent("settings-navigate", { detail: { path } }));
    },
    [navigate]
  );

  const hasPermission = useCallback(
    (permission: SettingsPermission): boolean => {
      return permissions.permissions.includes(permission);
    },
    [permissions]
  );

  // Memoize breadcrumbs to prevent unnecessary recalculations
  const breadcrumbs = useMemo(() => settingsRegistry.getBreadcrumbs(currentRoute), [currentRoute]);

  // Memoize context value to prevent infinite re-render loops
  // This is critical: object literal instantiation on every render causes
  // consumers to re-render even when values haven't changed
  const contextValue: SettingsContextType = useMemo(
    () => ({
      currentRoute,
      navigateTo,
      searchQuery,
      setSearchQuery,
      permissions,
      hasPermission,
      breadcrumbs,
    }),
    [currentRoute, navigateTo, searchQuery, setSearchQuery, permissions, hasPermission, breadcrumbs]
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
