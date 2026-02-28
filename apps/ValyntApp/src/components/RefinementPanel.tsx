import { ArrowRight, Info, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  type RefinementSuggestion,
  SelfImprovementService,
} from "../services/SelfImprovementService";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const RefinementPanel: React.FC = () => {
  const [suggestions, setSuggestions] = useState<RefinementSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    const service = SelfImprovementService.getInstance();
    const data = await service.getRefinementSuggestions({});
    setSuggestions(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <Card className="p-6 mt-6 border-2 border-indigo-500/30 bg-indigo-50/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-700">
          <Sparkles className="h-5 w-5" /> AI Model Refinement (Pillar 10)
        </h3>
        <Button variant="ghost" size="xs" onClick={fetchSuggestions} disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Refresh"}
        </Button>
      </div>

      <div className="space-y-4">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {s.metricId.replace("_", " ")}
              </Badge>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                {(s.confidence * 100).toFixed(0)}% Match
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="text-sm line-through text-muted-foreground">
                {s.currentAssumption.toString()}%
              </div>
              <ArrowRight className="h-4 w-4 text-indigo-500" />
              <div className="text-lg font-bold text-indigo-700">
                {s.suggestedAssumption.toString()}%
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">{s.reasoning}</p>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                Apply Refinement
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" className="px-2">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Impact on ROI: {s.impactOnROI.gt(0) ? "+" : ""}
                      {s.impactOnROI.toString()} USD
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
