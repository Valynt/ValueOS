import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface AgentSuggestionEvent {
  agentId: string;
  sessionId: string;
  suggestionType: string;
  confidence: number;
  hallucinationCheck?: boolean;
  accepted: boolean;
  userId?: string;
  organizationId: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface SecurityEvent {
  type: 'rls_violation' | 'hallucination_detected' | 'circuit_breaker_triggered' | 'confidence_threshold_breached';
  severity: 'low' | 'medium' | 'high' | 'critical';
  agentId?: string;
  sessionId?: string;
  organizationId: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface TelemetryMetrics {
  agentSuggestions: {
    total: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number;
  };
  hallucinationRate: number;
  averageConfidence: number;
  rlsViolations: number;
  circuitBreakerTriggers: number;
  confidenceBreaches: number;
}

export class TelemetryGuardrailsService {
  /**
   * Track agent suggestion acceptance/rejection
   */
  async trackSuggestion(event: AgentSuggestionEvent): Promise<void> {
    try {
      await supabase
        .from('agent_suggestion_events')
        .insert({
          agent_id: event.agentId,
          session_id: event.sessionId,
          suggestion_type: event.suggestionType,
          confidence: event.confidence,
          hallucination_check: event.hallucinationCheck,
          accepted: event.accepted,
          user_id: event.userId,
          organization_id: event.organizationId,
          timestamp: event.timestamp.toISOString(),
          context: event.context,
        });

      // Check for concerning patterns
      await this.checkSuggestionPatterns(event);
    } catch (error) {
      logger.error('Failed to track suggestion', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await supabase
        .from('security_events')
        .insert({
          type: event.type,
          severity: event.severity,
          agent_id: event.agentId,
          session_id: event.sessionId,
          organization_id: event.organizationId,
          details: event.details,
          timestamp: event.timestamp.toISOString(),
        });

      // Alert on critical events
      if (event.severity === 'critical') {
        await this.triggerCriticalAlert(event);
      }

      // Update metrics
      await this.updateSecurityMetrics(event);
    } catch (error) {
      logger.error('Failed to log security event', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get telemetry metrics for organization
   */
  async getMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<TelemetryMetrics> {
    try {
      // Get suggestion metrics
      const { data: suggestions } = await supabase
        .from('agent_suggestion_events')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('timestamp', timeRange.start.toISOString())
        .lte('timestamp', timeRange.end.toISOString());

      const totalSuggestions = suggestions?.length || 0;
      const acceptedSuggestions = suggestions?.filter(s => s.accepted).length || 0;
      const rejectedSuggestions = totalSuggestions - acceptedSuggestions;

      // Get security events
      const { data: securityEvents } = await supabase
        .from('security_events')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('timestamp', timeRange.start.toISOString())
        .lte('timestamp', timeRange.end.toISOString());

      const hallucinationEvents = securityEvents?.filter(e => e.type === 'hallucination_detected') || [];
      const rlsViolations = securityEvents?.filter(e => e.type === 'rls_violation') || [];
      const circuitBreakerEvents = securityEvents?.filter(e => e.type === 'circuit_breaker_triggered') || [];
      const confidenceBreaches = securityEvents?.filter(e => e.type === 'confidence_threshold_breached') || [];

      // Calculate averages
      const avgConfidence = suggestions?.length
        ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
        : 0;

      return {
        agentSuggestions: {
          total: totalSuggestions,
          accepted: acceptedSuggestions,
          rejected: rejectedSuggestions,
          acceptanceRate: totalSuggestions > 0 ? acceptedSuggestions / totalSuggestions : 0,
        },
        hallucinationRate: hallucinationEvents.length / Math.max(totalSuggestions, 1),
        averageConfidence: avgConfidence,
        rlsViolations: rlsViolations.length,
        circuitBreakerTriggers: circuitBreakerEvents.length,
        confidenceBreaches: confidenceBreaches.length,
      };
    } catch (error) {
      logger.error('Failed to get metrics', error instanceof Error ? error : undefined);
      return {
        agentSuggestions: { total: 0, accepted: 0, rejected: 0, acceptanceRate: 0 },
        hallucinationRate: 0,
        averageConfidence: 0,
        rlsViolations: 0,
        circuitBreakerTriggers: 0,
        confidenceBreaches: 0,
      };
    }
  }

  /**
   * Check for concerning suggestion patterns
   */
  private async checkSuggestionPatterns(event: AgentSuggestionEvent): Promise<void> {
    // Check for consistently low confidence
    if (event.confidence < 0.5) {
      const { data: recentSuggestions } = await supabase
        .from('agent_suggestion_events')
        .select('confidence')
        .eq('agent_id', event.agentId)
        .eq('organization_id', event.organizationId)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(10);

      const lowConfidenceCount = recentSuggestions?.filter(s => s.confidence < 0.5).length || 0;
      if (lowConfidenceCount >= 5) {
        await this.logSecurityEvent({
          type: 'confidence_threshold_breached',
          severity: 'medium',
          agentId: event.agentId,
          organizationId: event.organizationId,
          details: {
            message: `Agent ${event.agentId} has ${lowConfidenceCount} low confidence suggestions in 24h`,
            threshold: 0.5,
            count: lowConfidenceCount,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check for hallucination patterns
    if (event.hallucinationCheck === true) {
      await this.logSecurityEvent({
        type: 'hallucination_detected',
        severity: 'high',
        agentId: event.agentId,
        sessionId: event.sessionId,
        organizationId: event.organizationId,
        details: {
          suggestionType: event.suggestionType,
          confidence: event.confidence,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Trigger alerts for critical security events
   */
  private async triggerCriticalAlert(event: SecurityEvent): Promise<void> {
    // In real implementation, this would send alerts via email, Slack, etc.
    logger.error('CRITICAL SECURITY EVENT', {
      type: event.type,
      severity: event.severity,
      organizationId: event.organizationId,
      details: event.details,
    });

    // Could integrate with external alerting systems here
  }

  /**
   * Update rolling security metrics
   */
  private async updateSecurityMetrics(event: SecurityEvent): Promise<void> {
    // Update organization security metrics (could be cached or stored in DB)
    // This is a simplified implementation
    
    // In real implementation, you'd update a metrics table or cache
    logger.info('Security metric updated', {
      organizationId: event.organizationId,
      type: event.type,
      severity: event.severity,
    });
  }

  /**
   * Check if organization should be flagged for review
   */
  async shouldFlagForReview(organizationId: string): Promise<boolean> {
    const timeRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date(),
    };

    const metrics = await this.getMetrics(organizationId, timeRange);

    // Flag if any concerning patterns detected
    return (
      metrics.hallucinationRate > 0.1 || // >10% hallucination rate
      metrics.rlsViolations > 5 || // >5 RLS violations
      metrics.circuitBreakerTriggers > 10 || // >10 circuit breaker triggers
      metrics.agentSuggestions.acceptanceRate < 0.3 // <30% acceptance rate
    );
  }
}

export const telemetryGuardrailsService = new TelemetryGuardrailsService();
