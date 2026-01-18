import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { Construction } from 'lucide-react';

interface SettingsPlaceholderProps {
  title: string;
  description: string;
}

export const SettingsPlaceholder: React.FC<SettingsPlaceholderProps> = ({
  title,
  description,
}) => {
  return (
    <SettingsSection title={title} description={description}>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Construction className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-sm text-gray-600 max-w-md">
          This settings page is under development. Check back soon for updates.
        </p>
      </div>
    </SettingsSection>
  );
};
