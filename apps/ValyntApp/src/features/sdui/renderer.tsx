import type { SDUIComponent } from "./types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardPanel, Grid, HorizontalSplit, VerticalSplit } from "@/components/SDUI/CanvasLayout";

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

    case "VerticalSplit":
      return (
        <VerticalSplit {...(props as Record<string, unknown>)}>
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </VerticalSplit>
      );

    case "HorizontalSplit":
      return (
        <HorizontalSplit {...(props as Record<string, unknown>)}>
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </HorizontalSplit>
      );

    case "DashboardPanel":
      return (
        <DashboardPanel {...(props as Record<string, unknown>)}>
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </DashboardPanel>
      );

    case "Grid":
      return (
        <Grid {...(props as Record<string, unknown>)}>
          {children?.map((child) => (
            <SDUIRenderer key={child.id} component={child} onAction={onAction} />
          ))}
        </Grid>
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

    default:
      return (
        <div className="p-4 border border-dashed rounded text-muted-foreground text-sm">
          Unknown component: {type}
        </div>
      );
  }
}

export default SDUIRenderer;
