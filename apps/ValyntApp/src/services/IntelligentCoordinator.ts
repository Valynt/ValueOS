/**
 * Intelligent Coordinator - Enhanced Coordination Intelligence
 *
 * Optimizes agent routing and execution while preserving security boundaries
 * and maintaining the existing 15-agent architecture.
 */

import { randomUUID } from 'crypto';

import { logger } from '../lib/logger';

import { AgentType } from './agent-types';
import { getUnifiedAgentAPI } from './UnifiedAgentAPI';

// ============================================================================
// Types
// ============================================================================

export interface AgentRequest {
  agent: AgentType;
  query: string;
  context?: Record<string, any>;
  parameters?: Record<string, any>;
  sessionId?: string;
  userId?: string;
  traceId?: string;
}

export interface RequestAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  domains: AgentDomain[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  parallelizable: boolean;
  estimatedDuration: number;
  tokenEstimate: number;
  confidence: number;
}

export interface AgentDomain {
  type: 'research' | 'financial' | 'communication' | 'validation' | 'coordination';
  agents: AgentType[];
  dataRequirements: string[];
  securityClearance: string[];
}

export interface ExecutionPlan {
  planId: string;
  strategy: 'direct' | 'pipeline' | 'parallel' | 'dag';
  agents: AgentType[];
  executionOrder: string[][];
  contextSharing: ContextSharingPlan;
  estimatedDuration: number;
  costEstimate: number;
  confidence: number;
  reasoning: string;
}

export interface ContextSharingPlan {
  sharedContext: string[];
  agentSpecificContext: Record<AgentType, string[]>;
  securityValidations: SecurityValidation[];
}

export interface SecurityValidation {
  agent: AgentType;
  requiredPermissions: string[];
  dataAccessLevel: string;
  complianceChecks: string[];
}

export interface RoutingCache {
  key: string;
  plan: ExecutionPlan;
  createdAt: number;
  ttl: number;
  hitCount: number;
}

// ============================================================================
// Intelligent Coordinator Implementation
// ============================================================================

export class IntelligentCoordinator {
  private routingCache: Map<string, RoutingCache> = new Map();
  private contextCache: Map<string, any> = new Map();
  private agentAPI = getUnifiedAgentAPI();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Route request with intelligent optimization
   */
  async routeRequest(request: AgentRequest): Promise<ExecutionPlan> {
    const startTime = Date.now();
    const traceId = request.traceId || randomUUID();

    logger.info('Intelligent routing started', {
      traceId,
      agent: request.agent,
      query: request.query.substring(0, 100),
    });

    try {
      // Analyze request complexity and requirements
      const analysis = await this.analyzeRequest(request);

      // Check cache for similar requests
      const cacheKey = this.generateCacheKey(request, analysis);
      const cachedPlan = this.getFromCache(cacheKey);

      if (cachedPlan && this.isCacheValid(cachedPlan)) {
        cachedPlan.hitCount++;
        logger.info('Cache hit for intelligent routing', {
          traceId,
          cacheKey,
          hitCount: cachedPlan.hitCount,
        });
        return this.adaptCachedPlan(cachedPlan.plan, request);
      }

      // Generate optimal execution plan
      const plan = await this.generateExecutionPlan(request, analysis);

      // Cache the plan
      this.cachePlan(cacheKey, plan);

      const duration = Date.now() - startTime;
      logger.info('Intelligent routing completed', {
        traceId,
        planId: plan.planId,
        strategy: plan.strategy,
        agentCount: plan.agents.length,
        duration,
      });

      return plan;
    } catch (error) {
      logger.error('Intelligent routing failed', error instanceof Error ? error : undefined, {
        traceId,
        agent: request.agent,
      });
      throw error;
    }
  }

