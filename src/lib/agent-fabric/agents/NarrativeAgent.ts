/**
 * Narrative Agent
 *
 * VOS Lifecycle Stage: COMMUNICATOR
 *
 * Generates multi-level value narratives for different contexts and audiences.
 * Provides 3 narrative levels: Micro (tooltips), Contextual (panels), Document (exports).
 *
 * Responsibilities:
 * - Micro narratives: 10-50 words for tooltips and inline explanations
 * - Contextual narratives: ~200 words for section summaries
 * - Document narratives: Full-length proposals, QBRs, and exports
 * - Audience-aware messaging (executive, technical, financial)
 * - Consistent tone and terminology across all outputs
 */

import { z } from 'zod';
import { logger } from '../../../lib/logger';
import { BaseAgent } from './BaseAgent';
import { ValueFabricService } from '../../../services/ValueFabricService';
import type { AgentConfig, ConfidenceLevel } from '../../../types/agent';

// ============================================================================
// Input/Output Types
// ============================================================================

export type NarrativeLevel = 'micro' | 'contextual' | 'document';
export type NarrativeAudience = 'executive' | 'technical' | 'financial' | 'general';
export type NarrativeFormat = 'text' | 'markdown' | 'html';

export interface NarrativeAgentInput {
  /** The level of narrative to generate */
  level: NarrativeLevel;
  /** Target audience for the narrative */
  audience: NarrativeAudience;
  /** Output format */
  format?: NarrativeFormat;
  /** Value data to narrate */
  valueData: {
    /** Value case or opportunity identifier */
    valueCaseId?: string;
    /** Key metrics to highlight */
    metrics?: Array<{
      name: string;
      value: number;
      unit: string;
      context?: string;
    }>;
    /** Outcomes to describe */
    outcomes?: Array<{
      name: string;
      description: string;
      impact?: string;
    }>;
    /** Financial summary */
    financialSummary?: {
      totalValue: number;
      revenueImpact?: number;
      costSavings?: number;
      riskReduction?: number;
      paybackPeriod?: string;
      roi?: number;
    };
    /** Additional context */
    context?: Record<string, any>;
  };
  /** Specific topic or focus for the narrative */
  topic?: string;
  /** Custom instructions for tone or style */
  customInstructions?: string;
  /** Maximum length (for micro/contextual) */
  maxLength?: number;
}

export interface MicroNarrative {
  text: string;
  wordCount: number;
  keyTerms: string[];
}

export interface ContextualNarrative {
  summary: string;
  keyPoints: string[];
  callToAction?: string;
  wordCount: number;
}

export interface DocumentSection {
  title: string;
  content: string;
  subsections?: DocumentSection[];
}

export interface DocumentNarrative {
  title: string;
  executiveSummary: string;
  sections: DocumentSection[];
  conclusion: string;
  appendix?: string;
  wordCount: number;
  tableOfContents?: string[];
}

export interface NarrativeAgentOutput {
  level: NarrativeLevel;
  audience: NarrativeAudience;
  format: NarrativeFormat;
  micro?: MicroNarrative;
  contextual?: ContextualNarrative;
  document?: DocumentNarrative;
  tone: string;
  reasoning: string;
  confidenceLevel: ConfidenceLevel;
}

// ============================================================================
// Zod Schemas for Structured Output
// ============================================================================

const MicroNarrativeSchema = z.object({
  text: z.string(),
  word_count: z.number(),
  key_terms: z.array(z.string()),
});

const ContextualNarrativeSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  call_to_action: z.string().optional(),
  word_count: z.number(),
});

const DocumentSectionSchema: z.ZodType<any> = z.object({
  title: z.string(),
  content: z.string(),
  subsections: z.array(z.lazy(() => DocumentSectionSchema)).optional(),
});

const DocumentNarrativeSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  sections: z.array(DocumentSectionSchema),
  conclusion: z.string(),
  appendix: z.string().optional(),
  word_count: z.number(),
  table_of_contents: z.array(z.string()).optional(),
});

const NarrativeOutputSchema = z.object({
  level: z.enum(['micro', 'contextual', 'document']),
  audience: z.enum(['executive', 'technical', 'financial', 'general']),
  format: z.enum(['text', 'markdown', 'html']),
  micro: MicroNarrativeSchema.optional(),
  contextual: ContextualNarrativeSchema.optional(),
  document: DocumentNarrativeSchema.optional(),
  tone: z.string(),
  reasoning: z.string(),
  confidence_level: z.enum(['high', 'medium', 'low']),
});

// ============================================================================
// Narrative Agent Implementation
// ============================================================================

export class NarrativeAgent extends BaseAgent {
  private valueFabricService: ValueFabricService;

  public lifecycleStage = 'communicator';
  public version = '1.0';
  public name = 'Narrative Agent';

