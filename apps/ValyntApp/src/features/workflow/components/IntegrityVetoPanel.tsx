import React, { useState } from "react";
import Decimal from "decimal.js";
import { IntegrityService, type ValidationResult } from "../services/IntegrityService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const IntegrityVetoPanel: React.FC = () => {
  const [metricId, setMetricId] = useState("efficiency_gain");
  const [proposedValue, setProposedValue] = useState("25");
  const [median, setMedian] = useState("15");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const handleValidate = async () => {
    const service = IntegrityService.getInstance();
    const result = await service.validateAssumption(metricId, new Decimal(proposedValue), {
      industry: "Software",
      benchmarkMedian: new Decimal(median),
    });
    setValidation(result);
  };

  const handleCommit = () => {
    if (!validation) return;
    setIsLogging(true);
    const service = IntegrityService.getInstance();
    service.logToVMRT({
      metricId,
      originalValue: new Decimal(proposedValue),
      validatedValue: validation.isValid ? new Decimal(proposedValue) : (validation.suggestedValue || new Decimal(proposedValue)),
      reasoning: validation.isValid ? "Within conservative bounds" : validation.reason || "Adjusted to threshold",
      agentId: "IntegrityAgent",
    });
    setTimeout(() => {
      setIsLogging(false);
      setValidation(null);
      alert("Assumption committed to VMRT audit trail.");
    }, 800);
  };

  return (
    <Card className="p-6 mt-6 border-l-4 border-l-amber-500">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Shield">🛡️</span> IntegrityAgent Veto & VMRT
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <Label>Metric</Label>
          <Input value={metricId} onChange={(e) => setMetricId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Proposed Value (%)</Label>
          <Input type="number" value={proposedValue} onChange={(e) => setProposedValue(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Benchmark Median (%)</Label>
          <Input type="number" value={median} onChange={(e) => setMedian(e.target.value)} />
        </div>
      </div>

      <Button onClick={handleValidate} variant="secondary" className="w-full mb-4">
        Validate Assumption
      </Button>

      {validation && (
        <div className={`p-4 rounded-lg mb-4 ${validation.isValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className="font-bold flex items-center gap-2">
            {validation.isValid ? "✅ Approved" : "❌ Vetoed"}
            <span className="text-xs font-normal text-gray-500">(Confidence: {validation.confidenceScore})</span>
          </p>
          {!validation.isValid && (
            <div className="mt-2 text-sm">
              <p className="text-red-700">{validation.reason}</p>
              <p className="mt-1 font-medium">Suggested Value: {validation.suggestedValue?.toString()}%</p>
            </div>
          )}
          <Button 
            onClick={handleCommit} 
            className="mt-4 w-full" 
            variant={validation.isValid ? "default" : "destructive"}
            disabled={isLogging}
          >
            {isLogging ? "Logging to VMRT..." : "Commit to Value Model"}
          </Button>
        </div>
      )}
    </Card>
  );
};
