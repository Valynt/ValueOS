/**
 * Calibrated Agent Example
 * 
 * Demonstrates how to integrate confidence calibration into agent execution
 * to ensure confidence scores accurately reflect true probability of correctness.
 * 
 * P0 BLOCKER FIX: This pattern must be followed by all production agents.
 */

import { BaseAgent } from '../agents/BaseAgent';
import { ConfidenceCalibrationService } from '../ConfidenceCalibration';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../logger';

/**
 * Example agent with confidence calibration
 */
export class CalibratedOpportunityAgent extends BaseAgent {
  public lifecycleStage = 'opportunity';
  public version = '2.0.0';
  public name = 'CalibratedOpportunityAgent';

  private calibrationService: ConfidenceCalibrationService;

  constructor(config: Record<string, unknown>) {
    super(config);
    
    if (!this.supabase) {
      throw new Error('Supabase client required for calibration');
    }
    
    this.calibrationService = new ConfidenceCalibrationService(this.supabase);
  }

  /**
   * Execute agent with calibrated confidence
   */
  async execute(sessionId: string, input: unknown): Promise<unknown> {
    // 0. Get tenantId from session or input (assuming input has context or derived)
    // For example, fetch session to get tenantId
    const tenantId = await this.getTenantId(sessionId);

    // 1. Execute agent logic (existing implementation)
    const rawResult = await this.executeInternal(sessionId, input);

    // 2. Calibrate confidence score
    const calibrationResult = await this.calibrationService.calibrate(
      this.agentId,
      rawResult.confidence,
      tenantId,
      0.7  // Minimum acceptable confidence threshold
    );

    // 3. Apply calibrated confidence to result
    const calibratedResult = {
      ...rawResult,
      rawConfidence: calibrationResult.rawConfidence,
      calibratedConfidence: calibrationResult.calibratedConfidence,
      confidenceCalibrated: true
    };

    // 4. Check if fallback should be triggered
    if (calibrationResult.shouldTriggerFallback) {
      logger.warn('Calibrated confidence below threshold, triggering fallback', {
        agentId: this.agentId,
        sessionId,
        tenantId,
        rawConfidence: calibrationResult.rawConfidence,
        calibratedConfidence: calibrationResult.calibratedConfidence,
        threshold: calibrationResult.calibrationModel.minThreshold
      });

      // Trigger human-in-the-loop fallback
      return this.triggerHumanFallback(sessionId, calibratedResult);
    }

    // 5. Check if retraining should be triggered
    if (calibrationResult.shouldTriggerRetraining) {
      logger.warn('Calibration error high, triggering retraining', {
        agentId: this.agentId,
        tenantId,
        calibrationError: calibrationResult.calibrationModel.calibrationError,
        threshold: calibrationResult.calibrationModel.retrainingThreshold
      });

      await this.calibrationService.triggerRetraining(
        this.agentId,
        tenantId,
        `High calibration error: ${calibrationResult.calibrationModel.calibrationError}`
      );
    }

    // 6. Store prediction with calibrated confidence for future calibration
    if (this.supabase) {
      await this.storePrediction(sessionId, tenantId, calibratedResult);
    }

    return calibratedResult;
  }

  /**
   * Helper to get tenant ID from session
   */
  private async getTenantId(sessionId: string): Promise<string> {
    if (!this.supabase) return 'unknown';

    const { data } = await this.supabase
      .from('agent_sessions')
      .select('tenant_id')
      .eq('id', sessionId)
      .single();

    return data?.tenant_id || 'unknown';
  }

  /**
   * Internal execution logic (existing agent implementation)
   */
  private async executeInternal(_sessionId: string, _input: unknown): Promise<{
    opportunities: any[];
    confidence: number;
    reasoning: string;
    evidence: any[];
  }> {
    // Existing agent logic here
    // Returns result with raw confidence score
    return {
      opportunities: [],
      confidence: 0.85,  // Raw confidence from LLM
      reasoning: 'Analysis complete',
      evidence: []
    };
  }

