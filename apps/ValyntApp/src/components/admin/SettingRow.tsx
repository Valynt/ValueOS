import React from 'react';
import { ScopeBadge } from './ScopeBadge';
import type { SettingScope, SensitivityLevel } from '../../lib/adminNavigation';
import { cn } from '@/lib/utils';

interface SettingRowProps {
  /** Setting label */
  label: string;
  /** Setting description */
  description?: string;
  /** Scope at which this setting applies */
  scope: SettingScope;
  /** Whether this setting is inherited from a higher scope */
  inherited?: boolean;
  /** Source of the inherited value (e.g., "Tenant Default") */
  inheritedFrom?: string;
  /** Sensitivity level for visual indicators */
  sensitivity?: SensitivityLevel;
  /** Whether the current user can edit this setting */
  editable?: boolean;
  /** The setting control (input, toggle, select, etc.) */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Row component for admin settings.
 * Displays label, description, scope badge, inheritance indicator, and the setting control.
 */
export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  scope,
  inherited = false,
  inheritedFrom,
  sensitivity = 'normal',
  editable = true,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-8 py-4 border-b border-gray-100 last:border-b-0',
        !editable && 'opacity-60',
        className
      )}
    >
      {/* Left: Label + Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <ScopeBadge scope={scope} className="text-[10px]" />
          {inherited && (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {inheritedFrom ?? 'Inherited'}
            </span>
          )}
          {sensitivity === 'destructive' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Requires confirmation
            </span>
          )}
          {sensitivity === 'sensitive' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Re-auth required
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>

      {/* Right: Control */}
      <div className="flex-shrink-0">
        {editable ? (
          children
        ) : (
          <div className="cursor-not-allowed" aria-disabled="true" title="You don't have permission to edit this setting">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
