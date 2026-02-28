/**
 * ValueHypothesisGenerator — Cross-references products with SEC data to generate high-value hypotheses.
 *
 * This generator bridges the gap between technical products and business outcomes by
 * grounding product capabilities in the company's own stated risks and goals from 10-K filings.
 */

import { logger } from '../../lib/logger.js';
import { semanticMemory } from '../SemanticMemory.js';
import type { ExtractionContext, LLMGatewayInterface } from './SuggestionExtractor.js';

export interface ValueHypothesis {
  pattern_name: string;
  typical_kpis: Array<{ name: string; category: string; unit: string }>;
  typical_assumptions: Array<{ label: string; baseline: string; target: string }>;
  rationale: string;
  source_sec_snippet?: string;
}

export async function generateValueHypotheses(
  products: any[],
  context: ExtractionContext,
  llmGateway: LLMGatewayInterface,
  tenantId: string,
  contextId: string,
): Promise<ValueHypothesis[]> {
  try {
    if (products.length === 0) return [];

    logger.info('Generating grounded value hypotheses', { tenantId, productsCount: products.length });

    // 1. Get high-value context from SEC filings
    const secContextResult = await semanticMemory.search(
      `What are the main business risks, strategic goals, and operational priorities for ${context.companyName || 'the company'}?`,
      { limit: 10 }
    );

    const secSnippet = secContextResult
      .map(r => `[SEC Source: ${r.entry.metadata.source_url || '10-K'}]\n${r.entry.content}`)
      .join('\n\n---\n\n');

    // 2. Build Prompt
    const productList = products.map(p => `- ${p.name}: ${p.description}`).join('\n');
    
    const systemPrompt = `
You are a Value Engineer. Your task is to generate "Value Hypotheses" that connect a company's products to its strategic goals or risks identified in its SEC filings.

A Value Hypothesis should describe how a product feature or capability directly addresses a business pain point or goal, and how that can be measured.

Respond ONLY with a valid JSON array of ValueHypothesis objects.
Each object:
{
  "pattern_name": "Short descriptive name",
  "typical_kpis": [{"name": string, "category": "revenue"|"cost"|"risk"|"productivity", "unit": string}],
  "typical_assumptions": [{"label": string, "baseline": string, "target": string}],
  "rationale": "Why this hypothesis makes sense based on the SEC data",
  "source_sec_snippet": "The specific quote or risk factor from the SEC filing this addresses"
}
`;

    const userPrompt = `
COMPANY CONTEXT:
${context.companyName || 'Unknown Company'} (${context.industry || 'Unknown Industry'})

PRODUCTS:
${productList}

SEC FILING CONTEXT:
${secSnippet}

Generate up to 5 grounded value hypotheses.
`;

    const response = await llmGateway.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        tenantId,
        agentType: 'value-hypothesis-generator',
      },
    });

    const content = response.content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const raw = JSON.parse(jsonMatch[1] || content);

    return (Array.isArray(raw) ? raw : [raw]) as ValueHypothesis[];
  } catch (err) {
    logger.error('Failed to generate value hypotheses', { tenantId, error: (err as any).message });
    return [];
  }
}