  /**
   * Trigger human-in-the-loop fallback when confidence is too low
   */
  private async triggerHumanFallback(sessionId: string, result: any): Promise<unknown> {
    logger.info('Triggering human-in-the-loop fallback', {
      agentId: this.agentId,
      sessionId,
      calibratedConfidence: result.calibratedConfidence
    });

    // Create approval request
    if (this.supabase) {
      await this.supabase
        .from('approval_requests')
        .insert({
          session_id: sessionId,
          agent_id: this.agentId,
          request_type: 'low_confidence_review',
          status: 'pending',
          data: result,
          reason: `Calibrated confidence ${result.calibratedConfidence} below threshold`,
          created_at: new Date().toISOString()
        });
    }

    return {
      ...result,
      requiresHumanReview: true,
      reviewReason: 'Calibrated confidence below acceptable threshold'
    };
  }

  /**
   * Store prediction for future calibration
   */
  private async storePrediction(sessionId: string, tenantId: string, result: any): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('agent_predictions')
      .insert({
        session_id: sessionId,
        agent_id: this.agentId,
        agent_type: this.lifecycleStage,
        tenant_id: tenantId,
        input_hash: this.hashInput(result.input),
        input_data: result.input,
        prediction: result,
        confidence_level: this.mapConfidenceLevel(result.calibratedConfidence),
        confidence_score: result.rawConfidence,
        calibrated_confidence: result.calibratedConfidence,
        reasoning: result.reasoning,
        evidence: result.evidence,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Map calibrated confidence to level
   */
  private mapConfidenceLevel(calibratedConfidence: number): string {
    if (calibratedConfidence >= 0.8) return 'high';
    if (calibratedConfidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Hash input for deduplication
   */
  private hashInput(input: unknown): string {
    return Buffer.from(JSON.stringify(input)).toString('base64').substring(0, 32);
  }
}

/**
 * Usage Example
 */
export async function exampleUsage(supabase: SupabaseClient) {
  // 1. Create calibrated agent
  const agent = new CalibratedOpportunityAgent({
    id: 'opportunity-agent-001',
    supabase,
    llmGateway: {} as any,  // Your LLM gateway
    memorySystem: {} as any,  // Your memory system
    auditLogger: {} as any  // Your audit logger
  });

  // 2. Execute agent
  // execute now fetches tenantId internally
  const result: any = await agent.execute('session-123', {
    companyName: 'Acme Corp',
    industry: 'Technology'
  });

  // 3. Check if human review is required
  if (result.requiresHumanReview) {
    // Route to human reviewer
    logger.info('Human review required', { reason: result.reviewReason });
  } else {
    // Proceed with automated workflow
    logger.info('Agent executed successfully', { 
      calibratedConfidence: result.calibratedConfidence 
    });
  }

  // 4. Later, record actual outcome for calibration
  await supabase
    .from('agent_predictions')
    .update({
      actual_outcome: { success: true },
      actual_recorded_at: new Date().toISOString(),
      variance_percentage: 5.2  // Actual vs predicted variance
    })
    .eq('session_id', 'session-123')
    .eq('agent_id', 'opportunity-agent-001');

  // 5. Periodically check calibration status
  const calibrationService = new ConfidenceCalibrationService(supabase);
  // Get tenant ID (assuming known or retrieved)
  const tenantId = 'tenant-123';
  const stats = await calibrationService.getCalibrationStats('opportunity-agent-001', tenantId);
  
  logger.info('Calibration Status', {
    recentAccuracy: stats.recentAccuracy,
    calibrationError: stats.model?.calibrationError,
    needsRecalibration: stats.needsRecalibration
  });

  // 6. Manually trigger recalibration if needed
  if (stats.needsRecalibration) {
    await calibrationService.triggerRetraining(
      'opportunity-agent-001',
      tenantId,
      'Manual recalibration requested'
    );
  }
}
