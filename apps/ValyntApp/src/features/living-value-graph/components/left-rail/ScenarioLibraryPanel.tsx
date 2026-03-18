/**
 * ScenarioLibraryPanel Component - List and manage scenarios
 */

import { useState } from 'react';

import { Scenario } from '../../types/graph.types';

interface ScenarioLibraryPanelProps {
  scenarios?: Scenario[];
  activeScenarioId?: string;
  onScenarioSelect?: (scenarioId: string) => void;
  onScenarioCreate?: (name: string, type: string) => void;
}

export function ScenarioLibraryPanel({
  scenarios = [],
  activeScenarioId,
  onScenarioSelect,
  onScenarioCreate,
}: ScenarioLibraryPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

  const sortedScenarios = [...scenarios].sort((a, b) => {
    const order = ['baseline', 'conservative', 'expected', 'upside', 'custom'];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">Scenarios</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      {isCreating && (
        <div className="mb-3 p-3 bg-neutral-50 rounded">
          <input
            type="text"
            placeholder="Scenario name..."
            value={newScenarioName}
            onChange={(e) => setNewScenarioName(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-neutral-300 rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const trimmedName = newScenarioName.trim();
                if (trimmedName.length > 0) {
                  onScenarioCreate?.(trimmedName, 'custom');
                  setNewScenarioName('');
                  setIsCreating(false);
                }
              }}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewScenarioName('');
              }}
              className="text-xs px-3 py-1 border border-neutral-300 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sortedScenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onScenarioSelect?.(scenario.id)}
            className={`w-full text-left p-3 rounded border transition-colors ${scenario.id === activeScenarioId
                ? 'bg-blue-50 border-blue-200'
                : 'bg-white border-neutral-200 hover:bg-neutral-50'
              }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">{scenario.name}</div>
                <div className="text-xs text-neutral-500 capitalize">{scenario.type}</div>
              </div>
              {scenario.id === activeScenarioId && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
            </div>
          </button>
        ))}
        {scenarios.length === 0 && <div className="text-sm text-neutral-500">No scenarios created</div>}
      </div>
    </div>
  );
}
