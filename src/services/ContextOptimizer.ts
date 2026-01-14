/**
 * Context Window Optimizer
 *
 * Optimizes context windows to reduce token consumption while maintaining
 * context relevance and security boundaries.
 */

import { logger } from '../lib/logger';
import { AgentType } from './agent-types';
import { getMemoryPressureMonitor, MemoryPressure, MemoryPressureListener } from './monitoring/MemoryPressureMonitor';

// ============================================================================
// Types
// ============================================================================

export interface ContextWindow {
  id: string;
  agentType: AgentType;
  sessionId: string;
  content: string;
  tokens: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

export interface ContextCompression {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  compressionMethod: 'truncation' | 'summarization' | 'semantic' | 'hybrid' | 'none';
  quality: 'high' | 'medium' | 'low';
  processingTime: number;
}

export interface ContextOptimization {
  windowId: string;
  originalSize: number;
  optimizedSize: number;
  compression: ContextCompression;
  retainedContent: string;
  discardedContent: string[];
  optimizationScore: number;
  recommendations: string[];
}

export interface ContextCache {
  key: string;
  content: string;
  tokens: number;
  createdAt: number;
  lastAccessed: number;
  hitCount: number;
  ttl: number;
  agentTypes: AgentType[];
  semanticHash: string;
}

export interface OptimizationConfig {
  maxTokens: number;
  minTokens: number;
  compressionThreshold: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  semanticThreshold: number;
  priorityWeights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// Context Optimizer Implementation
// ============================================================================

export class ContextOptimizer implements MemoryPressureListener {
  private contextWindows: Map<string, ContextWindow> = new Map();
  private contextCache: Map<string, ContextCache> = new Map();
  private optimizationHistory: ContextOptimization[] = [];
  private memoryMonitor = getMemoryPressureMonitor();

  private config: OptimizationConfig;
  private maxCacheSize: number;
  private readonly MAX_HISTORY_SIZE = 500;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      maxTokens: 4000,
      minTokens: 100,
      compressionThreshold: 0.7, // Compress if > 70% of max tokens
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      semanticThreshold: 0.8, // Semantic similarity threshold
      priorityWeights: {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      },
      ...config,
    };

    // Initialize adaptive cache size
    this.maxCacheSize = this.memoryMonitor.getRecommendedCacheSize();

    // Register for memory pressure changes
    this.memoryMonitor.addListener(this);

    // Start memory monitoring if not already running
    this.memoryMonitor.startMonitoring();
  }

