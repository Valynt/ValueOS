/**
 * LazyAgentChatSidebar
 *
 * Deferred loading of the AgentChatSidebar until user interaction.
 * The component is code-split and only fetched when `open=true` is first triggered.
 */
import { Suspense, lazy, useEffect, useState } from "react";

import { InlineSkeleton } from "@/components/common/LayoutSkeleton";

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

// Lazy load the full chat sidebar component (heavy: useChat hook, message history, etc.)
const LazyAgentChatSidebarContent = lazy(() =>
  import("./AgentChatSidebar").then((m) => ({ default: m.AgentChatSidebar }))
);

/**
 * Lightweight placeholder that renders nothing when closed,
 * shows skeleton while loading, and then the real component.
 */
export function LazyAgentChatSidebar({ open, onClose }: AgentChatSidebarProps) {
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  // Track that we've opened at least once, so we don't re-fetch on every toggle
  useEffect(() => {
    if (open && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  }, [open, hasBeenOpened]);

  // Don't render anything until first open (keeps initial bundle lean)
  if (!hasBeenOpened && !open) {
    return null;
  }

  return (
    <Suspense fallback={<AgentChatSidebarSkeleton open={open} />}>
      <LazyAgentChatSidebarContent open={open} onClose={onClose} />
    </Suspense>
  );
}

/**
 * Skeleton that mimics the sidebar structure while loading
 */
function AgentChatSidebarSkeleton({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-card border-l border-border flex flex-col shadow-xl animate-in slide-in-from-right duration-300"
      role="status"
      aria-label="Loading agent chat"
    >
      {/* Header skeleton */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Agent message */}
        <div className="flex gap-3">
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
        {/* User message */}
        <div className="flex gap-3 justify-end">
          <div className="flex-1 space-y-2 pt-1 text-right">
            <div className="h-3 w-2/3 rounded bg-muted animate-pulse ml-auto" />
          </div>
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
        </div>
        {/* Agent message */}
        <div className="flex gap-3">
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Suggested prompts */}
        <div className="flex gap-2 overflow-hidden">
          <div className="h-6 w-32 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse shrink-0" />
        </div>
        {/* Input field */}
        <div className="h-10 rounded-lg bg-muted animate-pulse" />
      </div>

      <span className="sr-only">Loading agent chat...</span>
    </div>
  );
}
