/**
 * Industry Templates
 */

export interface IndustryTemplate {
  name: string;
  role: string;
  focusAreas: string[];
  categories: string[];
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  technology: { name: 'Technology', role: 'technology consultant', focusAreas: ['scalability', 'integration', 'ROI'], categories: ['saas', 'hardware', 'services'] },
  finance: { name: 'Finance', role: 'financial advisor', focusAreas: ['risk', 'compliance', 'returns'], categories: ['banking', 'insurance', 'investment'] },
  healthcare: { name: 'Healthcare', role: 'healthcare consultant', focusAreas: ['outcomes', 'efficiency', 'compliance'], categories: ['provider', 'pharma', 'device'] },
  default: { name: 'General', role: 'business consultant', focusAreas: ['value', 'efficiency', 'growth'], categories: [] },
};

/** Detect the most relevant industry template from context text. */
export function detectIndustry(context: string): IndustryTemplate {
  const lower = context.toLowerCase();
  for (const [key, template] of Object.entries(INDUSTRY_TEMPLATES)) {
    if (key === 'default') continue;
    if (template.categories.some((c) => lower.includes(c)) || lower.includes(key)) {
      return template;
    }
  }
  return INDUSTRY_TEMPLATES.default;
}
