/**
 * Badge Component
 *
 * Small status indicators and labels.
 * Follows ValueOS design system.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline:
          "border-border text-foreground",
        success:
          "border-transparent bg-success/10 text-success border-success/20",
        warning:
          "border-transparent bg-warning/10 text-warning-700 border-warning/20",
        error:
          "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        destructive:
          "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        info:
          "border-transparent bg-primary/10 text-primary border-primary/20",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  removable?: boolean;
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, removable, onRemove, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {children}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-1 -mr-0.5 rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Remove"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
Badge.displayName = "Badge";

/**
 * StatusBadge - Badge specifically for status indicators
 */
export type StatusType = "draft" | "in-progress" | "review" | "approved" | "completed" | "archived";

const statusConfig: Record<StatusType, { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "Draft", variant: "secondary" },
  "in-progress": { label: "In Progress", variant: "info" },
  review: { label: "Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  archived: { label: "Archived", variant: "outline" },
};

export interface StatusBadgeProps {
  status: StatusType;
  size?: BadgeProps["size"];
  className?: string;
}

const StatusBadge = ({ status, size = "md", className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
};

/**
 * VerificationBadge - Badge for data verification status
 */
export interface VerificationBadgeProps {
  verified: boolean;
  source?: string;
  size?: BadgeProps["size"];
  className?: string;
}

const VerificationBadge = ({ verified, source, size = "sm", className }: VerificationBadgeProps) => {
  return (
    <Badge
      variant={verified ? "success" : "warning"}
      size={size}
      className={className}
    >
      {verified ? "Verified" : "Estimated"}
      {source && (
        <span className="ml-1 opacity-70">• {source}</span>
      )}
    </Badge>
  );
};

/**
 * CountBadge - Badge for showing counts (notifications, items, etc.)
 */
export interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeProps["variant"];
  className?: string;
}

const CountBadge = ({ count, max = 99, variant = "default", className }: CountBadgeProps) => {
  const displayCount = count > max ? `${max}+` : count;

  if (count === 0) return null;

  return (
    <Badge
      variant={variant}
      size="sm"
      className={cn("min-w-[1.25rem] justify-center px-1.5", className)}
    >
      {displayCount}
    </Badge>
  );
};

export { Badge, badgeVariants, StatusBadge, VerificationBadge, CountBadge };
