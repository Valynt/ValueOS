// packages/backend/src/components/Agent/SuggestionCard.ts
export interface SuggestionCardProps {
  title: string;
  description: string;
  action: () => void;
}

export class SuggestionCard {
  constructor(public props: SuggestionCardProps) {}
}
