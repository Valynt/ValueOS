/**
 * Retrieval-Conditioned Agent Base Class Enhancement
 * 
 * Adds context-first LLM call pattern to BaseAgent:
 * - Pre-retrieval: Query memory/knowledge base before LLM call
 * - Context injection: Add retrieved snippets, metadata, prior runs
 * - Relevance ranking: Score and filter context by relevance
 * - Window management: Handle large retrievals within token limits
 * 
 * Prevents hallucinations by grounding LLM responses in retrieved data.
 */

import { MemorySystem, AgentMemory } from '../MemorySystem';
import { logger } from '../../logger';

// =====================================================
// RETRIEVAL CONTEXT TYPES
// =====================================================

export interface RetrievalContext {
  /**
   * Semantic memory snippets from vector search
   */
  semantic_snippets: {
    content: string;
    relevance_score: number;
    source: string;
    metadata?: Record<string, any>;
  }[];

  /**
   * Episodic memory (prior agent runs)
   */
  episodic_context: {
    agent_id: string;
    execution_time: string;
    input_summary: string;
    output_summary: string;
    success: boolean;
  }[];

  /**
   * Document metadata (title, headers, structure)
   */
  document_metadata: {
    source_id: string;
    title?: string;
    headers?: string[];
    page_count?: number;
    word_count?: number;
    created_at?: string;
  }[];

  /**
   * Web scraper content (cleaned)
   */
  web_content: {
    url: string;
    title: string;
    h1_tags: string[];
    main_content: string;
    relevance_score: number;
  }[];

  /**
   * Benchmark anchors (from Ground Truth API)
   */
  benchmark_context: {
    metric_name: string;
    industry: string;
    value: number;
    unit: string;
    source: 'gartner' | 'forrester' | 'idc' | 'mckinsey' | 'internal';
    confidence: number;
  }[];
}

export interface RetrievalConfig {
  /**
   * Enable semantic search
   */
  use_semantic_memory?: boolean;

  /**
   * Enable episodic memory (prior runs)
   */
  use_episodic_memory?: boolean;

  /**
   * Enable document metadata
   */
  use_document_metadata?: boolean;

  /**
   * Enable web content
   */
  use_web_content?: boolean;

  /**
   * Enable benchmark anchors
   */
  use_benchmark_context?: boolean;

  /**
   * Minimum relevance score (0.0-1.0)
   */
  min_relevance_score?: number;

  /**
   * Maximum context tokens
   */
  max_context_tokens?: number;

  /**
   * Maximum snippets per type
   */
  max_snippets_per_type?: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: Required<RetrievalConfig> = {
  use_semantic_memory: true,
  use_episodic_memory: true,
  use_document_metadata: false,
  use_web_content: false,
  use_benchmark_context: false,
  min_relevance_score: 0.6,
  max_context_tokens: 4000,
  max_snippets_per_type: 5
};

// =====================================================
// RETRIEVAL ENGINE
// =====================================================

export class RetrievalEngine {
  constructor(
    private memorySystem: MemorySystem,
    private organizationId: string
  ) {}

  /**
   * Retrieve context before LLM call
   */
  async retrieveContext(
    sessionId: string,
    query: string,
    config: RetrievalConfig = {}
  ): Promise<RetrievalContext> {
    const mergedConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };

    logger.debug('Retrieving context for query', {
      sessionId,
      organizationId: this.organizationId,
      query: query.substring(0, 100),
      config: mergedConfig
    });

    const context: RetrievalContext = {
      semantic_snippets: [],
      episodic_context: [],
      document_metadata: [],
      web_content: [],
      benchmark_context: []
    };

    // Parallel retrieval (independent operations)
    const retrievalPromises = [];

    if (mergedConfig.use_semantic_memory) {
      retrievalPromises.push(
        this.retrieveSemanticSnippets(sessionId, query, mergedConfig)
          .then(snippets => { context.semantic_snippets = snippets; })
      );
    }

    if (mergedConfig.use_episodic_memory) {
      retrievalPromises.push(
        this.retrieveEpisodicContext(sessionId, mergedConfig)
          .then(episodes => { context.episodic_context = episodes; })
      );
    }

    if (mergedConfig.use_document_metadata) {
      retrievalPromises.push(
        this.retrieveDocumentMetadata(sessionId, mergedConfig)
          .then(metadata => { context.document_metadata = metadata; })
      );
    }

    if (mergedConfig.use_web_content) {
      retrievalPromises.push(
        this.retrieveWebContent(sessionId, query, mergedConfig)
          .then(webData => { context.web_content = webData; })
      );
    }

    if (mergedConfig.use_benchmark_context) {
      retrievalPromises.push(
        this.retrieveBenchmarkContext(query, mergedConfig)
          .then(benchmarks => { context.benchmark_context = benchmarks; })
      );
    }

    await Promise.all(retrievalPromises);

