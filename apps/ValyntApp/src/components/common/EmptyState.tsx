import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-4 p-3 bg-muted rounded-full">
          <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          {ActionIcon && (
            <ActionIcon className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptySearchState({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
    >
      <p className="text-foreground mb-2">No results found for "{query}"</p>
      <p className="text-sm text-muted-foreground mb-4">
        Try adjusting your search or filters
      </p>
      <button
        onClick={onClear}
        className="text-sm text-primary hover:underline focus:outline-none"
      >
        Clear search
      </button>
    </div>
  );
}

export default EmptyState;
