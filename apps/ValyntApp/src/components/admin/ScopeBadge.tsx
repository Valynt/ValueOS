import React from 'react';

import { SCOPE_CONFIG, type SettingScope } from '../../lib/adminNavigation';

import { cn } from '@/lib/utils';

interface ScopeBadgeProps {
  scope: SettingScope;
  className?: string;
}

/**
 * Visual scope indicator for admin settings.
 * Communicates whether a setting applies at platform, tenant, workspace, or user level.
 */
export const ScopeBadge: React.FC<ScopeBadgeProps> = ({ scope, className }) => {
  const config = SCOPE_CONFIG[scope];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.color,
        className
      )}
      role="status"
      aria-label={config.description}
    >
      {scope === 'platform' && (
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
        </svg>
      )}
      {scope === 'tenant' && (
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
        </svg>
      )}
      {scope === 'workspace' && (
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
        </svg>
      )}
      {config.label}
    </span>
  );
};
