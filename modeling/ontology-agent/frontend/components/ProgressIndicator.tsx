'use client';

import React from 'react';

interface ProgressIndicatorProps {
  progress: number;
  status: string;
  message: string;
  entitiesFound: number;
  relationshipsFound: number;
}

export default function ProgressIndicator({
  progress,
  status,
  message,
  entitiesFound,
  relationshipsFound,
}: ProgressIndicatorProps) {
  const stages = [
    { key: 'crawling', label: 'Crawling', icon: '🕷️' },
    { key: 'extracting', label: 'Extracting', icon: '🧠' },
    { key: 'building_graph', label: 'Building Graph', icon: '🔗' },
    { key: 'generating_insights', label: 'Insights', icon: '💡' },
    { key: 'completed', label: 'Complete', icon: '✅' },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === status);

  return (
    <div className="glass-card p-6 space-y-6">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-agent-purple to-agent-green transition-all duration-500 ease-out progress-pulse"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="absolute -top-1 left-0 right-0 flex justify-between">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                index <= currentStageIndex
                  ? 'bg-agent-purple scale-110'
                  : 'bg-dark-700'
              }`}
              title={stage.label}
            >
              {index < currentStageIndex ? '✓' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Stage labels */}
      <div className="flex justify-between text-xs text-gray-400">
        {stages.map((stage, index) => (
          <span
            key={stage.key}
            className={`transition-colors ${
              index <= currentStageIndex ? 'text-agent-green' : ''
            }`}
          >
            {stage.icon} {stage.label}
          </span>
        ))}
      </div>

      {/* Current status */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-medium text-white">{message}</p>
          <p className="text-sm text-gray-400 mt-1">
            Status: <span className="text-agent-blue capitalize">{status.replace('_', ' ')}</span>
          </p>
        </div>

        {/* Live stats */}
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-agent-purple">{entitiesFound}</p>
            <p className="text-xs text-gray-400">Entities</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-agent-green">{relationshipsFound}</p>
            <p className="text-xs text-gray-400">Relations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
