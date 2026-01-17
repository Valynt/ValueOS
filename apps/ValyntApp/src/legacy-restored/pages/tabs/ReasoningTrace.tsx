// /workspaces/ValueOS/src/pages/tabs/ReasoningTrace.tsx
import React from "react";
import { useData } from "../../data/store";
import TracePanel from "../../components/TracePanel";

interface ReasoningTraceProps {
  dealId: string;
}

const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ dealId }) => {
  const { state } = useData();
  const hypotheses = state.hypotheses.filter((h) => h.dealId === dealId);
  const selectedBenchmarks: string[] = JSON.parse(
    localStorage.getItem(`selectedBenchmarks-${dealId}`) || "[]"
  );
  const benchmarks = state.benchmarks.filter((b) => selectedBenchmarks.includes(b.id));

  const steps = [
    ...hypotheses.map((h) => {
      const driver = state.valueDrivers.find((d) => d.id === h.driverId);
      return {
        step: `Applied ${driver?.name} formula with inputs ${JSON.stringify(h.inputs)} resulting in outputs ${JSON.stringify(h.outputs)}`,
      };
    }),
    ...benchmarks.map((b) => ({
      step: `Referenced benchmark ${b.metric} with baseline ${b.baselineMin}-${b.baselineMax} from ${b.source}`,
      confidence: b.confidence,
    })),
  ];

  return <TracePanel steps={steps} />;
};

export default ReasoningTrace;
