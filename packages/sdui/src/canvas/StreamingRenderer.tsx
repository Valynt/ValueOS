/**
 * Streaming Canvas Renderer
 *
 * Renders canvas incrementally as agent generates layout.
 * Shows skeleton loaders during streaming, then renders the final
 * layout through the CanvasLayout components.
 */

import { createLogger } from "@shared/lib/logger";
import React, { useEffect, useState } from "react";

import { ComponentErrorBoundary } from "../components/ComponentErrorBoundary";
import {
  DashboardPanel,
  Grid,
  HorizontalSplit,
  VerticalSplit,
} from "../components/SDUI/CanvasLayout";
import { resolveComponentWithVersion } from "../registry";

import { CanvasLayout } from "./types";

const logger = createLogger({ component: "StreamingCanvas" });

export interface StreamingCanvasProps {
  canvasId: string;
  onEvent?: (event: unknown) => void;
  wsUrl?: string;
}

export const StreamingCanvas: React.FC<StreamingCanvasProps> = ({
  canvasId,
  onEvent,
  wsUrl = "/api/canvas/stream",
}) => {
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chunks, setChunks] = useState<Partial<CanvasLayout>[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`${wsUrl}/${canvasId}`);

    ws.onopen = () => {
      logger.info("Streaming canvas WebSocket connected", { canvasId, wsUrl });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "start") {
          setIsStreaming(true);
          setChunks([]);
        } else if (data.type === "chunk") {
          setIsStreaming(true);
          setChunks((prev) => [...prev, data.chunk]);
        } else if (data.type === "complete") {
          setLayout(data.layout);
          setIsStreaming(false);
          setChunks([]);
        } else if (data.type === "error") {
          logger.error("Streaming canvas error message received", new Error(String(data.error)), {
            canvasId,
          });
          setIsStreaming(false);
        }
      } catch (error) {
        logger.error(
          "Streaming canvas failed to parse message",
          error instanceof Error ? error : new Error(String(error)),
          { canvasId }
        );
      }
    };

    ws.onerror = () => {
      logger.error("Streaming canvas WebSocket error", new Error("WebSocket error"), { canvasId });
      setIsStreaming(false);
    };

    ws.onclose = () => {
      logger.info("Streaming canvas WebSocket disconnected", { canvasId });
      setIsStreaming(false);
    };

    return () => {
      ws.close();
    };
  }, [canvasId, wsUrl]);

  if (isStreaming && chunks.length > 0) {
    return <StreamingSkeletons chunks={chunks} />;
  }

  if (!layout) {
    return <EmptyCanvas message="Waiting for agent..." />;
  }

  return (
    <div className="h-full w-full" data-testid="streaming-canvas">
      <CanvasLayoutRenderer layout={layout} />
    </div>
  );
};

// ============================================================================
// Recursive layout renderer — maps CanvasLayout tree to React components
// ============================================================================

const MAX_DEPTH = 10;

