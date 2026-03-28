/**
 * Skeleton Component
 *
 * Loading placeholder that matches content layout.
 * Supports various shapes and animations for better UX.
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const skeletonVariants = cva(
  // Base styles
  "animate-pulse rounded-md bg-muted",
  {
    variants: {
      variant: {
        default: "bg-muted",
        card: "bg-card border border-border",
        text: "bg-muted/60",
        avatar: "bg-muted rounded-full",
        button: "bg-muted h-10 rounded-md",
        input: "bg-muted h-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {
  /**
   * Whether to show the skeleton animation
   */
  animate?: boolean;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, animate = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant }), !animate && "animate-none", className)}
        {...props}
        role="status"
        aria-label="Loading..."
        aria-busy="true"
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

// Pre-built skeleton components for common use cases
export function SkeletonText({
  lines = 1,
  className,
  ...props
}: { lines?: number } & SkeletonProps) {
  if (lines === 1) {
    return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full", // Last line shorter
            className
          )}
          {...props}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("p-6 space-y-4", className)}>
      <Skeleton className="h-4 w-1/4" {...props} />
      <Skeleton className="h-8 w-3/4" {...props} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" {...props} />
        <Skeleton className="h-4 w-5/6" {...props} />
        <Skeleton className="h-4 w-4/6" {...props} />
      </div>
    </div>
  );
}

export function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: SkeletonProps & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return <Skeleton variant="avatar" className={cn(sizeClasses[size], className)} {...props} />;
}

export function SkeletonButton({ className, ...props }: SkeletonProps) {
  return <Skeleton variant="button" className={cn("h-10 w-24", className)} {...props} />;
}

export { Skeleton, skeletonVariants };