  /**
   * Optimize context window for an agent
   */
  async optimizeContext(
    agentType: AgentType,
    sessionId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<ContextOptimization> {
    const startTime = Date.now();
    const windowId = this.generateWindowId(agentType, sessionId);

    // Calculate initial token count
    const originalSize = this.estimateTokens(content);

    // Check if optimization is needed
    if (originalSize <= this.config.minTokens) {
      return this.createOptimizationResult(windowId, originalSize, originalSize, content, [], 1.0);
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(content, agentType);
      if (cached) {
        cached.hitCount++;
        cached.lastAccessed = Date.now();

        return this.createOptimizationResult(
          windowId,
          originalSize,
          cached.tokens,
          cached.content,
          [],
          0.9 // High score for cache hit
        );
      }
    }

    // Perform optimization
    const optimization = await this.performOptimization(agentType, content, originalSize);

    // Cache the optimized content
    if (this.config.cacheEnabled && optimization.optimizationScore > 0.7) {
      this.cacheContent(optimization.retainedContent, agentType, optimization);
    }

    // Store optimization history
    this.addToHistory(optimization);

    const processingTime = Date.now() - startTime;

    logger.debug('Context optimization completed', {
      windowId,
      agentType,
      originalSize,
      optimizedSize: optimization.optimizedSize,
      compressionRatio: optimization.compression.compressionRatio,
      processingTime,
    });

    return optimization;
  }

  /**
   * Get optimized context for an agent
   */
  async getOptimizedContext(
    agentType: AgentType,
    sessionId: string,
    maxTokens?: number
  ): Promise<string> {
    const windowId = this.generateWindowId(agentType, sessionId);
    const window = this.contextWindows.get(windowId);

    if (!window) {
      return '';
    }

    // Update access statistics
    window.lastAccessed = Date.now();
    window.accessCount++;

    // Apply size limit if specified
    let content = window.content;
    if (maxTokens && this.estimateTokens(content) > maxTokens) {
      content = this.truncateContent(content, maxTokens);
    }

    return content;
  }

  /**
   * Add content to context window
   */
  async addToContext(
    agentType: AgentType,
    sessionId: string,
    content: string,
    priority: ContextWindow['priority'] = 'medium',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const windowId = this.generateWindowId(agentType, sessionId);
    const existingWindow = this.contextWindows.get(windowId);

    const newContent = existingWindow
      ? this.mergeContent(existingWindow.content, content, priority)
      : content;

    const tokens = this.estimateTokens(newContent);

    // Create or update window
    const window: ContextWindow = {
      id: windowId,
      agentType,
      sessionId,
      content: newContent,
      tokens,
      priority,
      createdAt: existingWindow?.createdAt || Date.now(),
      lastAccessed: Date.now(),
      accessCount: existingWindow?.accessCount || 0,
      expiresAt: Date.now() + this.config.cacheTTL,
      metadata: { ...existingWindow?.metadata, ...metadata },
    };

    this.contextWindows.set(windowId, window);

    // Auto-optimize if needed
    if (tokens > this.config.maxTokens * this.config.compressionThreshold) {
      await this.optimizeContext(agentType, sessionId, newContent, metadata);
    }
  }

  /**
   * Clear context window
   */
  clearContext(agentType: AgentType, sessionId: string): void {
    const windowId = this.generateWindowId(agentType, sessionId);
    this.contextWindows.delete(windowId);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    activeWindows: number;
    cacheSize: number;
    cacheHitRate: number;
    averageCompressionRatio: number;
    totalOptimizations: number;
    averageOptimizationScore: number;
  } {
    const activeWindows = this.contextWindows.size;
    const cacheSize = this.contextCache.size;

    // Calculate cache hit rate
    const totalCacheAccess = Array.from(this.contextCache.values())
      .reduce((sum, cache) => sum + cache.hitCount, 0);
    const cacheHitRate = cacheSize > 0 ? (totalCacheAccess - cacheSize) / totalCacheAccess : 0;

    // Calculate average compression ratio
    const recentOptimizations = this.optimizationHistory.slice(-100);
    const averageCompressionRatio = recentOptimizations.length > 0
      ? recentOptimizations.reduce((sum, opt) => sum + opt.compression.compressionRatio, 0) / recentOptimizations.length
      : 0;

    // Calculate average optimization score
    const averageOptimizationScore = recentOptimizations.length > 0
      ? recentOptimizations.reduce((sum, opt) => sum + opt.optimizationScore, 0) / recentOptimizations.length
      : 0;

    return {
      activeWindows,
      cacheSize,
      cacheHitRate,
      averageCompressionRatio,
      totalOptimizations: this.optimizationHistory.length,
      averageOptimizationScore,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Perform context optimization
   */
  private async performOptimization(
    agentType: AgentType,
    content: string,
    originalSize: number
  ): Promise<ContextOptimization> {
    const windowId = this.generateWindowId(agentType, 'optimization');

    // Determine optimization strategy
    const strategy = this.determineOptimizationStrategy(originalSize, agentType);

    let optimizedContent: string;
    let discardedContent: string[] = [];
    let compression: ContextCompression;

    switch (strategy) {
      case 'truncation':
        ({ optimizedContent, discardedContent } = this.truncateByPriority(content));
        compression = this.createCompression(originalSize, this.estimateTokens(optimizedContent), 'truncation', 'medium');
        break;

      case 'summarization':
        ({ optimizedContent, discardedContent } = this.summarizeContent(content, agentType));
        compression = this.createCompression(originalSize, this.estimateTokens(optimizedContent), 'summarization', 'high');
        break;

      case 'semantic':
        ({ optimizedContent, discardedContent } = this.semanticCompression(content, agentType));
        compression = this.createCompression(originalSize, this.estimateTokens(optimizedContent), 'semantic', 'high');
        break;

      case 'hybrid':
        ({ optimizedContent, discardedContent } = this.hybridOptimization(content, agentType));
        compression = this.createCompression(originalSize, this.estimateTokens(optimizedContent), 'hybrid', 'high');
        break;

      default:
        optimizedContent = content;
        discardedContent = [];
        compression = this.createCompression(originalSize, originalSize, 'none', 'high');
    }

    const optimizationScore = this.calculateOptimizationScore(compression, strategy);

    return {
      windowId,
      originalSize,
      optimizedSize: compression.compressedTokens,
      compression,
      retainedContent: optimizedContent,
      discardedContent,
      optimizationScore,
      recommendations: this.generateRecommendations(compression, strategy),
    };
  }

  /**
   * Determine optimization strategy
   */
  private determineOptimizationStrategy(originalSize: number, agentType: AgentType): ContextCompression['compressionMethod'] {
    const sizeRatio = originalSize / this.config.maxTokens;

    // Critical agents get better optimization
    const isCriticalAgent = ['integrity', 'groundtruth', 'coordinator'].includes(agentType);

    if (sizeRatio > 0.9) {
      return isCriticalAgent ? 'semantic' : 'truncation';
    } else if (sizeRatio > 0.7) {
      return isCriticalAgent ? 'hybrid' : 'summarization';
    } else if (sizeRatio > 0.5) {
      return 'semantic';
    }

    return 'none';
  }

  /**
   * Truncate content by priority
   */
  private truncateByPriority(content: string): { optimizedContent: string; discardedContent: string[] } {
    const sections = this.splitContentByPriority(content);
    let optimizedContent = '';
    let discardedContent: string[] = [];
    let currentTokens = 0;

    // Keep content until we reach the limit
    for (const section of sections) {
      const sectionTokens = this.estimateTokens(section.content);

      if (currentTokens + sectionTokens <= this.config.maxTokens) {
        optimizedContent += section.content + '\n';
        currentTokens += sectionTokens;
      } else {
        discardedContent.push(section.content);
      }
    }

    return { optimizedContent, discardedContent };
  }

  /**
   * Summarize content
   */
  private summarizeContent(content: string, agentType: AgentType): { optimizedContent: string; discardedContent: string[] } {
    // Simple summarization - in production, this would use an LLM
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    const targetSentences = Math.max(1, Math.floor(sentences.length * 0.4));

    const optimizedContent = sentences.slice(0, targetSentences).join('. ') + '.';
    const discardedContent = sentences.slice(targetSentences).map(s => s + '.');

    return { optimizedContent, discardedContent };
  }

  /**
   * Semantic compression
   */
  private semanticCompression(content: string, agentType: AgentType): { optimizedContent: string; discardedContent: string[] } {
    // Remove redundant information and keep semantically unique content
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const uniqueLines = this.removeSemanticDuplicates(lines);

    const optimizedContent = uniqueLines.join('\n');
    const discardedContent = lines.filter(line => !uniqueLines.includes(line));

    return { optimizedContent, discardedContent };
  }

  /**
   * Hybrid optimization
   */
  private hybridOptimization(content: string, agentType: AgentType): { optimizedContent: string; discardedContent: string[] } {
    // First remove semantic duplicates
    const { optimizedContent: semanticContent, discardedContent: semanticDiscarded } = this.semanticCompression(content, agentType);

    // Then truncate if still too large
    const { optimizedContent, discardedContent: truncationDiscarded } = this.truncateByPriority(semanticContent);

    return {
      optimizedContent,
      discardedContent: [...semanticDiscarded, ...truncationDiscarded],
    };
  }

  /**
   * Split content by priority sections
   */
  private splitContentByPriority(content: string): Array<{ content: string; priority: ContextWindow['priority'] }> {
    const sections: Array<{ content: string; priority: ContextWindow['priority'] }> = [];

    // Simple heuristic-based priority assignment
    const lines = content.split('\n');
    let currentSection = '';
    let currentPriority: ContextWindow['priority'] = 'medium';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Detect priority indicators
      if (trimmedLine.startsWith('CRITICAL:') || trimmedLine.startsWith('IMPORTANT:')) {
        if (currentSection) {
          sections.push({ content: currentSection, priority: currentPriority });
        }
        currentSection = line + '\n';
        currentPriority = 'critical';
      } else if (trimmedLine.startsWith('NOTE:') || trimmedLine.startsWith('INFO:')) {
        if (currentSection) {
          sections.push({ content: currentSection, priority: currentPriority });
        }
        currentSection = line + '\n';
        currentPriority = 'high';
      } else if (trimmedLine.startsWith('DEBUG:') || trimmedLine.startsWith('LOG:')) {
        if (currentSection) {
          sections.push({ content: currentSection, priority: currentPriority });
        }
        currentSection = line + '\n';
        currentPriority = 'low';
      } else {
        currentSection += line + '\n';
      }
    }

    if (currentSection) {
      sections.push({ content: currentSection, priority: currentPriority });
    }

    return sections;
  }

  /**
   * Remove semantic duplicates
   */
  private removeSemanticDuplicates(lines: string[]): string[] {
    const uniqueLines: string[] = [];
    const seenHashes = new Set<string>();

    for (const line of lines) {
      const hash = this.generateSemanticHash(line);

      if (!seenHashes.has(hash)) {
        uniqueLines.push(line);
        seenHashes.add(hash);
      }
    }

    return uniqueLines;
  }

  /**
   * Generate semantic hash for content
   */
  private generateSemanticHash(content: string): string {
    // Simple hash generation - in production, use proper semantic analysis
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    let hash = 0;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString();
  }

  /**
   * Merge content with priority consideration
   */
  private mergeContent(existingContent: string, newContent: string, priority: ContextWindow['priority']): string {
    // Simple concatenation - in production, use intelligent merging
    return existingContent + '\n\n' + newContent;
  }

  /**
   * Truncate content to fit token limit
   */
  private truncateContent(content: string, maxTokens: number): string {
    const words = content.split(' ');
    let truncatedContent = '';
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = this.estimateTokens(word);

      if (currentTokens + wordTokens <= maxTokens) {
        truncatedContent += (truncatedContent ? ' ' : '') + word;
        currentTokens += wordTokens;
      } else {
        break;
      }
    }

    return truncatedContent;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Create compression metadata
   */
  private createCompression(
    originalTokens: number,
    compressedTokens: number,
    method: ContextCompression['compressionMethod'],
    quality: ContextCompression['quality']
  ): ContextCompression {
    return {
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      compressionMethod: method,
      quality,
      processingTime: 0, // Would be measured in production
    };
  }

  /**
   * Calculate optimization score
   */
  private calculateOptimizationScore(compression: ContextCompression, strategy: string): number {
    let score = 0.5; // Base score

    // Compression ratio contribution
    score += (1 - compression.compressionRatio) * 0.3;

    // Quality contribution
    const qualityScores = { high: 0.2, medium: 0.1, low: 0.0 };
    score += qualityScores[compression.quality] || 0;

    // Strategy contribution
    const strategyScores = {
      semantic: 0.15,
      hybrid: 0.1,
      summarization: 0.05,
      truncation: 0.0,
      none: 0.2,
    };
    score += strategyScores[strategy as keyof typeof strategyScores] || 0;

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(compression: ContextCompression, strategy: string): string[] {
    const recommendations: string[] = [];

    if (compression.compressionRatio > 0.8) {
      recommendations.push('Consider splitting into multiple smaller contexts');
    }

    if (compression.quality === 'low') {
      recommendations.push('Quality may be impacted - review critical information');
    }

    if (strategy === 'truncation') {
      recommendations.push('Consider summarization for better content preservation');
    }

    if (compression.processingTime > 100) {
      recommendations.push('Optimization took significant time - consider caching');
    }

    return recommendations;
  }

  /**
   * Create optimization result
   */
  private createOptimizationResult(
    windowId: string,
    originalSize: number,
    optimizedSize: number,
    retainedContent: string,
    discardedContent: string[],
    score: number
  ): ContextOptimization {
    return {
      windowId,
      originalSize,
      optimizedSize,
      compression: this.createCompression(originalSize, optimizedSize, 'none', 'high'),
      retainedContent,
      discardedContent,
      optimizationScore: score,
      recommendations: [],
    };
  }

  /**
   * Cache management methods
   */
  private getFromCache(content: string, agentType: AgentType): ContextCache | null {
    const semanticHash = this.generateSemanticHash(content);
    const key = `${agentType}:${semanticHash}`;

    const cached = this.contextCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.createdAt > cached.ttl) {
      this.contextCache.delete(key);
      return null;
    }

    return cached;
  }

  private cacheContent(content: string, agentType: AgentType, optimization: ContextOptimization): void {
    const semanticHash = this.generateSemanticHash(content);
    const key = `${agentType}:${semanticHash}`;

    // Check if we need to clean up before adding new entry
    if (this.contextCache.size >= this.maxCacheSize) {
      this.performAdaptiveCleanup(10); // Clean 10% to make room
    }

    this.contextCache.set(key, {
      key,
      content,
      tokens: optimization.optimizedSize,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      ttl: this.config.cacheTTL,
      agentTypes: [agentType],
      semanticHash,
    });
  }

  private addToHistory(optimization: ContextOptimization): void {
    this.optimizationHistory.push(optimization);

    // Trim history if too large
    if (this.optimizationHistory.length > this.MAX_HISTORY_SIZE) {
      this.optimizationHistory = this.optimizationHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Generate window ID
   */
  private generateWindowId(agentType: AgentType, sessionId: string): string {
    return `${agentType}:${sessionId}`;
  }

  /**
   * Handle memory pressure changes
   */
  onPressureChange(pressure: MemoryPressure, stats: any): void {
    const newCacheSize = this.memoryMonitor.getRecommendedCacheSize();
    const cleanupPercentage = this.memoryMonitor.getCleanupPercentage();

    logger.info('Memory pressure detected, adjusting cache', {
      pressure,
      currentCacheSize: this.contextCache.size,
      newCacheSize,
      cleanupPercentage,
      heapUsedPercentage: stats.heapUsedPercentage,
    });

    // Update cache size
    this.maxCacheSize = newCacheSize;

    // Perform cleanup if needed
    if (cleanupPercentage > 0) {
      this.performAdaptiveCleanup(cleanupPercentage);
    }

    // Trigger garbage collection if needed
    if (this.memoryMonitor.shouldTriggerGC()) {
      this.memoryMonitor.triggerGC();
    }
  }

  /**
   * Perform adaptive cache cleanup based on memory pressure
   */
  private performAdaptiveCleanup(cleanupPercentage: number): void {
    const entriesToRemove = Math.floor(this.contextCache.size * (cleanupPercentage / 100));

    if (entriesToRemove > 0) {
      // Sort by last accessed time (oldest first) and remove entries
      const sortedEntries = Array.from(this.contextCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const toRemove = sortedEntries.slice(0, entriesToRemove);

      toRemove.forEach(([key]) => {
        this.contextCache.delete(key);
      });

      logger.info('Adaptive cache cleanup completed', {
        entriesRemoved: toRemove.length,
        remainingEntries: this.contextCache.size,
        cleanupPercentage,
      });
    }
  }
  clearExpiredContexts(): void {
    const now = Date.now();
    let clearedCount = 0;

    // Clear expired windows
    for (const [key, window] of this.contextWindows.entries()) {
      if (window.expiresAt < now) {
        this.contextWindows.delete(key);
        clearedCount++;
      }
    }

    // Clear expired cache entries
    for (const [key, cache] of this.contextCache.entries()) {
      if (cache.createdAt + cache.ttl < now) {
        this.contextCache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.debug('Expired contexts cleared', { clearedCount });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let contextOptimizerInstance: ContextOptimizer | null = null;

export function getContextOptimizer(config?: Partial<OptimizationConfig>): ContextOptimizer {
  if (!contextOptimizerInstance) {
    contextOptimizerInstance = new ContextOptimizer(config);
  }
  return contextOptimizerInstance;
}

export function resetContextOptimizer(): void {
  contextOptimizerInstance = null;
}