    logger.info('Context retrieval complete', {
      sessionId,
      organizationId: this.organizationId,
      semantic_count: context.semantic_snippets.length,
      episodic_count: context.episodic_context.length,
      document_count: context.document_metadata.length,
      web_count: context.web_content.length,
      benchmark_count: context.benchmark_context.length
    });

    return context;
  }

  /**
   * Semantic memory retrieval (vector search)
   */
  private async retrieveSemanticSnippets(
    sessionId: string,
    query: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['semantic_snippets']> {
    try {
      // Query memory system with tenant isolation
      const memories = await this.memorySystem.searchSemanticMemory(
        sessionId,
        query,
        config.max_snippets_per_type
      );

      // Note: Tenant isolation via organization_id filter needs to be added to searchSemanticMemory
      // For now, we filter in-memory (NOT ideal, should be in DB query)
      return memories
        .filter(m => m.metadata?.organization_id === this.organizationId)
        .map(m => ({
          content: m.content,
          relevance_score: 0.8, // searchSemanticMemory doesn't return relevance score yet
          source: `agent:${m.agent_id}`,
          metadata: m.metadata
        }))
        .filter(m => m.relevance_score >= config.min_relevance_score);
    } catch (error) {
      logger.error('Semantic retrieval failed', { error, sessionId });
      return [];
    }
  }

  /**
   * Episodic memory retrieval (prior agent runs)
   */
  private async retrieveEpisodicContext(
    sessionId: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['episodic_context']> {
    try {
      const memories = await this.memorySystem.getEpisodicMemory(
        sessionId,
        config.max_snippets_per_type
      );

      // Filter by tenant (should be in DB query)
      return memories
        .filter(m => m.metadata?.organization_id === this.organizationId)
        .map(m => ({
          agent_id: m.agent_id,
          execution_time: m.created_at || new Date().toISOString(),
          input_summary: m.metadata?.input_summary || 'N/A',
          output_summary: m.metadata?.output_summary || m.content.substring(0, 100),
          success: m.metadata?.success ?? true
        }));
    } catch (error) {
      logger.error('Episodic retrieval failed', { error, sessionId });
      return [];
    }
  }

  /**
   * Document metadata retrieval
   */
  private async retrieveDocumentMetadata(
    sessionId: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['document_metadata']> {
    // TODO: Integrate with Supabase storage metadata query
    // For now, return empty array
    logger.debug('Document metadata retrieval not yet implemented', { sessionId });
    return [];
  }

  /**
   * Web content retrieval (cleaned scraper data)
   */
  private async retrieveWebContent(
    sessionId: string,
    query: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['web_content']> {
    // TODO: Integrate with web scraper service
    // For now, return empty array
    logger.debug('Web content retrieval not yet implemented', { sessionId });
    return [];
  }

  /**
   * Benchmark context retrieval (Ground Truth API)
   */
  private async retrieveBenchmarkContext(
    query: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['benchmark_context']> {
    // TODO: Integrate with MCP Ground Truth API
    // For now, return empty array
    logger.debug('Benchmark context retrieval not yet implemented');
    return [];
  }

  /**
   * Format context for LLM injection
   */
  formatContextForPrompt(context: RetrievalContext): string {
    const sections: string[] = [];

    if (context.semantic_snippets.length > 0) {
      sections.push('## RETRIEVED CONTEXT (Semantic Memory)\n');
      context.semantic_snippets.forEach((snippet, idx) => {
        sections.push(`[${idx + 1}] (Relevance: ${snippet.relevance_score.toFixed(2)}) ${snippet.source}`);
        sections.push(snippet.content);
        sections.push('');
      });
    }

    if (context.episodic_context.length > 0) {
      sections.push('## PRIOR AGENT RUNS (Episodic Memory)\n');
      context.episodic_context.forEach((episode, idx) => {
        sections.push(`[${idx + 1}] Agent: ${episode.agent_id} | Time: ${episode.execution_time} | Success: ${episode.success}`);
        sections.push(`Input: ${episode.input_summary}`);
        sections.push(`Output: ${episode.output_summary}`);
        sections.push('');
      });
    }

    if (context.document_metadata.length > 0) {
      sections.push('## DOCUMENT METADATA\n');
      context.document_metadata.forEach((doc, idx) => {
        sections.push(`[${idx + 1}] ${doc.title || doc.source_id}`);
        if (doc.headers) sections.push(`Headers: ${doc.headers.join(', ')}`);
        if (doc.word_count) sections.push(`Words: ${doc.word_count}`);
        sections.push('');
      });
    }

    if (context.web_content.length > 0) {
      sections.push('## WEB CONTENT\n');
      context.web_content.forEach((web, idx) => {
        sections.push(`[${idx + 1}] ${web.title} (${web.url})`);
        sections.push(`H1: ${web.h1_tags.join(', ')}`);
        sections.push(web.main_content.substring(0, 500));
        sections.push('');
      });
    }

    if (context.benchmark_context.length > 0) {
      sections.push('## INDUSTRY BENCHMARKS\n');
      context.benchmark_context.forEach((benchmark, idx) => {
        sections.push(`[${idx + 1}] ${benchmark.metric_name}: ${benchmark.value} ${benchmark.unit} (${benchmark.industry}, Source: ${benchmark.source}, Confidence: ${benchmark.confidence})`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate context to fit token limit
   */
  truncateContext(context: RetrievalContext, maxTokens: number): RetrievalContext {
    const formatted = this.formatContextForPrompt(context);
    const currentTokens = this.estimateTokens(formatted);

    if (currentTokens <= maxTokens) {
      return context; // Fits within limit
    }

    // Truncate snippets proportionally
    const ratio = maxTokens / currentTokens;
    
    return {
      semantic_snippets: context.semantic_snippets.slice(0, Math.floor(context.semantic_snippets.length * ratio)),
      episodic_context: context.episodic_context.slice(0, Math.floor(context.episodic_context.length * ratio)),
      document_metadata: context.document_metadata.slice(0, Math.floor(context.document_metadata.length * ratio)),
      web_content: context.web_content.slice(0, Math.floor(context.web_content.length * ratio)),
      benchmark_context: context.benchmark_context.slice(0, Math.floor(context.benchmark_context.length * ratio))
    };
  }
}

// =====================================================
// EXAMPLE: RETRIEVAL-CONDITIONED AGENT
// =====================================================

import { BaseAgent } from '../BaseAgent';
import { AgentConfig } from '../../../types/agent';
import Handlebars from 'handlebars';

export interface RetrievalConditionedInput {
  query: string;
  context_hint?: string;
  retrieval_config?: RetrievalConfig;
}

export interface RetrievalConditionedOutput {
  answer: string;
  retrieved_context_summary: {
    semantic_count: number;
    episodic_count: number;
    benchmark_count: number;
    total_tokens: number;
  };
  confidence: number;
}

const RETRIEVAL_CONDITIONED_PROMPT = `You are an expert analyst answering questions using ONLY retrieved context.

{{{retrieved_context}}}

## USER QUERY
{{query}}

{{#if context_hint}}
## CONTEXT HINT
{{context_hint}}
{{/if}}

CRITICAL RULES:
1. Answer ONLY from retrieved context above
2. If no relevant context exists, say "Insufficient context to answer"
3. Cite sources using [1], [2] notation
4. Indicate confidence level (0.0-1.0) based on evidence quality

Return valid JSON:
{
  "answer": "<your response>",
  "confidence": 0.85,
  "sources_cited": [1, 2]
}`;

export class RetrievalConditionedAgent extends BaseAgent {
  public lifecycleStage = 'discovery';
  public version = '2.0';
  public name = 'RetrievalConditionedAgent';

  private retrievalEngine: RetrievalEngine;

  constructor(config: AgentConfig, organizationId: string) {
    super(config);
    this.retrievalEngine = new RetrievalEngine(this.memorySystem, organizationId);
  }

  async execute(sessionId: string, input: RetrievalConditionedInput): Promise<RetrievalConditionedOutput> {
    // STEP 1: Retrieve context BEFORE LLM call
    const rawContext = await this.retrievalEngine.retrieveContext(
      sessionId,
      input.query,
      input.retrieval_config
    );

    // STEP 2: Truncate to fit token budget
    const truncatedContext = this.retrievalEngine.truncateContext(
      rawContext,
      input.retrieval_config?.max_context_tokens || DEFAULT_RETRIEVAL_CONFIG.max_context_tokens
    );

    // STEP 3: Format context for injection
    const formattedContext = this.retrievalEngine.formatContextForPrompt(truncatedContext);

    // STEP 4: Inject context into prompt
    const template = Handlebars.compile(RETRIEVAL_CONDITIONED_PROMPT);
    const prompt = template({
      query: input.query,
      context_hint: input.context_hint,
      retrieved_context: formattedContext
    });

    // STEP 5: LLM call with context-grounded prompt
    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are an expert analyst. Answer questions using ONLY the retrieved context provided. Never hallucinate or use external knowledge.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.1, // Very low to prevent hallucinations
      max_tokens: 2000
    });

    const parsed = this.extractJSON(response.content);

    // STEP 6: Store result in episodic memory
    await this.memorySystem.storeEpisodicMemory(
      sessionId,
      this.agentId,
      `Answered query: ${input.query.substring(0, 50)}...`,
      {
        query: input.query,
        answer: parsed.answer,
        confidence: parsed.confidence,
        context_summary: {
          semantic_count: truncatedContext.semantic_snippets.length,
          episodic_count: truncatedContext.episodic_context.length,
          benchmark_count: truncatedContext.benchmark_context.length
        }
      }
    );

    return {
      answer: parsed.answer,
      retrieved_context_summary: {
        semantic_count: truncatedContext.semantic_snippets.length,
        episodic_count: truncatedContext.episodic_context.length,
        benchmark_count: truncatedContext.benchmark_context.length,
        total_tokens: this.retrievalEngine.estimateTokens(formattedContext)
      },
      confidence: parsed.confidence
    };
  }
}
