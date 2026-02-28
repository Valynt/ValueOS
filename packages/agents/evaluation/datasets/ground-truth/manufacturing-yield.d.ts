/**
 * Ground Truth Dataset: Manufacturing Yield Improvement
 *
 * A value case for a discrete manufacturing company improving
 * first-pass yield through predictive quality analytics.
 * Exercises different evidence tiers and a critical red-team objection
 * that triggers a revision cycle.
 */
import type { ProvenanceRecord } from '../../../../memory/provenance/index.js';
import type { ClaimConfidence } from '../../../core/ConfidenceScorer.js';
import type { Citation, ClassifiedEvidence, EvidenceBundle, EvidenceItem } from '../../../core/EvidenceTiering.js';
import type { SagaStateType } from '../../../core/ValueCaseSaga.js';
import type { Objection } from '../../../orchestration/agents/RedTeamAgent.js';
import type { NarrativeBlock, ValueHypothesis, ValueTree } from '../../../orchestration/HypothesisLoop.js';
export declare const SCENARIO_ID = "gt-mfg-yield-001";
export declare const VALUE_CASE_ID = "550e8400-e29b-41d4-a716-446655440002";
export declare const TENANT_ID = "tenant-precision-mfg-001";
export declare const CORRELATION_ID = "660e8400-e29b-41d4-a716-446655440002";
export declare const scenarioMeta: {
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
export declare const hypotheses: ValueHypothesis[];
export declare const evidenceItems: EvidenceItem[];
export declare const classifiedEvidence: ClassifiedEvidence[];
export declare const citations: Citation[];
export declare const evidenceBundle: EvidenceBundle;
export declare const valueTree: ValueTree;
export declare const claimConfidences: ClaimConfidence[];
export declare const narrativeBlock: NarrativeBlock;
export declare const objections: Objection[];
export declare const provenanceRecords: Omit<ProvenanceRecord, 'id' | 'createdAt'>[];
export declare const expectedStateTransitions: Array<{
    from: SagaStateType | 'NONE';
    to: SagaStateType;
    trigger: string;
}>;
export declare const manufacturingYieldScenario: {
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
    readonly hypotheses: ValueHypothesis[];
    readonly evidenceItems: EvidenceItem[];
    readonly classifiedEvidence: ClassifiedEvidence[];
    readonly citations: Citation[];
    readonly evidenceBundle: EvidenceBundle;
    readonly valueTree: ValueTree;
    readonly claimConfidences: ClaimConfidence[];
    readonly narrativeBlock: NarrativeBlock;
    readonly objections: Objection[];
    readonly provenanceRecords: Omit<ProvenanceRecord, "id" | "createdAt">[];
    readonly expectedStateTransitions: {
        from: SagaStateType | "NONE";
        to: SagaStateType;
        trigger: string;
    }[];
    /** This scenario triggers a revision cycle due to obj_101 (critical) */
    readonly expectsRevision: true;
    readonly expectedRevisionCount: 1;
};
//# sourceMappingURL=manufacturing-yield.d.ts.map