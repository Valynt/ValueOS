import Decimal from "decimal.js";
import React, { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Scenario {
  id: string;
  name: string;
  impact: Decimal;
}

export const ScenarioModeler: React.FC = () => {
  const [baseValue, setBaseValue] = useState("100000");
  const [sensitivity, setSensitivity] = useState("10"); // Percentage
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  const calculations = useMemo(() => {
    try {
      const base = new Decimal(baseValue);
      const sens = new Decimal(sensitivity).div(100);

      return {
        upside: base.mul(new Decimal(1).plus(sens)),
        downside: base.mul(new Decimal(1).minus(sens)),
      };
    } catch {
      return null;
    }
  }, [baseValue, sensitivity]);

  const addScenario = () => {
    if (!calculations) return;
    const newScenario: Scenario = {
      id: `scenario_${Date.now()}`,
      name: `Scenario ${scenarios.length + 1}`,
      impact: calculations.upside,
    };
    setScenarios([...scenarios, newScenario]);
  };

  return (
    <Card className="p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Chart">
          📊
        </span>{" "}
        Sensitivity Analysis & Scenario Modeler
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="base-value">Base Value (USD)</Label>
          <Input
            id="base-value"
            type="number"
            value={baseValue}
            onChange={(e) => setBaseValue(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sensitivity">Sensitivity (+/- %)</Label>
          <Input
            id="sensitivity"
            type="number"
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
          />
        </div>
      </div>

      {calculations && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
            <p className="text-xs text-green-600 uppercase font-bold">Upside (+{sensitivity}%)</p>
            <p className="text-xl font-bold text-green-700">${calculations.upside.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs text-red-600 uppercase font-bold">Downside (-{sensitivity}%)</p>
            <p className="text-xl font-bold text-red-700">${calculations.downside.toFixed(2)}</p>
          </div>
        </div>
      )}

      <Button onClick={addScenario} className="w-full mb-6">
        Save Current Scenario
      </Button>

      {scenarios.length > 0 && (
        <div className="space-y-2">
          <Label>Saved Scenarios</Label>
          {scenarios.map((s) => (
            <div key={s.id} className="flex justify-between p-2 border rounded text-sm">
              <span>{s.name}</span>
              <span className="font-mono font-bold">${s.impact.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
