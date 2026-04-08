import type { CompanyValueFabricModel, ValueFabricNode } from "./ValueFabricBuilder.js";

type AlignmentMode = "licensor_only" | "licensor_vs_target";

type TargetSignalKind =
  | "use_case"
  | "pain_signal"
  | "value_driver"
  | "objection_signal"
  | "stakeholder"
  | "gap";

export interface TargetSignal {
  kind: TargetSignalKind;
  text: string;
}

export interface AlignmentPathway {
  id: string;
  licensor_node_id: string;
  licensor_node_name: string;
  licensor_node_type: ValueFabricNode["type"];
  matched_target_signals: string[];
  shared_terms: string[];
  confidence_score: number;
  rationale: string;
}

export interface ValueFabricAlignmentResult {
  mode: AlignmentMode;
  pathways: AlignmentPathway[];
  summary: {
    licensor_nodes: number;
    target_signals: number;
    matched_pathways: number;
  };
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "their",
  "our",
  "you",
  "they",
  "them",
  "its",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "will",
  "can",
  "could",
  "would",
  "should",
  "about",
  "through",
  "across",
  "over",
  "under",
  "more",
  "less",
  "high",
  "low",
  "team",
  "teams",
  "company",
  "business",
  "customer",
  "customers",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function unique(tokens: string[]): string[] {
  return Array.from(new Set(tokens));
}

function overlap(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return unique(a.filter((token) => setB.has(token)));
}

function extractTargetSignals(targetContext: unknown): TargetSignal[] {
  const root = asRecord(targetContext);
  const contextJson = asRecord(root.context_json);

  const signals: TargetSignal[] = [];

  for (const useCase of asStringArray(contextJson.use_cases)) {
    signals.push({ kind: "use_case", text: useCase });
  }

  const useCaseObjects = Array.isArray(contextJson.use_cases)
    ? contextJson.use_cases.filter((item) => item && typeof item === "object")
    : [];

  for (const item of useCaseObjects) {
    const row = asRecord(item);
    const name = asString(row.name);
    const description = asString(row.description);
    if (name) signals.push({ kind: "use_case", text: name });
    if (description) signals.push({ kind: "use_case", text: description });
    for (const pain of asStringArray(row.pain_signals)) {
      signals.push({ kind: "pain_signal", text: pain });
    }
  }

  for (const pain of asStringArray(contextJson.pain_signals)) {
    signals.push({ kind: "pain_signal", text: pain });
  }

  const valueDriverObjects = Array.isArray(contextJson.value_drivers)
    ? contextJson.value_drivers.filter((item) => item && typeof item === "object")
    : [];
  for (const item of valueDriverObjects) {
    const row = asRecord(item);
    const name = asString(row.name);
    if (name) signals.push({ kind: "value_driver", text: name });
  }

  for (const candidate of asStringArray(contextJson.value_driver_candidates)) {
    signals.push({ kind: "value_driver", text: candidate });
  }

  for (const objection of asStringArray(contextJson.objection_signals)) {
    signals.push({ kind: "objection_signal", text: objection });
  }

  const stakeholders = Array.isArray(contextJson.stakeholders)
    ? contextJson.stakeholders.filter((item) => item && typeof item === "object")
    : [];
  for (const item of stakeholders) {
    const row = asRecord(item);
    const name = asString(row.name);
    const role = asString(row.role);
    if (name) signals.push({ kind: "stakeholder", text: name });
    if (role) signals.push({ kind: "stakeholder", text: role });
  }

  const gaps = Array.isArray(contextJson.missing_data_gaps)
    ? contextJson.missing_data_gaps.filter((item) => item && typeof item === "object")
    : [];
  for (const item of gaps) {
    const row = asRecord(item);
    const field = asString(row.field);
    if (field) signals.push({ kind: "gap", text: field });
  }

  return signals.filter((signal) => signal.text.length > 0);
}

function pathwayId(nodeId: string, signalText: string): string {
  const signalSlug = signalText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  return `${nodeId}->${signalSlug || "signal"}`;
}

function alignmentRationale(nodeName: string, sharedTerms: string[]): string {
  return `Matched "${nodeName}" to target context via shared terms: ${sharedTerms.join(", ")}`;
}

export function buildValueFabricAlignment(params: {
  licensorModel: CompanyValueFabricModel | Record<string, unknown> | null;
  targetContext?: unknown;
}): ValueFabricAlignmentResult {
  const model = params.licensorModel as CompanyValueFabricModel | null;
  const targetSignals = extractTargetSignals(params.targetContext);

  const licensorNodes = Array.isArray(model?.nodes)
    ? model.nodes.filter((node) =>
        ["product", "capability", "use_case", "persona", "pain", "outcome"].includes(node.type)
      )
    : [];

  if (targetSignals.length === 0 || licensorNodes.length === 0) {
    return {
      mode: targetSignals.length > 0 ? "licensor_vs_target" : "licensor_only",
      pathways: [],
      summary: {
        licensor_nodes: licensorNodes.length,
        target_signals: targetSignals.length,
        matched_pathways: 0,
      },
    };
  }

  const pathways: AlignmentPathway[] = [];

  for (const node of licensorNodes) {
    const nodeTokens = unique(tokenize(`${node.name} ${node.description ?? ""}`));
    if (nodeTokens.length === 0) continue;

    let bestSignal: TargetSignal | null = null;
    let bestSharedTerms: string[] = [];
    let bestScore = 0;

    for (const signal of targetSignals) {
      const signalTokens = unique(tokenize(signal.text));
      if (signalTokens.length === 0) continue;

      const sharedTerms = overlap(nodeTokens, signalTokens);
      if (sharedTerms.length === 0) continue;

      const overlapScore = sharedTerms.length / Math.max(nodeTokens.length, signalTokens.length);
      if (overlapScore > bestScore) {
        bestScore = overlapScore;
        bestSharedTerms = sharedTerms;
        bestSignal = signal;
      }
    }

    if (!bestSignal || bestScore < 0.15) continue;

    const nodeConfidence = typeof node.confidence_score === "number" ? node.confidence_score : 0.6;
    const confidenceScore = Math.min(0.99, Math.max(0.2, nodeConfidence * 0.6 + bestScore * 0.4));

    pathways.push({
      id: pathwayId(node.id, bestSignal.text),
      licensor_node_id: node.id,
      licensor_node_name: node.name,
      licensor_node_type: node.type,
      matched_target_signals: [bestSignal.text],
      shared_terms: bestSharedTerms,
      confidence_score: Number(confidenceScore.toFixed(3)),
      rationale: alignmentRationale(node.name, bestSharedTerms),
    });
  }

  pathways.sort((a, b) => b.confidence_score - a.confidence_score);

  return {
    mode: "licensor_vs_target",
    pathways: pathways.slice(0, 25),
    summary: {
      licensor_nodes: licensorNodes.length,
      target_signals: targetSignals.length,
      matched_pathways: pathways.length,
    },
  };
}
