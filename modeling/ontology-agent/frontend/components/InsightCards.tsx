'use client';

import React from 'react';
import { Insight } from '@/lib/api';

interface InsightCardsProps {
  insights: Insight[];
}

const severityColors = {
  low: 'bg-gray-500',
  medium: 'bg-agent-orange',
  high: 'bg-agent-coral',
  critical: 'bg-red-600',
};

const typeIcons = {
  gap: '⚠️',
  opportunity: '🎯',
  risk: '🔴',
  competitive: '⚔️',
  trend: '📈',
};

export default function InsightCards({ insights }: InsightCardsProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No insights generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          🎯 Key Insights Discovered
        </h3>
        <span className="px-3 py-1 bg-agent-purple/20 text-agent-purple text-sm rounded-full">
          {insights.length} insights
        </span>
      </div>

      <div className="grid gap-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`insight-card insight-${insight.type} p-4 rounded-lg`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{typeIcons[insight.type]}</span>
                <h4 className="font-medium text-white">{insight.title}</h4>
              </div>
              <span
                className={`px-2 py-0.5 text-xs rounded ${severityColors[insight.severity]} text-white`}
              >
                {insight.severity}
              </span>
            </div>

            <p className="text-sm text-gray-300 mt-2">{insight.description}</p>

            {insight.recommendation && (
              <div className="mt-3 p-2 bg-dark-700/50 rounded">
                <p className="text-xs text-agent-green">
                  💡 {insight.recommendation}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
              <span className="capitalize">{insight.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
