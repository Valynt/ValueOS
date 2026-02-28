/**
 * LoadingSkeleton Component
 * Provides consistent loading states to prevent layout shift
 */

import React from "react";

import { Skeleton } from "./skeleton";

import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  variant?: "default" | "card" | "text" | "button";
  lines?: number;
}

export function LoadingSkeleton({
  className,
  variant = "default",
  lines = 3,
}: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (variant === "button") {
    return <Skeleton className={cn("h-10 w-24", className)} />;
  }

  return <Skeleton className={cn("h-4 w-full", className)} />;
}
