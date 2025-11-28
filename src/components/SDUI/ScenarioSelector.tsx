import React from 'react';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  aiRecommended?: boolean;
}

export interface ScenarioSelectorProps {
  scenarios: Scenario[];
  onSelect: (scenario: Scenario) => void;
  className?: string;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ scenarios, onSelect, className = '' }) => (
  <div className={`bg-gray-800 p-4 rounded ${className}`}>
    {scenarios.map(s => (
      <button key={s.id} onClick={() => onSelect(s)} className="block w-full text-left p-2 hover:bg-gray-700 rounded text-white">
        {s.title}
      </button>
    ))}
  </div>
);

export default ScenarioSelector;
