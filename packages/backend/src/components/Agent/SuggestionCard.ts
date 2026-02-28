// packages/backend/src/components/Agent/SuggestionCard.ts
export interface SuggestionCardProps {
  title: string;
  description: string;
  action: () => void;
}

export interface Suggestion {
  id: string;
  title: string;
  content: string;
  agentName: string;
  position: { x: number; y: number };
  priority: 'normal' | 'critical';
  actions: Array<{ label: string; action: string }>;
}

export class SuggestionCard {
  constructor(public props: SuggestionCardProps) {}
}
