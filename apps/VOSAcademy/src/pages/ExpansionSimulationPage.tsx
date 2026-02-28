import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const ExpansionSimulationPage: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [opportunities, setOpportunities] = useState<
    { id: string; title: string; value: string; confidence: number }[]
  >([]);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    // Simulate ExpansionAgent analysis
    setTimeout(() => {
      setOpportunities([
        { id: "1", title: "Advanced Analytics Upsell", value: "$25,000 ARR", confidence: 0.85 },
        { id: "2", title: "Multi-Region Expansion", value: "$50,000 ARR", confidence: 0.72 },
      ]);
      setIsAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">VOS Academy: Expansion Simulation</h1>
      <p className="text-muted-foreground mb-8">
        Learn how the ExpansionAgent identifies incremental ROI opportunities by analyzing realized
        value data.
      </p>

      <Card className="p-6 mb-8 border-t-4 border-t-indigo-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span role="img" aria-label="Rocket">
            🚀
          </span>{" "}
          ExpansionAgent Analysis
        </h3>
        <p className="text-sm mb-6">
          Click the button below to simulate the ExpansionAgent scanning your current realization
          data for upsell potential.
        </p>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full md:w-auto">
          {isAnalyzing ? "Analyzing Realized Value..." : "Run Expansion Analysis"}
        </Button>
      </Card>

      {opportunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opt) => (
            <Card key={opt.id} className="p-4 border-l-4 border-l-green-500">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold">{opt.title}</h4>
                <Badge variant="secondary">{(opt.confidence * 100).toFixed(0)}% Confidence</Badge>
              </div>
              <p className="text-2xl font-bold text-green-700 mb-4">{opt.value}</p>
              <Button size="sm" variant="outline" className="w-full">
                Create Expansion Case
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
