import React from 'react';
import { Lightbulb, X, Sparkles } from 'lucide-react';

export interface Suggestion {
  id: string;
  title: string;
  content: string;
  agentName: string;
  position?: { x: number; y: number };
  priority: 'critical' | 'normal';
  actions: Array<{ label: string; action: string }>;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAction: (action: string) => void;
  onDismiss: () => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAction,
  onDismiss
}) => {
  const isPriority = suggestion.priority === 'critical';

  return (
    <div
      className={`absolute z-30 w-80 bg-white rounded-lg shadow-xl border-2 ${
        isPriority
          ? 'border-orange-300 animate-pulse-border'
          : 'border-blue-200'
      }`}
      style={{
        left: suggestion.position?.x || 100,
        top: suggestion.position?.y || 100,
      }}
    >
      <div className={`p-4 rounded-t-lg ${
        isPriority ? 'bg-orange-50' : 'bg-blue-50'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPriority ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              {isPriority ? (
                <Sparkles className={`h-4 w-4 ${isPriority ? 'text-orange-600' : 'text-blue-600'}`} />
              ) : (
                <Lightbulb className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">{suggestion.title}</h3>
              <p className="text-xs text-gray-600 mt-0.5">{suggestion.agentName}</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          {suggestion.content}
        </p>

        <div className="mt-4 flex space-x-2">
          {suggestion.actions.map((action, index) => (
            <button
              key={index}
              onClick={() => onAction(action.action)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                index === 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