  /**
   * Analyze request to determine optimal routing strategy
   */
  private async analyzeRequest(request: AgentRequest): Promise<RequestAnalysis> {
    const query = request.query.toLowerCase();
    const context = request.context || {};

    // Determine complexity based on query characteristics
    const complexity = this.assessComplexity(query, context);

    // Identify required domains
    const domains = this.identifyDomains(query, context);

    // Assess security requirements
    const securityLevel = this.assessSecurityLevel(query, context, domains);

    // Determine parallelizability
    const parallelizable = this.canParallelize(domains, complexity);

    // Estimate duration and token usage
    const estimatedDuration = this.estimateDuration(complexity, domains.length);
    const tokenEstimate = this.estimateTokens(query, complexity);

    // Calculate confidence in analysis
    const confidence = this.calculateConfidence(complexity, domains, query);

    return {
      complexity,
      domains,
      securityLevel,
      parallelizable,
      estimatedDuration,
      tokenEstimate,
      confidence,
    };
  }

  /**
   * Assess request complexity
   */
  private assessComplexity(query: string, context: Record<string, any>): RequestAnalysis['complexity'] {
    const indicators = {
      simple: ['what is', 'how to', 'explain', 'define', 'list'],
      moderate: ['analyze', 'compare', 'evaluate', 'recommend', 'suggest'],
      complex: ['optimize', 'design', 'implement', 'integrate', 'transform'],
      enterprise: ['enterprise', 'organization', 'system-wide', 'compliance', 'audit'],
    };

    for (const [level, keywords] of Object.entries(indicators)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return level as RequestAnalysis['complexity'];
      }
    }

