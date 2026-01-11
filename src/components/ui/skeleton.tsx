/**
 * Skeleton Component
 *
 * Content-aware skeleton loading states for improved perceived performance.
 * Follows VALYNT design system with subtle animations.
 */

import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-none",
    rounded: "rounded-md",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  return (
    <div
      className={cn(
        "bg-gray-700/50",
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
      aria-hidden="true"
      role="presentation"
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({ lines = 3, className, lastLineWidth = "60%" }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          width={i === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showActions?: boolean;
}

export function SkeletonCard({
  className,
  showImage = true,
  showActions = true,
}: SkeletonCardProps) {
  return (
    <div className={cn("bg-gray-800/50 rounded-lg border border-gray-700/50 p-4", className)}>
      {showImage && <Skeleton variant="rounded" height={120} className="w-full mb-4" />}
      <Skeleton variant="text" height={20} className="w-3/4 mb-2" />
      <Skeleton variant="text" height={14} className="w-full mb-1" />
      <Skeleton variant="text" height={14} className="w-2/3 mb-4" />
      {showActions && (
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={32} className="w-20" />
          <Skeleton variant="rounded" height={32} className="w-20" />
        </div>
      )}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex gap-4 p-3 border-b border-gray-700/50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} variant="text" height={16} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 p-3 border-b border-gray-700/30">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              variant="text"
              height={14}
              className="flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonListProps {
  items?: number;
  className?: string;
  showAvatar?: boolean;
}

export function SkeletonList({ items = 5, className, showAvatar = true }: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          {showAvatar && <Skeleton variant="circular" width={40} height={40} />}
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={14} className="w-1/3" />
            <Skeleton variant="text" height={12} className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SkeletonDashboardProps {
  className?: string;
}

export function SkeletonDashboard({ className }: SkeletonDashboardProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" height={28} className="w-48" />
          <Skeleton variant="text" height={14} className="w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={36} className="w-24" />
          <Skeleton variant="rounded" height={36} className="w-24" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
            <Skeleton variant="text" height={12} className="w-20 mb-2" />
            <Skeleton variant="text" height={28} className="w-16 mb-1" />
            <Skeleton variant="text" height={10} className="w-12" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
          <Skeleton variant="text" height={20} className="w-32 mb-4" />
          <Skeleton variant="rounded" height={200} className="w-full" />
        </div>
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
          <Skeleton variant="text" height={20} className="w-24 mb-4" />
          <SkeletonList items={4} showAvatar={false} />
        </div>
      </div>
    </div>
  );
}

interface SkeletonCanvasProps {
  className?: string;
}

export function SkeletonCanvas({ className }: SkeletonCanvasProps) {
  return (
    <div className={cn("flex h-full", className)}>
      {/* Left panel - Chat */}
      <div className="w-2/5 border-r border-gray-700/50 p-4 space-y-4">
        <Skeleton variant="text" height={20} className="w-32 mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "p-3 rounded-lg",
              i % 2 === 0 ? "bg-gray-800/30 ml-0 mr-8" : "bg-primary/10 ml-8 mr-0"
            )}
          >
            <Skeleton variant="text" height={14} className="w-full mb-1" />
            <Skeleton variant="text" height={14} className="w-3/4" />
          </div>
        ))}
        {/* Input */}
        <div className="mt-auto pt-4">
          <Skeleton variant="rounded" height={48} className="w-full" />
        </div>
      </div>

      {/* Right panel - Canvas */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="text" height={24} className="w-40" />
          <div className="flex gap-2">
            <Skeleton variant="rounded" height={32} className="w-8" />
            <Skeleton variant="rounded" height={32} className="w-8" />
            <Skeleton variant="rounded" height={32} className="w-8" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} showImage={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
