import React from 'react';

const legendItems = [
  { color: '#90caf9', label: 'Opportunity Agent' },
  { color: '#ffb74d', label: 'Target Agent' },
  { color: '#81c784', label: 'Realization Agent' },
  { color: '#9575cd', label: 'Expansion Agent' },
  { color: '#e57373', label: 'Integrity Agent' },
  { color: '#ba68c8', label: 'Orchestrator Agent' },
  { color: '#2196f3', label: 'Lifecycle Event Flow' },
  { color: '#fb8c00', label: 'Business Case Flow' },
  { color: '#4caf50', label: 'Realization Update Flow' },
  { color: '#9575cd', label: 'Expansion Trigger' },
  { color: '#d81b60', label: 'Validation Flow' },
  { color: '#6a1b9a', label: 'Orchestration Flow' },
];

function Legend() {
  return (
    <div className="p-2 bg-gray-50 border rounded text-sm mb-4">
      <strong>Legend</strong>
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center mt-1">
          <span style={{ width: '12px', height: '12px', backgroundColor: item.color, marginRight: '6px', display: 'inline-block', border: '1px solid #bdbdbd' }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;