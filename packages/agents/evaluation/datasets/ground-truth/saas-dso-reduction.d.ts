/**
 * Ground Truth Dataset: SaaS DSO Reduction
 *
 * A complete value case scenario for a mid-market SaaS company
 * reducing Days Sales Outstanding (DSO) through accounts receivable automation.
 * Based on realistic financial data patterns from public SaaS companies.
 */
import type { Citation, ClassifiedEvidence, EvidenceBundle, EvidenceItem } from '../../../core/EvidenceTiering.js';
import type { ClaimConfidence } from '../../../core/ConfidenceScorer.js';
import type { ProvenanceRecord } from '../../../../memory/provenance/index.js';
import type { NarrativeBlock, ValueHypothesis, ValueTree } from '../../../orchestration/HypothesisLoop.js';
import type { Objection } from '../../../orchestration/agents/RedTeamAgent.js';
import type { SagaStateType } from '../../../core/ValueCaseSaga.js';
export declare const SCENARIO_ID = "gt-saas-dso-001";
export declare const VALUE_CASE_ID = "550e8400-e29b-41d4-a716-446655440001";
export declare const TENANT_ID = "tenant-acme-corp-001";
export declare const CORRELATION_ID = "660e8400-e29b-41d4-a716-446655440001";
export declare const scenarioMeta: {
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
export declare const saassDsoReductionScenario: {
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
};
//# sourceMappingURL=saas-dso-reduction.d.ts.map