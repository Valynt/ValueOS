// /workspaces/ValueOS/apps/ValyntApp/src/components/TracePanel.tsx
import React from "react";
import { CheckCircle } from "lucide-react";

interface TraceStep {
  step: string;
  citation?: string;
  confidence?: number;
}

interface TracePanelProps {
  steps: TraceStep[];
}

const TracePanel: React.FC<TracePanelProps> = ({ steps }) => {
  return (
    <div className="bg-gray-50 p-4 rounded">
      <h3 className="text-lg font-semibold mb-4">Reasoning Trace</h3>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm">{step.step}</p>
              {step.citation && <p className="text-xs text-gray-600">Citation: {step.citation}</p>}
              {step.confidence && (
                <p className="text-xs text-gray-600">Confidence: {step.confidence * 100}%</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TracePanel;
