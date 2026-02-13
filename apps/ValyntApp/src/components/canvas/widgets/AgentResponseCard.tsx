/**
 * Canvas Widget: AgentResponseCard
 * Displays agent analysis results with value drivers
 */

import { Sparkles } from "lucide-react";
import type { WidgetProps } from "../CanvasHost";

interface ValueDriver {
  title: string;
  description: string;
}

interface AgentResponseData {
  agentName?: string;
  status?: string;
  summary?: string;
  valueDrivers?: ValueDriver[];
}

export function AgentResponseCard({ data, onAction }: WidgetProps) {
  const {
    agentName = "Value Intelligence Agent",
    status = "Analysis complete",
    summary = "Based on the discovery data, I've identified primary value drivers:",
    valueDrivers = [
      { title: "Operational Efficiency", description: "40% reduction in manual processes" },
      { title: "Revenue Growth", description: "15% increase in customer retention" },
      { title: "Cost Avoidance", description: "$800K annual savings in compliance" },
    ],
  } = (data as AgentResponseData) ?? {};

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{agentName}</h3>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
      <div className="prose prose-invert max-w-none">
        <p className="text-muted-foreground">{summary}</p>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {valueDrivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>
                <strong className="text-foreground">{driver.title}:</strong> {driver.description}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AgentResponseCard;
