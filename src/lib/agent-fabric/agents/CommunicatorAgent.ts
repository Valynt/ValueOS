/**
 * CommunicatorAgent - Narrative Generation & SDUI Schema Output
 *
 * The CommunicatorAgent is responsible for:
 * 1. Translating VMRT reasoning traces into executive-ready narratives
 * 2. Generating stakeholder-specific communications (CFO, CIO, VP Ops)
 * 3. Creating SDUI schemas for dynamic UI rendering
 * 4. Formatting business cases and QBR reports
 */

import { z } from "zod";
import { BaseAgent } from "./BaseAgent";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMGateway } from "../../llm/gateway";
import type { MemorySystem } from "../../memory/system";
import type { AuditLogger } from "../../audit/logger";
import type {
  ValueTree,
  ROIModel,
  RealizationReport,
  ConfidenceLevel,
} from "../../../types/vos";

// ============================================================================
// Types
// ============================================================================

export interface CommunicatorAgentConfig {
  supabase: SupabaseClient;
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  auditLogger: AuditLogger;
  organizationId: string;
  userId: string;
}

export type StakeholderPersona =
  | "cfo"
  | "cio"
  | "vp_ops"
  | "vp_sales"
  | "executive"
  | "technical";

export interface NarrativeInput {
  valueCaseId: string;
  targetPersona: StakeholderPersona;
  valueTree?: ValueTree;
  roiModel?: ROIModel;
  realizationReport?: RealizationReport;
  additionalContext?: Record<string, unknown>;
  format:
    | "executive_summary"
    | "business_case"
    | "qbr_report"
    | "email"
    | "presentation";
}

export interface ExecutiveNarrative {
  title: string;
  headline: string;
  keyMetrics: {
    label: string;
    value: string;
    trend: "up" | "down" | "neutral";
    confidence: ConfidenceLevel;
  }[];
  strategicContext: string;
  valueProposition: string;
  callToAction: string;
  risks: string[];
  nextSteps: string[];
}

export interface SDUISchema {
  schemaVersion: string;
  layoutType: "dashboard" | "report" | "card" | "form";
  components: SDUIComponent[];
  bindings: SDUIDataBinding[];
  actions: SDUIAction[];
}

export interface SDUIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: SDUIComponent[];
}

export interface SDUIDataBinding {
  componentId: string;
  property: string;
  source: string;
  transform?: string;
  fallback?: string;
  refresh?: number;
}

export interface SDUIAction {
  id: string;
  trigger: string;
  handler: string;
  params: Record<string, unknown>;
}

export interface CommunicatorOutput {
  narrative: ExecutiveNarrative;
  sduiSchema?: SDUISchema;
  confidenceScore: number;
  personaAlignment: number;
  reasoning: string;
}

// ============================================================================
// Schemas
// ============================================================================

const KeyMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.enum(["up", "down", "neutral"]),
  confidence: z.enum(["high", "medium", "low"]),
});

const ExecutiveNarrativeSchema = z.object({
  title: z.string(),
  headline: z.string(),
  keyMetrics: z.array(KeyMetricSchema),
  strategicContext: z.string(),
  valueProposition: z.string(),
  callToAction: z.string(),
  risks: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

const SDUIComponentSchema: z.ZodType<SDUIComponent> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.unknown()),
    children: z.array(SDUIComponentSchema).optional(),
  })
);

const SDUISchemaSchema = z.object({
  schemaVersion: z.string(),
  layoutType: z.enum(["dashboard", "report", "card", "form"]),
  components: z.array(SDUIComponentSchema),
  bindings: z.array(
    z.object({
      componentId: z.string(),
      property: z.string(),
      source: z.string(),
      transform: z.string().optional(),
      fallback: z.string().optional(),
      refresh: z.number().optional(),
    })
  ),
  actions: z.array(
    z.object({
      id: z.string(),
      trigger: z.string(),
      handler: z.string(),
      params: z.record(z.unknown()),
    })
  ),
});

const CommunicatorOutputSchema = z.object({
  narrative: ExecutiveNarrativeSchema,
  sduiSchema: SDUISchemaSchema.optional(),
  confidenceScore: z.number().min(0).max(1),
  personaAlignment: z.number().min(0).max(1),
  reasoning: z.string(),
});

