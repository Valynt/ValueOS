import React from 'react';
import { Sparkles } from 'lucide-react';

interface InlineAgentButtonProps {
  componentId: string;
  componentType: string;
  onClick: () => void;
}

export const InlineAgentButton: React.FC<InlineAgentButtonProps> = ({
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
      title="Ask agent to refine"
    >
      <Sparkles className="h-3 w-3 mr-1" />
      Ask agent
    </button>
  );
};
