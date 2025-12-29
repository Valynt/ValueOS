/**
 * Ground Truth Engine - 4-Layer Truth Architecture
 * 
 * Architectural enforcement to prevent agent misleading through:
 * - Layer 1: Adversarial Peer Review (IntegrityAgent)
 * - Layer 2: Deterministic Grounding (Citation Enforcement)
 * - Layer 3: Reasoning Chain Viewer (Transparent Logic)
 * - Layer 4: Immutable Audit Trails (SOC 2)
 * 
 * Every agent is treated as an UNTRUSTED actor until output is:
 * - Cryptographically signed
 * - Grounded in specific data sources
 * - Peer-reviewed by IntegrityAgent
 * 
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { createLogger } from '../logger';
import { AgentIdentity, AgentRole } from '../auth/AgentIdentity';

const logger = createLogger({ component: 'GroundTruthEngine' });

// ============================================================================
// Types
// ============================================================================

/**
 * Citation source types
 */
export type SourceType = 
  | 'VMRT'           // Value Management Reference Table
  | 'CRM'            // CRM Record
  | 'BENCHMARK'      // Benchmark Data
  | 'FINANCIAL'      // Financial Statement
  | 'USER_INPUT'     // User-provided data
  | 'CALCULATION'    // Derived calculation
  | 'EXTERNAL_API';  // External data source

/**
 * A verified citation for ground truth
 */
export interface Citation {
  /** Source ID (e.g., VMRT-BENCH-004) */
  id: string;
  /** Type of source */
  type: SourceType;
  /** Specific field or metric referenced */
  field?: string;
  /** Value from the source */
  value: string | number;
  /** When the source was accessed */
  accessedAt: string;
  /** Hash of the source data at access time */
  dataHash?: string;
}

/**
 * A reasoning step in the chain
 */
export interface ReasoningStep {
  /** Step order */
  order: number;
  /** Action description */
  action: string;
  /** Input to this step */
  input: Record<string, unknown>;
  /** Output from this step */
  output: Record<string, unknown>;
  /** Citations used in this step */
  citations: Citation[];
  /** Verification status */
  verified: boolean;
  /** Verification method */
  verificationMethod?: 'data_match' | 'calculation_check' | 'peer_review';
}

/**
 * Complete reasoning chain
 */
export interface ReasoningChain {
  /** Unique chain ID */
  id: string;
  /** Agent that produced this chain */
  agentId: string;
  /** Session ID */
  sessionId: string;
  /** All reasoning steps */
  steps: ReasoningStep[];
  /** Final conclusion */
  conclusion: string;
  /** All citations used */
  citations: Citation[];
  /** Overall verification status */
  verified: boolean;
  /** Timestamp */
  createdAt: string;
}

/**
 * Integrity check request
 */
export interface IntegrityCheckRequest {
  /** Original task input */
  originalPrompt: string;
  /** Agent's output */
  agentOutput: Record<string, unknown>;
  /** Sources cited by the agent */
  citedSources: Citation[];
  /** Reasoning chain if available */
  reasoningChain?: ReasoningChain;
  /** Risk level of the task */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Agent that produced the output */
  producingAgent: {
    id: string;
    role: AgentRole;
  };
}

/**
 * Integrity check result
 */
export interface IntegrityCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Overall confidence in the output */
  confidence: number;
  /** Specific issues found */
  issues: IntegrityIssue[];
  /** Recommendations for correction */
  recommendations: string[];
  /** Timestamp */
  checkedAt: string;
  /** Integrity agent that performed the check */
  checkedBy: string;
}

/**
 * A specific integrity issue
 */
export interface IntegrityIssue {
  /** Issue severity */
  severity: 'warning' | 'error' | 'critical';
  /** Issue category */
  category: 'missing_citation' | 'invalid_source' | 'logical_fallacy' | 'calculation_error' | 'data_mismatch' | 'hallucination_risk';
  /** Issue description */
  message: string;
  /** Location in the output */
  location?: string;
  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Custom error for integrity failures
 */
export class IntegrityError extends Error {
  constructor(
    public readonly issues: IntegrityIssue[],
    public readonly checkResult: IntegrityCheckResult
  ) {
    super(`Integrity check failed: ${issues.map(i => i.message).join('; ')}`);
    this.name = 'IntegrityError';
  }
}

// ============================================================================
// Citation Enforcement (Layer 2)
// ============================================================================

/**
 * Citation pattern: [Source: TYPE-ID] or [Source: TYPE-ID:FIELD]
 * Examples:
 * - [Source: VMRT-BENCH-004]
 * - [Source: CRM-DEAL-12345]
 * - [Source: BENCHMARK-SaaS-ARR]
 */
const CITATION_PATTERN = /\[Source:\s*([A-Z_]+)-([A-Za-z0-9_-]+)(?::([A-Za-z0-9_-]+))?\]/g;

/**
 * Number pattern to detect uncited numerical claims
 */
const UNCITED_NUMBER_PATTERN = /(?<!\[Source:[^\]]*)\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\$\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)\b(?![^\[]*\])/g;