// ============================================================================
// Persona Configuration
// ============================================================================

const PERSONA_CONFIG: Record<
  StakeholderPersona,
  {
    primaryPain: string;
    kpisFocus: string[];
    financialDriver: string;
    communicationStyle: string;
  }
> = {
  cfo: {
    primaryPain: "Working Capital Friction",
    kpisFocus: ["DSO", "FCF", "EBITDA", "NPV", "Payback Period"],
    financialDriver: "Free Cash Flow",
    communicationStyle:
      "Data-driven, conservative estimates, risk-adjusted projections",
  },
  cio: {
    primaryPain: "Technical Debt",
    kpisFocus: ["Maintenance Ratio", "System Uptime", "Integration Costs"],
    financialDriver: "OpEx Reduction",
    communicationStyle: "Technical depth with business impact translation",
  },
  vp_ops: {
    primaryPain: "Asset Downtime & Process Variability",
    kpisFocus: ["OEE", "Throughput", "Cycle Time", "Quality Rate"],
    financialDriver: "COGS Optimization",
    communicationStyle: "Operational metrics with efficiency focus",
  },
  vp_sales: {
    primaryPain: "Pipeline Volatility",
    kpisFocus: ["Win Rate", "Deal Velocity", "ACV", "Pipeline Coverage"],
    financialDriver: "Revenue Uplift",
    communicationStyle: "Revenue-focused, competitive positioning",
  },
  executive: {
    primaryPain: "Strategic Alignment",
    kpisFocus: ["ROI", "NPV", "Market Position", "Risk Mitigation"],
    financialDriver: "Enterprise Value",
    communicationStyle: "High-level strategic narrative with clear outcomes",
  },
  technical: {
    primaryPain: "Implementation Complexity",
    kpisFocus: ["Integration Time", "API Performance", "Data Quality"],
    financialDriver: "Total Cost of Ownership",
    communicationStyle: "Technical specifications with architecture details",
  },
};

// ============================================================================
// Agent Implementation
// ============================================================================

export class CommunicatorAgent extends BaseAgent {
  readonly agentType = "communicator" as const;
  readonly agentVersion = "1.0.0";

  private readonly config: CommunicatorAgentConfig;

  constructor(config: CommunicatorAgentConfig) {
    super({
      supabase: config.supabase,
      llmGateway: config.llmGateway,
      memorySystem: config.memorySystem,
      auditLogger: config.auditLogger,
      agentType: "communicator",
      organizationId: config.organizationId,
      userId: config.userId,
    });
    this.config = config;
  }

  /**
   * Generate stakeholder-specific narrative from value data
   */
  async execute(
    sessionId: string,
    input: NarrativeInput
  ): Promise<CommunicatorOutput> {
    const personaConfig = PERSONA_CONFIG[input.targetPersona];
    const prompt = this.buildNarrativePrompt(input, personaConfig);

    const { result: output } = await this.secureInvoke(
      sessionId,
      { prompt, input },
      CommunicatorOutputSchema,
      {
        confidenceThreshold: 0.7,
        safetyLimits: {
          maxRetries: 2,
          timeoutMs: 45000,
        },
      }
    );

    // Log narrative generation metrics
    await this.logMetric(sessionId, "narrative_generated", {
      valueCaseId: input.valueCaseId,
      persona: input.targetPersona,
      format: input.format,
      confidenceScore: output.confidenceScore,
      personaAlignment: output.personaAlignment,
    });

    // Link to value case lifecycle
    await this.linkLifecycleArtifact({
      sessionId,
      sourceType: "narrative",
      sourceId: `narrative-${input.valueCaseId}-${Date.now()}`,
      targetType: "value_case",
      targetId: input.valueCaseId,
      relationshipType: "generated_from",
      reasoning_trace: `Generated ${input.format} narrative for ${input.targetPersona}`,
    });

    return output;
  }

