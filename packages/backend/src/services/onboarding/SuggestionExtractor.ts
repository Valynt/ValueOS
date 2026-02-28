/**
 * SuggestionExtractor — LLM-based entity extraction for onboarding research.
 *
 * One LLM call per entity type, Zod-validated output.
 * Partial failures are tolerated: one entity type failing doesn't block others.
 */

import { z } from 'zod';

import { logger } from '../../lib/logger.js';
import { semanticMemory } from '../SemanticMemory.js';

import type { CrawledPage } from './WebCrawler.js';

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'product' | 'competitor' | 'persona' | 'claim' | 'capability' | 'value_pattern';

export interface ExtractionResult {
  entityType: EntityType;
  items: Array<{
    payload: Record<string, unknown>;
    confidence_score: number;
    source_urls: string[];
    source_page_url: string | null;
  }>;
  success: boolean;
  error?: string;
  tokensUsed?: number;
}

export interface ExtractionContext {
  companyName?: string;
  industry?: string;
  companySize?: string;
  salesMotion?: string;
}

export interface LLMGatewayInterface {
  complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata: { tenantId: string; [key: string]: unknown };
  }): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;
}

// ============================================================================
// Zod Schemas per entity type
// ============================================================================

const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  product_type: z.enum(['platform', 'module', 'service', 'add_on']).nullable().default(null),
});

const CompetitorSchema = z.object({
  name: z.string(),
  website_url: z.string().nullable().default(null),
  relationship: z.enum(['direct', 'indirect', 'incumbent', 'emerging']).nullable().default(null),
});

const PersonaSchema = z.object({
  title: z.string(),
  persona_type: z.enum(['decision_maker', 'champion', 'influencer', 'end_user', 'blocker']).nullable().default(null),
  seniority: z.enum(['c_suite', 'vp', 'director', 'manager', 'individual_contributor']).nullable().default(null),
  typical_kpis: z.array(z.string()).default([]),
  pain_points: z.array(z.string()).default([]),
});

const ClaimSchema = z.object({
  claim_text: z.string(),
  risk_level: z.enum(['safe', 'conditional', 'high_risk']).default('conditional'),
  category: z.enum(['revenue', 'cost', 'risk', 'productivity', 'compliance']).nullable().default(null),
  rationale: z.string().nullable().default(null),
  economic_lever: z.enum(['revenue', 'cost', 'risk', 'productivity', 'compliance']).nullable().optional(),
  implied_kpis: z.array(z.string()).optional().default([]),
  evidence_strength: z.enum(['explicit_metric', 'case_study', 'marketing_claim']).optional().default('marketing_claim'),
});

const CapabilitySchema = z.object({
  capability: z.string(),
  operational_change: z.string().nullable().default(null),
  economic_lever: z.string().nullable().default(null),
});

const ValuePatternSchema = z.object({
  pattern_name: z.string(),
  typical_kpis: z.array(z.object({ name: z.string(), category: z.string(), unit: z.string() })).default([]),
  typical_assumptions: z.array(z.object({ label: z.string(), baseline: z.string(), target: z.string() })).default([]),
});

const ENTITY_SCHEMAS: Record<EntityType, z.ZodType> = {
  product: z.array(ProductSchema),
  competitor: z.array(CompetitorSchema),
  persona: z.array(PersonaSchema),
  claim: z.array(ClaimSchema),
  capability: z.array(CapabilitySchema),
  value_pattern: z.array(ValuePatternSchema),
};

// ============================================================================
// System Prompts
// ============================================================================

function getSystemPrompt(entityType: EntityType, context: ExtractionContext): string {
  const companyInfo = [
    context.companyName ? `Company: ${context.companyName}` : '',
    context.industry ? `Industry: ${context.industry}` : '',
    context.companySize ? `Size: ${context.companySize}` : '',
    context.salesMotion ? `Sales motion: ${context.salesMotion}` : '',
  ].filter(Boolean).join('. ');

  const base = `You are an analyst extracting structured data from a company's website content. ${companyInfo ? `Context: ${companyInfo}.` : ''}\n\nRespond ONLY with a valid JSON array. No markdown, no explanation.`;

  const prompts: Record<EntityType, string> = {
    product: `${base}\n\nExtract products/solutions. Each item:\n{"name": string, "description": string, "product_type": "platform"|"module"|"service"|"add_on"|null}`,
    competitor: `${base}\n\nExtract competitors mentioned or implied (via "vs", "alternative to", "compared to" language). Each item:\n{"name": string, "website_url": string|null, "relationship": "direct"|"indirect"|"incumbent"|"emerging"|null}`,
    persona: `${base}\n\nExtract buyer personas (job titles/roles the company sells to). Each item:\n{"title": string, "persona_type": "decision_maker"|"champion"|"influencer"|"end_user"|"blocker"|null, "seniority": "c_suite"|"vp"|"director"|"manager"|"individual_contributor"|null, "typical_kpis": string[], "pain_points": string[]}`,
    claim: `${base}\n\nExtract value claims the company makes (ROI, cost savings, efficiency gains, etc.). Each item:\n{"claim_text": string, "risk_level": "safe"|"conditional"|"high_risk", "category": "revenue"|"cost"|"risk"|"productivity"|"compliance"|null, "rationale": string|null, "economic_lever": "revenue"|"cost"|"risk"|"productivity"|"compliance"|null, "implied_kpis": string[], "evidence_strength": "explicit_metric"|"case_study"|"marketing_claim"}\n\nMark claims with specific metrics as "safe", vague claims as "conditional", and unsubstantiated bold claims as "high_risk".`,
    capability: `${base}\n\nExtract capabilities (what the products enable operationally, not features). Each item:\n{"capability": string, "operational_change": string|null, "economic_lever": string|null}`,
    value_pattern: `${base}\n\nGenerate value patterns (reusable value hypothesis templates) from the company's products, industry, and target personas. Each item:\n{"pattern_name": string, "typical_kpis": [{"name": string, "category": string, "unit": string}], "typical_assumptions": [{"label": string, "baseline": string, "target": string}]}`,
  };

  return prompts[entityType];
}

