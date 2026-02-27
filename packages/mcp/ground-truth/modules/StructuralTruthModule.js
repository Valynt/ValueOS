"use strict";
/**
 * ESOModule - Economic Structure Ontology & VOS-PT-1 MCP Module
 *
 * Provides tools for:
 * - get_metric_value: Retrieve KPI benchmarks with industry/size context
 * - validate_claim: Check financial claims against ground truth
 * - get_value_chain: Trace causal relationships between KPIs
 * - get_similar_traces: Find relevant VMRT examples for reasoning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESOModule = exports.StructuralTruthModuleSchema = exports.STRUCTURAL_TRUTH_SCHEMA_FIELDS = void 0;
const BaseModule_1 = require("../core/BaseModule");
const zod_1 = require("zod");
const eso_data_1 = require("@backend/types/eso-data");
const vos_pt1_seed_1 = require("@backend/types/vos-pt1-seed");
const eso_1 = require("@backend/types/eso");
// ============================================================================
// Types
// ============================================================================
exports.STRUCTURAL_TRUTH_SCHEMA_FIELDS = [
    "integrity_checks",
    "analysis",
    "timestamp",
];
exports.StructuralTruthModuleSchema = zod_1.z
    .object({
    integrity_checks: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        confidence: zod_1.z.number().min(0).max(1),
        category: zod_1.z.string(),
        priority: zod_1.z.string(),
        status: zod_1.z.string(),
    })),
    analysis: zod_1.z.string(),
    timestamp: zod_1.z.string(),
})
    .passthrough();
// ============================================================================
// Module Implementation
// ============================================================================
class ESOModule extends BaseModule_1.BaseModule {
    moduleName = "eso";
    moduleVersion = "1.0.0";
    kpiIndex;
    edgeIndex;
    personaIndex;
    constructor() {
        super();
        this.kpiIndex = new Map();
        this.edgeIndex = new Map();
        this.personaIndex = new Map();
    }
    async initialize() {
        // Index all KPIs
        for (const kpi of eso_data_1.ALL_ESO_KPIS) {
            this.kpiIndex.set(kpi.id, kpi);
        }
        // Index edges by source
        for (const edge of eso_data_1.EXTENDED_ESO_EDGES) {
            const existing = this.edgeIndex.get(edge.sourceId) || [];
            existing.push(edge);
            this.edgeIndex.set(edge.sourceId, existing);
        }
        // Index personas
        for (const persona of eso_data_1.EXTENDED_PERSONA_MAPS) {
            this.personaIndex.set(persona.persona, persona);
        }
        console.log(`ESO Module initialized: ${this.kpiIndex.size} KPIs, ${eso_data_1.EXTENDED_ESO_EDGES.length} edges`);
    }
    getTools() {
        return [
            {
                name: "eso_get_metric_value",
                description: "Get benchmark value for a KPI with industry context",
                inputSchema: {
                    type: "object",
                    properties: {
                        metricId: {
                            type: "string",
                            description: "KPI identifier (e.g., saas_nrr, fin_dso)",
                        },
                        industry: { type: "string", description: "Industry vertical" },
                        companySize: {
                            type: "string",
                            enum: ["smb", "mid_market", "enterprise"],
                        },
                        percentile: {
                            type: "string",
                            enum: ["p25", "p50", "p75"],
                            default: "p50",
                        },
                    },
                    required: ["metricId"],
                },
            },
            {
                name: "eso_validate_claim",
                description: "Validate a financial claim against industry benchmarks",
                inputSchema: {
                    type: "object",
                    properties: {
                        metricId: { type: "string", description: "KPI identifier" },
                        claimedValue: {
                            type: "number",
                            description: "The claimed metric value",
                        },
                        projectedImprovement: {
                            type: "number",
                            description: "Optional projected improvement",
                        },
                    },
                    required: ["metricId", "claimedValue"],
                },
            },
            {
                name: "eso_get_value_chain",
                description: "Get causal relationships and financial drivers for a KPI",
                inputSchema: {
                    type: "object",
                    properties: {
                        metricId: { type: "string", description: "KPI identifier" },
                        depth: {
                            type: "number",
                            description: "Traversal depth",
                            default: 2,
                        },
                    },
                    required: ["metricId"],
                },
            },
            {
                name: "eso_get_similar_traces",
                description: "Find similar VMRT reasoning traces for reference",
                inputSchema: {
                    type: "object",
                    properties: {
                        industry: { type: "string", description: "Filter by industry" },
                        outcomeCategory: {
                            type: "string",
                            description: "Filter by outcome type",
                        },
                        persona: {
                            type: "string",
                            description: "Filter by target persona",
                        },
                        limit: { type: "number", default: 5 },
                    },
                },
            },
            {
                name: "eso_get_persona_kpis",
                description: "Get KPIs relevant to a stakeholder persona",
                inputSchema: {
                    type: "object",
                    properties: {
                        persona: {
                            type: "string",
                            description: "Persona (cfo, cio, vp_ops, etc.)",
                        },
                    },
                    required: ["persona"],
                },
            },
        ];
    }
    async handleToolCall(toolName, args) {
        switch (toolName) {
            case "eso_get_metric_value":
                return this.getMetricValue(args);
            case "eso_validate_claim":
                return this.validateClaim(args);
            case "eso_get_value_chain":
                return this.getValueChain(args);
            case "eso_get_similar_traces":
                return this.getSimilarTraces(args);
            case "eso_get_persona_kpis":
                return this.getPersonaKPIs(args.persona);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    // ============================================================================
    // Tool Implementations
    // ============================================================================
    getMetricValue(request) {
        const kpi = this.kpiIndex.get(request.metricId);
        if (!kpi) {
            throw new Error(`Unknown metric: ${request.metricId}`);
        }
        const percentile = request.percentile || "p50";
        const value = kpi.benchmarks[percentile];
        return {
            metricId: kpi.id,
            name: kpi.name,
            value,
            unit: kpi.unit,
            percentile,
            source: kpi.benchmarks.source,
            benchmarks: {
                p25: kpi.benchmarks.p25,
                p50: kpi.benchmarks.p50,
                p75: kpi.benchmarks.p75,
                worldClass: kpi.benchmarks.worldClass,
            },
            context: {
                industry: kpi.domain,
                improvementDirection: kpi.improvementDirection,
            },
            confidence: 0.9,
        };
    }
    validateClaim(request) {
        const result = (0, eso_1.checkBenchmarkAlignment)(request.metricId, request.claimedValue);
        const kpi = this.kpiIndex.get(request.metricId);
        if (!kpi) {
            return {
                valid: false,
                percentile: "unknown",
                warning: `Unknown metric: ${request.metricId}`,
                benchmark: { p25: 0, p50: 0, p75: 0 },
            };
        }
        return {
            valid: result.aligned,
            percentile: result.percentile,
            warning: result.warning,
            benchmark: {
                p25: kpi.benchmarks.p25,
                p50: kpi.benchmarks.p50,
                p75: kpi.benchmarks.p75,
            },
            recommendation: result.warning
                ? "Consider using P50 benchmark for conservative estimates"
                : undefined,
        };
    }
    getValueChain(request) {
        const kpi = this.kpiIndex.get(request.metricId);
        if (!kpi) {
            throw new Error(`Unknown metric: ${request.metricId}`);
        }
        const upstream = [];
        const downstream = [];
        // Find upstream (dependencies)
        for (const depId of kpi.dependencies) {
            const depKpi = this.kpiIndex.get(depId);
            if (depKpi) {
                const edge = eso_data_1.EXTENDED_ESO_EDGES.find((e) => e.sourceId === depId && e.targetId === kpi.id);
                if (edge) {
                    upstream.push({ metric: depKpi, relationship: edge });
                }
            }
        }
        // Find downstream (what depends on this)
        const edges = this.edgeIndex.get(request.metricId) || [];
        for (const edge of edges) {
            const targetKpi = this.kpiIndex.get(edge.targetId);
            if (targetKpi) {
                downstream.push({ metric: targetKpi, relationship: edge });
            }
        }
        // Find financial drivers from persona maps
        const financialDrivers = [];
        for (const persona of eso_data_1.EXTENDED_PERSONA_MAPS) {
            if (persona.keyKPIs.includes(request.metricId)) {
                financialDrivers.push(persona.financialDriver);
            }
        }
        return {
            rootMetric: kpi,
            upstream,
            downstream,
            financialDrivers: [...new Set(financialDrivers)],
        };
    }
    getSimilarTraces(request) {
        const limit = request.limit || 5;
        const filtered = vos_pt1_seed_1.ALL_VMRT_SEEDS.filter((trace) => {
            if (request.industry &&
                trace.context?.organization?.industry !== request.industry) {
                return false;
            }
            if (request.outcomeCategory &&
                trace.valueModel?.outcomeCategory !== request.outcomeCategory) {
                return false;
            }
            if (request.persona && trace.context?.persona !== request.persona) {
                return false;
            }
            return true;
        });
        const traces = filtered.slice(0, limit).map((trace) => ({
            traceId: trace.traceId,
            summary: trace.reasoningSteps?.[0]?.description || "No summary",
            industry: trace.context?.organization?.industry || "unknown",
            outcomeCategory: trace.valueModel?.outcomeCategory || "unknown",
            totalImpact: trace.valueModel?.financialImpact?.totalImpact?.amount || 0,
            confidence: trace.qualityMetrics?.overallConfidence || 0,
        }));
        return {
            traces,
            count: traces.length,
        };
    }
    getPersonaKPIs(persona) {
        const personaMap = this.personaIndex.get(persona);
        if (!personaMap) {
            throw new Error(`Unknown persona: ${persona}`);
        }
        const kpis = personaMap.keyKPIs
            .map((id) => this.kpiIndex.get(id))
            .filter(Boolean);
        return {
            persona: personaMap.persona,
            primaryPain: personaMap.primaryPain,
            financialDriver: personaMap.financialDriver,
            kpis: kpis.map((kpi) => ({
                id: kpi.id,
                name: kpi.name,
                benchmarks: kpi.benchmarks,
                improvementDirection: kpi.improvementDirection,
            })),
            communicationPreference: personaMap.communicationPreference,
        };
    }
}
exports.ESOModule = ESOModule;
//# sourceMappingURL=StructuralTruthModule.js.map