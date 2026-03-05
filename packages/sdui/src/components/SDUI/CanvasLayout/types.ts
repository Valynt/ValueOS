import React from "react";

export type LayoutBreakpoint = "sm" | "md" | "lg" | "xl";

export interface LayoutBaseProps {
  children?: React.ReactNode;
  slots?: React.ReactNode[];
  className?: string;
}

export interface ResponsiveLayoutConfig {
  collapseAt?: LayoutBreakpoint;
  collapseDirection?: "vertical" | "horizontal";
}

export interface SplitResizeConfig {
  enabled?: boolean;
  minRatio?: number;
}

export interface SplitLayoutProps extends LayoutBaseProps {
  ratios?: number[];
  gap?: number;
  responsive?: ResponsiveLayoutConfig;
  resize?: SplitResizeConfig;
}

export interface GridLayoutProps extends LayoutBaseProps {
  columns?: number;
  rows?: number;
  gap?: number;
  responsive?: {
    minColumnWidth?: number;
    collapseAt?: LayoutBreakpoint;
  };
}

export interface DashboardPanelProps extends LayoutBaseProps {
  title?: string;
  subtitle?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