/**
 * Parse citations from text
 */
export function parseCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  let match;
  
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    const [, type, id, field] = match;
    citations.push({
      id: `${type}-${id}`,
      type: type as SourceType,
      field,
      value: '', // Will be populated during verification
      accessedAt: new Date().toISOString(),
    });
  }
  
  return citations;
}

/**
 * Find uncited numerical claims in text
 */
export function findUncitedClaims(text: string): string[] {
  const uncited: string[] = [];
  let match;
  
  // Reset regex
  UNCITED_NUMBER_PATTERN.lastIndex = 0;
  
  while ((match = UNCITED_NUMBER_PATTERN.exec(text)) !== null) {
    uncited.push(match[1]);
  }
  
  // Filter out common false positives (years, small numbers, etc.)
  return uncited.filter(num => {
    const value = parseFloat(num.replace(/[$,%KMB]/g, '').replace(/,/g, ''));
    // Ignore years (1900-2100) and very small numbers
    if (value >= 1900 && value <= 2100) return false;
    if (value < 10 && !num.includes('%') && !num.includes('$')) return false;
    return true;
  });
}

/**
 * Verify that all numerical claims have citations
 * Returns issues if uncited claims are found
 */
export function verifyCitations(text: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const uncitedClaims = findUncitedClaims(text);
  
  for (const claim of uncitedClaims) {
    issues.push({
      severity: 'error',
      category: 'missing_citation',
      message: `Uncited numerical claim: "${claim}" requires a source citation`,
      location: claim,
      suggestedFix: `Add citation in format: ${claim} [Source: VMRT-xxx] or ${claim} [Source: CRM-xxx]`,
    });
  }
  
  return issues;
}

/**
 * Validate that cited sources exist and match
 */
export async function validateCitedSources(
  citations: Citation[],
  sourceValidator: (citation: Citation) => Promise<boolean>
): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];
  
  for (const citation of citations) {
    try {
      const valid = await sourceValidator(citation);
      if (!valid) {
        issues.push({
          severity: 'error',
          category: 'invalid_source',
          message: `Citation ${citation.id} could not be verified`,
          location: citation.id,
          suggestedFix: 'Verify the source ID exists and is accessible',
        });
      }
    } catch (error) {
      issues.push({
        severity: 'warning',
        category: 'invalid_source',
        message: `Failed to validate citation ${citation.id}: ${error}`,
        location: citation.id,
      });
    }
  }
  
  return issues;
}

// ============================================================================
// Reasoning Chain Builder (Layer 3)
// ============================================================================

/**
 * Create a new reasoning chain
 */