// ============================================================================
// Extraction Logic
// ============================================================================

function parseResponse(content: string, entityType: EntityType): Record<string, unknown>[] {
  let jsonStr = content.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!;
  }

  const raw = JSON.parse(jsonStr);
  const schema = ENTITY_SCHEMAS[entityType];
  return schema.parse(raw) as Record<string, unknown>[];
}

function assignConfidence(item: Record<string, unknown>, entityType: EntityType): number {
  // Heuristic confidence based on data completeness
  const fields = Object.values(item).filter((v) => v !== null && v !== undefined && v !== '');
  const totalFields = Object.keys(item).length;
  const completeness = totalFields > 0 ? fields.length / totalFields : 0.5;

  // Base confidence by entity type
  const baseConfidence: Record<EntityType, number> = {
    product: 0.8,
    competitor: 0.6,
    persona: 0.65,
    claim: 0.5,
    capability: 0.7,
    value_pattern: 0.55,
  };

  return Math.round(Math.min(1, baseConfidence[entityType] * (0.5 + completeness * 0.5)) * 100) / 100;
}

/**
 * Get a specialized query for RAG retrieval based on entity type.
 */
function getRetrievalQuery(entityType: EntityType, context: ExtractionContext): string {
  const company = context.companyName || 'the company';
  const queries: Record<EntityType, string> = {
    product: `What products, solutions, and services does ${company} offer?`,
    competitor: `Who are the main competitors of ${company}? Who do they compete with?`,
    persona: `What are the target buyer personas, job titles, and roles that ${company} sells to?`,
    claim: `What value propositions, ROI claims, and benefits does ${company} promise to customers?`,
    capability: `What are the core capabilities and operational features of ${company}'s platform?`,
    value_pattern: `What are the key value drivers and business outcomes associated with ${company}'s products?`,
  };
  return queries[entityType];
}

/**
 * Extract entities of a single type from crawled pages.
 */
export async function extractEntityType(
  entityType: EntityType,
  pages: CrawledPage[],
  context: ExtractionContext,
  llmGateway: LLMGatewayInterface,
  tenantId: string,
  contextId?: string,
): Promise<ExtractionResult> {
  try {
    let ragContext = '';
    
    // R2.3: Retrieval Step
    if (contextId) {
      const query = getRetrievalQuery(entityType, context);
      const searchResults = await semanticMemory.search(query, {
        limit: 15, // Retrieve top 15 relevant chunks
      });
      
      if (searchResults.length > 0) {
        ragContext = searchResults
          .map(r => `[Source: ${r.entry.metadata.source_url || 'Unknown'}]\n${r.entry.content}`)
          .join('\n\n---\n\n');
        
        logger.info('RAG context retrieved', { entityType, chunks: searchResults.length });
      }
    }

    // Fallback or additional context from pages (keeping it for now to ensure coverage)
    const combinedText = pages.map((p) => p.text).join('\n\n---\n\n');
    const truncatedText = combinedText.substring(0, 20_000); 

    const systemPrompt = getSystemPrompt(entityType, context);
    
    const userPrompt = `
${ragContext ? `PREORITIZED CONTEXT (from vector search):\n${ragContext}\n\n` : ''}
${truncatedText ? `ADDITIONAL CONTEXT:\n${truncatedText}\n\n` : ''}
Please extract ${entityType} entities from the context provided above.
`;

    const response = await llmGateway.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        tenantId,
        agentType: 'onboarding-research',
        entityType,
      },
    });

    const parsed = parseResponse(response.content, entityType);
    const sourceUrls = pages.map((p) => p.url);

    const items = parsed.map((payload) => {
      let confidence = assignConfidence(payload, entityType);

      // Claims with confidence < 0.5 default to "conditional"
      if (entityType === 'claim' && confidence < 0.5) {
        (payload as Record<string, unknown>).risk_level = 'conditional';
      }

      return {
        payload,
        confidence_score: confidence,
        source_urls: sourceUrls,
        source_page_url: pages[0]?.url ?? null,
      };
    });

    return {
      entityType,
      items,
      success: true,
      tokensUsed: response.usage?.total_tokens,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Entity extraction failed', { entityType, error: errorMsg });
    return {
      entityType,
      items: [],
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Extract all entity types in parallel using Promise.allSettled.
 */
export async function extractAllEntities(
  pages: CrawledPage[],
  context: ExtractionContext,
  llmGateway: LLMGatewayInterface,
  tenantId: string,
  contextId?: string,
  onEntityProgress?: (entityType: EntityType, status: 'running' | 'completed' | 'failed') => void,
): Promise<ExtractionResult[]> {
  const entityTypes: EntityType[] = ['product', 'competitor', 'persona', 'claim', 'capability', 'value_pattern'];

  const results = await Promise.allSettled(
    entityTypes.map(async (entityType) => {
      onEntityProgress?.(entityType, 'running');
      const result = await extractEntityType(entityType, pages, context, llmGateway, tenantId, contextId);
      onEntityProgress?.(entityType, result.success ? 'completed' : 'failed');
      return result;
    })
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      entityType: entityTypes[i]!,
      items: [],
      success: false,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}
