/**
 * Canvas Layer: CanvasHost
 * Dynamic host for SDUI-driven widgets
 * Implements the DynamicRenderer pattern for server-driven UI
 */

import { AlertTriangle, Building2, RefreshCw } from "lucide-react";
import React, { Component, ComponentType, ErrorInfo, ReactNode, Suspense } from "react";

// Widget type registry - maps component_type to lazy-loaded components
const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {};

export interface WidgetProps {
  id: string;
  data?: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => Promise<void> | void;
}

export interface SDUIWidget {
  id: string;
  componentType: string;
  props?: Record<string, unknown>;
  children?: SDUIWidget[];
}

interface CanvasHostProps {
  widgets: SDUIWidget[];
  onWidgetAction?: (widgetId: string, action: string, payload?: unknown) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

// Register built-in widgets
function registerWidget(type: string, component: ComponentType<WidgetProps>) {
  widgetRegistry[type] = component;
}

// Lazy-load built-in widgets to keep bundle split
const ValueSummaryCard = React.lazy(() => import("./widgets/ValueSummaryCard"));
const AgentResponseCard = React.lazy(() => import("./widgets/AgentResponseCard"));
const ChatInputWidget = React.lazy(() => import("./widgets/ChatInput"));

// V1 Surface Widgets
const StakeholderMap = React.lazy(() => import("./widgets/StakeholderMap"));
const GapResolution = React.lazy(() => import("./widgets/GapResolution"));
const HypothesisCard = React.lazy(() => import("./widgets/HypothesisCard"));
const AssumptionRegister = React.lazy(() => import("./widgets/AssumptionRegister"));
const ScenarioComparison = React.lazy(() => import("./widgets/ScenarioComparison"));
const SensitivityTornado = React.lazy(() => import("./widgets/SensitivityTornado"));
const ReadinessGauge = React.lazy(() => import("./widgets/ReadinessGauge"));
const EvidenceGapList = React.lazy(() => import("./widgets/EvidenceGapList"));
const ArtifactPreview = React.lazy(() => import("./widgets/ArtifactPreview"));
const InlineEditor = React.lazy(() => import("./widgets/InlineEditor"));
const KPITargetCard = React.lazy(() => import("./widgets/KPITargetCard"));
const CheckpointTimeline = React.lazy(() => import("./widgets/CheckpointTimeline"));
const UsageMeter = React.lazy(() => import("./widgets/UsageMeter"));
const PlanComparison = React.lazy(() => import("./widgets/PlanComparison"));

// Register built-in SDUI widget types
registerWidget("value-summary", ValueSummaryCard as unknown as ComponentType<WidgetProps>);
registerWidget("agent-response", AgentResponseCard as unknown as ComponentType<WidgetProps>);
registerWidget("chat-input", ChatInputWidget as unknown as ComponentType<WidgetProps>);

// Register V1 Surface Widgets
registerWidget("stakeholder-map", StakeholderMap as unknown as ComponentType<WidgetProps>);
registerWidget("gap-resolution", GapResolution as unknown as ComponentType<WidgetProps>);
registerWidget("hypothesis-card", HypothesisCard as unknown as ComponentType<WidgetProps>);
registerWidget("assumption-register", AssumptionRegister as unknown as ComponentType<WidgetProps>);
registerWidget("scenario-comparison", ScenarioComparison as unknown as ComponentType<WidgetProps>);
registerWidget("sensitivity-tornado", SensitivityTornado as unknown as ComponentType<WidgetProps>);
registerWidget("readiness-gauge", ReadinessGauge as unknown as ComponentType<WidgetProps>);
registerWidget("evidence-gap-list", EvidenceGapList as unknown as ComponentType<WidgetProps>);
registerWidget("artifact-preview", ArtifactPreview as unknown as ComponentType<WidgetProps>);
registerWidget("inline-editor", InlineEditor as unknown as ComponentType<WidgetProps>);
registerWidget("kpi-target-card", KPITargetCard as unknown as ComponentType<WidgetProps>);
registerWidget("checkpoint-timeline", CheckpointTimeline as unknown as ComponentType<WidgetProps>);
registerWidget("usage-meter", UsageMeter as unknown as ComponentType<WidgetProps>);
registerWidget("plan-comparison", PlanComparison as unknown as ComponentType<WidgetProps>);

// Per-widget error fallback — compact, does not crash sibling widgets
interface WidgetErrorFallbackProps {
  widgetId: string;
  onRetry: () => void;
}

function WidgetErrorFallback({ widgetId, onRetry }: WidgetErrorFallbackProps) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">Widget failed to render</p>
          <p className="text-xs text-muted-foreground font-mono">{widgetId}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

interface WidgetErrorBoundaryProps {
  widgetId: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  retryKey: number;
}

class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): Partial<WidgetErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`CanvasHost: widget "${this.props.widgetId}" threw`, {
      error,
      widgetId: this.props.widgetId,
      componentStack: info.componentStack,
    });
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  override render() {
    if (this.state.hasError) {
      return <WidgetErrorFallback widgetId={this.props.widgetId} onRetry={this.handleRetry} />;
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

// Widget loading fallback
function WidgetSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-6">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

// Unknown widget fallback
function UnknownWidget({ componentType }: { componentType: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Unknown widget type: <code className="text-primary">{componentType}</code>
      </p>
    </div>
  );
}

// Default empty state
function DefaultEmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium">No case selected</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a case from the sidebar or create a new one
        </p>
      </div>
    </div>
  );
}

export function CanvasHost({
  widgets,
  onWidgetAction,
  emptyState,
  className = "",
}: CanvasHostProps) {
  if (widgets.length === 0) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  const renderWidget = (widget: SDUIWidget): React.ReactNode => {
    const Widget = widgetRegistry[widget.componentType];

    if (!Widget) {
      return <UnknownWidget key={widget.id} componentType={widget.componentType} />;
    }

    const handleAction = (action: string, payload?: unknown) => {
      onWidgetAction?.(widget.id, action, payload);
    };

    return (
      <WidgetErrorBoundary key={widget.id} widgetId={widget.id}>
        <Suspense fallback={<WidgetSkeleton />}>
          <Widget
            id={widget.id}
            data={widget.props}
            onAction={handleAction}
          />
        </Suspense>
      </WidgetErrorBoundary>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {widgets.map(renderWidget)}
    </div>
  );
}

// Export registration function for external widgets
export { registerWidget };

export default CanvasHost;