const CanvasLayoutRenderer: React.FC<{ layout: CanvasLayout; depth?: number }> = ({
  layout,
  depth = 0,
}) => {
  if (depth > MAX_DEPTH) {
    return (
      <div className="p-4 border border-red-500 bg-red-50 text-red-900 text-sm">
        Layout too deeply nested (max {MAX_DEPTH}).
      </div>
    );
  }

  const layoutObj = layout as Record<string, unknown>;
  const renderChildren = (children: CanvasLayout[] | undefined) =>
    children?.map((child, i) => <CanvasLayoutRenderer key={i} layout={child} depth={depth + 1} />);

  const slotNodes = "slots" in layoutObj && layoutObj.slots
    ? {
      primary: (layoutObj.slots as Record<string, unknown>).primary ? <CanvasLayoutRenderer layout={(layoutObj.slots as Record<string, unknown>).primary as CanvasLayout} depth={depth + 1} /> : undefined,
      secondary: (layoutObj.slots as Record<string, unknown>).secondary ? <CanvasLayoutRenderer layout={(layoutObj.slots as Record<string, unknown>).secondary as CanvasLayout} depth={depth + 1} /> : undefined,
      header: (layoutObj.slots as Record<string, unknown>).header ? <CanvasLayoutRenderer layout={(layoutObj.slots as Record<string, unknown>).header as CanvasLayout} depth={depth + 1} /> : undefined,
      footer: (layoutObj.slots as Record<string, unknown>).footer ? <CanvasLayoutRenderer layout={(layoutObj.slots as Record<string, unknown>).footer as CanvasLayout} depth={depth + 1} /> : undefined,
    }
    : undefined;

  switch (layoutObj.type) {
    case "VerticalSplit":
      return (
        <VerticalSplit ratios={layoutObj.ratios as number[]} gap={layoutObj.gap as number} stackAt={layoutObj.stackAt as 'sm' | 'md' | 'lg' | 'xl' | false} dragResize={layoutObj.dragResize as boolean} minRatio={layoutObj.minRatio as number} slots={slotNodes}>
          {renderChildren(layoutObj.children as CanvasLayout[])}
        </VerticalSplit>
      );

    case "HorizontalSplit":
      return (
        <HorizontalSplit ratios={layoutObj.ratios as number[]} gap={layoutObj.gap as number} stackAt={layoutObj.stackAt as 'sm' | 'md' | 'lg' | 'xl' | false} dragResize={layoutObj.dragResize as boolean} minRatio={layoutObj.minRatio as number} slots={slotNodes}>
          {renderChildren(layoutObj.children as CanvasLayout[])}
        </HorizontalSplit>
      );

    case "Grid":
      return (
        <Grid columns={layoutObj.columns as number} rows={layoutObj.rows as number} gap={layoutObj.gap as number} responsive={layoutObj.responsive as boolean} responsiveColumns={layoutObj.responsiveColumns as Record<string, number>}>
          {renderChildren(layoutObj.children as CanvasLayout[])}
        </Grid>
      );

    case "DashboardPanel":
      return (
        <DashboardPanel title={layoutObj.title as string} collapsible={layoutObj.collapsible as boolean} defaultCollapsed={layoutObj.defaultCollapsed as boolean} slots={slotNodes}>
          {renderChildren(layoutObj.children as CanvasLayout[])}
        </DashboardPanel>
      );

    case "Component": {
      const componentName = layoutObj.component as string;
      const version = layoutObj.version as number;
      const props = layoutObj.props as Record<string, unknown>;
      const result = resolveComponentWithVersion(componentName, version);
      if (!result || !result.component) {
        return (
          <div className="p-3 border border-amber-300 bg-amber-50 text-amber-800 text-sm rounded">
            Component not found: {componentName}
          </div>
        );
      }
      const Component = result.component;
      return (
        <ComponentErrorBoundary componentName={componentName}>
          <Component {...(props ?? {})} />
        </ComponentErrorBoundary>
      );
    }

    default:
      return (
        <div className="p-3 border border-gray-300 bg-gray-50 text-gray-600 text-sm rounded">
          Unknown layout type: {(layout as Record<string, unknown>).type as string}
        </div>
      );
  }
};

// ============================================================================
// Skeleton loaders for streaming state
// ============================================================================

const SKELETON_HEIGHTS: Record<string, string> = {
  LineChart: "h-64",
  BarChart: "h-64",
  AreaChart: "h-64",
  KPICard: "h-32",
  MetricBadge: "h-20",
  DataTable: "h-96",
};

const StreamingSkeletons: React.FC<{ chunks: Partial<CanvasLayout>[] }> = ({ chunks }) => {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {chunks.map((chunk, i) => {
        const componentName =
          (chunk as Record<string, unknown>).type === "Component" ? (chunk as Record<string, unknown>).component as string : undefined;
        const heightClass =
          (componentName && SKELETON_HEIGHTS[componentName]) || "h-48";

        return <div key={i} className={`${heightClass} bg-gray-800 rounded-lg`} />;
      })}
    </div>
  );
};

// ============================================================================
// Empty canvas placeholder
// ============================================================================

const EmptyCanvas: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4" />
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};