export function createReasoningChain(
  agentId: string,
  sessionId: string
): ReasoningChain {
  return {
    id: `chain:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    sessionId,
    steps: [],
    conclusion: '',
    citations: [],
    verified: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Add a step to the reasoning chain
 */
export function addReasoningStep(
  chain: ReasoningChain,
  step: Omit<ReasoningStep, 'order'>
): ReasoningChain {
  return {
    ...chain,
    steps: [
      ...chain.steps,
      { ...step, order: chain.steps.length + 1 },
    ],
    citations: [...chain.citations, ...step.citations],
  };
}

/**
 * Finalize a reasoning chain with conclusion
 */
export function finalizeReasoningChain(
  chain: ReasoningChain,
  conclusion: string,
  allStepsVerified: boolean
): ReasoningChain {
  return {
    ...chain,
    conclusion,
    verified: allStepsVerified && chain.steps.every(s => s.verified),
  };
}

// ============================================================================
// Integrity Agent Interface (Layer 1)
// ============================================================================

/**
 * Interface for the Integrity Agent
 * This is injected into BaseAgent to enable peer review
 */
export interface IIntegrityAgent {
  /**
   * Perform an integrity audit on agent output
   */
  audit(request: IntegrityCheckRequest): Promise<IntegrityCheckResult>;
  
  /**
   * Check for logical fallacies in reasoning
   */
  checkLogic(reasoningChain: ReasoningChain): Promise<IntegrityIssue[]>;
  
  /**
   * Verify calculations are correct
   */
  verifyCalculations(
    inputs: Record<string, number>,
    formula: string,
    result: number
  ): Promise<IntegrityIssue[]>;
}

/**
 * Default integrity agent implementation
 * Uses rule-based checks (can be enhanced with LLM-based review)
 */
export class DefaultIntegrityAgent implements IIntegrityAgent {
  private agentId: string;
  
  constructor() {
    this.agentId = `integrity:${Date.now()}`;
  }
  
  async audit(request: IntegrityCheckRequest): Promise<IntegrityCheckResult> {
    const issues: IntegrityIssue[] = [];
    
    // Layer 2: Citation verification
    const outputText = JSON.stringify(request.agentOutput);
    const citationIssues = verifyCitations(outputText);
    issues.push(...citationIssues);
    
    // Verify cited sources exist
    // In production, this would check against VMRT/CRM databases
    for (const source of request.citedSources) {
      if (!source.id || source.id.length < 3) {
        issues.push({
          severity: 'error',
          category: 'invalid_source',
          message: `Invalid source ID: ${source.id}`,
          location: source.id,
        });
      }
    }
    
    // Layer 3: Check reasoning chain if provided
    if (request.reasoningChain) {
      const logicIssues = await this.checkLogic(request.reasoningChain);
      issues.push(...logicIssues);
    }
    
    // Determine pass/fail
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const errorIssues = issues.filter(i => i.severity === 'error');
    
    const passed = criticalIssues.length === 0 && 
                   (request.riskLevel !== 'critical' || errorIssues.length === 0);
    
    // Calculate confidence
    const confidence = Math.max(0, 1 - (issues.length * 0.1) - (criticalIssues.length * 0.3));
    
    const result: IntegrityCheckResult = {
      passed,
      confidence,
      issues,
      recommendations: this.generateRecommendations(issues),
      checkedAt: new Date().toISOString(),
      checkedBy: this.agentId,
    };
    
    logger.info('Integrity audit completed', {
      producingAgent: request.producingAgent.id,
      riskLevel: request.riskLevel,
      passed,
      issueCount: issues.length,
      confidence,
    });
    
    return result;
  }
  
  async checkLogic(reasoningChain: ReasoningChain): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    
    // Check for empty reasoning
    if (reasoningChain.steps.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'logical_fallacy',
        message: 'No reasoning steps provided - conclusion may be unsupported',
      });
    }
    
    // Check for unverified steps
    const unverifiedSteps = reasoningChain.steps.filter(s => !s.verified);
    if (unverifiedSteps.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'logical_fallacy',
        message: `${unverifiedSteps.length} reasoning step(s) are unverified`,
        location: `Steps: ${unverifiedSteps.map(s => s.order).join(', ')}`,
      });
    }
    
    // Check for steps without citations
    const uncitedSteps = reasoningChain.steps.filter(s => s.citations.length === 0);
    if (uncitedSteps.length > reasoningChain.steps.length * 0.5) {
      issues.push({
        severity: 'warning',
        category: 'missing_citation',
        message: 'More than 50% of reasoning steps lack citations',
      });
    }
    
    return issues;
  }
  
  async verifyCalculations(
    inputs: Record<string, number>,
    formula: string,
    result: number
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    
    // Common ROI/NPV formulas
    const formulas: Record<string, (inputs: Record<string, number>) => number> = {
      'roi': (i) => ((i.revenue - i.cost) / i.cost) * 100,
      'npv': (i) => i.cashFlow / Math.pow(1 + i.discountRate, i.years),
      'payback': (i) => i.investment / i.annualSavings,
    };
    
    const formulaKey = formula.toLowerCase();
    if (formulas[formulaKey]) {
      try {
        const expected = formulas[formulaKey](inputs);
        const tolerance = Math.abs(expected * 0.01); // 1% tolerance
        
        if (Math.abs(result - expected) > tolerance) {
          issues.push({
            severity: 'error',
            category: 'calculation_error',
            message: `Calculation mismatch: expected ${expected.toFixed(2)}, got ${result}`,
            suggestedFix: `Verify inputs and formula: ${formula}`,
          });
        }
      } catch (error) {
        issues.push({
          severity: 'warning',
          category: 'calculation_error',
          message: `Could not verify calculation: ${error}`,
        });
      }
    }
    
    return issues;
  }
  
  private generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];
    
    const categories = new Set(issues.map(i => i.category));
    
    if (categories.has('missing_citation')) {
      recommendations.push('Add citations for all numerical claims using [Source: TYPE-ID] format');
    }
    if (categories.has('invalid_source')) {
      recommendations.push('Verify all cited source IDs exist in VMRT or CRM');
    }
    if (categories.has('logical_fallacy')) {
      recommendations.push('Review reasoning chain for logical consistency');
    }
    if (categories.has('calculation_error')) {
      recommendations.push('Double-check calculations with verified inputs');
    }
    if (categories.has('hallucination_risk')) {
      recommendations.push('Replace general knowledge claims with specific data sources');
    }
    
    return recommendations;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultIntegrityAgent: IIntegrityAgent | null = null;

/**
 * Get the default integrity agent instance
 */
export function getIntegrityAgent(): IIntegrityAgent {
  if (!defaultIntegrityAgent) {
    defaultIntegrityAgent = new DefaultIntegrityAgent();
  }
  return defaultIntegrityAgent;
}

/**
 * Set a custom integrity agent (for testing or enhanced implementations)
 */
export function setIntegrityAgent(agent: IIntegrityAgent): void {
  defaultIntegrityAgent = agent;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Types are exported above
  
  // Citation enforcement
  parseCitations,
  findUncitedClaims,
  verifyCitations,
  validateCitedSources,
  
  // Reasoning chain
  createReasoningChain,
  addReasoningStep,
  finalizeReasoningChain,
  
  // Integrity agent
  DefaultIntegrityAgent,
  getIntegrityAgent,
  setIntegrityAgent,
  
  // Error
  IntegrityError,
};
