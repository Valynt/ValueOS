/**
 * Target Agent
 *
 * VOS Lifecycle Stage: TARGET
 *
 * Creates business cases with value trees, ROI models, and value commitments.
 *
 * Responsibilities:
 * - Build hierarchical Value Trees from capabilities to outcomes
 * - Create ROI calculation models with formulas
 * - Generate Value Commits with specific KPI targets
 * - Link capabilities to financial outcomes
 * - Set baseline and target values with confidence levels
 * - Create assumptions with provenance tracking
 */

import { BaseAgent } from './BaseAgent';
import { ModelService } from '../../../services/ModelService';
import type {
  ValueTree,
  ROIModel,
  ValueCommit,
  TargetAgentInput,
  TargetAgentOutput
} from '../../../types/vos';

import { AgentConfig } from '../../../types/agent';

export class TargetAgent extends BaseAgent {
  public lifecycleStage = 'target';
  public version = '1.0';
  public name = 'Target Agent';

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error("Supabase client is required for TargetAgent");
    }
  }

  async execute(
    sessionId: string,
    input: TargetAgentInput
  ): Promise<TargetAgentOutput> {
    const startTime = Date.now();

    const objectivesText = JSON.stringify(input.businessObjectives, null, 2);
    const capabilitiesText = JSON.stringify(input.capabilities, null, 2);

    const prompt = `You are a value engineering expert creating a comprehensive business case with ROI modeling.

BUSINESS OBJECTIVES:
${objectivesText}

CAPABILITIES (Solution Features):
${capabilitiesText}

Your task is to create:
1. **Value Tree**: A hierarchical structure showing how capabilities drive outcomes which impact KPIs which generate financial value
2. **ROI Model**: Formula-based calculations showing financial impact
3. **Value Commit**: Specific, measurable commitments at point of sale

Provenance requirements:
- Every ROI calculation must list input_variables with name, source, and description
- Provide source_references mapping each variable back to a KPI, capability, or assumption
- Include a reasoning_trace (80+ chars) describing the logic/provenance of each calculation
- Return a business_case_summary plus a confidence_level for the overall chain

Return ONLY valid JSON in this exact format:
{
  "value_tree": {
    "name": "<descriptive name>",
    "description": "<what this value tree represents>",
    "nodes": [
      {
        "node_id": "cap_1",
        "label": "<Capability name>",
        "type": "capability",
        "reference_id": "<capability_id from input>"
      },
      {
        "node_id": "outcome_1",
        "label": "<Outcome description>",
        "type": "outcome"
      },
      {
        "node_id": "kpi_1",
        "label": "<KPI name>",
        "type": "kpi"
      },
      {
        "node_id": "financial_1",
        "label": "<Financial metric>",
        "type": "financialMetric"
      }
    ],
    "links": [
      {
        "parent_node_id": "cap_1",
        "child_node_id": "outcome_1",
        "weight": 1.0
      }
    ]
  },
  "roi_model": {
    "name": "<ROI Model Name>",
    "assumptions": [
      "<assumption 1 with source>",
      "<assumption 2 with source>"
    ],
    "calculations": [
      {
        "name": "annual_time_savings_hours",
        "formula": "employees * hours_per_week * 52 * efficiency_gain",
        "description": "Total hours saved per year",
        "calculation_order": 1,
        "result_type": "intermediate",
        "unit": "hours",
        "input_variables": [
          { "name": "employees", "source": "discovery:headcount", "description": "Number of impacted employees" },
          { "name": "hours_per_week", "source": "benchmark:industry_hours", "description": "Average hours per week" },
          { "name": "efficiency_gain", "source": "capability:automation", "description": "Expected efficiency delta" }
        ],
        "source_references": { "employees": "kpi:headcount", "efficiency_gain": "capability:automation" },
        "reasoning_trace": "Explain how each variable influences the impact and cite its source"
      },
      {
        "name": "annual_cost_savings",
        "formula": "annual_time_savings_hours * hourly_rate",
        "description": "Cost savings from time reduction",
        "calculation_order": 2,
        "result_type": "cost",
        "unit": "USD",
        "input_variables": [
          { "name": "hourly_rate", "source": "finance:blended_rate", "description": "Fully loaded rate" }
        ],
        "source_references": { "hourly_rate": "benchmark:finance" },
        "reasoning_trace": "Show why the financial rate is conservative and sourced"
      },
      {
        "name": "total_roi",
        "formula": "((annual_cost_savings * 3) - total_investment) / total_investment * 100",
        "description": "3-year ROI percentage",
        "calculation_order": 3,
        "result_type": "intermediate",
        "unit": "percent",
        "input_variables": [
          { "name": "total_investment", "source": "sales:pricing", "description": "Implementation and subscription" }
        ],
        "source_references": { "total_investment": "order_form:pricing" },
        "reasoning_trace": "Connect ROI back to upstream calculations and assumptions"
      }
    ],
    "confidence_level": "medium"
  },
  "kpi_targets": [
    {
      "kpi_name": "<KPI name>",
      "baseline_value": 100,
      "target_value": 150,
      "unit": "<unit>",
      "deadline": "2025-12-31",
      "confidence_level": "high"
    }
  ],
  "value_commit": {
    "notes": "<commitment statement>",
    "target_date": "2025-12-31"
  },
  "business_case_summary": "<executive summary of the business case>",
  "confidence_level": "<high|medium|low>",
  "reasoning": "<your methodology and key decisions>"
}`;

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are a value engineering expert. You create rigorous, formula-driven business cases with clear cause-and-effect relationships between capabilities and financial outcomes.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.3,
      max_tokens: 4000
    });

    const parsed = await this.extractJSON(response.content);

    const valueTree: Omit<ValueTree, 'id' | 'created_at' | 'updated_at'> = {
      value_case_id: input.valueCaseId,
      use_case_id: undefined,
      name: parsed.value_tree.name,
      description: parsed.value_tree.description,
      version: 1,
      is_published: false,
    };

    const roiModel: Omit<ROIModel, 'id' | 'value_tree_id' | 'created_at' | 'updated_at'> = {
      organization_id: this.organizationId || '',
      financial_model_id: undefined,
      name: parsed.roi_model.name,
      assumptions: parsed.roi_model.assumptions,
      version: '1.0',
      confidence_level: parsed.roi_model.confidence_level,
    };

    const valueCommit: Omit<ValueCommit, 'id' | 'value_tree_id' | 'created_at'> = {
      value_case_id: input.valueCaseId,
      committed_by: undefined,
      committed_by_name: undefined,
      status: 'active',
      date_committed: new Date().toISOString(),
      target_date: parsed.value_commit.target_date,
      notes: parsed.value_commit.notes,
      metadata: {},
    };

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'value_tree_nodes', parsed.value_tree.nodes.length, 'count');
    await this.logMetric(sessionId, 'kpi_targets', parsed.kpi_targets.length, 'count');
    await this.logPerformanceMetric(sessionId, 'target_execute', durationMs, {
      nodes: parsed.value_tree.nodes.length,
      kpi_targets: parsed.kpi_targets.length,
    });

    await this.logExecution(
      sessionId,
      'target_business_case_creation',
      input,
      {
        value_tree_nodes: parsed.value_tree.nodes.length,
        roi_calculations: parsed.roi_model.calculations.length,
        kpi_targets: parsed.kpi_targets.length
      },
      parsed.reasoning,
      parsed.confidence_level,
      [{
        type: 'value_tree_generation',
        model: response.model,
        tokens: response.tokens_used
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Business Case: ${parsed.business_case_summary}`,
      {
        value_tree: valueTree,
        roi_model: roiModel,
        kpi_targets: parsed.kpi_targets
      }
    );

    return {
      valueTree: valueTree as ValueTree,
      roiModel: roiModel as ROIModel,
      valueCommit: valueCommit as ValueCommit,
      businessCase: {
        summary: parsed.business_case_summary,
        nodes: parsed.value_tree.nodes,
        links: parsed.value_tree.links,
        calculations: parsed.roi_model.calculations,
        kpi_targets: parsed.kpi_targets,
        reasoning: parsed.reasoning,
        confidence_level: parsed.confidence_level
      }
    };
  }

  /**
   * Persist complete Target artifacts to database using the ModelService.
   */
  async persistTargetArtifacts(
    output: TargetAgentOutput,
    valueCaseId: string,
    sessionId?: string
  ): Promise<{
    valueTreeId: string;
    roiModelId: string;
    valueCommitId: string;
  }> {
    if (!this.organizationId || !this.userId) {
      throw new Error("Agent is missing required user and organization context.");
    }
    
    const context = {
      userId: this.userId,
      organizationId: this.organizationId,
      sessionId: sessionId,
    };

    const modelService = new ModelService(context);
    
    // Note: The provenance logging logic that was here previously should be
    // moved into the ModelService as well, ideally into an AuditService that
    // the ModelService would use. For this refactoring step, we are focusing
    // on moving the core persistence logic.

    return modelService.persistBusinessCase(output, valueCaseId);
  }
}
