/**
 * Canvas Layer: CanvasHost
 * Dynamic host for SDUI-driven widgets
 * Implements the DynamicRenderer pattern for server-driven UI
 */

import React, { Suspense, ComponentType } from "react";
import { Building2 } from "lucide-react";

// Widget type registry - maps component_type to lazy-loaded components
const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {};

export interface WidgetProps {
  id: string;
  data?: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
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

// Register built-in SDUI widget types
registerWidget("value-summary", ValueSummaryCard as unknown as ComponentType<WidgetProps>);
registerWidget("agent-response", AgentResponseCard as unknown as ComponentType<WidgetProps>);
registerWidget("chat-input", ChatInputWidget as unknown as ComponentType<WidgetProps>);

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
      <Suspense key={widget.id} fallback={<WidgetSkeleton />}>
        <Widget
          id={widget.id}
          data={widget.props}
          onAction={handleAction}
        />
      </Suspense>
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
