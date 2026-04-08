import type { SDUIComponent } from "./types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModeSelector } from "@/components/mode/ModeSelector";
import { InspectorPanel } from "@/components/value/InspectorPanel";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";

interface SDUIRendererProps {
  component: SDUIComponent;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
}

export function SDUIRenderer({ component, onAction }: SDUIRendererProps) {
  const { type, props, children } = component;

  switch (type) {
    case "text":
      return <p className={props.className as string}>{props.content as string}</p>;

    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level) || 2));
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag className={props.className as string}>{props.content as string}</Tag>;
    }

    case "button":
      return (
        <Button
          variant={(props.variant as "default" | "outline" | "destructive") || "default"}
          onClick={() => onAction?.("click", props)}
        >
          {props.label as string}
        </Button>
      );

    case "input":
      return (
        <Input
          type={(props.inputType as string) || "text"}
          placeholder={props.placeholder as string}
          defaultValue={props.defaultValue as string}
        />
      );

    case "card":
      return (
        <Card>
          {props.title ? (
            <CardHeader>
              <CardTitle>{String(props.title)}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent>
            {children?.map((child) => (
              <SDUIRenderer key={child.id} component={child} onAction={onAction} />
            ))}
          </CardContent>
        </Card>
      );

    case "grid": {
      // Use Tailwind grid-cols-{n} for up to 12 columns, else fallback to inline style
      const columns = Number(props.columns) || 2;
      const gridColsClass = columns <= 12 ? `grid-cols-${columns}` : '';
      return (
        <div
          className={`grid gap-4 ${gridColsClass}`}
          {...(columns > 12 ? { style: { gridTemplateColumns: `repeat(${columns}, 1fr)` } } : {})}
        >
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </div>
      );
    }

    case "list":
      return (
        <ul className="space-y-2">
          {children?.map((child) => (
            <li key={child.id}>
              <SDUIRenderer component={child} onAction={onAction} />
            </li>
          ))}
        </ul>
      );

    // Warmth component extensions
    case "warmth_card": {
      const warmth = (props.warmth as string) || "forming";
      const warmthClasses: Record<string, string> = {
        forming: "border-amber-400 bg-amber-50",
        firm: "border-blue-400 bg-white",
        verified: "border-emerald-400 bg-emerald-50",
      };
      return (
        <div className={`rounded-lg border-2 p-4 ${warmthClasses[warmth]}`}>
          {props.title && <h3 className="font-semibold mb-2">{String(props.title)}</h3>}
          {props.content && <p className="text-sm text-gray-700">{String(props.content)}</p>}
        </div>
      );
    }

    case "warmth_badge": {
      const warmth = (props.warmth as string) || "forming";
      const badgeClasses: Record<string, string> = {
        forming: "bg-amber-100 text-amber-800",
        firm: "bg-blue-100 text-blue-800",
        verified: "bg-emerald-100 text-emerald-800",
      };
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeClasses[warmth]}`}>
          {warmth}
        </span>
      );
    }

    case "mode_selector":
      return (
        <ModeSelector
          activeMode={props.activeMode as string}
          onModeChange={(mode: string) => onAction?.("mode_change", { mode })}
          availableModes={props.availableModes as string[]}
          warmthState={props.warmthState as string}
        />
      );

    case "narrative_stream":
      return (
        <div className="space-y-4">
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </div>
      );

    case "inspector_panel":
      return (
        <InspectorPanel
          node={props.node as unknown}
          warmth={props.warmth as string}
          operationalState={props.operationalState as unknown}
          onShowLineage={() => onAction?.("show_lineage", {})}
          onEdit={() => onAction?.("edit", {})}
          onRequestEvidence={() => onAction?.("request_evidence", {})}
        />
      );

    case "copilot_panel":
      return (
        <CopilotPanel
          caseId={props.caseId as string}
          warmth={props.warmth as string}
          onNavigateToNode={(nodeId: string) => onAction?.("navigate_to_node", { nodeId })}
          onSwitchMode={(mode: string) => onAction?.("switch_mode", { mode })}
        />
      );

    default:
      return (
        <div className="p-4 border border-dashed rounded text-muted-foreground text-sm">
          Unknown component: {type}
        </div>
      );
  }
}

export default SDUIRenderer;
