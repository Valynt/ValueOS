/**
 * Hypothesis-First Core Loop Orchestrator
 *
 * Drives the 7-step value engineering loop:
 * 1. Hypothesis — OpportunityAgent proposes value drivers
 * 2. Model — FinancialModelingAgent builds Value Trees
 * 3. Evidence — GroundTruthAgent fetches grounding data
 * 4. Narrative — NarrativeAgent translates math into story
 * 5. Objection — RedTeamAgent stress-tests claims
 * 6. Revision — Re-enter at DRAFTING if critical objections (max 3 cycles)
 * 7. Approval — VE approves, transition to FINALIZED
 *
 * Each step carries an idempotency key, streams progress via SSE,
 * records token usage, and routes failures to the DLQ.
 */
import { z } from 'zod';

import type { DeadLetterQueue } from '../core/DeadLetterQueue.js';
import type { IdempotencyGuard } from '../core/IdempotencyGuard.js';
import type { ValueCaseSaga } from '../core/ValueCaseSaga.js';

import type { Objection, RedTeamAgent } from './agents/RedTeamAgent.js';
export interface ValueHypothesis {
    id: string;
    description: string;
    confidence: number;
    category: string;
    estimatedValue?: number;
}
export interface ValueTree {
    id: string;
    valueCaseId: string;
    nodes: ValueTreeNode[];
    totalValue: number;
    currency: string;
    timestamp: string;
}
export interface ValueRange {
    low: number;
    high: number;
}
export interface ValueDriver {
    metric: string;
    value: number;
    unit: string;
    timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
    assumptions?: string[];
    citations?: string[];
}
export interface ValueTreeNode {
    id: string;
    label: string;
    value: number;
    currency?: string;
    timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
    range?: ValueRange;
    formula?: string;
    confidenceScore: number;
    assumptions: string[];
    dependencies: string[];
    citations: string[];
    drivers: ValueDriver[];
    children?: ValueTreeNode[];
}
export interface NarrativeBlock {
    id: string;
    valueCaseId: string;
    title: string;
    executiveSummary: string;
    sections: NarrativeSection[];
    timestamp: string;
}
export interface NarrativeSection {
    heading: string;
    content: string;
    claimIds: string[];
    confidenceScore: number;
}
export interface LoopProgress {
    step: number;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message?: string;
    timestamp: string;
}
export interface EvidenceReportItem {
    title: string;
    description: string;
    confidence: number;
    category: string;
    verification_type: string;
    priority: string;
}
export interface EvidenceReport {
    valueCaseId: string;
    items: EvidenceReportItem[];
    analysis: string;
    timestamp: string;
}
export interface LoopResult {
    valueCaseId: string;
    tenantId: string;
    hypotheses: ValueHypothesis[];
    valueTree: ValueTree | null;
    evidenceBundle: EvidenceReport | null;
    narrative: NarrativeBlock | null;
    objections: Objection[];
    revisionCount: number;
    finalState: string;
    success: boolean;
    error?: string;
}
export interface LoopConfig {
    maxRevisionCycles: number;
}
export interface OpportunityAgentInterface {
    analyzeOpportunities(query: string, context?: {
        organizationId?: string;
        userId?: string;
        sessionId?: string;
    }): Promise<{
        opportunities: Array<{
            title: string;
            description: string;
            confidence: number;
            category: string;
            estimatedValue?: number;
        }>;
        analysis: string;
    }>;
}
export interface FinancialModelOutput {
    title: string;
    description: string;
    confidence: number;
    category: string;
    model_type: string;
    priority: string;
    value?: number;
    currency?: string;
    timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
    range?: {
        low: number;
        high: number;
    };
    assumptions?: string[];
    dependencies?: string[];
    citations?: string[];
    drivers?: Array<{
        metric: string;
        value: number;
        unit: string;
        timeBasis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
        assumptions?: string[];
        citations?: string[];
    }>;
}
export interface FinancialModelingAgentInterface {
    analyzeFinancialModels(query: string, context?: {
        organizationId?: string;
        userId?: string;
        sessionId?: string;
    }, idempotencyKey?: string): Promise<{
        financial_models: FinancialModelOutput[];
        analysis: string;
    }>;
}
export interface GroundTruthAgentInterface {
    analyzeGroundtruth(query: string, context?: {
        organizationId?: string;
        userId?: string;
        sessionId?: string;
    }, idempotencyKey?: string): Promise<{
        groundtruths: Array<{
            title: string;
            description: string;
            confidence: number;
            category: string;
            verification_type: string;
            priority: string;
        }>;
        analysis: string;
    }>;
}
export interface NarrativeAgentInterface {
    analyzeNarrative(query: string, context?: {
        organizationId?: string;
        userId?: string;
        sessionId?: string;
    }, idempotencyKey?: string): Promise<{
        narratives: Array<{
            title: string;
            description: string;
            confidence: number;
            category: string;
            narrative_type: string;
            priority: string;
        }>;
        analysis: string;
    }>;
}
export interface SSEEmitter {
    send(data: LoopProgress): void;
}
export declare const ValueHypothesisSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    confidence: z.ZodEffects<z.ZodNumber, number, number>;
    category: z.ZodString;
    estimatedValue: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    confidence: number;
    category: string;
    estimatedValue?: number | undefined;
}, {
    id: string;
    description: string;
    confidence: number;
    category: string;
    estimatedValue?: number | undefined;
}>;
export declare const ValueTreeNodeSchema: z.ZodType<ValueTreeNode>;
export declare const ValueTreeSchema: z.ZodObject<{
    id: z.ZodString;
    valueCaseId: z.ZodString;
    nodes: z.ZodArray<z.ZodType<ValueTreeNode, z.ZodTypeDef, ValueTreeNode>, "many">;
    totalValue: z.ZodEffects<z.ZodNumber, number, number>;
    currency: z.ZodString;
    timestamp: z.ZodString;
}, "strict", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    currency: string;
    valueCaseId: string;
    totalValue: number;
    nodes: ValueTreeNode[];
}, {
    timestamp: string;
    id: string;
    currency: string;
    valueCaseId: string;
    totalValue: number;
    nodes: ValueTreeNode[];
}>;
export declare const NarrativeSectionSchema: z.ZodObject<{
    heading: z.ZodString;
    content: z.ZodString;
    claimIds: z.ZodArray<z.ZodString, "many">;
    confidenceScore: z.ZodEffects<z.ZodNumber, number, number>;
}, "strict", z.ZodTypeAny, {
    content: string;
    confidenceScore: number;
    heading: string;
    claimIds: string[];
}, {
    content: string;
    confidenceScore: number;
    heading: string;
    claimIds: string[];
}>;
export declare const NarrativeBlockSchema: z.ZodObject<{
    id: z.ZodString;
    valueCaseId: z.ZodString;
    title: z.ZodString;
    executiveSummary: z.ZodString;
    sections: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
        claimIds: z.ZodArray<z.ZodString, "many">;
        confidenceScore: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strict", z.ZodTypeAny, {
        content: string;
        confidenceScore: number;
        heading: string;
        claimIds: string[];
    }, {
        content: string;
        confidenceScore: number;
        heading: string;
        claimIds: string[];
    }>, "many">;
    timestamp: z.ZodString;
}, "strict", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    title: string;
    sections: {
        content: string;
        confidenceScore: number;
        heading: string;
        claimIds: string[];
    }[];
    valueCaseId: string;
    executiveSummary: string;
}, {
    timestamp: string;
    id: string;
    title: string;
    sections: {
        content: string;
        confidenceScore: number;
        heading: string;
        claimIds: string[];
    }[];
    valueCaseId: string;
    executiveSummary: string;
}>;
/** Schema for the evidence bundle as constructed by the loop (not the formal EvidenceBundle domain type). */
export declare const EvidenceReportSchema: z.ZodObject<{
    valueCaseId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        confidence: z.ZodEffects<z.ZodNumber, number, number>;
        category: z.ZodString;
        verification_type: z.ZodString;
        priority: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        title: string;
        priority: string;
        confidence: number;
        category: string;
        verification_type: string;
    }, {
        description: string;
        title: string;
        priority: string;
        confidence: number;
        category: string;
        verification_type: string;
    }>, "many">;
    analysis: z.ZodString;
    timestamp: z.ZodString;
}, "strict", z.ZodTypeAny, {
    timestamp: string;
    valueCaseId: string;
    items: {
        description: string;
        title: string;
        priority: string;
        confidence: number;
        category: string;
        verification_type: string;
    }[];
    analysis: string;
}, {
    timestamp: string;
    valueCaseId: string;
    items: {
        description: string;
        title: string;
        priority: string;
        confidence: number;
        category: string;
        verification_type: string;
    }[];
    analysis: string;
}>;
export declare const LoopResultSchema: z.ZodObject<{
    valueCaseId: z.ZodString;
    tenantId: z.ZodString;
    hypotheses: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        confidence: z.ZodEffects<z.ZodNumber, number, number>;
        category: z.ZodString;
        estimatedValue: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        confidence: number;
        category: string;
        estimatedValue?: number | undefined;
    }, {
        id: string;
        description: string;
        confidence: number;
        category: string;
        estimatedValue?: number | undefined;
    }>, "many">;
    valueTree: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        valueCaseId: z.ZodString;
        nodes: z.ZodArray<z.ZodType<ValueTreeNode, z.ZodTypeDef, ValueTreeNode>, "many">;
        totalValue: z.ZodEffects<z.ZodNumber, number, number>;
        currency: z.ZodString;
        timestamp: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        currency: string;
        valueCaseId: string;
        totalValue: number;
        nodes: ValueTreeNode[];
    }, {
        timestamp: string;
        id: string;
        currency: string;
        valueCaseId: string;
        totalValue: number;
        nodes: ValueTreeNode[];
    }>>;
    evidenceBundle: z.ZodNullable<z.ZodObject<{
        valueCaseId: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            confidence: z.ZodEffects<z.ZodNumber, number, number>;
            category: z.ZodString;
            verification_type: z.ZodString;
            priority: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }, {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }>, "many">;
        analysis: z.ZodString;
        timestamp: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        timestamp: string;
        valueCaseId: string;
        items: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
        analysis: string;
    }, {
        timestamp: string;
        valueCaseId: string;
        items: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
        analysis: string;
    }>>;
    narrative: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        valueCaseId: z.ZodString;
        title: z.ZodString;
        executiveSummary: z.ZodString;
        sections: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
            claimIds: z.ZodArray<z.ZodString, "many">;
            confidenceScore: z.ZodEffects<z.ZodNumber, number, number>;
        }, "strict", z.ZodTypeAny, {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }, {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }>, "many">;
        timestamp: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        title: string;
        sections: {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }[];
        valueCaseId: string;
        executiveSummary: string;
    }, {
        timestamp: string;
        id: string;
        title: string;
        sections: {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }[];
        valueCaseId: string;
        executiveSummary: string;
    }>>;
    objections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        targetComponent: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        category: z.ZodEnum<["assumption", "data_quality", "math_error", "missing_evidence", "logical_gap"]>;
        description: z.ZodString;
        suggestedRevision: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }, {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }>, "many">;
    revisionCount: z.ZodNumber;
    finalState: z.ZodString;
    success: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    success: boolean;
    valueCaseId: string;
    objections: {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }[];
    narrative: {
        timestamp: string;
        id: string;
        title: string;
        sections: {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }[];
        valueCaseId: string;
        executiveSummary: string;
    } | null;
    hypotheses: {
        id: string;
        description: string;
        confidence: number;
        category: string;
        estimatedValue?: number | undefined;
    }[];
    valueTree: {
        timestamp: string;
        id: string;
        currency: string;
        valueCaseId: string;
        totalValue: number;
        nodes: ValueTreeNode[];
    } | null;
    evidenceBundle: {
        timestamp: string;
        valueCaseId: string;
        items: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
        analysis: string;
    } | null;
    revisionCount: number;
    finalState: string;
    error?: string | undefined;
}, {
    tenantId: string;
    success: boolean;
    valueCaseId: string;
    objections: {
        id: string;
        description: string;
        severity: "critical" | "low" | "medium" | "high";
        category: "assumption" | "data_quality" | "math_error" | "missing_evidence" | "logical_gap";
        targetComponent: string;
        suggestedRevision?: string | undefined;
    }[];
    narrative: {
        timestamp: string;
        id: string;
        title: string;
        sections: {
            content: string;
            confidenceScore: number;
            heading: string;
            claimIds: string[];
        }[];
        valueCaseId: string;
        executiveSummary: string;
    } | null;
    hypotheses: {
        id: string;
        description: string;
        confidence: number;
        category: string;
        estimatedValue?: number | undefined;
    }[];
    valueTree: {
        timestamp: string;
        id: string;
        currency: string;
        valueCaseId: string;
        totalValue: number;
        nodes: ValueTreeNode[];
    } | null;
    evidenceBundle: {
        timestamp: string;
        valueCaseId: string;
        items: {
            description: string;
            title: string;
            priority: string;
            confidence: number;
            category: string;
            verification_type: string;
        }[];
        analysis: string;
    } | null;
    revisionCount: number;
    finalState: string;
    error?: string | undefined;
}>;
export declare class HypothesisLoop {
    private saga;
    private idempotencyGuard;
    private dlq;
    private opportunityAgent;
    private financialModelingAgent;
    private groundTruthAgent;
    private narrativeAgent;
    private redTeamAgent;
    private config;
    constructor(deps: {
        saga: ValueCaseSaga;
        idempotencyGuard: IdempotencyGuard;
        dlq: DeadLetterQueue;
        opportunityAgent: OpportunityAgentInterface;
        financialModelingAgent: FinancialModelingAgentInterface;
        groundTruthAgent: GroundTruthAgentInterface;
        narrativeAgent: NarrativeAgentInterface;
        redTeamAgent: RedTeamAgent;
        config?: Partial<LoopConfig>;
    });
    /**
     * Run the full hypothesis-first core loop.
     *
     * @param domainPackContext - Optional KPI vocabulary from a domain pack,
     *   prepended to agent queries so they prefer industry-specific terminology.
     */
    run(valueCaseId: string, tenantId: string, correlationId: string, sse?: SSEEmitter, domainPackContext?: string): Promise<LoopResult>;
    private executeWithGuard;
    /**
     * Build a ValueTree from the modeling agent's structured output.
     * Falls back to hypothesis estimatedValue when the model doesn't provide a value.
     */
    private buildValueTree;
    private emitProgress;
}
//# sourceMappingURL=HypothesisLoop.d.ts.map