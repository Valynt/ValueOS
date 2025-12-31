import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  const ActionIcon = action?.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-4 p-3 bg-gray-100 rounded-full">
          <Icon className="h-8 w-8 text-gray-400" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={action.label}
        >
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" aria-hidden="true" />}
          {action.label}
        </button>
      )}
    </div>
  );
};

export const EmptySearchState: React.FC<{
  query: string;
  onClear: () => void;
}> = ({ query, onClear }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
    <p className="text-gray-900 mb-2">No results found for "{query}"</p>
    <p className="text-sm text-gray-600 mb-4">
      Try adjusting your search or filters
    </p>
    <button
      onClick={onClear}
      className="text-sm text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
    >
      Clear search
    </button>
  </div>
);
