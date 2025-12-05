import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SettingsContextType, UserPermissions, SettingsPermission } from '../types';
import { settingsRegistry } from '../lib/settingsRegistry';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: React.ReactNode;
  defaultRoute?: string;
  permissions?: UserPermissions;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
  defaultRoute = '/user/profile',
  permissions = {
    permissions: ['team.view', 'team.manage'],
    role: 'Member',
  },
}) => {
  const [currentRoute, setCurrentRoute] = useState<string>(defaultRoute);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const hash = window.location.hash.replace('#/settings', '');
    if (hash && hash !== currentRoute) {
      setCurrentRoute(hash);
    }
  }, []);

  const navigateTo = useCallback((path: string) => {
    setCurrentRoute(path);
    window.location.hash = `/settings${path}`;

    window.dispatchEvent(new CustomEvent('settings-navigate', { detail: { path } }));
  }, []);

  const hasPermission = useCallback(
    (permission: SettingsPermission): boolean => {
      return permissions.permissions.includes(permission);
    },
    [permissions]
  );

  const breadcrumbs = settingsRegistry.getBreadcrumbs(currentRoute);

  const contextValue: SettingsContextType = {
    currentRoute,
    navigateTo,
    searchQuery,
    setSearchQuery,
    permissions,
    hasPermission,
    breadcrumbs,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
