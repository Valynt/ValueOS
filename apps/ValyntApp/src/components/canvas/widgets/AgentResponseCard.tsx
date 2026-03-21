/**
 * Canvas Widget: AgentResponseCard
 *
 * Displays agent analysis results with value drivers.
 * When data.metadata.trace_id is present, renders an Output/Reasoning tab
 * switcher. Clicking the HallucinationBadge activates the Reasoning tab.
 */

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { HallucinationBadge } from "@sdui/components/SDUI/HallucinationBadge";
import { ReasoningTracePanel } from "@sdui/components/SDUI/ReasoningTracePanel";

import type { WidgetProps } from "../CanvasHost";

interface ValueDriver {
  title: string;
  description: string;
}

interface AgentOutputMetadata {
  trace_id?: string;
  hallucination_check?: boolean | null;
  grounding_score?: number | null;
}

interface AgentResponseData {
  agentName?: string;
  status?: string;
  summary?: string;
  valueDrivers?: ValueDriver[];
  metadata?: AgentOutputMetadata;
}

type ActiveTab = "output" | "reasoning";

export function AgentResponseCard({ data }: WidgetProps) {
  const {
    agentName = "Value Intelligence Agent",
    status = "Analysis complete",
    summary = "Based on the discovery data, I've identified primary value drivers:",
    valueDrivers = [
      { title: "Operational Efficiency", description: "40% reduction in manual processes" },
      { title: "Revenue Growth", description: "15% increase in customer retention" },
      { title: "Cost Avoidance", description: "$800K annual savings in compliance" },
    ],
    metadata,
  } = (data as AgentResponseData) ?? {};

  const traceId = metadata?.trace_id;
  const hasReasoningTab = !!traceId;
  const [activeTab, setActiveTab] = useState<ActiveTab>("output");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{agentName}</h3>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        </div>
        {(metadata?.hallucination_check !== undefined || metadata?.grounding_score !== undefined) && (
          <HallucinationBadge
            hallucination_check={metadata?.hallucination_check}
            grounding_score={metadata?.grounding_score}
            onReasoningOpen={hasReasoningTab ? () => setActiveTab("reasoning") : undefined}
          />
        )}
      </div>

      {/* Tab bar — only when trace_id is present */}
      {hasReasoningTab && (
        <div role="tablist" className="flex gap-0 border-b border-border mb-4">
          <button
            role="tab"
            aria-selected={activeTab === "output"}
            type="button"
            onClick={() => setActiveTab("output")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "output"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Output
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "reasoning"}
            type="button"
            onClick={() => setActiveTab("reasoning")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "reasoning"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Reasoning
          </button>
        </div>
      )}

      {/* Output tab */}
      {(!hasReasoningTab || activeTab === "output") && (
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
      )}

      {/* Reasoning tab */}
      {hasReasoningTab && activeTab === "reasoning" && (
        <ReasoningTracePanel trace_id={traceId} />
      )}
    </div>
  );
}

export default AgentResponseCard;
