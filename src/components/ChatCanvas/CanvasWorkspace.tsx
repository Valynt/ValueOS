/**
 * Canvas Workspace Component
 *
 * Extracted from ChatCanvasLayout to handle SDUI rendering and canvas display.
 * Provides the main workspace for AI-generated content and user interactions.
 */

import React, { FC } from "react";
import { Loader2 } from "lucide-react";
import { RenderPageResult } from "../../sdui/renderPage";
import { StreamingUpdate } from "../../services/UnifiedAgentOrchestrator";
import { SkeletonCanvas } from "../Common/SkeletonCanvas";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

interface CanvasWorkspaceProps {
  renderedPage: RenderPageResult | null;
  isLoading: boolean;
  streamingUpdate: StreamingUpdate | null;
  isInitialLoad?: boolean;
}

export const CanvasContent: FC<CanvasWorkspaceProps> = ({
  renderedPage,
  isLoading,
  streamingUpdate,
  isInitialLoad,
}) => {
  // Show skeleton on initial load
  if (isInitialLoad) {
    return <SkeletonCanvas />;
  }

  // Show rendered content (prefer this even if loading/streaming to show updates)
  if (renderedPage?.element) {
    return (
      <div className="relative h-full flex flex-col">
        {/* Streaming Indicator Overlay */}
        {(isLoading || streamingUpdate) && (
          <div className="absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur border border-indigo-100 rounded-full shadow-sm animate-in fade-in slide-in-from-top-2">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-indigo-600">
              {streamingUpdate?.message || "Analyzing..."}
            </span>
          </div>
        )}

        <div className="p-6 overflow-auto flex-1">{renderedPage.element}</div>
      </div>
    );
  }

  // Fallback Loading State (only if no page rendered yet)
  if (isLoading || streamingUpdate) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg">
          <Loader2
            className="w-5 h-5 text-indigo-600 animate-spin"
            aria-hidden="true"
          />
          <span className="text-indigo-700 font-medium">
            {streamingUpdate?.message || "Processing..."}
          </span>
        </div>
        {streamingUpdate?.stage && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="capitalize">{streamingUpdate.stage}</span>
            {streamingUpdate.progress !== undefined && (
              <span>({Math.round(streamingUpdate.progress * 100)}%)</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export const CanvasWorkspace: FC<CanvasWorkspaceProps> = (props: CanvasWorkspaceProps) => {
  return (
    <div className="flex-1 flex flex-col bg-background">
      <CanvasErrorBoundary
        caseId={props.renderedPage?.metadata?.case_id}
        onRetry={() => window.location.reload()}
      >
        <CanvasContent {...props} />
      </CanvasErrorBoundary>
    </div>
  );
};