  // Word count limits by level
  private readonly WORD_LIMITS = {
    micro: { min: 10, max: 50 },
    contextual: { min: 100, max: 300 },
    document: { min: 500, max: 5000 },
  };

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error('Supabase client is required for NarrativeAgent');
    }
    this.valueFabricService = new ValueFabricService(config.supabase);
  }

  async execute(
    sessionId: string,
    input: NarrativeAgentInput
  ): Promise<NarrativeAgentOutput> {
    const startTime = Date.now();

    // Determine word limits
    const wordLimits = this.WORD_LIMITS[input.level];
    const maxLength = input.maxLength || wordLimits.max;

    // Build narrative context
    const narrativeContext = this.buildNarrativeContext(input);

    const prompt = this.buildPrompt(input, narrativeContext, maxLength);

    // Use secure invocation with structured output
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      NarrativeOutputSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.5, high: 0.8 },
        context: {
          agent: 'NarrativeAgent',
          level: input.level,
          audience: input.audience,
        },
      }
    );

    const parsed = secureResult.result;
    const durationMs = Date.now() - startTime;

    // Log metrics
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'narrative_level', input.level === 'micro' ? 1 : input.level === 'contextual' ? 2 : 3, 'ordinal');
    await this.logPerformanceMetric(sessionId, 'narrative_execute', durationMs, {
      level: input.level,
      audience: input.audience,
    });

    // Log execution for audit trail
    await this.logExecution(
      sessionId,
      'narrative_generation',
      input,
      parsed,
      parsed.reasoning,
      parsed.confidence_level,
      []
    );

    // Store in semantic memory
    const narrativePreview = this.getNarrativePreview(parsed);
    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Narrative (${input.level}/${input.audience}): ${narrativePreview}`,
      {
        level: input.level,
        audience: input.audience,
        topic: input.topic,
      },
      this.organizationId
    );

    // Transform to output format
    return this.transformOutput(parsed, input.format || 'text');
  }

  /**
   * Build narrative context from input
   */
  private buildNarrativeContext(input: NarrativeAgentInput): string {
    const parts: string[] = [];

    if (input.topic) {
      parts.push(`Topic: ${input.topic}`);
    }

    if (input.valueData.metrics && input.valueData.metrics.length > 0) {
      parts.push('\nKey Metrics:');
      input.valueData.metrics.forEach(m => {
        parts.push(`- ${m.name}: ${m.value} ${m.unit}${m.context ? ` (${m.context})` : ''}`);
      });
    }

    if (input.valueData.outcomes && input.valueData.outcomes.length > 0) {
      parts.push('\nOutcomes:');
      input.valueData.outcomes.forEach(o => {
        parts.push(`- ${o.name}: ${o.description}${o.impact ? ` - Impact: ${o.impact}` : ''}`);
      });
    }

    if (input.valueData.financialSummary) {
      const fs = input.valueData.financialSummary;
      parts.push('\nFinancial Summary:');
      parts.push(`- Total Value: $${fs.totalValue.toLocaleString()}`);
      if (fs.revenueImpact) parts.push(`- Revenue Impact: $${fs.revenueImpact.toLocaleString()}`);
      if (fs.costSavings) parts.push(`- Cost Savings: $${fs.costSavings.toLocaleString()}`);
      if (fs.riskReduction) parts.push(`- Risk Reduction: $${fs.riskReduction.toLocaleString()}`);
      if (fs.roi) parts.push(`- ROI: ${fs.roi}%`);
      if (fs.paybackPeriod) parts.push(`- Payback Period: ${fs.paybackPeriod}`);
    }

    if (input.valueData.context) {
      parts.push(`\nAdditional Context: ${JSON.stringify(input.valueData.context, null, 2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Build level-specific prompt
   */
  private buildPrompt(
    input: NarrativeAgentInput,
    context: string,
    maxLength: number
  ): string {
    const audienceGuidance = this.getAudienceGuidance(input.audience);
    const levelGuidance = this.getLevelGuidance(input.level, maxLength);

    return `You are a value communication specialist generating ${input.level}-level narratives for ${input.audience} audiences.

VALUE DATA:
${context}

AUDIENCE GUIDANCE:
${audienceGuidance}

LEVEL GUIDANCE:
${levelGuidance}

${input.customInstructions ? `CUSTOM INSTRUCTIONS:\n${input.customInstructions}\n` : ''}

Generate a compelling ${input.level} narrative that:
1. Speaks directly to ${input.audience} priorities and concerns
2. Highlights the most impactful value elements
3. Uses appropriate terminology and tone
4. Stays within word limits (${this.WORD_LIMITS[input.level].min}-${maxLength} words)
5. Provides clear, actionable insights

Return ONLY valid JSON in this exact format:
{
  "level": "${input.level}",
  "audience": "${input.audience}",
  "format": "${input.format || 'text'}",
  ${this.getOutputStructure(input.level)},
  "tone": "<description of tone used>",
  "reasoning": "<why this narrative approach was chosen>",
  "confidence_level": "<high|medium|low>"
}`;
  }

  /**
   * Get audience-specific guidance
   */
  private getAudienceGuidance(audience: NarrativeAudience): string {
    const guidance: Record<NarrativeAudience, string> = {
      executive: 'Focus on strategic impact, business outcomes, competitive advantage, and bottom-line results. Use concise, confident language. Avoid technical details.',
      technical: 'Emphasize implementation details, integration points, technical capabilities, and operational improvements. Be specific about how value is achieved.',
      financial: 'Lead with numbers, ROI calculations, payback periods, and financial projections. Include assumptions and sensitivity considerations.',
      general: 'Balance business value with practical benefits. Use accessible language that works across roles. Focus on tangible outcomes.',
    };
    return guidance[audience];
  }

  /**
   * Get level-specific guidance
   */
  private getLevelGuidance(level: NarrativeLevel, maxLength: number): string {
    const guidance: Record<NarrativeLevel, string> = {
      micro: `Generate a tooltip-style explanation in ${this.WORD_LIMITS.micro.min}-${maxLength} words. Be extremely concise. Include only the most essential insight.`,
      contextual: `Generate a panel-style summary in ${this.WORD_LIMITS.contextual.min}-${maxLength} words. Include 3-5 key points and optionally a call to action.`,
      document: `Generate a full document with title, executive summary, structured sections, and conclusion. Target ${maxLength} words. Include a logical flow from problem to solution to value.`,
    };
    return guidance[level];
  }

  /**
   * Get output structure for JSON template
   */
  private getOutputStructure(level: NarrativeLevel): string {
    const structures: Record<NarrativeLevel, string> = {
      micro: `"micro": {
    "text": "<concise narrative>",
    "word_count": 25,
    "key_terms": ["<term1>", "<term2>"]
  }`,
      contextual: `"contextual": {
    "summary": "<narrative summary>",
    "key_points": ["<point 1>", "<point 2>", "<point 3>"],
    "call_to_action": "<optional CTA>",
    "word_count": 200
  }`,
      document: `"document": {
    "title": "<document title>",
    "executive_summary": "<executive summary paragraph>",
    "sections": [
      {
        "title": "<section title>",
        "content": "<section content>",
        "subsections": []
      }
    ],
    "conclusion": "<concluding paragraph>",
    "appendix": "<optional appendix>",
    "word_count": 1000,
    "table_of_contents": ["<section 1>", "<section 2>"]
  }`,
    };
    return structures[level];
  }

  /**
   * Get preview of narrative for memory storage
   */
  private getNarrativePreview(parsed: any): string {
    if (parsed.micro) {
      return parsed.micro.text.substring(0, 100);
    }
    if (parsed.contextual) {
      return parsed.contextual.summary.substring(0, 100);
    }
    if (parsed.document) {
      return parsed.document.executive_summary.substring(0, 100);
    }
    return 'No narrative generated';
  }

  /**
   * Transform parsed output to typed output
   */
  private transformOutput(parsed: any, format: NarrativeFormat): NarrativeAgentOutput {
    const output: NarrativeAgentOutput = {
      level: parsed.level,
      audience: parsed.audience,
      format: format,
      tone: parsed.tone,
      reasoning: parsed.reasoning,
      confidenceLevel: parsed.confidence_level,
    };

    if (parsed.micro) {
      output.micro = {
        text: this.formatContent(parsed.micro.text, format),
        wordCount: parsed.micro.word_count,
        keyTerms: parsed.micro.key_terms,
      };
    }

    if (parsed.contextual) {
      output.contextual = {
        summary: this.formatContent(parsed.contextual.summary, format),
        keyPoints: parsed.contextual.key_points,
        callToAction: parsed.contextual.call_to_action,
        wordCount: parsed.contextual.word_count,
      };
    }

    if (parsed.document) {
      output.document = {
        title: parsed.document.title,
        executiveSummary: this.formatContent(parsed.document.executive_summary, format),
        sections: this.transformSections(parsed.document.sections, format),
        conclusion: this.formatContent(parsed.document.conclusion, format),
        appendix: parsed.document.appendix ? this.formatContent(parsed.document.appendix, format) : undefined,
        wordCount: parsed.document.word_count,
        tableOfContents: parsed.document.table_of_contents,
      };
    }

    return output;
  }

  /**
   * Transform document sections recursively
   */
  private transformSections(sections: any[], format: NarrativeFormat): DocumentSection[] {
    return sections.map(s => ({
      title: s.title,
      content: this.formatContent(s.content, format),
      subsections: s.subsections ? this.transformSections(s.subsections, format) : undefined,
    }));
  }

  /**
   * Format content based on requested format
   */
  private formatContent(content: string, format: NarrativeFormat): string {
    if (format === 'text') {
      // Strip any markdown formatting for plain text
      return content.replace(/[#*_`]/g, '');
    }
    if (format === 'html') {
      // Convert markdown to basic HTML
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>');
    }
    // Return as-is for markdown
    return content;
  }
}
