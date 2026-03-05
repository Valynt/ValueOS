import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import React, { useMemo, useState } from "react";

const BREAKPOINT_PREFIX = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

function toChildrenArray(children, slots) {
  const slotted = [slots?.primary, slots?.secondary].filter(Boolean);
  const fromChildren = React.Children.toArray(children);
  return slotted.length > 0 ? slotted : fromChildren;
}

function ratiosToTemplate(ratios, childCount) {
  if (childCount === 0) {
    return "1fr";
  }

  if (ratios.length === childCount) {
    return ratios.map((value) => `${Math.max(value, 0.05)}fr`).join(" ");
  }

  return `repeat(${childCount}, minmax(0, 1fr))`;
}

function getStackClasses(direction, stackAt) {
  if (!stackAt) {
    return direction === "vertical" ? "grid-cols-[inherit]" : "grid-rows-[inherit]";
  }

  const prefix = BREAKPOINT_PREFIX[stackAt];
  return direction === "vertical" ? `grid-cols-1 ${prefix}:grid-cols-[inherit]` : `grid-rows-1 ${prefix}:grid-rows-[inherit]`;
}

function SplitLayout({
  direction,
  ratios,
  gap = 16,
  children,
  className = "",
  slots,
  stackAt = "md",
  dragResize = false,
  minRatio = 0.2,
}) {
  const childNodes = toChildrenArray(children, slots);
  const baseRatios = useMemo(() => {
    if (ratios && ratios.length === childNodes.length) {
      return ratios;
    }

    return Array.from({ length: Math.max(childNodes.length, 1) }, () => 1);
  }, [ratios, childNodes.length]);
  const [dynamicRatios, setDynamicRatios] = useState(baseRatios);

  const canDrag = dragResize && childNodes.length === 2;

  const handleResize = (event) => {
    if (!canDrag) {
      return;
    }

    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const position = direction === "vertical" ? event.clientX - bounds.left : event.clientY - bounds.top;
    const total = direction === "vertical" ? bounds.width : bounds.height;

    if (total <= 0) {
      return;
    }

    const rawRatio = position / total;
    const constrainedRatio = Math.max(minRatio, Math.min(1 - minRatio, rawRatio));
    setDynamicRatios([constrainedRatio, 1 - constrainedRatio]);
  };

  const template = ratiosToTemplate(canDrag ? dynamicRatios : baseRatios, childNodes.length);

  const style =
    direction === "vertical"
      ? { gridTemplateColumns: template, gap: `${gap}px` }
      : { gridTemplateRows: template, gap: `${gap}px` };

  const testId = direction === "vertical" ? "canvas-vertical-split" : "canvas-horizontal-split";
  const axisClass = direction === "vertical" ? "grid-flow-col" : "grid-flow-row";

  return (
    <div data-testid={testId} className={`w-full grid ${axisClass} ${getStackClasses(direction, stackAt)} ${className}`} style={style}>
      {childNodes.map((child, index) => (
        <React.Fragment key={`split-child-${index}`}>
          <div className={direction === "vertical" ? "min-w-0" : "min-h-0"}>{child}</div>
          {canDrag && index === 0 && (
            <div
              role="separator"
              aria-orientation={direction === "vertical" ? "vertical" : "horizontal"}
              onMouseDown={handleResize}
              onMouseMove={(event) => {
                if (event.buttons === 1) {
                  handleResize(event);
                }
              }}
              className="group z-10 flex items-center justify-center rounded bg-border/40 text-muted-foreground hover:bg-border"
            >
              <GripVertical className="h-3 w-3" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function VerticalSplit(props) {
  return <SplitLayout {...props} direction="vertical" />;
}

export function HorizontalSplit(props) {
  return <SplitLayout {...props} direction="horizontal" />;
}

export function Grid({
  columns = 2,
  rows,
  gap = 16,
  responsive = true,
  responsiveColumns,
  children,
  className = "",
}) {
  const templateRows = rows ? `repeat(${rows}, minmax(0, 1fr))` : undefined;

  const responsiveClasses = responsive
    ? [
        `grid-cols-${responsiveColumns?.base ?? 1}`,
        responsiveColumns?.sm ? `sm:grid-cols-${responsiveColumns.sm}` : "",
        `md:grid-cols-${responsiveColumns?.md ?? columns}`,
        responsiveColumns?.lg ? `lg:grid-cols-${responsiveColumns.lg}` : "",
        responsiveColumns?.xl ? `xl:grid-cols-${responsiveColumns.xl}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div
      data-testid="canvas-grid"
      className={`w-full grid ${responsive ? responsiveClasses : ""} ${className}`}
      style={{
        gridTemplateColumns: responsive ? undefined : `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: templateRows,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

export function DashboardPanel({
  title,
  collapsible = false,
  defaultCollapsed = false,
  contentClassName = "",
  children,
  className = "",
  slots,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section data-testid="canvas-dashboard-panel" className={`rounded-lg border border-border bg-card ${className}`}>
      {(title || slots?.header) && (
        <div
          className={`flex items-center gap-2 border-b border-border px-4 py-3 ${collapsible ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
          onClick={collapsible ? () => setCollapsed((previous) => !previous) : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          {collapsible && (
            <span className="text-muted-foreground">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
          )}
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {slots?.header}
        </div>
      )}
      {!collapsed && (
        <div className={`space-y-4 p-4 ${contentClassName}`}>
          {children}
          {slots?.footer}
        </div>
      )}
    </section>
  );
}
