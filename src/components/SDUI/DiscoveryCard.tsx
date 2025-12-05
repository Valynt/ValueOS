import React from 'react';
import { ListChecks } from 'lucide-react';

export interface DiscoveryCardProps {
  questions: string[];
  title?: string;
  prompt?: string;
}

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  questions,
  title = 'Discovery Questions',
  prompt,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="discovery-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600" aria-hidden="true">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {prompt && <p className="text-xs text-gray-500 leading-5">{prompt}</p>}
        </div>
      </div>
      <ul className="space-y-2 text-sm text-gray-800">
        {questions.map((question, index) => (
          <li key={question} className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
            <span>{question}</span>
            <span className="text-gray-400 text-xs">#{index + 1}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
