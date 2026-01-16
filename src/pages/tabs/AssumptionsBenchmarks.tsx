// /workspaces/ValueOS/src/pages/tabs/AssumptionsBenchmarks.tsx
import React, { useState, useEffect } from "react";
import { useData } from "../../data/store";

interface AssumptionsBenchmarksProps {
  dealId: string;
}

const AssumptionsBenchmarks: React.FC<AssumptionsBenchmarksProps> = ({ dealId }) => {
  const { state } = useData();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(`selectedBenchmarks-${dealId}`);
    if (stored) setSelected(JSON.parse(stored));
  }, [dealId]);

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = checked ? [...selected, id] : selected.filter((s) => s !== id);
    setSelected(newSelected);
    localStorage.setItem(`selectedBenchmarks-${dealId}`, JSON.stringify(newSelected));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Assumptions & Benchmarks</h2>
      <div className="space-y-4">
        {state.benchmarks.map((b) => (
          <div key={b.id} className="bg-white p-4 rounded shadow flex items-center">
            <input
              type="checkbox"
              checked={selected.includes(b.id)}
              onChange={(e) => handleSelect(b.id, e.target.checked)}
              className="mr-4"
            />
            <div>
              <h3 className="font-semibold">{b.metric}</h3>
              <p>Industry: {b.industry}</p>
              <p>
                Baseline: {b.baselineMin} - {b.baselineMax}
              </p>
              <p>Source: {b.source}</p>
              <p>Confidence: {(b.confidence * 100).toFixed(0)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssumptionsBenchmarks;
