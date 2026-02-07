/**
 * IntegrityAgent Implementation
 * Validates agent outputs for integrity, confidence, and potential issues
 */

import { BaseAgent } from './BaseAgent.js';
import type { AgentOutput, LifecycleContext } from '../../../types/agent.js';

export interface IntegrityCheck {
  isValid: boolean;
  confidence: number;
  issues: IntegrityIssue[];
  suggestions?: any;
}

export interface IntegrityIssue {
  type: 'low_confidence' | 'hallucination' | 'data_integrity' | 'logic_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
}

export class IntegrityAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Perform integrity check on the agent output
    const integrityCheck = await this.checkIntegrity(context);

    const result = {
      integrityCheck,
      validated: integrityCheck.isValid,
      issues: integrityCheck.issues,
      suggestions: integrityCheck.suggestions,
    };

    return this.prepareOutput(result, integrityCheck.isValid ? 'success' : 'warning');
  }

  private async checkIntegrity(context: LifecycleContext): Promise<IntegrityCheck> {
    const issues: IntegrityIssue[] = [];
    let confidence = 1.0;

    // Check for low confidence in agent outputs
    if (context.agentOutput?.confidence !== undefined) {
      const agentConfidence = context.agentOutput.confidence;
      if (agentConfidence < 0.7) {
        issues.push({
          type: 'low_confidence',
          severity: agentConfidence < 0.5 ? 'high' : 'medium',
          description: `Agent confidence (${Math.round(agentConfidence * 100)}%) below acceptable threshold`,
        });
        confidence = Math.min(confidence, agentConfidence);
      }
    }

    // Check for potential hallucinations (simplified check)
    if (context.agentOutput?.result) {
      const result = JSON.stringify(context.agentOutput.result);
      // Simple heuristic: check for repetitive patterns or unlikely claims
      if (result.includes('definitely') && result.includes('certainly')) {
        issues.push({
          type: 'hallucination',
          severity: 'medium',
          description: 'Potential overconfidence in output claims',
        });
        confidence *= 0.8;
      }
    }

    // Check data integrity
    if (context.agentOutput?.metadata?.dataSource) {
      // Verify data source integrity
      const dataSource = context.agentOutput.metadata.dataSource;
      if (!this.isValidDataSource(dataSource)) {
        issues.push({
          type: 'data_integrity',
          severity: 'high',
          description: `Invalid or untrusted data source: ${dataSource}`,
        });
        confidence *= 0.6;
      }
    }

    return {
      isValid: issues.length === 0,
      confidence,
      issues,
      suggestions: issues.length > 0 ? this.generateSuggestions(issues) : undefined,
    };
  }

  /**
   * Evaluate veto / re-refine decision based on integrity check
   */
  public static evaluateVetoDecision(integrityCheck: IntegrityCheck): { veto: boolean; reRefine?: boolean; reason?: string } {
    if (!integrityCheck) return { veto: false };

    // If per-output confidence is low, request a re-refine
    if (integrityCheck.confidence < 0.85) {
      return { veto: false, reRefine: true, reason: 'low_confidence' };
    }

    // If critical data integrity or logic errors exist, veto
    const severe = integrityCheck.issues.find((issue) =>
      (issue.severity === 'high' || issue.severity === 'critical') &&
      (issue.type === 'data_integrity' || issue.type === 'logic_error')
    );

    if (severe) {
      return { veto: true, reason: severe.description };
    }

    return { veto: false };
  }

  private isValidDataSource(source: string): boolean {
    // Simplified validation - in real implementation, check against whitelist
    const validSources = ['crm', 'database', 'api', 'memory', 'calculation'];
    return validSources.some(valid => source.includes(valid));
  }

  private generateSuggestions(issues: IntegrityIssue[]): any {
    const suggestions: any = {};

    issues.forEach(issue => {
      switch (issue.type) {
        case 'low_confidence':
          suggestions.confidence = 'Consider re-running with additional context or verification';
          break;
        case 'hallucination':
          suggestions.verification = 'Cross-reference output with trusted sources';
          break;
        case 'data_integrity':
          suggestions.dataSource = 'Verify data source authenticity and recency';
          break;
        case 'logic_error':
          suggestions.logic = 'Review reasoning chain for logical inconsistencies';
          break;
      }
    });

    return suggestions;
  }
}
