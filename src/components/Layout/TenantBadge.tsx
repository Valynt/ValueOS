/**
 * TenantBadge Component
 *
 * Displays the current tenant with color-coded visual indicator.
 * Always visible in the app header to prevent "wrong tenant" errors.
 */

import { useTenant } from "../../contexts/TenantContext";
import { cn } from "../../lib/utils";

interface TenantBadgeProps {
  className?: string;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TenantBadge({ className, showName = true, size = "md" }: TenantBadgeProps) {
  const { currentTenant, isLoading, error, isApiEnabled } = useTenant();

  if (!isApiEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 animate-pulse",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          size === "lg" && "text-base",
          className
        )}
      >
        <div className="w-3 h-3 rounded-full bg-gray-600" />
        {showName && <div className="w-20 h-4 bg-gray-600 rounded" />}
      </div>
    );
  }

  if (error || !currentTenant) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-amber-500",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          size === "lg" && "text-base",
          className
        )}
        title={error?.message || "No tenant selected"}
      >
        <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
        {showName && <span className="truncate max-w-[120px]">No Tenant</span>}
      </div>
    );
  }

  const sizeClasses = {
    sm: "text-xs gap-1.5",
    md: "text-sm gap-2",
    lg: "text-base gap-2.5",
  };

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div
      className={cn("flex items-center", sizeClasses[size], className)}
      title={`Current tenant: ${currentTenant.name}`}
    >
      <div
        className={cn("rounded-full flex-shrink-0", dotSizes[size])}
        style={{ backgroundColor: currentTenant.color }}
        aria-hidden="true"
      />
      {showName && <span className="truncate max-w-[150px] font-medium">{currentTenant.name}</span>}
      <span className="sr-only">Current tenant: {currentTenant.name}</span>
    </div>
  );
}

export default TenantBadge;
