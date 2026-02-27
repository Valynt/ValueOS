/**
 * Ground Truth Dataset: Healthcare Revenue Cycle
 *
 * A value case for a regional hospital network reducing denied claims
 * and improving bed utilization through revenue cycle automation
 * and predictive discharge planning.
 */
import type { Citation, ClassifiedEvidence, EvidenceBundle, EvidenceItem } from '../../../core/EvidenceTiering.js';
import type { ClaimConfidence } from '../../../core/ConfidenceScorer.js';
import type { ProvenanceRecord } from '../../../../memory/provenance/index.js';
import type { NarrativeBlock, ValueHypothesis, ValueTree } from '../../../orchestration/HypothesisLoop.js';
import type { Objection } from '../../../orchestration/agents/RedTeamAgent.js';
import type { SagaStateType } from '../../../core/ValueCaseSaga.js';
export declare const SCENARIO_ID = "gt-healthcare-revcycle-001";
export declare const VALUE_CASE_ID = "550e8400-e29b-41d4-a716-446655440003";
export declare const TENANT_ID = "tenant-regional-health-001";
export declare const CORRELATION_ID = "660e8400-e29b-41d4-a716-446655440003";
export declare const scenarioMeta: {
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
export declare const healthcareRevenueCycleScenario: {
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
    readonly expectsRevision: true;
    readonly expectedRevisionCount: 1;
};
//# sourceMappingURL=healthcare-revenue-cycle.d.ts.map