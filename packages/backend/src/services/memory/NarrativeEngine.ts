import { SupabaseClient } from "@supabase/supabase-js";

import { DomainPackService } from "../domain-packs/DomainPackService.js";

import { MemoryService } from "./MemoryService.js"
import { ModelRunEngine } from "./ModelRunEngine.js"
import {
  Fact,
  FactStatus,
  ModelRun,
  Narrative,
  NarrativeRequest,
  NarrativeStatus,
  PersonaType,
  UUID,
} from "./types";


export class NarrativeEngine {
  constructor(
    private memoryService: MemoryService,
    private modelEngine: ModelRunEngine,
    private supabase: SupabaseClient
  ) {}

  public async generate(request: NarrativeRequest): Promise<Narrative> {
    const { facts, modelRun } = await this.retrieveValidatedContext(
      request.valueCaseId
    );

    const template = this.getTemplate(request.persona);

    let body = this.injectParameters(template, {
      facts,
      modelRun,
      context: request.additionalContext,
    });

    body = this.injectCitations(body, facts, modelRun);

    // Apply domain pack glossary if a pack is attached to the case
    body = await this.applyGlossary(body, request.valueCaseId);

    const narrative: Narrative = {
      id: crypto.randomUUID() as UUID,
      tenant_id: facts[0]?.tenant_id || this.memoryService.getTenantId(),
      value_case_id: request.valueCaseId,
      title: request.title,
      body,
      status: NarrativeStatus.DRAFT,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { data, error } = await this.supabase
      .from("memory_narratives")
      .insert({
        id: narrative.id,
        tenant_id: narrative.tenant_id,
        value_case_id: narrative.value_case_id,
        title: narrative.title,
        body: narrative.body,
        status: narrative.status,
        version: narrative.version,
      })
      .select()
      .single();

    if (error) throw error;

    return data as Narrative;
  }

  private async retrieveValidatedContext(
    valueCaseId: UUID
  ): Promise<{ facts: Fact[]; modelRun: ModelRun }> {
    const { facts } = await this.memoryService.retrieveContext(
      valueCaseId,
      "",
      []
    );

    const approvedFacts = facts.filter((f) => f.status === FactStatus.APPROVED);

    const modelRun = await this.modelEngine.getLatestRun(valueCaseId);

    if (!modelRun) {
      throw new Error(
        `Cannot generate narrative: No valid ModelRun found for ${valueCaseId}`
      );
    }

    return { facts: approvedFacts, modelRun };
  }

  private injectParameters(
    template: string,
    data: { facts: Fact[]; modelRun: ModelRun; context?: string }
  ): string {
    let output = template;
    const results = data.modelRun.results || {};
    const benchmarks = data.modelRun.benchmarks || [];

    Object.entries(results).forEach(([key, value]) => {
      const formattedValue =
        typeof value === "number" ? value.toLocaleString() : String(value);
      output = output.replace(
        // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
        new RegExp(`{{results.${key}}}`, "g"),
        formattedValue
      );
    });

    benchmarks.forEach((b) => {
      if (b.label && b.value_at_execution !== undefined) {
        output = output.replace(
          // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
          new RegExp(`{{benchmarks.${b.label}}}`, "g"),
          b.value_at_execution.toString()
        );
      }
    });

    const factsPlaceholder = data.facts
      .map((f, i) => `${i + 1}. ${f.claim}`)
      .join("\n");
    output = output.replace("{{facts_placeholder}}", factsPlaceholder);

    if (data.context) {
      output = output.replace("{{additional_context}}", data.context);
    }

    return output;
  }

  private injectCitations(body: string, facts: Fact[], run: ModelRun): string {
    let citedBody = body;

    const citationList = facts
      .map((f, i) => `[^${i + 1}]: ${f.claim}`)
      .join("\n");

    const runHash = run.run_hash || "N/A";
    const footer = `\n\n---\n**Data Provenance**\n- Calculation Hash: ${runHash.substring(0, 8)}\n${citationList}`;

    return citedBody + footer;
  }

  /**
   * Replace neutral terms with domain-specific terminology from the pack glossary.
   * E.g., "revenue_uplift" → "Net Interest Margin Expansion" for Banking.
   */
  private async applyGlossary(body: string, valueCaseId: UUID): Promise<string> {
    try {
      const { data: vc } = await this.supabase
        .from("value_cases")
        .select("domain_pack_id, domain_pack_snapshot, organization_id")
        .eq("id", valueCaseId)
        .single();

      if (!vc) return body;

      // Prefer snapshot glossary for reproducibility
      let glossary: Record<string, string> = {};
      const snapshot = vc.domain_pack_snapshot as Record<string, unknown> | null;
      if (snapshot?.glossary) {
        glossary = snapshot.glossary as Record<string, string>;
      } else if (vc.domain_pack_id && vc.organization_id) {
        const service = new DomainPackService(this.supabase);
        const packData = await service.getPackWithLayers(vc.domain_pack_id, vc.organization_id);
        const pack = packData.pack as Record<string, unknown>;
        glossary = (pack.glossary as Record<string, string>) ?? {};
      }

      if (Object.keys(glossary).length === 0) return body;

      let result = body;
      for (const [neutral, domain] of Object.entries(glossary)) {
        // Case-insensitive replacement of neutral terms with domain-specific ones
        // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
        const pattern = new RegExp(`\\b${neutral.replace(/_/g, '[_ ]')}\\b`, 'gi');
        result = result.replace(pattern, domain);
      }
      return result;
    } catch {
      // Non-fatal: return body unchanged if glossary lookup fails
      return body;
    }
  }

  private getTemplate(persona: PersonaType): string {
    const cfoTemplate = [
      "### Executive Financial Summary",
      "Based on the latest analysis, this initiative yields an **NPV of ${{results.npv}}** with an **IRR of {{results.irr}}%**.",
      "Compared to the industry benchmark of {{benchmarks.peer_avg}}%, our projected efficiency gains are significant.",
      "The following validated facts support this ROI:",
      "{{facts_placeholder}}",
    ].join("\n");

    const vpSalesTemplate = [
      "### Sales Strategic Value Proposition",
      "Our solution addresses the core bottleneck by improving cycle time by {{results.cycle_improvement}}%.",
      "This allows the team to hit a projected revenue impact of ${{results.total_impact}}, verified against",
      "{{benchmarks.industry_standard}} standards.",
    ].join("\n");

    const templates: Record<PersonaType, string> = {
      [PersonaType.CFO]: cfoTemplate,
      [PersonaType.VP_SALES]: vpSalesTemplate,
    };

    return templates[persona] || templates[PersonaType.CFO];
  }

  public async updateNarrativeStatus(
    narrativeId: UUID,
    status: NarrativeStatus
  ): Promise<Narrative> {
    const { data, error } = await this.supabase
      .from("memory_narratives")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", narrativeId)
      .select()
      .single();

    if (error) throw error;
    return data as Narrative;
  }

  public async listNarratives(
    tenantId: UUID,
    valueCaseId?: UUID,
    status?: NarrativeStatus
  ): Promise<Narrative[]> {
    let query = this.supabase
      .from("memory_narratives")
      .select("*")
      .eq("tenant_id", tenantId);

    if (valueCaseId) {
      query = query.eq("value_case_id", valueCaseId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return data as Narrative[];
  }
}
