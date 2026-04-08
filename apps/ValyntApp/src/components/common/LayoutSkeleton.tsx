import { cn } from "@/lib/utils";

interface LayoutSkeletonProps {
  variant?: "fullscreen" | "embedded" | "sidebar";
  className?: string;
}

/**
 * LayoutSkeleton - Skeleton loader that mimics the actual MainLayout structure
 * Provides visual continuity during lazy loading, reducing perceived latency
 */
export function LayoutSkeleton({ variant = "fullscreen", className }: LayoutSkeletonProps) {
  const isFullscreen = variant === "fullscreen";
  const showSidebar = variant === "sidebar" || variant === "fullscreen";

  const containerClasses = cn(
    "flex overflow-hidden bg-background text-foreground",
    isFullscreen ? "h-screen" : "h-full min-h-[400px]",
    className
  );

  return (
    <div className={containerClasses} role="status" aria-live="polite" aria-label="Loading page content">
      {/* Sidebar skeleton */}
      {showSidebar && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-full max-w-[20rem] transform -translate-x-full",
            "lg:static lg:inset-0 lg:w-[16rem] lg:max-w-none lg:translate-x-0",
            "bg-card border-r border-border flex flex-col"
          )}
          aria-hidden="true"
        >
          {/* Sidebar header */}
          <div className="h-16 border-b border-border flex items-center px-4 gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>

          {/* Nav items */}
          <div className="flex-1 p-3 space-y-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-md bg-muted animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>

          {/* User footer */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar skeleton */}
        <div className="h-16 border-b border-border flex items-center px-4 gap-4 shrink-0">
          {/* Menu button (mobile) */}
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse lg:hidden" />
          
          {/* Breadcrumb / title */}
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>

        {/* Content area skeleton */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-6" aria-hidden="true">
          {/* Page header */}
          <div className="mb-6 space-y-2">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-72 rounded bg-muted animate-pulse" />
          </div>

          {/* Content cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Visually hidden loading message */}
      <span className="sr-only">Loading page content...</span>
    </div>
  );
}

/**
 * Simple skeleton for inline/embedded loading states
 */
export function InlineSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-muted animate-pulse"
          style={{ width: `${100 - (i * 15)}%`, animationDelay: `${i * 75}ms` }}
        />
      ))}
      <span className="sr-only">Loading content...</span>
    </div>
  );
}
