import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway, LLMProvider } from './LLMGateway';
import { llmConfig } from '../../config/llm';
import { MemorySystem } from './MemorySystem';
import { AuditLogger } from './AuditLogger';
import { ReflectionEngine } from './ReflectionEngine';
import { CompanyIntelligenceAgent } from './agents/CompanyIntelligenceAgent';
import { ValueMappingAgent } from './agents/ValueMappingAgent';
import { FinancialModelingAgent } from './agents/FinancialModelingAgent';
import { Agent, Workflow, WorkflowExecution, AgentFabricResult } from './types';
import { AgentCircuitBreaker, SafetyLimits, SafetyError } from './CircuitBreaker';
import { logger } from '../logger';
import { parseLLMOutputStrict, CommonSchemas } from '../../utils/safeJsonParser';
import { featureFlags } from '../../config/featureFlags';
import { z } from 'zod';

export class AgentFabric {
  private supabase: SupabaseClient;
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private auditLogger: AuditLogger;
  private reflectionEngine: ReflectionEngine;
  private safetyLimits: SafetyLimits;

  private agents: Map<string, Agent> = new Map();
  private workflow?: Workflow;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    llmProvider: LLMProvider = llmConfig.provider,
    safetyLimits?: Partial<SafetyLimits>
  ) {
    this.supabase = new SupabaseClient(supabaseUrl, supabaseKey);
    this.llmGateway = new LLMGateway(llmProvider, llmConfig.gatingEnabled);
    this.memorySystem = new MemorySystem(this.supabase, this.llmGateway);
    this.auditLogger = new AuditLogger(this.supabase);
    this.reflectionEngine = new ReflectionEngine(this.llmGateway);
    this.safetyLimits = {
      maxExecutionTime: 30000,
      maxLLMCalls: 20,
      maxRecursionDepth: 5,
      maxMemoryBytes: 100 * 1024 * 1024,
      enableDetailedTracking: false,
      ...safetyLimits,
    };
  }

  async initialize(): Promise<void> {
    const { data: agentsData, error: agentsError } = await this.supabase
      .from('agents')
      .select('*')
      .eq('status', 'active');

    if (agentsError) throw agentsError;

    for (const agent of agentsData || []) {
      this.agents.set(agent.name, agent);
    }

    const { data: workflowData, error: workflowError } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('name', 'value_case_generation')
      .eq('is_active', true)
      .single();

    if (workflowError) throw workflowError;
    this.workflow = workflowData;
  }

  async processUserInput(userInput: string, userId?: string): Promise<AgentFabricResult> {
    if (!this.workflow) {
      throw new Error('AgentFabric not initialized. Call initialize() first.');
    }

    const sessionId = await this.createSession(userId || 'anonymous-user');

    const executionId = await this.createExecution(sessionId);

    let currentIteration = 0;
    let qualityScore = 0;
    let valueCaseData: any = null;

    while (currentIteration < this.workflow.dag_definition.quality_check.max_iterations) {
      currentIteration++;

      await this.memorySystem.storeEpisodicMemory(
        sessionId,
        this.agents.get('orchestrator')!.id,
        `Starting iteration ${currentIteration}`,
        { iteration: currentIteration }
      );

      valueCaseData = await this.executeWorkflow(sessionId, executionId, userInput, valueCaseData);

      const assessment = await this.reflectionEngine.evaluateQuality(
        valueCaseData,
        this.workflow.dag_definition.quality_check.rubric,
        this.workflow.dag_definition.quality_check.threshold
      );

      qualityScore = assessment.total_score;

      await this.supabase
        .from('workflow_executions')
        .update({
          quality_score: qualityScore,
          iteration_count: currentIteration,
          dag_state: { assessment, data: valueCaseData }
        })
        .eq('id', executionId);

      if (!assessment.needs_refinement) {
        break;
      }

      if (currentIteration < this.workflow.dag_definition.quality_check.max_iterations) {
        await this.memorySystem.storeWorkingMemory(
          sessionId,
          this.agents.get('orchestrator')!.id,
          `Refinement needed. Score: ${qualityScore}/${assessment.max_score}. ${assessment.feedback}`,
          { assessment }
        );
      }
    }

    await this.supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    await this.supabase
      .from('agent_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    const totalTokens = await this.auditLogger.getTotalTokens(sessionId);
    const totalLatency = await this.auditLogger.getTotalLatency(sessionId);

    return {
      value_case_id: valueCaseData.value_case_id,
      company_profile: valueCaseData.company_profile,
      value_maps: valueCaseData.value_maps,
      kpi_hypotheses: valueCaseData.kpi_hypotheses,
      financial_model: valueCaseData.financial_model,
      assumptions: valueCaseData.assumptions,
      quality_score: qualityScore,
      execution_metadata: {
        execution_id: executionId,
        iteration_count: currentIteration,
        total_tokens: totalTokens,
        total_latency_ms: totalLatency,
        agent_contributions: {}
      }
    };
  }

  private async executeWorkflow(
    sessionId: string,
    executionId: string,
    userInput: string,
    previousData: any
  ): Promise<any> {
    const valueCaseId = crypto.randomUUID();

    const { data: valueCaseData } = await this.supabase
      .from('value_cases')
      .insert({
        session_id: sessionId,
        name: `Value Case - ${new Date().toISOString()}`,
        status: 'draft'
      })
      .select()
      .single();

    const companyAgent = new CompanyIntelligenceAgent(
      this.agents.get('company_intelligence')!,
      this.llmGateway,
      this.memorySystem,
      this.auditLogger
    );

    const companyResult = await companyAgent.execute(sessionId, {
      user_input: userInput,
      value_case_id: valueCaseData.id
    });

    const { data: companyProfileData } = await this.supabase
      .from('company_profiles')
      .insert(companyResult.company_profile)
      .select()
      .single();

    const valueAgent = new ValueMappingAgent(
      this.agents.get('value_mapping')!,
      this.llmGateway,
      this.memorySystem,
      this.auditLogger
    );

    const valueResult = await valueAgent.execute(sessionId, {
      user_input: userInput,
      company_profile: companyProfileData,
      value_case_id: valueCaseData.id
    });

    const { data: valueMapsData } = await this.supabase
      .from('value_maps')
      .insert(valueResult.value_maps)
      .select();

    const kpiHypotheses = await this.generateKPIHypotheses(
      sessionId,
      valueCaseData.id,
      companyProfileData,
      valueMapsData
    );

    const costBreakdown = await this.generateCostStack(
      sessionId,
      valueCaseData.id,
      companyProfileData
    );

    const financialAgent = new FinancialModelingAgent(
      this.agents.get('financial_modeling')!,
      this.llmGateway,
      this.memorySystem,
      this.auditLogger
    );

    const financialResult = await financialAgent.execute(sessionId, {
      value_case_id: valueCaseData.id,
      kpi_hypotheses: kpiHypotheses,
      cost_breakdown: costBreakdown
    });

    const { data: financialModelData } = await this.supabase
      .from('financial_models')
      .insert(financialResult.financial_model)
      .select()
      .single();

    return {
      value_case_id: valueCaseData.id,
      company_profile: companyProfileData,
      value_maps: valueMapsData,
      kpi_hypotheses: kpiHypotheses,
      financial_model: financialModelData,
      assumptions: []
    };
  }

  private async generateKPIHypotheses(
    sessionId: string,
    valueCaseId: string,
    companyProfile: any,
    valueMaps: any[]
  ): Promise<any[]> {
    const prompt = `Create 3-5 KPI hypotheses with baselines and targets.

COMPANY: ${JSON.stringify(companyProfile, null, 2)}
VALUE MAPS: ${JSON.stringify(valueMaps, null, 2)}

Return JSON:
{
  "kpis": [
    {
      "kpi_name": "<name>",
      "baseline_value": <number>,
      "target_value": <number>,
      "unit": "<unit>",
      "timeframe": "<timeframe>",
      "calculation_method": "<method>",
      "confidence_level": "<high|medium|low>",
      "assumptions": ["<assumption1>"]
    }
  ]
}`;

    const response = await this.llmGateway.complete([
      { role: 'system', content: 'You are a KPI specialist.' },
      { role: 'user', content: prompt }
    ]);

    const parsed = featureFlags.ENABLE_SAFE_JSON_PARSER
      ? await parseLLMOutputStrict(response.content, CommonSchemas.kpiSchema)
      : JSON.parse(response.content.match(/\{[\s\S]*\}/)![0]);

    const kpisToInsert = parsed.kpis.map((kpi: any) => ({
      value_case_id: valueCaseId,
      ...kpi
    }));

    const { data } = await this.supabase
      .from('kpi_hypotheses')
      .insert(kpisToInsert)
      .select();

    return data || [];
  }

  private async generateCostStack(
    sessionId: string,
    valueCaseId: string,
    companyProfile: any
  ): Promise<any> {
    const prompt = `Estimate costs for a ${companyProfile.company_size} company.

Return JSON:
{
  "software": <annual_cost>,
  "implementation": <one_time_cost>,
  "training": <one_time_cost>,
  "support": <annual_cost>
}`;

    const response = await this.llmGateway.complete([
      { role: 'system', content: 'You are a cost analyst.' },
      { role: 'user', content: prompt }
    ]);

    return featureFlags.ENABLE_SAFE_JSON_PARSER
      ? await parseLLMOutputStrict(response.content, z.any())
      : JSON.parse(response.content.match(/\{[\s\S]*\}/)![0]);
  }

  private async createSession(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('agent_sessions')
      .insert({
        user_id: userId,
        session_token: crypto.randomUUID(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  private async createExecution(sessionId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .insert({
        workflow_id: this.workflow!.id,
        session_id: sessionId,
        status: 'running'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
}
