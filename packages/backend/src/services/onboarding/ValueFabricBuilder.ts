import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

import type { ExtractionResult } from "./SuggestionExtractor.js";

export interface ValueFabricNode {
  id: string;
  type:
    | "product"
    | "capability"
    | "use_case"
    | "persona"
    | "pain"
    | "outcome"
    | "proof_point";
  name: string;
  description?: string;
  confidence_score: number;
  source_urls: string[];
  attributes?: Record<string, unknown>;
}

export interface ValueFabricRelationship {
  id: string;
  from: string;
  to: string;
  type:
    | "offers"
    | "enables"
    | "targets"
    | "experiences"
    | "addresses"
    | "drives"
    | "supported_by";
  confidence_score: number;
}

export interface ValueTreeNode {
  id: string;
  parent_id: string | null;
  type: ValueFabricNode["type"];
  name: string;
  confidence_score: number;
}

export interface CompanyValueFabricModel {
  ontology_version: string;
  generated_at: string;
  tenant_id: string;
  context_id: string;
  source_website?: string;
  nodes: ValueFabricNode[];
  relationships: ValueFabricRelationship[];
  value_tree: {
    roots: string[];
    nodes: ValueTreeNode[];
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => asString(v)).filter(Boolean) : [];
}

function clampConfidence(value: unknown, fallback = 0.6): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function toId(type: string, raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return `${type}:${slug || "unknown"}`;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function buildCompanyValueFabricModel(params: {
  tenantId: string;
  contextId: string;
  website?: string;
  extractionResults: ExtractionResult[];
}): CompanyValueFabricModel {
  const { tenantId, contextId, website, extractionResults } = params;

  const products = extractionResults.find((r) => r.entityType === "product")?.items ?? [];
  const capabilities = extractionResults.find((r) => r.entityType === "capability")?.items ?? [];
  const personas = extractionResults.find((r) => r.entityType === "persona")?.items ?? [];
  const claims = extractionResults.find((r) => r.entityType === "claim")?.items ?? [];
  const valuePatterns = extractionResults.find((r) => r.entityType === "value_pattern")?.items ?? [];

  const nodes: ValueFabricNode[] = [];
  const relationships: ValueFabricRelationship[] = [];
  const treeNodes: ValueTreeNode[] = [];
  const roots: string[] = [];

  const productIds: string[] = [];
  for (const item of products) {
    const payload = asRecord(item.payload);
    const name = asString(payload.name);
    if (!name) continue;
    const id = toId("product", name);
    productIds.push(id);
    roots.push(id);
    nodes.push({
      id,
      type: "product",
      name,
      description: asString(payload.description),
      confidence_score: clampConfidence(item.confidence_score, 0.75),
      source_urls: item.source_urls ?? [],
      attributes: {
        product_type: asString(payload.product_type) || null,
      },
    });
    treeNodes.push({
      id,
      parent_id: null,
      type: "product",
      name,
      confidence_score: clampConfidence(item.confidence_score, 0.75),
    });
  }

  const capabilityIds: string[] = [];
  for (const item of capabilities) {
    const payload = asRecord(item.payload);
    const name = asString(payload.capability);
    if (!name) continue;
    const id = toId("capability", name);
    capabilityIds.push(id);
    const parentProductId = productIds[0] ?? null;
    nodes.push({
      id,
      type: "capability",
      name,
      description: asString(payload.operational_change),
      confidence_score: clampConfidence(item.confidence_score, 0.7),
      source_urls: item.source_urls ?? [],
      attributes: {
        economic_lever: asString(payload.economic_lever) || null,
      },
    });
    treeNodes.push({
      id,
      parent_id: parentProductId,
      type: "capability",
      name,
      confidence_score: clampConfidence(item.confidence_score, 0.7),
    });
    if (parentProductId) {
      relationships.push({
        id: `${parentProductId}->${id}:offers`,
        from: parentProductId,
        to: id,
        type: "offers",
        confidence_score: 0.75,
      });
    }
  }

  const personaIds: string[] = [];
  const painIds: string[] = [];
  for (const item of personas) {
    const payload = asRecord(item.payload);
    const title = asString(payload.title);
    if (!title) continue;
    const personaId = toId("persona", title);
    personaIds.push(personaId);
    nodes.push({
      id: personaId,
      type: "persona",
      name: title,
      confidence_score: clampConfidence(item.confidence_score, 0.65),
      source_urls: item.source_urls ?? [],
      attributes: {
        persona_type: asString(payload.persona_type) || null,
        seniority: asString(payload.seniority) || null,
        typical_kpis: asStringArray(payload.typical_kpis),
      },
    });

    const parentCapabilityId = capabilityIds[0] ?? productIds[0] ?? null;
    treeNodes.push({
      id: personaId,
      parent_id: parentCapabilityId,
      type: "persona",
      name: title,
      confidence_score: clampConfidence(item.confidence_score, 0.65),
    });

    if (parentCapabilityId) {
      relationships.push({
        id: `${parentCapabilityId}->${personaId}:targets`,
        from: parentCapabilityId,
        to: personaId,
        type: "targets",
        confidence_score: 0.6,
      });
    }

    for (const pain of asStringArray(payload.pain_points)) {
      const painId = toId("pain", pain);
      painIds.push(painId);
      nodes.push({
        id: painId,
        type: "pain",
        name: pain,
        confidence_score: clampConfidence(item.confidence_score, 0.6),
        source_urls: item.source_urls ?? [],
      });
      treeNodes.push({
        id: painId,
        parent_id: personaId,
        type: "pain",
        name: pain,
        confidence_score: clampConfidence(item.confidence_score, 0.6),
      });
      relationships.push({
        id: `${personaId}->${painId}:experiences`,
        from: personaId,
        to: painId,
        type: "experiences",
        confidence_score: 0.7,
      });
    }
  }

  const useCaseIds: string[] = [];
  const outcomeIds: string[] = [];
  const proofIds: string[] = [];

  for (const item of valuePatterns) {
    const payload = asRecord(item.payload);
    const name = asString(payload.pattern_name);
    if (!name) continue;
    const useCaseId = toId("use_case", name);
    useCaseIds.push(useCaseId);
    const parentCapabilityId = capabilityIds[0] ?? productIds[0] ?? null;

    nodes.push({
      id: useCaseId,
      type: "use_case",
      name,
      confidence_score: clampConfidence(item.confidence_score, 0.7),
      source_urls: item.source_urls ?? [],
      attributes: {
        typical_kpis: payload.typical_kpis,
        typical_assumptions: payload.typical_assumptions,
      },
    });
    treeNodes.push({
      id: useCaseId,
      parent_id: parentCapabilityId,
      type: "use_case",
      name,
      confidence_score: clampConfidence(item.confidence_score, 0.7),
    });

    if (parentCapabilityId) {
      relationships.push({
        id: `${parentCapabilityId}->${useCaseId}:enables`,
        from: parentCapabilityId,
        to: useCaseId,
        type: "enables",
        confidence_score: 0.7,
      });
    }
  }

  for (const item of claims) {
    const payload = asRecord(item.payload);
    const claimText = asString(payload.claim_text);
    if (!claimText) continue;

    const outcomeName =
      asString(payload.category) && asString(payload.category) !== "null"
        ? `${asString(payload.category)} outcome: ${claimText}`
        : claimText;
    const outcomeId = toId("outcome", outcomeName);
    outcomeIds.push(outcomeId);

    const parentNode = useCaseIds[0] ?? capabilityIds[0] ?? productIds[0] ?? null;
    nodes.push({
      id: outcomeId,
      type: "outcome",
      name: outcomeName,
      description: asString(payload.rationale),
      confidence_score: clampConfidence(item.confidence_score, 0.6),
      source_urls: item.source_urls ?? [],
      attributes: {
        category: asString(payload.category) || null,
        economic_lever: asString(payload.economic_lever) || null,
        implied_kpis: asStringArray(payload.implied_kpis),
        risk_level: asString(payload.risk_level) || "conditional",
      },
    });
    treeNodes.push({
      id: outcomeId,
      parent_id: parentNode,
      type: "outcome",
      name: outcomeName,
      confidence_score: clampConfidence(item.confidence_score, 0.6),
    });

    if (parentNode) {
      relationships.push({
        id: `${parentNode}->${outcomeId}:drives`,
        from: parentNode,
        to: outcomeId,
        type: "drives",
        confidence_score: 0.65,
      });
    }

    const evidence = asString(payload.rationale) || claimText;
    const proofId = toId("proof", evidence.slice(0, 80));
    proofIds.push(proofId);
    nodes.push({
      id: proofId,
      type: "proof_point",
      name: evidence.slice(0, 180),
      confidence_score: clampConfidence(item.confidence_score, 0.55),
      source_urls: item.source_urls ?? [],
      attributes: {
        evidence_strength: asString(payload.evidence_strength) || null,
      },
    });
    treeNodes.push({
      id: proofId,
      parent_id: outcomeId,
      type: "proof_point",
      name: evidence.slice(0, 180),
      confidence_score: clampConfidence(item.confidence_score, 0.55),
    });
    relationships.push({
      id: `${outcomeId}->${proofId}:supported_by`,
      from: outcomeId,
      to: proofId,
      type: "supported_by",
      confidence_score: 0.6,
    });
  }

  for (const capabilityId of capabilityIds) {
    for (const painId of painIds.slice(0, 5)) {
      relationships.push({
        id: `${capabilityId}->${painId}:addresses`,
        from: capabilityId,
        to: painId,
        type: "addresses",
        confidence_score: 0.5,
      });
    }
  }

  return {
    ontology_version: "1.0",
    generated_at: new Date().toISOString(),
    tenant_id: tenantId,
    context_id: contextId,
    source_website: website,
    nodes: dedupeById(nodes),
    relationships: dedupeById(relationships),
    value_tree: {
      roots: dedupeById(roots.map((id) => ({ id }))).map((x) => x.id),
      nodes: dedupeById(treeNodes),
    },
  };
}

export function renderValueFabricForRetrieval(model: CompanyValueFabricModel): string {
  const products = model.nodes.filter((n) => n.type === "product").map((n) => n.name);
  const capabilities = model.nodes.filter((n) => n.type === "capability").map((n) => n.name);
  const useCases = model.nodes.filter((n) => n.type === "use_case").map((n) => n.name);
  const personas = model.nodes.filter((n) => n.type === "persona").map((n) => n.name);
  const pains = model.nodes.filter((n) => n.type === "pain").map((n) => n.name);
  const outcomes = model.nodes.filter((n) => n.type === "outcome").map((n) => n.name);
  const proofPoints = model.nodes.filter((n) => n.type === "proof_point").map((n) => n.name);

  return [
    "VALUE FABRIC (Canonical Semantic Layer)",
    `Ontology Version: ${model.ontology_version}`,
    `Context ID: ${model.context_id}`,
    `Products: ${products.join("; ") || "(none)"}`,
    `Capabilities: ${capabilities.join("; ") || "(none)"}`,
    `Use Cases: ${useCases.join("; ") || "(none)"}`,
    `Target Personas: ${personas.join("; ") || "(none)"}`,
    `Customer Pains: ${pains.join("; ") || "(none)"}`,
    `Business Outcomes: ${outcomes.join("; ") || "(none)"}`,
    `Proof Points: ${proofPoints.join("; ") || "(none)"}`,
    "Value Tree Nodes:",
    ...model.value_tree.nodes.map(
      (n) => `- ${n.type}:${n.name} (parent=${n.parent_id ?? "root"}, confidence=${n.confidence_score})`
    ),
    "Relationships:",
    ...model.relationships.map((r) => `- ${r.type}: ${r.from} -> ${r.to} (confidence=${r.confidence_score})`),
  ].join("\n");
}

export async function persistCompanyValueFabric(params: {
  supabase: SupabaseClient;
  tenantId: string;
  contextId: string;
  website?: string;
  extractionResults: ExtractionResult[];
}): Promise<CompanyValueFabricModel> {
  const { supabase, tenantId, contextId, website, extractionResults } = params;
  const model = buildCompanyValueFabricModel({
    tenantId,
    contextId,
    website,
    extractionResults,
  });

  const { data: contextRow, error: contextErr } = await supabase
    .from("company_contexts")
    .select("id, metadata, version")
    .eq("id", contextId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (contextErr || !contextRow?.id) {
    logger.warn("ValueFabric persistence skipped; context not found", {
      contextId,
      tenantId,
      error: contextErr?.message,
    });
    return model;
  }

  const currentVersion = typeof contextRow.version === "number" ? contextRow.version : 1;
  const nextVersion = currentVersion + 1;
  const metadata = asRecord(contextRow.metadata);
  const mergedMetadata = {
    ...metadata,
    value_fabric_summary: {
      ontology_version: model.ontology_version,
      generated_at: model.generated_at,
      node_count: model.nodes.length,
      relationship_count: model.relationships.length,
    },
  };

  const { error: versionErr } = await supabase.from("company_context_versions").upsert(
    {
      context_id: contextId,
      tenant_id: tenantId,
      version: nextVersion,
      snapshot: JSON.parse(JSON.stringify(model)) as Record<string, unknown>,
      change_reason: "onboarding_value_fabric_ingestion",
    },
    {
      onConflict: "context_id,version",
    }
  );

  if (versionErr) {
    logger.warn("Failed to persist company context version snapshot", {
      contextId,
      tenantId,
      error: versionErr.message,
    });
  }

  const { error: updateErr } = await supabase
    .from("company_contexts")
    .update({
      metadata: mergedMetadata,
      version: nextVersion,
      onboarding_status: "completed",
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contextId)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    logger.warn("Failed to update company context with value fabric summary", {
      contextId,
      tenantId,
      error: updateErr.message,
    });
  }

  return model;
}

