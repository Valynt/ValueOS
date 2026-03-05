import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  DashboardPanelProps,
  GridLayoutProps,
  LayoutBreakpoint,
  SplitLayoutProps,
} from "./types";

const BREAKPOINTS: Record<LayoutBreakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

function childrenFromProps(children: React.ReactNode, slots?: React.ReactNode[]): React.ReactNode[] {
  if (slots && slots.length > 0) {
    return slots;
  }
  return React.Children.toArray(children);
}

function normalizeRatios(ratios: number[] | undefined, childCount: number): number[] {
  if (childCount === 0) return [];
  if (!ratios || ratios.length !== childCount) {
    return new Array(childCount).fill(1);
  }
  return ratios.map((ratio) => Math.max(0.1, ratio));
}

function templateFromRatios(ratios: number[]): string {
  return ratios.map((ratio) => `${ratio}fr`).join(" ");
}

function useCollapsedLayout(breakpoint?: LayoutBreakpoint): boolean {
  const [width, setWidth] = useState<number>(() =>
    typeof window === "undefined" ? Number.MAX_SAFE_INTEGER : window.innerWidth
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!breakpoint) {
    return false;
  }

  return width <= BREAKPOINTS[breakpoint];
}

interface SplitRendererProps {
  orientation: "horizontal" | "vertical";
  props: SplitLayoutProps;
}

function SplitRenderer({ orientation, props }: SplitRendererProps) {
  const {
    ratios,
    gap = 16,
    children,
    slots,
    className = "",
    responsive,
    resize,
  } = props;
  const childrenNodes = childrenFromProps(children, slots);
  const [dynamicRatios, setDynamicRatios] = useState<number[]>(() =>
    normalizeRatios(ratios, childrenNodes.length)
  );

  React.useEffect(() => {
    setDynamicRatios(normalizeRatios(ratios, childrenNodes.length));
  }, [ratios, childrenNodes.length]);

  const isCollapsed = useCollapsedLayout(responsive?.collapseAt);
  const shouldStack = isCollapsed && responsive?.collapseDirection;
  const activeOrientation = shouldStack ? responsive.collapseDirection : orientation;

  const templateStyle = useMemo(() => {
    if (childrenNodes.length === 0) {
      return undefined;
    }

    if (activeOrientation === "vertical") {
      return { gridTemplateColumns: templateFromRatios(dynamicRatios) };
    }

    return { gridTemplateRows: templateFromRatios(dynamicRatios) };
  }, [activeOrientation, childrenNodes.length, dynamicRatios]);

  const handleResize = (index: number, delta: number) => {
    setDynamicRatios((currentRatios) => {
      const current = [...currentRatios];
      const minRatio = resize?.minRatio ?? 0.25;
      const sizeFactor = activeOrientation === "vertical" ? window.innerWidth : window.innerHeight;
      const ratioDelta = delta / Math.max(sizeFactor, 1);

      const left = current[index] ?? 1;
      const right = current[index + 1] ?? 1;

      const boundedDelta = Math.min(right - minRatio, Math.max(minRatio - left, ratioDelta));
      current[index] = left + boundedDelta;
      current[index + 1] = right - boundedDelta;
      return current;
    });
  };

  const startDragResize = (index: number, startEvent: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") {
      return;
    }

    const startPosition = activeOrientation === "vertical" ? startEvent.clientX : startEvent.clientY;

    const onMove = (event: MouseEvent) => {
      const currentPosition = activeOrientation === "vertical" ? event.clientX : event.clientY;
      handleResize(index, currentPosition - startPosition);
    };

    const stopDrag = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stopDrag);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stopDrag);
  };

  return (
    <div
      data-testid={`canvas-${orientation}-split`}
      className={`grid w-full ${className}`}
      style={{
        ...templateStyle,
        gap: `${gap}px`,
      }}
    >
      {childrenNodes.map((child, index) => {
        const lastChild = index === childrenNodes.length - 1;

        return (
          <React.Fragment key={`split-child-${index}`}>
            <div className="min-h-0 min-w-0">{child}</div>
            {resize?.enabled && !lastChild && !shouldStack && (
              <button
                type="button"
                aria-label={`Resize pane ${index + 1}`}
                data-testid={`split-resizer-${index}`}
                onMouseDown={(event) => startDragResize(index, event)}
                className={`flex items-center justify-center rounded bg-border/80 text-muted-foreground hover:bg-border ${
                  activeOrientation === "vertical" ? "cursor-col-resize" : "cursor-row-resize"
                }`}
                style={{
                  minHeight: activeOrientation === "horizontal" ? "8px" : "100%",
                  minWidth: activeOrientation === "vertical" ? "8px" : "100%",
                }}
              >
                <GripVertical className="h-3 w-3" />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const VerticalSplit: React.FC<SplitLayoutProps> = (props) => (
  <SplitRenderer orientation="vertical" props={props} />
);

export const HorizontalSplit: React.FC<SplitLayoutProps> = (props) => (
  <SplitRenderer orientation="horizontal" props={props} />
);

export const Grid: React.FC<GridLayoutProps> = ({
  columns = 2,
  rows,
  gap = 16,
  responsive,
  children,
  slots,
  className = "",
}) => {
  const childrenNodes = childrenFromProps(children, slots);
  const isCollapsed = useCollapsedLayout(responsive?.collapseAt);

  const templateColumns = isCollapsed
    ? "1fr"
    : responsive?.minColumnWidth
      ? `repeat(auto-fit, minmax(${responsive.minColumnWidth}px, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <div
      data-testid="canvas-grid"
      className={`grid w-full ${className}`}
      style={{
        gridTemplateColumns: templateColumns,
        gridTemplateRows: rows ? `repeat(${rows}, minmax(0, auto))` : undefined,
        gap: `${gap}px`,
      }}
    >
      {childrenNodes}
    </div>
  );
};

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  title,
  subtitle,
  collapsible = false,
  defaultCollapsed = false,
  children,
  slots,
  className = "",
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section
      data-testid="canvas-dashboard-panel"
      className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm ${className}`}
    >
      {(title || subtitle) && (
        <header
          className={`border-b border-border px-4 py-3 ${collapsible ? "cursor-pointer select-none" : ""}`}
          onClick={collapsible ? () => setCollapsed((prev) => !prev) : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          <div className="flex items-center gap-2">
            {collapsible ? (
              collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : null}
            {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          </div>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </header>
      )}
      {!collapsed ? <div className="space-y-4 p-4">{childrenFromProps(children, slots)}</div> : null}
    </section>
  );
};

VerticalSplit.displayName = "VerticalSplit";
HorizontalSplit.displayName = "HorizontalSplit";
Grid.displayName = "Grid";
DashboardPanel.displayName = "DashboardPanel";

export type {
  DashboardPanelProps,
  GridLayoutProps,
  LayoutBaseProps,
  ResponsiveLayoutConfig,
  SplitLayoutProps,
  SplitResizeConfig,
} from "./types";
