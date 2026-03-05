import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";

// Placeholder components - these need to be implemented
export const AgentResponseCard: React.FC<any> = () => (
  <div>AgentResponseCard - Not implemented</div>
);
export const AgentWorkflowPanel: React.FC<any> = () => (
  <div>AgentWorkflowPanel - Not implemented</div>
);
export const Breadcrumbs: React.FC<any> = () => <div>Breadcrumbs - Not implemented</div>;
export const ConfidenceIndicator: React.FC<any> = () => (
  <div>ConfidenceIndicator - Not implemented</div>
);
export const DataTable: React.FC<any> = () => <div>DataTable - Not implemented</div>;
export const ExpansionBlock: React.FC<any> = () => <div>ExpansionBlock - Not implemented</div>;
export const InfoBanner: React.FC<any> = () => <div>InfoBanner - Not implemented</div>;
export const IntegrityReviewPanel: React.FC<any> = () => (
  <div>IntegrityReviewPanel - Not implemented</div>
);
export const LifecyclePanel: React.FC<any> = () => <div>LifecyclePanel - Not implemented</div>;
export const MetricBadge: React.FC<any> = () => <div>MetricBadge - Not implemented</div>;
export const RealizationDashboard: React.FC<any> = () => (
  <div>RealizationDashboard - Not implemented</div>
);
export const ScenarioSelector: React.FC<any> = () => <div>ScenarioSelector - Not implemented</div>;
export const SDUIForm: React.FC<any> = () => <div>SDUIForm - Not implemented</div>;
export const SectionErrorFallback: React.FC<any> = () => (
  <div>SectionErrorFallback - Not implemented</div>
);
export const SideNavigation: React.FC<any> = () => <div>SideNavigation - Not implemented</div>;
export const TabBar: React.FC<any> = () => <div>TabBar - Not implemented</div>;
export const ValueCommitForm: React.FC<any> = () => <div>ValueCommitForm - Not implemented</div>;
export const JsonViewer: React.FC<any> = () => <div>JsonViewer - Not implemented</div>;
export const TextBlock: React.FC<any> = () => <div>TextBlock - Not implemented</div>;
export const ConfirmationDialog: React.FC<any> = () => (
  <div>ConfirmationDialog - Not implemented</div>
);
export const ValueHypothesisCard: React.FC<any> = () => (
  <div>ValueHypothesisCard - Not implemented</div>
);
export const ProgressBar: React.FC<any> = () => <div>ProgressBar - Not implemented</div>;
export const ComponentPreview: React.FC<any> = () => <div>ComponentPreview - Not implemented</div>;

// Re-export implemented components from their own files
export { DiscoveryCard } from "./DiscoveryCard";
export { KPIForm } from "./KPIForm";
export { InteractiveChart } from "./InteractiveChart";
export { ValueTreeCard } from "./ValueTreeCard";
export { NarrativeBlock } from "./NarrativeBlock";

export interface UnknownComponentFallbackProps {
  componentName?: string;
  props?: Record<string, any>;
  className?: string;
}

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

export const UnknownComponentFallback: React.FC<UnknownComponentFallbackProps> = ({
  componentName = "Unknown",
  props,
  className = "",
}) => {
  const [showProps, setShowProps] = useState(false);

  return (
    <div
      data-testid="unknown-component-fallback"
      className={`bg-card border border-border rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
        <span className="text-sm font-medium">
          Unknown component: <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{componentName}</code>
        </span>
      </div>
      {isDev && props && Object.keys(props).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowProps(!showProps)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showProps ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Requested props
          </button>
          {showProps && (
            <pre className="mt-2 text-xs bg-secondary/50 rounded p-2 overflow-auto max-h-48 text-muted-foreground">
              {JSON.stringify(props, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
UnknownComponentFallback.displayName = "UnknownComponentFallback";

export { DashboardPanel, Grid, HorizontalSplit, VerticalSplit } from "./CanvasLayout";
export type {
  DashboardPanelProps,
  GridLayoutProps,
  LayoutBaseProps,
  ResponsiveLayoutConfig,
  SplitLayoutProps,
  SplitResizeConfig,
} from "./CanvasLayout";
