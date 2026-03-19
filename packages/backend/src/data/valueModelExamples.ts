/**
 * Value Model Examples
 */

export interface ValueModelExample {
  id: string;
  name: string;
  type: string;
  industry?: string;
  prompt?: string;
  description?: string;
}

export const VALUE_MODEL_EXAMPLES: ValueModelExample[] = [
  { id: 'ex1', name: 'Cost Reduction', type: 'operational', description: 'Reduce operational costs through process optimization.' },
  { id: 'ex2', name: 'Revenue Growth', type: 'financial', description: 'Grow revenue through new market expansion.' },
];

/** Return examples relevant to the query and industry, up to maxCount. */
export function getRelevantExamples(query: string, industry: string, maxCount = 3): ValueModelExample[] {
  const lower = query.toLowerCase();
  const filtered = VALUE_MODEL_EXAMPLES.filter(
    (ex) => !ex.industry || ex.industry === industry || lower.includes(ex.type)
  );
  return filtered.slice(0, maxCount);
}

/** Format a ValueModelExample as a prompt string. */
export function formatExampleForPrompt(example: ValueModelExample): string {
  return `Example: ${example.name} (${example.type})${example.description ? ` — ${example.description}` : ''}`;
}