    // Default based on query length and context complexity
    if (query.length < 100 && Object.keys(context).length < 3) return 'simple';
    if (query.length < 300 && Object.keys(context).length < 10) return 'moderate';
    if (query.length < 500) return 'complex';
    return 'enterprise';
  }

  /**
   * Identify required domains based on query content
   */
  private identifyDomains(query: string, context: Record<string, any>): AgentDomain[] {
    const domains: AgentDomain[] = [];

    // Research domain
    if (this.matchesKeywords(query, ['research', 'benchmark', 'market', 'competitor', 'industry'])) {
      domains.push({
        type: 'research',
        agents: ['research', 'benchmark', 'company-intelligence'],
        dataRequirements: ['market_data', 'competitor_data', 'industry_reports'],
        securityClearance: ['market_research', 'competitive_intelligence'],
      });
    }

    // Financial domain
    if (this.matchesKeywords(query, ['roi', 'financial', 'cost', 'value', 'investment', 'profit'])) {
      domains.push({
        type: 'financial',
        agents: ['financial-modeling', 'value-mapping', 'opportunity', 'target'],
        dataRequirements: ['financial_statements', 'cost_data', 'value_metrics'],
        securityClearance: ['financial_analysis', 'value_modeling'],
      });
    }

    // Communication domain
    if (this.matchesKeywords(query, ['report', 'presentation', 'summary', 'communicate', 'narrative'])) {
      domains.push({
        type: 'communication',
        agents: ['narrative', 'communicator'],
        dataRequirements: ['templates', 'brand_guidelines', 'stakeholder_info'],
        securityClearance: ['content_creation', 'external_communication'],
      });
    }

    // Validation domain
    if (this.matchesKeywords(query, ['validate', 'verify', 'compliance', 'audit', 'check'])) {
      domains.push({
        type: 'validation',
        agents: ['integrity', 'groundtruth'],
        dataRequirements: ['compliance_rules', 'audit_logs', 'validation_criteria'],
        securityClearance: ['compliance_audit', 'data_validation'],
      });
    }

    // Coordination domain (always present for multi-agent workflows)
    if (domains.length > 1) {
      domains.push({
        type: 'coordination',
        agents: ['coordinator'],
        dataRequirements: ['workflow_state', 'agent_status', 'execution_context'],
        securityClearance: ['workflow_orchestration'],
      });
    }

    return domains;
  }

  /**
   * Assess security level required
   */
  private assessSecurityLevel(
    query: string,
    context: Record<string, any>,
    domains: AgentDomain[]
  ): RequestAnalysis['securityLevel'] {
    // Check for sensitive data indicators
    const sensitiveKeywords = ['confidential', 'proprietary', 'sensitive', 'classified', 'restricted'];
    const hasSensitiveData = sensitiveKeywords.some(keyword => query.includes(keyword)) ||
                            Object.values(context).some(value =>
                              typeof value === 'string' && sensitiveKeywords.some(k => value.includes(k))
                            );

    // Check for compliance requirements
    const complianceKeywords = ['compliance', 'audit', 'regulation', 'sox', 'hipaa', 'gdpr'];
    const hasCompliance = complianceKeywords.some(keyword => query.includes(keyword));

    // Check for financial data
    const hasFinancial = domains.some(d => d.type === 'financial');

    // Determine security level
    if (hasSensitiveData && hasCompliance) return 'critical';
    if (hasSensitiveData || hasCompliance) return 'high';
    if (hasFinancial) return 'medium';
    return 'low';
  }

  /**
   * Determine if tasks can be parallelized
   */
  private canParallelize(domains: AgentDomain[], complexity: RequestAnalysis['complexity']): boolean {
    // Simple tasks are usually single-agent
    if (complexity === 'simple') return false;

    // Check if domains have independent data requirements
    const domainTypes = domains.map(d => d.type);
    const independentDomains = ['research', 'financial'];

    return domainTypes.some(type => independentDomains.includes(type)) &&
           domainTypes.length > 1;
  }

  /**
   * Estimate execution duration in seconds
   */
  private estimateDuration(complexity: RequestAnalysis['complexity'], domainCount: number): number {
    const baseDurations = {
      simple: 5,
      moderate: 15,
      complex: 45,
      enterprise: 120,
    };

    const baseDuration = baseDurations[complexity];
    const domainMultiplier = Math.max(1, domainCount * 0.3);

    return Math.ceil(baseDuration * domainMultiplier);
  }

  /**
   * Estimate token consumption
   */
  private estimateTokens(query: string, complexity: RequestAnalysis['complexity']): number {
    const baseTokens = query.length * 1.3; // Rough estimate
    const complexityMultipliers = {
      simple: 1,
      moderate: 2.5,
      complex: 5,
      enterprise: 10,
    };

    return Math.ceil(baseTokens * complexityMultipliers[complexity]);
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateConfidence(
    complexity: RequestAnalysis['complexity'],
    domains: AgentDomain[],
    query: string
  ): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on query clarity
    if (query.length > 50) confidence += 0.1;
    if (query.length > 200) confidence += 0.1;

    // Adjust based on domain clarity
    if (domains.length > 0) confidence += 0.05;
    if (domains.length > 2) confidence += 0.05;

    // Adjust based on complexity
    if (complexity === 'simple') confidence += 0.1;
    if (complexity === 'enterprise') confidence -= 0.1;

    return Math.min(confidence, 0.95);
  }

  /**
   * Generate optimal execution plan
   */
  private async generateExecutionPlan(
    request: AgentRequest,
    analysis: RequestAnalysis
  ): Promise<ExecutionPlan> {
    const planId = `plan-${Date.now()}-${randomUUID().substring(0, 8)}`;

    // Determine execution strategy
    const strategy = this.determineStrategy(analysis);

    // Select agents based on domains and strategy
    const agents = this.selectAgents(analysis, strategy);

    // Determine execution order
    const executionOrder = this.determineExecutionOrder(agents, strategy, analysis);

    // Plan context sharing
    const contextSharing = this.planContextSharing(agents, analysis);

    // Estimate costs
    const costEstimate = this.estimateCost(agents, analysis);

    // Generate reasoning
    const reasoning = this.generateReasoning(strategy, agents, analysis);

    return {
      planId,
      strategy,
      agents,
      executionOrder,
      contextSharing,
      estimatedDuration: analysis.estimatedDuration,
      costEstimate,
      confidence: analysis.confidence,
      reasoning,
    };
  }

  /**
   * Determine execution strategy
   */
  private determineStrategy(analysis: RequestAnalysis): ExecutionPlan['strategy'] {
    if (analysis.complexity === 'simple') return 'direct';
    if (analysis.parallelizable && analysis.domains.length <= 3) return 'parallel';
    if (analysis.domains.length <= 2) return 'pipeline';
    return 'dag';
  }

  /**
   * Select agents for execution
   */
  private selectAgents(analysis: RequestAnalysis, strategy: ExecutionPlan['strategy']): AgentType[] {
    const agents: AgentType[] = [];

    // Always include coordinator for multi-agent workflows
    if (strategy !== 'direct') {
      agents.push('coordinator');
    }

    // Add agents based on domains
    analysis.domains.forEach(domain => {
      domain.agents.forEach(agent => {
        if (!agents.includes(agent)) {
          agents.push(agent);
        }
      });
    });

    // Add integrity for complex workflows
    if (analysis.securityLevel === 'high' || analysis.securityLevel === 'critical') {
      if (!agents.includes('integrity')) {
        agents.push('integrity');
      }
    }

    // Add communicator for final output
    if (strategy !== 'direct' && !agents.includes('communicator')) {
      agents.push('communicator');
    }

    return agents;
  }

  /**
   * Determine execution order
   */
  private determineExecutionOrder(
    agents: AgentType[],
    strategy: ExecutionPlan['strategy'],
    analysis: RequestAnalysis
  ): string[][] {
    switch (strategy) {
      case 'direct':
        return [agents];

      case 'pipeline':
        return agents.map(agent => [agent]);

      case 'parallel':
        // Group agents that can run in parallel
        const researchAgents = agents.filter(a => ['research', 'benchmark', 'company-intelligence'].includes(a));
        const analysisAgents = agents.filter(a => ['opportunity', 'target', 'financial-modeling'].includes(a));
        const outputAgents = agents.filter(a => ['communicator', 'narrative'].includes(a));

        const order: string[][] = [];
        if (researchAgents.length > 0) order.push(researchAgents);
        if (analysisAgents.length > 0) order.push(analysisAgents);
        if (outputAgents.length > 0) order.push(outputAgents);

        return order.length > 0 ? order : [agents];

      case 'dag':
        // Complex DAG execution - simplified for this implementation
        return agents.map(agent => [agent]);

      default:
        return [agents];
    }
  }

  /**
   * Plan context sharing between agents
   */
  private planContextSharing(agents: AgentType[], analysis: RequestAnalysis): ContextSharingPlan {
    const sharedContext: string[] = ['sessionId', 'userId', 'organizationId', 'traceId'];

    const agentSpecificContext: Record<AgentType, string[]> = {
      coordinator: ['workflowState', 'executionPlan', 'agentStatus'],
      opportunity: ['marketData', 'stakeholderInfo', 'constraints'],
      target: ['opportunityData', 'financialBaseline', 'targets'],
      realization: ['targetData', 'kpiData', 'varianceData'],
      expansion: ['realizationData', 'growthOpportunities', 'constraints'],
      integrity: ['allAgentOutputs', 'complianceRules', 'auditRequirements'],
      research: ['researchQuery', 'dataSources', 'timeRange'],
      benchmark: ['industryData', 'peerData', 'metrics'],
      'company-intelligence': ['companyData', 'financialData', 'operationalData'],
      'financial-modeling': ['financialInputs', 'assumptions', 'scenarios'],
      'value-mapping': ['valueDrivers', 'metrics', 'outcomes'],
      'system-mapper': ['systemData', 'architectureInfo', 'dependencies'],
      'intervention-designer': ['systemData', 'interventionRequirements', 'constraints'],
      'outcome-engineer': ['outcomeData', 'metrics', 'requirements'],
      'value-eval': ['valueData', 'evaluationCriteria', 'metrics'],
      communicator: ['allAgentOutputs', 'audienceInfo', 'formatRequirements'],
      narrative: ['contentData', 'narrativeStyle', 'keyMessages'],
      groundtruth: ['claimsData', 'sources', 'verificationCriteria'],
    };

    const securityValidations: SecurityValidation[] = agents.map(agent => ({
      agent,
      requiredPermissions: this.getRequiredPermissions(agent, analysis),
      dataAccessLevel: this.getDataAccessLevel(agent, analysis),
      complianceChecks: this.getComplianceChecks(agent, analysis),
    }));

    return {
      sharedContext,
      agentSpecificContext,
      securityValidations,
    };
  }

  /**
   * Get required permissions for an agent
   */
  private getRequiredPermissions(agent: AgentType, analysis: RequestAnalysis): string[] {
    const basePermissions = {
      coordinator: ['workflow.execute', 'agents.coordinate'],
      opportunity: ['data.read', 'opportunity.execute'],
      target: ['data.read', 'target.execute'],
      realization: ['data.read', 'realization.execute'],
      expansion: ['data.read', 'expansion.execute'],
      integrity: ['data.read', 'integrity.execute', 'audit.read'],
      research: ['data.read', 'research.execute'],
      benchmark: ['data.read', 'benchmark.execute'],
      'company-intelligence': ['data.read', 'company-intelligence.execute'],
      'financial-modeling': ['data.read', 'financial-modeling.execute'],
      'value-mapping': ['data.read', 'value-mapping.execute'],
      'system-mapper': ['data.read', 'system-mapper.execute'],
      'intervention-designer': ['data.read', 'intervention-designer.execute'],
      'outcome-engineer': ['data.read', 'outcome-engineer.execute'],
      'value-eval': ['data.read', 'value-eval.execute'],
      communicator: ['data.read', 'communicator.execute'],
      narrative: ['data.read', 'narrative.execute'],
      groundtruth: ['data.read', 'groundtruth.execute'],
    };

    const permissions = basePermissions[agent] || [];

    // Add security-level specific permissions
    if (analysis.securityLevel === 'high' || analysis.securityLevel === 'critical') {
      permissions.push('security.elevated');
    }

    return permissions;
  }

  /**
   * Get data access level for an agent
   */
  private getDataAccessLevel(agent: AgentType, analysis: RequestAnalysis): string {
    const baseLevels = {
      coordinator: 'workflow',
      opportunity: 'business',
      target: 'financial',
      realization: 'operational',
      expansion: 'strategic',
      integrity: 'audit',
      research: 'external',
      benchmark: 'industry',
      'company-intelligence': 'confidential',
      'financial-modeling': 'financial',
      'value-mapping': 'business',
      'system-mapper': 'system',
      'intervention-designer': 'design',
      'outcome-engineer': 'outcome',
      'value-eval': 'evaluation',
      communicator: 'public',
      narrative: 'public',
      groundtruth: 'verification',
    };

    return baseLevels[agent] || 'standard';
  }

  /**
   * Get compliance checks for an agent
   */
  private getComplianceChecks(agent: AgentType, analysis: RequestAnalysis): string[] {
    const checks = [];

    // Base compliance checks
    if (['financial-modeling', 'target'].includes(agent)) {
      checks.push('sox_compliance', 'financial_accuracy');
    }

    if (['integrity', 'groundtruth'].includes(agent)) {
      checks.push('audit_trail', 'data_integrity');
    }

    if (['company-intelligence'].includes(agent)) {
      checks.push('data_privacy', 'confidentiality');
    }

    // Security level specific checks
    if (analysis.securityLevel === 'critical') {
      checks.push('enhanced_audit', 'access_logging');
    }

    return checks;
  }

  /**
   * Estimate execution cost
   */
  private estimateCost(agents: AgentType[], analysis: RequestAnalysis): number {
    const agentCosts = {
      coordinator: 0.05,
      opportunity: 0.15,
      target: 0.20,
      realization: 0.10,
      expansion: 0.15,
      integrity: 0.08,
      research: 0.25,
      benchmark: 0.20,
      'company-intelligence': 0.18,
      'financial-modeling': 0.22,
      'value-mapping': 0.12,
      'system-mapper': 0.15,
      'intervention-designer': 0.18,
      'outcome-engineer': 0.16,
      'value-eval': 0.12,
      communicator: 0.05,
      narrative: 0.08,
      groundtruth: 0.10,
    };

    const baseCost = agents.reduce((total, agent) => total + (agentCosts[agent] || 0.10), 0);

    // Apply complexity multiplier
    const complexityMultiplier = {
      simple: 1,
      moderate: 1.2,
      complex: 1.5,
      enterprise: 2.0,
    };

    return baseCost * complexityMultiplier[analysis.complexity];
  }

  /**
   * Generate reasoning for the execution plan
   */
  private generateReasoning(
    strategy: ExecutionPlan['strategy'],
    agents: AgentType[],
    analysis: RequestAnalysis
  ): string {
    const strategyDescriptions = {
      direct: 'Single agent execution for simple request',
      pipeline: 'Sequential agent execution for moderate complexity',
      parallel: 'Parallel execution where possible for efficiency',
      dag: 'Complex workflow with dependencies and optimizations',
    };

    return `Strategy: ${strategyDescriptions[strategy]}. ` +
           `Selected ${agents.length} agents based on ${analysis.domains.length} identified domains. ` +
           `Estimated duration: ${analysis.estimatedDuration}s, ` +
           `Security level: ${analysis.securityLevel}, ` +
           `Confidence: ${(analysis.confidence * 100).toFixed(1)}%`;
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(request: AgentRequest, analysis: RequestAnalysis): string {
    const keyData = {
      query: request.query.substring(0, 100), // Normalize query
      complexity: analysis.complexity,
      domains: analysis.domains.map(d => d.type).sort(),
      securityLevel: analysis.securityLevel,
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private getFromCache(key: string): RoutingCache | null {
    return this.routingCache.get(key) || null;
  }

  private isCacheValid(cache: RoutingCache): boolean {
    return (Date.now() - cache.createdAt) < cache.ttl;
  }

  private cachePlan(key: string, plan: ExecutionPlan): void {
    // Remove oldest entry if cache is full
    if (this.routingCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.routingCache.keys().next().value;
      if (oldestKey) {
        this.routingCache.delete(oldestKey);
      }
    }

    this.routingCache.set(key, {
      key,
      plan,
      createdAt: Date.now(),
      ttl: this.CACHE_TTL,
      hitCount: 0,
    });
  }

  private adaptCachedPlan(cachedPlan: ExecutionPlan, request: AgentRequest): ExecutionPlan {
    // Create a new plan with updated trace ID and session info
    return {
      ...cachedPlan,
      planId: `plan-${Date.now()}-${randomUUID().substring(0, 8)}`,
      reasoning: cachedPlan.reasoning + ' (adapted from cache)',
    };
  }

  /**
   * Utility methods
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entries = Array.from(this.routingCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const totalRequests = totalHits + entries.length; // hits + misses

    return {
      size: this.routingCache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.createdAt)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.createdAt)) : null,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.routingCache.clear();
    this.contextCache.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let intelligentCoordinatorInstance: IntelligentCoordinator | null = null;

export function getIntelligentCoordinator(): IntelligentCoordinator {
  if (!intelligentCoordinatorInstance) {
    intelligentCoordinatorInstance = new IntelligentCoordinator();
  }
  return intelligentCoordinatorInstance;
}

export function resetIntelligentCoordinator(): void {
  intelligentCoordinatorInstance = null;
}
