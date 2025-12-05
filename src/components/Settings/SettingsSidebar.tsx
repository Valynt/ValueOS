import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User, Users, Building2, X } from 'lucide-react';
import { SettingsRoute } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { settingsRegistry } from '../../lib/settingsRegistry';

interface SettingsSidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ onClose, isMobile = false }) => {
  const { currentRoute, navigateTo, permissions } = useSettings();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['user', 'team', 'organization']));

  const routes = settingsRegistry.filterByPermission(
    settingsRegistry.getAllRoutes(),
    permissions.permissions
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleNavigate = (path: string) => {
    navigateTo(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'User':
        return <User className="h-5 w-5" />;
      case 'Users':
        return <Users className="h-5 w-5" />;
      case 'Building2':
        return <Building2 className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const renderRoute = (route: SettingsRoute, level: number = 0) => {
    const isExpanded = expandedSections.has(route.id);
    const hasChildren = route.children && route.children.length > 0;
    const fullPath = route.path;
    const isActive = currentRoute === fullPath || currentRoute.startsWith(fullPath + '/');

    if (level === 0) {
      return (
        <div key={route.id} className="mb-2">
          <button
            onClick={() => toggleSection(route.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-2">
              {getIcon(route.icon)}
              <span>{route.label}</span>
            </div>
            {hasChildren && (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {isExpanded && hasChildren && (
            <div className="mt-1 ml-3 space-y-1 border-l-2 border-gray-200 pl-3">
              {route.children!.map(child => renderRoute(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={route.id}
        onClick={() => handleNavigate(fullPath)}
        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        {route.label}
      </button>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white ${isMobile ? 'border-r border-gray-200' : ''}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        {routes.map(route => renderRoute(route))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Your Role</p>
          <p>{permissions.role}</p>
        </div>
      </div>
    </div>
  );
};
