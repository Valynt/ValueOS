import Decimal from "decimal.js";

import { logger } from "../../../lib/logger";

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  suggestedValue?: Decimal;
  confidenceScore: number;
}

export interface VMRTLog {
  id: string;
  timestamp: string;
  metricId: string;
  originalValue: Decimal;
  validatedValue: Decimal;
  reasoning: string;
  agentId: string;
  hash: string; // Verification hash for audit trail
}

export class IntegrityService {
  private static instance: IntegrityService;
  private logs: VMRTLog[] = [];

  private constructor() {}

  public static getInstance(): IntegrityService {
    if (!IntegrityService.instance) {
      IntegrityService.instance = new IntegrityService();
    }
    return IntegrityService.instance;
  }

  /**
   * Validates an assumption against conservative quantification rules.
   * Simulates the IntegrityAgent veto.
   */
  public async validateAssumption(
    metricId: string,
    value: Decimal,
    context: { industry: string; benchmarkMedian: Decimal }
  ): Promise<ValidationResult> {
    // Rule: Assumptions should not exceed 120% of the benchmark median without strong evidence
    const threshold = context.benchmarkMedian.mul(1.2);

    if (value.gt(threshold)) {
      return {
        isValid: false,
        reason: `Value exceeds conservative threshold (120% of ${context.industry} median).`,
        suggestedValue: threshold,
        confidenceScore: 0.7,
      };
    }

    return {
      isValid: true,
      confidenceScore: 0.95,
    };
  }

  /**
   * Logs a validated assumption to the VMRT (Value Modeling Reasoning Trace).
   */
  public logToVMRT(log: Omit<VMRTLog, "id" | "timestamp" | "hash">): VMRTLog {
    const newLog: VMRTLog = {
      ...log,
      id: `vmrt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      hash: Math.random().toString(36).substring(7), // Mock hash
    };
    this.logs.push(newLog);
    logger.info("[VMRT] Logged reasoning trace:", newLog);
    return newLog;
  }

  public getVMRTLogs(): VMRTLog[] {
    return [...this.logs];
  }
}