  /**
   * Build the narrative generation prompt
   */
  private buildNarrativePrompt(
    input: NarrativeInput,
    personaConfig: (typeof PERSONA_CONFIG)[StakeholderPersona]
  ): string {
    return `You are the CommunicatorAgent for ValueOS - translating financial reasoning into executive-ready narratives.

## Your Role
Transform complex Value Modeling Reasoning Traces (VMRT) into compelling, stakeholder-specific communications.

## Target Persona: ${input.targetPersona.toUpperCase()}
- **Primary Pain Point:** ${personaConfig.primaryPain}
- **KPIs of Interest:** ${personaConfig.kpisFocus.join(", ")}
- **Financial Driver:** ${personaConfig.financialDriver}
- **Communication Style:** ${personaConfig.communicationStyle}

## Output Format: ${input.format.toUpperCase()}

## Value Data
${input.valueTree ? `### Value Tree\n${JSON.stringify(input.valueTree, null, 2)}` : ""}

${input.roiModel ? `### ROI Model\n${JSON.stringify(input.roiModel, null, 2)}` : ""}

${input.realizationReport ? `### Realization Report\n${JSON.stringify(input.realizationReport, null, 2)}` : ""}

## Instructions
1. **Headline**: Create a compelling one-liner that captures the primary value
2. **Key Metrics**: Extract 3-5 metrics most relevant to this persona
3. **Strategic Context**: Frame the value in terms of the persona's priorities
4. **Value Proposition**: Articulate the "so what" - why this matters NOW
5. **Risks**: Be transparent about assumptions and potential challenges
6. **Call to Action**: Specific next step appropriate for this stakeholder
7. **SDUI Schema**: If format is dashboard or report, generate UI schema

## Constraints
- Use conservative estimates (P50 benchmarks or lower)
- Every number must trace to source data
- Align language with persona's vocabulary
- Format currency as $X.XM or $XXK as appropriate

Generate the narrative with confidence and persona alignment scores (0-1).`;
  }

  /**
   * Generate a QBR (Quarterly Business Review) report
   */
  async generateQBR(
    sessionId: string,
    valueCaseId: string,
    realizationReport: RealizationReport,
    targetPersona: StakeholderPersona = "executive"
  ): Promise<CommunicatorOutput> {
    return this.execute(sessionId, {
      valueCaseId,
      targetPersona,
      realizationReport,
      format: "qbr_report",
    });
  }

  /**
   * Generate an executive summary for a business case
   */
  async generateExecutiveSummary(
    sessionId: string,
    valueCaseId: string,
    valueTree: ValueTree,
    roiModel: ROIModel,
    targetPersona: StakeholderPersona = "executive"
  ): Promise<CommunicatorOutput> {
    return this.execute(sessionId, {
      valueCaseId,
      targetPersona,
      valueTree,
      roiModel,
      format: "executive_summary",
    });
  }

  /**
   * Generate SDUI schema for a value dashboard
   */
  async generateDashboardSchema(
    sessionId: string,
    valueCaseId: string,
    valueTree: ValueTree,
    roiModel: ROIModel
  ): Promise<SDUISchema> {
    const output = await this.execute(sessionId, {
      valueCaseId,
      targetPersona: "executive",
      valueTree,
      roiModel,
      format: "presentation",
    });

    return output.sduiSchema || this.getDefaultDashboardSchema(valueCaseId);
  }

  /**
   * Get default dashboard schema as fallback
   */
  private getDefaultDashboardSchema(valueCaseId: string): SDUISchema {
    return {
      schemaVersion: "1.0.0",
      layoutType: "dashboard",
      components: [
        {
          id: "metrics-hero",
          type: "MetricsHero",
          props: { valueCaseId },
        },
        {
          id: "value-tree",
          type: "ValueTreeCard",
          props: { valueCaseId },
        },
        {
          id: "roi-summary",
          type: "ROISummary",
          props: { valueCaseId },
        },
      ],
      bindings: [
        {
          componentId: "metrics-hero",
          property: "metrics",
          source: `value_cases/${valueCaseId}/metrics`,
          refresh: 30000,
        },
      ],
      actions: [
        {
          id: "export-pdf",
          trigger: "click",
          handler: "exportToPDF",
          params: { valueCaseId },
        },
      ],
    };
  }
}
