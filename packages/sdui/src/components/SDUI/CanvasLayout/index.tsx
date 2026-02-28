import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";

// ============================================================================
// Shared types
// ============================================================================

interface LayoutBaseProps {
  children?: React.ReactNode;
  className?: string;
}

interface SplitProps extends LayoutBaseProps {
  ratios?: number[];
  gap?: number;
}

interface GridProps extends LayoutBaseProps {
  columns?: number;
  rows?: number;
  gap?: number;
  responsive?: boolean;
}

interface DashboardPanelProps extends LayoutBaseProps {
  title?: string;
  collapsible?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert ratio array to CSS grid template value.
 * e.g. [1, 2, 1] → "1fr 2fr 1fr"
 */
function ratiosToTemplate(ratios: number[] | undefined, childCount: number): string {
  if (ratios && ratios.length === childCount) {
    return ratios.map((r) => `${r}fr`).join(" ");
  }
  return `repeat(${childCount}, 1fr)`;
}

function childArray(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children);
}

// ============================================================================
// VerticalSplit — children arranged in columns (side-by-side)
// ============================================================================

export const VerticalSplit: React.FC<SplitProps> = ({
  ratios,
  gap = 16,
  children,
  className = "",
}) => {
  const kids = childArray(children);

  return (
    <div
      data-testid="canvas-vertical-split"
      className={`w-full ${className}`}
      style={{
        display: "grid",
        gridTemplateColumns: ratiosToTemplate(ratios, kids.length),
        gap: `${gap}px`,
      }}
    >
      {kids.map((child, i) => (
        <div key={i} className="min-w-0">
          {child}
        </div>
      ))}
    </div>
  );
};
VerticalSplit.displayName = "VerticalSplit";

// ============================================================================
// HorizontalSplit — children stacked in rows (top-to-bottom)
// ============================================================================

export const HorizontalSplit: React.FC<SplitProps> = ({
  ratios,
  gap = 16,
  children,
  className = "",
}) => {
  const kids = childArray(children);

  return (
    <div
      data-testid="canvas-horizontal-split"
      className={`w-full ${className}`}
      style={{
        display: "grid",
        gridTemplateRows: ratiosToTemplate(ratios, kids.length),
        gap: `${gap}px`,
      }}
    >
      {kids.map((child, i) => (
        <div key={i} className="min-h-0">
          {child}
        </div>
      ))}
    </div>
  );
};
HorizontalSplit.displayName = "HorizontalSplit";

// ============================================================================
// Grid — CSS grid with configurable columns
// ============================================================================

export const Grid: React.FC<GridProps> = ({
  columns = 2,
  rows,
  gap = 16,
  responsive = true,
  children,
  className = "",
}) => {
  const templateColumns = responsive
    ? `repeat(auto-fill, minmax(min(100%, ${Math.floor(100 / columns)}%), 1fr))`
    : `repeat(${columns}, 1fr)`;

  const templateRows = rows ? `repeat(${rows}, auto)` : undefined;

  return (
    <div
      data-testid="canvas-grid"
      className={`w-full ${className}`}
      style={{
        display: "grid",
        gridTemplateColumns: templateColumns,
        gridTemplateRows: templateRows,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
};
Grid.displayName = "Grid";

// ============================================================================
// DashboardPanel — titled, optionally collapsible container
// ============================================================================

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  title,
  collapsible = false,
  children,
  className = "",
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      data-testid="canvas-dashboard-panel"
      className={`rounded-lg border border-border bg-card ${className}`}
    >
      {title && (
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b border-border ${
            collapsible ? "cursor-pointer select-none hover:bg-muted/50" : ""
          }`}
          onClick={collapsible ? () => setCollapsed((prev) => !prev) : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          {collapsible && (
            <span className="text-muted-foreground">
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          )}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      )}
      {!collapsed && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
};
DashboardPanel.displayName = "DashboardPanel";
