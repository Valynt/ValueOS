/**
 * Canvas Layer: CanvasHost
 * Dynamic host for SDUI-driven widgets
 * Implements the DynamicRenderer pattern for server-driven UI
 */

import { Building2 } from "lucide-react";
import React, { Component, ComponentType, ErrorInfo, LazyExoticComponent, ReactNode, Suspense } from "react";

// Widget type registry - maps component_type to eagerly or lazily loaded components
type RegisteredWidget = ComponentType<WidgetProps> | LazyExoticComponent<ComponentType<WidgetProps>>;
const widgetRegistry: Record<string, RegisteredWidget> = {};

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
  onWidgetError?: (widgetId: string, componentType: string, error: Error, errorInfo: ErrorInfo) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

// Register built-in widgets
function registerWidget(type: string, component: RegisteredWidget) {
  widgetRegistry[type] = component;
}

// Lazy-load built-in widgets to keep bundle split
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
registerWidget("agent-response", AgentResponseCard);
registerWidget("chat-input", ChatInputWidget);

// Register V1 Surface Widgets
registerWidget("stakeholder-map", StakeholderMap);
registerWidget("gap-resolution", GapResolution);
registerWidget("hypothesis-card", HypothesisCard);
registerWidget("assumption-register", AssumptionRegister);
registerWidget("scenario-comparison", ScenarioComparison);
registerWidget("sensitivity-tornado", SensitivityTornado);
registerWidget("readiness-gauge", ReadinessGauge);
registerWidget("evidence-gap-list", EvidenceGapList);
registerWidget("artifact-preview", ArtifactPreview);
registerWidget("inline-editor", InlineEditor);
registerWidget("kpi-target-card", KPITargetCard);
registerWidget("checkpoint-timeline", CheckpointTimeline);
registerWidget("usage-meter", UsageMeter);
registerWidget("plan-comparison", PlanComparison);

// Per-widget error boundary to isolate failures (spec 3.2.1)
interface WidgetErrorBoundaryProps {
  widgetId: string;
  componentType: string;
  onError?: (widgetId: string, componentType: string, error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): Partial<WidgetErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      `[CanvasHost] Widget "${this.props.componentType}" (${this.props.widgetId}) crashed:`,
      error.message,
      errorInfo.componentStack,
    );

    this.props.onError?.(this.props.widgetId, this.props.componentType, error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive mb-1">
            Widget failed to render
          </p>
          <p className="text-xs text-muted-foreground">
            {this.props.componentType} ({this.props.widgetId})
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
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
  onWidgetError,
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

    const handleAction = async (action: string, payload?: unknown) => {
      onWidgetAction?.(widget.id, action, payload);
    };

    return (
      <WidgetErrorBoundary
        key={widget.id}
        widgetId={widget.id}
        componentType={widget.componentType}
        onError={onWidgetError}
      >
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
