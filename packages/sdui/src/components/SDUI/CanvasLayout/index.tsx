import { ChevronDown, ChevronRight, GripVertical, GripHorizontal } from "lucide-react";
import React, { useMemo, useState } from "react";

export type ResponsiveBreakpoint = "sm" | "md" | "lg" | "xl";

export interface LayoutSlots {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export interface LayoutBaseProps {
  children?: React.ReactNode;
  className?: string;
  slots?: LayoutSlots;
}

export interface SplitProps extends LayoutBaseProps {
  ratios?: [number, number] | number[];
  gap?: number;
  stackAt?: ResponsiveBreakpoint | false;
  dragResize?: boolean;
  minRatio?: number;
}

export interface GridResponsiveColumns {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface GridProps extends LayoutBaseProps {
  columns?: number;
  rows?: number;
  gap?: number;
  responsive?: boolean;
  responsiveColumns?: GridResponsiveColumns;
}

export interface DashboardPanelProps extends LayoutBaseProps {
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  contentClassName?: string;
}

const COLUMN_CLASS_MAP: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

const BREAKPOINT_COLUMN_CLASS_MAP: Record<ResponsiveBreakpoint, Record<number, string>> = {
  sm: Object.fromEntries(Object.entries(COLUMN_CLASS_MAP).map(([key, value]) => [Number(key), `sm:${value}`])) as Record<number, string>,
  md: Object.fromEntries(Object.entries(COLUMN_CLASS_MAP).map(([key, value]) => [Number(key), `md:${value}`])) as Record<number, string>,
  lg: Object.fromEntries(Object.entries(COLUMN_CLASS_MAP).map(([key, value]) => [Number(key), `lg:${value}`])) as Record<number, string>,
  xl: Object.fromEntries(Object.entries(COLUMN_CLASS_MAP).map(([key, value]) => [Number(key), `xl:${value}`])) as Record<number, string>,
};

const STACK_CLASS_MAP: Record<ResponsiveBreakpoint, { vertical: string; horizontal: string }> = {
  sm: { vertical: "flex-col sm:flex-row", horizontal: "flex-row sm:flex-col" },
  md: { vertical: "flex-col md:flex-row", horizontal: "flex-row md:flex-col" },
  lg: { vertical: "flex-col lg:flex-row", horizontal: "flex-row lg:flex-col" },
  xl: { vertical: "flex-col xl:flex-row", horizontal: "flex-row xl:flex-col" },
};

function clampColumnCount(value: number | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  return Math.max(1, Math.min(12, value));
}

function toChildrenArray(children: React.ReactNode, slots?: LayoutSlots): React.ReactNode[] {
  const slotted = [slots?.primary, slots?.secondary].filter(Boolean);
  const fromChildren = React.Children.toArray(children);
  return slotted.length > 0 ? slotted : fromChildren;
}

function normalizeRatios(ratios: number[] | undefined, childCount: number): number[] {
  if (childCount === 0) {
    return [];
  }
  if (ratios && ratios.length === childCount) {
    return ratios.map((ratio) => Math.max(0.05, ratio));
  }
  return Array.from({ length: childCount }, () => 1);
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
}: SplitProps & { direction: "horizontal" | "vertical" }) {
  const childNodes = toChildrenArray(children, slots);
  const ratioDefaults = useMemo(() => normalizeRatios(ratios, childNodes.length), [ratios, childNodes.length]);
  const [dynamicRatios, setDynamicRatios] = useState(ratioDefaults);

  const canDrag = dragResize && childNodes.length === 2;
  const isVertical = direction === "vertical";

  const activeRatios = canDrag ? dynamicRatios : ratioDefaults;
  const totalRatio = activeRatios.reduce((sum, value) => sum + value, 0) || 1;

  const onResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canDrag) {
      return;
    }

    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const pointer = isVertical ? event.clientX - bounds.left : event.clientY - bounds.top;
    const total = isVertical ? bounds.width : bounds.height;

    if (total <= 0) {
      return;
    }

    const normalized = pointer / total;
    const constrained = Math.max(minRatio, Math.min(1 - minRatio, normalized));
    setDynamicRatios([constrained, 1 - constrained]);
  };

  const stackClasses = stackAt ? STACK_CLASS_MAP[stackAt][direction] : isVertical ? "flex-row" : "flex-col";

  return (
    <div
      data-testid={isVertical ? "canvas-vertical-split" : "canvas-horizontal-split"}
      className={`relative flex w-full ${stackClasses} ${className}`}
      style={{ gap: `${gap}px` }}
    >
      {childNodes.map((child, index) => {
        const basis = `${(activeRatios[index] ?? 1 / childNodes.length) / totalRatio * 100}%`;

        return (
          <div
            key={`split-child-${index}`}
            className={isVertical ? "min-w-0" : "min-h-0"}
            style={{ flexBasis: basis, flexGrow: 0, flexShrink: 1 }}
          >
            {child}
          </div>
        );
      })}

      {canDrag && (
        <button
          type="button"
          role="separator"
          aria-orientation={isVertical ? "vertical" : "horizontal"}
          aria-label={isVertical ? "Resize columns" : "Resize rows"}
          onMouseDown={onResize}
          onMouseMove={(event) => {
            if (event.buttons === 1) {
              onResize(event);
            }
          }}
          className={`absolute z-10 flex items-center justify-center rounded-md bg-border/60 text-muted-foreground hover:bg-border ${
            isVertical
              ? "top-1/2 h-12 w-3 -translate-y-1/2"
              : "left-1/2 h-3 w-12 -translate-x-1/2"
          }`}
          style={
            isVertical
              ? { left: `calc(${(activeRatios[0] / totalRatio) * 100}% - 6px)` }
              : { top: `calc(${(activeRatios[0] / totalRatio) * 100}% - 6px)` }
          }
        >
          {isVertical ? <GripVertical className="h-3 w-3" /> : <GripHorizontal className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

export function VerticalSplit(props: SplitProps) {
  return <SplitLayout {...props} direction="vertical" />;
}

export function HorizontalSplit(props: SplitProps) {
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
}: GridProps) {
  const base = clampColumnCount(responsiveColumns?.base, 1);
  const sm = responsiveColumns?.sm ? clampColumnCount(responsiveColumns.sm, base) : undefined;
  const md = clampColumnCount(responsiveColumns?.md, columns);
  const lg = responsiveColumns?.lg ? clampColumnCount(responsiveColumns.lg, md) : undefined;
  const xl = responsiveColumns?.xl ? clampColumnCount(responsiveColumns.xl, lg ?? md) : undefined;

  const responsiveClasses = responsive
    ? [
        COLUMN_CLASS_MAP[base],
        sm ? BREAKPOINT_COLUMN_CLASS_MAP.sm[sm] : "",
        BREAKPOINT_COLUMN_CLASS_MAP.md[md],
        lg ? BREAKPOINT_COLUMN_CLASS_MAP.lg[lg] : "",
        xl ? BREAKPOINT_COLUMN_CLASS_MAP.xl[xl] : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div
      data-testid="canvas-grid"
      className={`grid w-full ${responsiveClasses} ${className}`}
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: responsive ? undefined : `repeat(${clampColumnCount(columns, 2)}, minmax(0, 1fr))`,
        gridTemplateRows: rows ? `repeat(${rows}, minmax(0, 1fr))` : undefined,
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
}: DashboardPanelProps) {
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
