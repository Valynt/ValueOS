/**
 * Ground Truth Datasets
 *
 * Complete value case scenarios with all artifacts needed to validate
 * the end-to-end HypothesisLoop pipeline. Each scenario includes:
 * - Hypotheses, evidence, value trees, narratives, objections
 * - Confidence scores and provenance records
 * - Expected saga state transitions
 */
export { saassDsoReductionScenario } from './saas-dso-reduction.js';
export { manufacturingYieldScenario } from './manufacturing-yield.js';
export { healthcareRevenueCycleScenario } from './healthcare-revenue-cycle.js';
import { healthcareRevenueCycleScenario } from './healthcare-revenue-cycle.js';
import { manufacturingYieldScenario } from './manufacturing-yield.js';
import { saassDsoReductionScenario } from './saas-dso-reduction.js';
/** All ground truth scenarios indexed by ID */
export declare const GROUND_TRUTH_SCENARIOS: {
    readonly [saassDsoReductionScenario.meta.id]: {
        readonly meta: {
            id: string;
            name: string;
            industry: string;
            companyProfile: {
                name: string;
                annualRevenue: number;
                employees: number;
                currentDSO: number;
                targetDSO: number;
                arBalance: number;
            };
            description: string;
        };
        readonly valueCaseId: "550e8400-e29b-41d4-a716-446655440001";
        readonly tenantId: "tenant-acme-corp-001";
        readonly correlationId: "660e8400-e29b-41d4-a716-446655440001";
        readonly hypotheses: import("../../../index.js").ValueHypothesis[];
        readonly evidenceItems: import("../../../index.js").EvidenceItem[];
        readonly classifiedEvidence: import("../../../index.js").ClassifiedEvidence[];
        readonly citations: import("../../../index.js").Citation[];
        readonly evidenceBundle: import("../../../index.js").EvidenceBundle;
        readonly valueTree: import("../../../index.js").ValueTree;
        readonly claimConfidences: import("../../../index.js").ClaimConfidence[];
        readonly narrativeBlock: import("../../../index.js").NarrativeBlock;
        readonly objections: import("../../../index.js").Objection[];
        readonly provenanceRecords: Omit<import("@memory/provenance/index.js").ProvenanceRecord, "id" | "createdAt">[];
        readonly expectedStateTransitions: {
            from: import("../../../index.js").SagaStateType | "NONE";
            to: import("../../../index.js").SagaStateType;
            trigger: string;
        }[];
    };
    readonly [manufacturingYieldScenario.meta.id]: {
        readonly meta: {
            id: string;
            name: string;
            industry: string;
            companyProfile: {
                name: string;
                annualRevenue: number;
                employees: number;
                currentYield: number;
                targetYield: number;
                annualScrapCost: number;
                annualReworkCost: number;
            };
            description: string;
        };
        readonly valueCaseId: "550e8400-e29b-41d4-a716-446655440002";
        readonly tenantId: "tenant-precision-mfg-001";
        readonly correlationId: "660e8400-e29b-41d4-a716-446655440002";
        readonly hypotheses: import("../../../index.js").ValueHypothesis[];
        readonly evidenceItems: import("../../../index.js").EvidenceItem[];
        readonly classifiedEvidence: import("../../../index.js").ClassifiedEvidence[];
        readonly citations: import("../../../index.js").Citation[];
        readonly evidenceBundle: import("../../../index.js").EvidenceBundle;
        readonly valueTree: import("../../../index.js").ValueTree;
        readonly claimConfidences: import("../../../index.js").ClaimConfidence[];
        readonly narrativeBlock: import("../../../index.js").NarrativeBlock;
        readonly objections: import("../../../index.js").Objection[];
        readonly provenanceRecords: Omit<import("@memory/provenance/index.js").ProvenanceRecord, "id" | "createdAt">[];
        readonly expectedStateTransitions: {
            from: import("../../../index.js").SagaStateType | "NONE";
            to: import("../../../index.js").SagaStateType;
            trigger: string;
        }[];
        readonly expectsRevision: true;
        readonly expectedRevisionCount: 1;
    };
    readonly [healthcareRevenueCycleScenario.meta.id]: {
        readonly meta: {
            id: string;
            name: string;
            industry: string;
            companyProfile: {
                name: string;
                annualRevenue: number;
                employees: number;
                facilities: number;
                beds: number;
                bedUtilization: number;
                annualDeniedClaims: number;
                denialRate: number;
            };
            description: string;
        };
        readonly valueCaseId: "550e8400-e29b-41d4-a716-446655440003";
        readonly tenantId: "tenant-regional-health-001";
        readonly correlationId: "660e8400-e29b-41d4-a716-446655440003";
        readonly hypotheses: import("../../../index.js").ValueHypothesis[];
        readonly evidenceItems: import("../../../index.js").EvidenceItem[];
        readonly classifiedEvidence: import("../../../index.js").ClassifiedEvidence[];
        readonly citations: import("../../../index.js").Citation[];
        readonly evidenceBundle: import("../../../index.js").EvidenceBundle;
        readonly valueTree: import("../../../index.js").ValueTree;
        readonly claimConfidences: import("../../../index.js").ClaimConfidence[];
        readonly narrativeBlock: import("../../../index.js").NarrativeBlock;
        readonly objections: import("../../../index.js").Objection[];
        readonly provenanceRecords: Omit<import("@memory/provenance/index.js").ProvenanceRecord, "id" | "createdAt">[];
        readonly expectedStateTransitions: {
            from: import("../../../index.js").SagaStateType | "NONE";
            to: import("../../../index.js").SagaStateType;
            trigger: string;
        }[];
        readonly expectsRevision: true;
        readonly expectedRevisionCount: 1;
    };
};
export type GroundTruthScenarioId = keyof typeof GROUND_TRUTH_SCENARIOS;
//# sourceMappingURL=index.d.ts.map