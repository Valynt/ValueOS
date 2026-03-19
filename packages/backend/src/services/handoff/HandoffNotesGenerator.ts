/**
 * Handoff Notes Generator
 *
 * Generates contextual handoff notes for Customer Success teams using NarrativeAgent.
 * Creates four sections: deal context, buyer priorities, implementation assumptions, key risks.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { buildEventEnvelope, getDomainEventBus } from "../../events/DomainEventBus.js";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway.js";
import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from "../../lib/supabase.js";
import { secureServiceInvoke } from "../llm/secureServiceInvocation.js";
import { ScenarioType, SourceType } from "../../types/value-modeling.js";

const logger = createLogger({ component: "HandoffNotesGenerator" });

// ============================================================================
// Zod Schema for LLM Output
// ============================================================================

const HandoffNotesOutputSchema = z.object({
  deal_context: z.string().min(1).describe("Summary of the deal: what was sold, to whom, and the core value proposition"),
  buyer_priorities: z.string().min(1).describe("What the buyer cares about most, their pain points and success criteria"),
  implementation_assumptions: z.string().min(1).describe("Key assumptions that must hold for value realization"),
  key_risks: z.string().min(1).describe("Risks that could prevent value realization and recommended mitigations"),
});

export type HandoffNotesOutput = z.infer<typeof HandoffNotesOutputSchema>;

export interface HandoffNotesResult {
  baseline_id: string;
  sections: {
    deal_context: string;
    buyer_priorities: string;
    implementation_assumptions: string;
    key_risks: string;
  };
  generated_at: string;
}

// ============================================================================
// Context Types
// ============================================================================

interface ValueCaseContext {
  title: string;
  description: string;
  stage: string;
  buyer_name?: string;
  account_name?: string;
  expected_deal_size?: number;
}

interface ScenarioContext {
  scenario_type: ScenarioType;
  roi: number;
  npv: number;
  payback_months: number;
}

interface AssumptionContext {
  name: string;
  value: number;
  unit?: string;
  source_type: SourceType;
  confidence_score: number;
}

interface ValueDriverContext {
  id: string;
  name: string;
  category: string;
  impact: number;
}

// ============================================================================
// Service
// ============================================================================

export class HandoffNotesGenerator {
  private supabase: SupabaseClient;
  private readonly llmGateway: LLMGateway;

  constructor(
    llmGateway?: LLMGateway,
    supabase: SupabaseClient = supabaseClient,
  ) {
    if (!supabase) {
      throw new Error("HandoffNotesGenerator requires Supabase to be configured");
    }
    this.supabase = supabase;
    this.llmGateway =
      llmGateway ??
      new LLMGateway({
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 2048,
      });
  }

  /**
   * Generate handoff notes for a baseline using contextual data.
   * Stores notes in promise_handoff_notes table.
   */
  async generateHandoffNotes(
    baselineId: string,
    tenantId: string
  ): Promise<HandoffNotesResult> {
    logger.info("Generating handoff notes", { baselineId, tenantId });

    // Fetch baseline with case data
    const baseline = await this.fetchBaselineContext(baselineId, tenantId);
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    // Gather context from related data
    const [valueCase, scenario, assumptions, valueDrivers] = await Promise.all([
      this.fetchValueCase(baseline.case_id, tenantId),
      this.fetchScenario(baseline.scenario_id, tenantId),
      this.fetchAssumptions(baseline.case_id, tenantId),
      this.fetchValueDrivers(baseline.case_id, tenantId),
    ]);

    // Build LLM prompt
    const prompt = this.buildHandoffPrompt({
      valueCase,
      scenario,
      assumptions,
      valueDrivers,
      scenarioType: baseline.scenario_type,
    });

    // Generate notes via LLM (using secureInvoke pattern from BaseAgent)
    const notes = await this.generateWithLLM(prompt, baselineId, tenantId);

    // Store generated notes in database
    await this.storeHandoffNotes(baselineId, tenantId, notes);

    // Emit domain event
    await this.publishHandoffCompleteEvent(baselineId, tenantId);

    logger.info("Handoff notes generated and stored", { baselineId, tenantId });

    return {
      baseline_id: baselineId,
      sections: notes,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Build structured prompt for LLM handoff note generation.
   */
  private buildHandoffPrompt(context: {
    valueCase: ValueCaseContext | null;
    scenario: ScenarioContext | null;
    assumptions: AssumptionContext[];
    valueDrivers: ValueDriverContext[];
    scenarioType: ScenarioType;
  }): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Value Case Handoff Context`);
    sections.push(`Scenario Type: ${context.scenarioType.toUpperCase()}`);
    sections.push(``);

    // Value Case Info
    if (context.valueCase) {
      sections.push(`## Deal Information`);
      sections.push(`Title: ${context.valueCase.title}`);
      sections.push(`Description: ${context.valueCase.description}`);
      if (context.valueCase.buyer_name) {
        sections.push(`Buyer: ${context.valueCase.buyer_name}`);
      }
      if (context.valueCase.account_name) {
        sections.push(`Account: ${context.valueCase.account_name}`);
      }
      if (context.valueCase.expected_deal_size) {
        sections.push(`Expected Deal Size: $${context.valueCase.expected_deal_size.toLocaleString()}`);
      }
      sections.push(``);
    }

    // Scenario Metrics
    if (context.scenario) {
      sections.push(`## Financial Projections`);
      sections.push(`ROI: ${(context.scenario.roi * 100).toFixed(1)}%`);
      sections.push(`NPV: $${context.scenario.npv.toLocaleString()}`);
      sections.push(`Payback Period: ${context.scenario.payback_months} months`);
      sections.push(``);
    }

    // Value Drivers
    if (context.valueDrivers.length > 0) {
      sections.push(`## Value Drivers`);
      context.valueDrivers.forEach(vd => {
        sections.push(`- ${vd.name} (${vd.category}): $${vd.impact.toLocaleString()}`);
      });
      sections.push(``);
    }

    // Critical Assumptions
    const criticalAssumptions = context.assumptions.filter(a => a.confidence_score < 0.7);
    if (criticalAssumptions.length > 0) {
      sections.push(`## Critical Assumptions (Lower Confidence)`);
      criticalAssumptions.forEach(a => {
        sections.push(`- ${a.name}: ${a.value}${a.unit || ''} (source: ${a.source_type}, confidence: ${(a.confidence_score * 100).toFixed(0)}%)`);
      });
      sections.push(``);
    }

    // All Assumptions
    if (context.assumptions.length > 0) {
      sections.push(`## All Assumptions`);
      context.assumptions.forEach(a => {
        sections.push(`- ${a.name}: ${a.value}${a.unit || ''} (source: ${a.source_type}, confidence: ${(a.confidence_score * 100).toFixed(0)}%)`);
      });
      sections.push(``);
    }

    // Instructions
    sections.push(`## Instructions`);
    sections.push(`Generate a structured handoff summary for the Customer Success team. The summary should enable CS to understand what was promised, why, and what the buyer cares about — without re-reading the full value case.`);
    sections.push(``);
    sections.push(`Provide four sections:`);
    sections.push(`1. **Deal Context**: What was sold, to whom, and the core value proposition`);
    sections.push(`2. **Buyer Priorities**: What the buyer cares about most, their pain points and success criteria`);
    sections.push(`3. **Implementation Assumptions**: Key assumptions that must hold for value realization`);
    sections.push(`4. **Key Risks**: Risks that could prevent value realization and recommended mitigations`);
    sections.push(``);
    sections.push(`Each section should be 2-4 sentences, written for a Customer Success Manager who will take over the account post-sale.`);

    return sections.join("\n");
  }

  /**
   * Generate handoff notes using LLM with secure validation.
   */
  private async generateWithLLM(
    prompt: string,
    baselineId: string,
    tenantId: string
  ): Promise<HandoffNotesOutput> {
    const systemPrompt = `You are a value engineering consultant preparing a handoff summary for a Customer Success team.

Your task is to synthesize the provided value case context into four clear, actionable sections that will help the CS team understand and deliver on the promises made during the sales process.

Guidelines:
- Be specific and concrete — avoid generic statements
- Flag assumptions that require CS attention or validation
- Highlight risks with clear owner recommendations
- Keep sections concise (2-4 sentences each)
- Write for a CS manager who needs to take action

Output must be valid JSON with these keys: deal_context, buyer_priorities, implementation_assumptions, key_risks`;

    try {
      const invocation = await secureServiceInvoke({
        gateway: this.llmGateway,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        schema: HandoffNotesOutputSchema,
        request: {
          tenantId,
          organizationId: tenantId,
          sessionId: baselineId,
          agentType: "handoff-notes-generator",
          serviceName: "HandoffNotesGenerator",
          operation: "generateHandoffNotes",
          max_tokens: 2048,
          temperature: 0.3,
          model: "gpt-4o",
        },
        logger,
        actorName: "HandoffNotesGenerator",
        sessionId: baselineId,
        tenantId,
        invalidJsonMessage: "Invalid JSON response from LLM",
        invalidJsonLogMessage: "HandoffNotesGenerator: Failed to parse LLM response as JSON",
        invalidJsonLogContext: (content, error) => ({
          baselineId,
          error: error instanceof Error ? error.message : String(error),
          content: content.slice(0, 500),
        }),
        hallucinationCheck: async (parsed) => this.checkHallucination(parsed),
        escalationLogMessage: "HandoffNotesGenerator: Hallucination escalation triggered",
        escalationLogContext: (parsed) => ({
          baselineId,
          sections: Object.keys(parsed),
        }),
      });

      return invocation.parsed;
    } catch (error) {
      logger.error("LLM generation failed for handoff notes", {
        baselineId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback notes on failure
      return {
        deal_context: "Please review the value case directly for deal context.",
        buyer_priorities: "Please review stakeholder notes for buyer priorities.",
        implementation_assumptions: "Please validate all assumptions with the customer success team.",
        key_risks: "Schedule a risk review meeting with the value engineering team.",
      };
    }
  }

  private async checkHallucination(output: HandoffNotesOutput): Promise<boolean> {
    const sections = Object.values(output);
    const allSectionsPopulated = sections.every((section) => section.trim().length >= 20);
    const hasFallbackLanguage = sections.some((section) => /please review|please validate|schedule a risk review/i.test(section));

    if (!allSectionsPopulated || hasFallbackLanguage) {
      logger.warn("HandoffNotesGenerator: Hallucination check failed", {
        allSectionsPopulated,
        hasFallbackLanguage,
      });
      return false;
    }

    return true;
  }

  /**
   * Store generated handoff notes in the database.
   */
  private async storeHandoffNotes(
    baselineId: string,
    tenantId: string,
    notes: HandoffNotesOutput
  ): Promise<void> {
    const sections: Array<{
      tenant_id: string;
      baseline_id: string;
      section: string;
      content_text: string;
      generated_by_agent: boolean;
    }> = [
      {
        tenant_id: tenantId,
        baseline_id: baselineId,
        section: "deal_context",
        content_text: notes.deal_context,
        generated_by_agent: true,
      },
      {
        tenant_id: tenantId,
        baseline_id: baselineId,
        section: "buyer_priorities",
        content_text: notes.buyer_priorities,
        generated_by_agent: true,
      },
      {
        tenant_id: tenantId,
        baseline_id: baselineId,
        section: "implementation_assumptions",
        content_text: notes.implementation_assumptions,
        generated_by_agent: true,
      },
      {
        tenant_id: tenantId,
        baseline_id: baselineId,
        section: "key_risks",
        content_text: notes.key_risks,
        generated_by_agent: true,
      },
    ];

    const { error } = await this.supabase
      .from("promise_handoff_notes")
      .insert(sections);

    if (error) {
      throw new Error(`Failed to store handoff notes: ${error.message}`);
    }
  }

  /**
   * Emit domain event for handoff completion.
   */
  private async publishHandoffCompleteEvent(baselineId: string, tenantId: string): Promise<void> {
    try {
      await getDomainEventBus().publish("narrative.drafted", {
        ...buildEventEnvelope({
          traceId: baselineId,
          tenantId,
          actorId: "system",
        }),
        valueCaseId: baselineId,
        defenseReadinessScore: 0.8,
        format: "handoff_notes",
      });
    } catch (err) {
      logger.warn("Failed to publish handoff complete event", { baselineId, error: (err as Error).message });
    }
  }

  // ============================================================================
  // Data Fetching
  // ============================================================================

  private async fetchBaselineContext(
    baselineId: string,
    tenantId: string
  ): Promise<{ id: string; case_id: string; scenario_id: string; scenario_type: ScenarioType } | null> {
    const { data, error } = await this.supabase
      .from("promise_baselines")
      .select("id, case_id, scenario_id, scenario_type")
      .eq("id", baselineId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      scenario_type: data.scenario_type as ScenarioType,
    };
  }

  private async fetchValueCase(caseId: string, tenantId: string): Promise<ValueCaseContext | null> {
    const { data, error } = await this.supabase
      .from("value_cases")
      .select("title, description, stage, buyer_name, account_name, expected_deal_size")
      .eq("id", caseId)
      .eq("organization_id", tenantId)
      .single();

    if (error || !data) return null;

    return data as ValueCaseContext;
  }

  private async fetchScenario(
    scenarioId: string | null,
    tenantId: string
  ): Promise<ScenarioContext | null> {
    if (!scenarioId) return null;

    const { data, error } = await this.supabase
      .from("scenarios")
      .select("scenario_type, roi, npv, payback_months")
      .eq("id", scenarioId)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      scenario_type: data.scenario_type as ScenarioType,
    };
  }

  private async fetchAssumptions(caseId: string, tenantId: string): Promise<AssumptionContext[]> {
    const { data, error } = await this.supabase
      .from("assumptions")
      .select("name, value, unit, source_type, confidence_score")
      .eq("case_id", caseId)
      .eq("organization_id", tenantId);

    if (error || !data) return [];

    return data.map(a => ({
      ...a,
      source_type: a.source_type as SourceType,
    }));
  }

  private async fetchValueDrivers(caseId: string, tenantId: string): Promise<ValueDriverContext[]> {
    const { data, error } = await this.supabase
      .from("value_drivers")
      .select("id, name, category, impact")
      .eq("case_id", caseId)
      .eq("organization_id", tenantId);

    if (error || !data) return [];

    return data as ValueDriverContext[];
  }
}

export const handoffNotesGenerator = new HandoffNotesGenerator();
export default handoffNotesGenerator;
