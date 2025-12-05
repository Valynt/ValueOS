import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export const SettingsBreadcrumb: React.FC = () => {
  const { breadcrumbs, navigateTo, currentRoute } = useSettings();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <button
        onClick={() => navigateTo('/user/profile')}
        className="flex items-center hover:text-gray-900 transition-colors"
        aria-label="Settings home"
      >
        <Home className="h-4 w-4" />
      </button>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isActive = crumb.path === currentRoute;

        return (
          <React.Fragment key={crumb.path}>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {isLast || isActive ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : (
              <button
                onClick={() => navigateTo(crumb.path)}
                className="hover:text-gray-900 transition-colors"
              >
                {crumb.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
