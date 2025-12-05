import React from 'react';
import { Loader2 } from 'lucide-react';
import { SettingsSectionProps } from '../../types';

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  loading = false,
  actions,
}) => {
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-beautiful-md overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
