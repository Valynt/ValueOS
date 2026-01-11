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

import { AgentMemory, MemorySystem } from './MemorySystem';
import { logger } from '../logger';
import { z } from 'zod';
import { webScraperService } from '../../services/WebScraperService';
import { getMCPServer } from '../mcp/MCPClient';

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
      // SECURITY FIX: Query memory system with proper tenant isolation
      const memories = await this.memorySystem.searchSemanticMemory(
        sessionId,
        query,
        config.max_snippets_per_type,
        this.organizationId // Pass organizationId for database-level filtering
      );

      return memories
        .map(m => ({
          content: m.content,
          relevance_score: 0.8, // searchSemanticMemory doesn't return relevance score yet
          source: `agent:${m.agent_id}`,
          metadata: m.metadata
        }))
        .filter(m => m.relevance_score >= config.min_relevance_score);
    } catch (error) {
      logger.error('Semantic retrieval failed', { error, sessionId, organizationId: this.organizationId });
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
      // SECURITY FIX: Pass organizationId for database-level filtering
      const memories = await this.memorySystem.getEpisodicMemory(
        sessionId,
        config.max_snippets_per_type,
        this.organizationId
      );

      return memories.map(m => ({
        agent_id: m.agent_id,
        execution_time: m.created_at || new Date().toISOString(),
        input_summary: m.metadata?.input_summary || 'N/A',
        output_summary: m.metadata?.output_summary || m.content.substring(0, 100),
        success: m.metadata?.success ?? true
      }));
    } catch (error) {
      logger.error('Episodic retrieval failed', { error, sessionId, organizationId: this.organizationId });
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
    try {
      const files = await this.memorySystem.listStoredDocuments(this.organizationId);

      return files.map(f => ({
        source_id: f.id,
        title: f.name,
        created_at: f.created_at,
        // Map custom metadata if available in the file object's metadata field
        headers: f.metadata?.headers,
        page_count: f.metadata?.page_count,
        word_count: f.metadata?.word_count
      }));
    } catch (error) {
       logger.error('Document metadata retrieval failed', { sessionId, error });
       return [];
    }
  }

  /**
   * Web content retrieval (cleaned scraper data)
   */
  private async retrieveWebContent(
    sessionId: string,
    query: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['web_content']> {
    try {
      // 1. Check if query itself is a URL or contains URLs
      const urls = this.extractUrls(query);

      if (urls.length > 0) {
        logger.debug('Scraping URLs found in query', { sessionId, urls });

        // Limit to 3 URLs to avoid long waits
        const targetUrls = urls.slice(0, 3);

        const scrapePromises = targetUrls.map(url => webScraperService.scrape(url));
        const results = await Promise.all(scrapePromises);

        // Filter out nulls
        return results.filter((r): r is NonNullable<typeof r> => r !== null);
      }

      // 2. If no URLs in query, we would typically use a search engine (Google/Bing)
      // to find relevant pages, then scrape them.
      // Since we don't have a live search API integration here yet, we return empty.

      return [];
    } catch (error) {
      logger.error('Web content retrieval failed', { sessionId, error });
      return [];
    }
  }

  /**
   * Helper to extract URLs from text
   */
  private extractUrls(text: string): string[] {
    // Regex to extract URLs, excluding trailing punctuation common in sentences
    const urlRegex = /(https?:\/\/[^\s.,;:)]+)/g;
    return text.match(urlRegex) || [];
  }

  /**
   * Benchmark context retrieval (Ground Truth API)
   */
  private async retrieveBenchmarkContext(
    query: string,
    config: Required<RetrievalConfig>
  ): Promise<RetrievalContext['benchmark_context']> {
    try {
      const mcpServer = await getMCPServer();
      const contextItems: RetrievalContext['benchmark_context'] = [];

      // 1. Extract intents from query (simple keyword matching for now)
      // In production, this would use a more sophisticated NLU or LLM extraction
      const intents = this.extractBenchmarkIntents(query);

      // 2. Execute MCP tools for each intent
      for (const intent of intents) {
        try {
          // Determine which tool to use based on intent type
          if (intent.type === 'industry') {
            const result = await mcpServer.executeTool('get_industry_benchmark', {
              identifier: intent.identifier,
            });

            if (!result.isError && result.content[0]?.text) {
              const data = JSON.parse(result.content[0].text);
              contextItems.push({
                metric_name: data.metric,
                industry: data.metadata?.industry_name || intent.label,
                value: Array.isArray(data.value) ? (data.value[0] + data.value[1]) / 2 : data.value,
                unit: data.unit || 'unit',
                source: 'internal', // Default to internal/MCP
                confidence: data.confidence || 0.8
              });
            }
          } else if (intent.type === 'entity') {
            const result = await mcpServer.executeTool('get_authoritative_financials', {
              entity_id: intent.identifier,
              metrics: ['revenue_total', 'gross_profit'], // Default metrics
              period: 'LTM'
            });

            if (!result.isError && result.content[0]?.text) {
              const data = JSON.parse(result.content[0].text);
              if (data.data && Array.isArray(data.data)) {
                 data.data.forEach((item: any) => {
                    contextItems.push({
                      metric_name: item.metric,
                      industry: item.entity.name,
                      value: item.value,
                      unit: item.unit,
                      source: 'internal',
                      confidence: 0.95
                    });
                 });
              }
            }
          }
        } catch (toolError) {
          logger.warn(`Failed to execute MCP tool for intent ${intent.identifier}`, { error: toolError });
        }
      }

      return contextItems;
    } catch (error) {
      logger.error('Benchmark context retrieval failed', { error });
      return [];
    }
  }

  /**
   * Helper to extract benchmark intents from query
   */
  private extractBenchmarkIntents(query: string): Array<{ type: 'industry' | 'entity', identifier: string, label: string }> {
    const intents: Array<{ type: 'industry' | 'entity', identifier: string, label: string }> = [];
    const lowerQuery = query.toLowerCase();

    // Map common keywords to NAICS codes (Sample mapping)
    const industryMap: Record<string, string> = {
      'software': '511210',
      'saas': '511210',
      'tech': '541511',
      'technology': '541511',
      'consulting': '541511',
      'programming': '541511',
      'banking': '522110',
      'retail': '440000'
    };

    // Map common entities to Tickers/CIKs (Sample mapping)
    // In production, use a proper entity resolution service
    const entityMap: Record<string, string> = {
      'apple': 'AAPL',
      'microsoft': 'MSFT',
      'google': 'GOOGL',
      'alphabet': 'GOOGL',
      'amazon': 'AMZN'
    };

    // Check for industries
    for (const [keyword, naics] of Object.entries(industryMap)) {
      if (lowerQuery.includes(keyword)) {
        intents.push({ type: 'industry', identifier: naics, label: keyword });
      }
    }

    // Check for entities
    for (const [keyword, ticker] of Object.entries(entityMap)) {
      if (lowerQuery.includes(keyword)) {
        intents.push({ type: 'entity', identifier: ticker, label: keyword });
      }
    }

    // Check for Occupation codes (basic regex)
    // Matches 15-1252 etc.
    const occupationMatch = query.match(/\d{2}-\d{4}/);
    if (occupationMatch) {
       intents.push({ type: 'industry', identifier: occupationMatch[0], label: 'occupation' });
    }

    return intents;
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

import { BaseAgent } from './agents/BaseAgent';
import { AgentConfig } from '../../../types/agent';

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

const RETRIEVAL_CONDITIONED_PROMPT = (data: { retrieved_context: string; query: string; context_hint?: string }) => `You are an expert analyst answering questions using ONLY retrieved context.

${data.retrieved_context}

## USER QUERY
${data.query}

${data.context_hint ? `## CONTEXT HINT
${data.context_hint}` : ''}

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
    const prompt = RETRIEVAL_CONDITIONED_PROMPT({
      query: input.query,
      context_hint: input.context_hint,
      retrieved_context: formattedContext
    });

    // Define schema for structured output
    const retrievalSchema = z.object({
      answer: z.string(),
      confidence: z.number().min(0).max(1),
      sources_cited: z.array(z.number()).optional()
    });

    // SECURITY FIX: Use secureInvoke() instead of direct llmGateway.complete()
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      retrievalSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.5, high: 0.8 },
        context: {
          agent: 'RetrievalConditionedAgent',
          contextTokens: this.retrievalEngine.estimateTokens(formattedContext),
          semanticCount: truncatedContext.semantic_snippets.length
        }
      }
    );

    const parsed = secureResult.result;

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
      },
      this.organizationId // SECURITY: Tenant isolation
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
