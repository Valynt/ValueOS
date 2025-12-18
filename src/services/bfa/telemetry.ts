/**
 * Backend for Agents (BFA) Telemetry
 * 
 * Agent-specific metrics and monitoring for semantic tools.
 * Provides performance tracking, error monitoring, and usage analytics.
 */

import { AgentContext, ToolExecutionResult } from './types';
import { logger } from '../logging';

/**
 * Telemetry metrics for tool execution
 */
export interface ToolMetrics {
  toolId: string;
  userId: string;
  tenantId: string;
  executionTimeMs: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  inputSize?: number;
  outputSize?: number;
  timestamp: Date;
}

/**
 * Telemetry collector for BFA operations
 */
export class BfaTelemetry {
  private static metrics: ToolMetrics[] = [];
  private static maxBufferSize = 1000;

  /**
   * Record tool execution metrics
   */
  static recordExecution<TOutput>(
    toolId: string,
    context: AgentContext,
    executionTimeMs: number,
    result: ToolExecutionResult<TOutput> | Error
  ): void {
    const metric: ToolMetrics = {
      toolId,
      userId: context.userId,
      tenantId: context.tenantId,
      executionTimeMs,
      success: !(result instanceof Error),
      timestamp: new Date()
    };

    if (result instanceof Error) {
      metric.errorType = result.constructor.name;
      metric.errorMessage = result.message;
    } else {
      metric.inputSize = this.calculateSize(result.data);
      metric.outputSize = this.calculateSize(result.data);
    }

    this.addMetric(metric);
    this.logMetric(metric);
  }

  /**
   * Get performance metrics for a tool
   */
  static getToolMetrics(toolId: string, timeRange?: { start: Date; end: Date }): ToolMetrics[] {
    let metrics = this.metrics.filter(m => m.toolId === toolId);
    
    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    return metrics;
  }

  /**
   * Get aggregated performance statistics
   */
  static getToolStats(toolId: string): {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    errorRate: number;
    topErrors: Array<{ errorType: string; count: number }>;
  } {
    const metrics = this.getToolMetrics(toolId);
    
    if (metrics.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        errorRate: 0,
        topErrors: []
      };
    }

    const successful = metrics.filter(m => m.success);
    const errors = metrics.filter(m => !m.success);
    
    const errorCounts = errors.reduce((acc, m) => {
      const errorType = m.errorType || 'Unknown';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([errorType, count]) => ({ errorType, count }));

    return {
      totalExecutions: metrics.length,
      successRate: successful.length / metrics.length,
      avgExecutionTime: metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length,
      errorRate: errors.length / metrics.length,
      topErrors
    };
  }

  /**
   * Get tenant usage metrics
   */
  static getTenantMetrics(tenantId: string): {
    totalExecutions: number;
    uniqueTools: number;
    avgExecutionTime: number;
    mostUsedTool: string;
  } {
    const tenantMetrics = this.metrics.filter(m => m.tenantId === tenantId);
    
    if (tenantMetrics.length === 0) {
      return {
        totalExecutions: 0,
        uniqueTools: 0,
        avgExecutionTime: 0,
        mostUsedTool: ''
      };
    }

    const toolCounts = tenantMetrics.reduce((acc, m) => {
      acc[m.toolId] = (acc[m.toolId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedTool = Object.entries(toolCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    return {
      totalExecutions: tenantMetrics.length,
      uniqueTools: Object.keys(toolCounts).length,
      avgExecutionTime: tenantMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / tenantMetrics.length,
      mostUsedTool
    };
  }

  /**
   * Check for performance anomalies
   */
  static detectAnomalies(toolId: string): {
    slowExecution: boolean;
    highErrorRate: boolean;
    unusualPattern: boolean;
  } {
    const metrics = this.getToolMetrics(toolId).slice(-50); // Last 50 executions
    
    if (metrics.length < 10) {
      return {
        slowExecution: false,
        highErrorRate: false,
        unusualPattern: false
      };
    }

    const stats = this.getToolStats(toolId);
    const recentMetrics = metrics.slice(-10);
    
    const recentErrorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
    const recentAvgTime = recentMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / recentMetrics.length;
    
    return {
      slowExecution: recentAvgTime > stats.avgExecutionTime * 2,
      highErrorRate: recentErrorRate > stats.errorRate * 2,
      unusualPattern: this.detectUnusualPatterns(recentMetrics)
    };
  }

  /**
   * Add metric to buffer
   */
  private static addMetric(metric: ToolMetrics): void {
    this.metrics.push(metric);
    
    // Keep buffer size manageable
    if (this.metrics.length > this.maxBufferSize) {
      this.metrics = this.metrics.slice(-this.maxBufferSize);
    }
  }

  /**
   * Log metric for external monitoring
   */
  private static logMetric(metric: ToolMetrics): void {
    logger.info('BFA tool execution', {
      toolId: metric.toolId,
      userId: metric.userId,
      tenantId: metric.tenantId,
      executionTimeMs: metric.executionTimeMs,
      success: metric.success,
      errorType: metric.errorType,
      timestamp: metric.timestamp.toISOString()
    });
  }

  /**
   * Calculate approximate size of data
   */
  private static calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Detect unusual patterns in execution metrics
   */
  private static detectUnusualPatterns(metrics: ToolMetrics[]): boolean {
    if (metrics.length < 5) return false;

    // Simple anomaly detection: check for sudden spikes in execution time
    const times = metrics.map(m => m.executionTimeMs);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Check if any execution is more than 2 standard deviations from mean
    return times.some(t => Math.abs(t - avg) > 2 * stdDev);
  }

  /**
   * Export metrics for external analysis
   */
  static exportMetrics(): ToolMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics buffer
   */
  static clearMetrics(): void {
    this.metrics = [];
  }
}
