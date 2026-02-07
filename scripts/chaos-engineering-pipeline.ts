#!/usr/bin/env ts-node
/**
 * VOS-QA-004: Chaos Engineering Pipeline
 * Automated chaos experiments with resilience validation
 */

import { chaosEngineering } from '../src/services/ChaosEngineering';
import { logger } from '../src/utils/logger';
import { performance } from 'perf_hooks';

interface ChaosExperiment {
  id: string;
  name: string;
  type: 'network' | 'resource' | 'failure' | 'state';
  severity: 'low' | 'medium' | 'high' | 'critical';
  blastRadius: number; // 0-1
  duration: number; // seconds
  autoRecover: boolean;
}

interface ExperimentResult {
  experimentId: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'failure' | 'degraded';
  resilienceScore: number;
  recoveryTime: number;
  impact: {
    requestsFailed: number;
    latencyIncrease: number;
    errors: string[];
  };
}

class ChaosEngineeringPipeline {
  private results: ExperimentResult[] = [];
  private isRunning = false;

  /**
   * Define chaos experiments
   */
  private getExperiments(): ChaosExperiment[] {
    return [
      // Network Chaos
      {
        id: 'net-latency-50ms',
        name: '50ms Network Latency',
        type: 'network',
        severity: 'low',
        blastRadius: 0.3,
        duration: 30,
        autoRecover: true,
      },
      {
        id: 'net-packet-loss-5%',
        name: '5% Packet Loss',
        type: 'network',
        severity: 'medium',
        blastRadius: 0.5,
        duration: 60,
        autoRecover: true,
      },
      {
        id: 'net-partition',
        name: 'Network Partition',
        type: 'network',
        severity: 'high',
        blastRadius: 0.7,
        duration: 120,
        autoRecover: true,
      },

      // Resource Chaos
      {
        id: 'cpu-stress-50%',
        name: '50% CPU Stress',
        type: 'resource',
        severity: 'medium',
        blastRadius: 0.4,
        duration: 45,
        autoRecover: true,
      },
      {
        id: 'memory-pressure',
        name: 'Memory Pressure (80%)',
        type: 'resource',
        severity: 'high',
        blastRadius: 0.6,
        duration: 60,
        autoRecover: true,
      },
      {
        id: 'disk-io-saturation',
        name: 'Disk I/O Saturation',
        type: 'resource',
        severity: 'medium',
        blastRadius: 0.3,
        duration: 30,
        autoRecover: true,
      },

      // Failure Chaos
      {
        id: 'pod-kill-coordinator',
        name: 'Kill Coordinator Agent',
        type: 'failure',
        severity: 'high',
        blastRadius: 0.5,
        duration: 0, // Immediate
        autoRecover: false,
      },
      {
        id: 'service-degradation',
        name: 'Service Degradation (503)',
        type: 'failure',
        severity: 'medium',
        blastRadius: 0.4,
        duration: 45,
        autoRecover: true,
      },
      {
        id: 'database-connection-drop',
        name: 'Database Connection Drop',
        type: 'failure',
        severity: 'critical',
        blastRadius: 0.8,
        duration: 30,
        autoRecover: true,
      },

      // State Chaos
      {
        id: 'cache-eviction',
        name: 'Cache Mass Eviction',
        type: 'state',
        severity: 'low',
        blastRadius: 0.2,
        duration: 20,
        autoRecover: true,
      },
      {
        id: 'file-corruption',
        name: 'Config File Corruption',
        type: 'state',
        severity: 'high',
        blastRadius: 0.3,
        duration: 0,
        autoRecover: false,
      },
    ];
  }

  /**
   * Run single experiment
   */
  private async runExperiment(experiment: ChaosExperiment): Promise<ExperimentResult> {
    const startTime = performance.now();
    const result: ExperimentResult = {
      experimentId: experiment.id,
      startTime,
      endTime: 0,
      duration: 0,
      status: 'success',
      resilienceScore: 100,
      recoveryTime: 0,
      impact: {
        requestsFailed: 0,
        latencyIncrease: 0,
        errors: [],
      },
    };

    logger.info(`🔥 Starting experiment: ${experiment.name}`);

    try {
      // Enable experiment
      chaosEngineering.enableExperiment(experiment.id);

      // Set blast radius
      chaosEngineering.setBlastRadius(experiment.id, experiment.blastRadius);

      // Execute chaos
      if (experiment.duration > 0) {
        // Timed experiment
        await chaosEngineering.executeChaos({
          experimentId: experiment.id,
          duration: experiment.duration,
        });

        // Monitor impact during experiment
        const monitorInterval = setInterval(() => {
          const metrics = chaosEngineering.getMetrics(experiment.id);
          result.impact.requestsFailed += metrics.failedRequests;
          result.impact.latencyIncrease = Math.max(
            result.impact.latencyIncrease,
            metrics.avgLatency
          );
          if (metrics.errors.length > 0) {
            result.impact.errors.push(...metrics.errors);
          }
        }, 1000);

        // Wait for experiment completion
        await new Promise(resolve => 
          setTimeout(resolve, experiment.duration * 1000)
        );

        clearInterval(monitorInterval);
      } else {
        // Immediate experiment (e.g., pod kill)
        await chaosEngineering.executeChaos({
          experimentId: experiment.id,
          duration: 0,
        });
      }

      // Auto-recover if enabled
      if (experiment.autoRecover) {
        const recoverStart = performance.now();
        await chaosEngineering.recover(experiment.id);
        result.recoveryTime = performance.now() - recoverStart;
      }

      // Validate resilience
      const resilience = await chaosEngineering.validateResilience(experiment.id);
      result.resilienceScore = resilience.score;
      result.status = resilience.passed ? 'success' : 'failure';

      if (!resilience.passed) {
        result.status = 'degraded';
        logger.warn(`⚠️  Experiment ${experiment.name} degraded system`);
      }

    } catch (error) {
      result.status = 'failure';
      result.impact.errors.push(
        error instanceof Error ? error.message : 'Unknown error'
      );
      logger.error(`❌ Experiment ${experiment.name} failed:`, error);
    } finally {
      // Always disable experiment
      chaosEngineering.disableExperiment(experiment.id);
      result.endTime = performance.now();
      result.duration = (result.endTime - result.startTime) / 1000;
    }

    return result;
  }

  /**
   * Run all experiments
   */
  async runPipeline(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Pipeline already running');
      return;
    }

    this.isRunning = true;
    this.results = [];

    console.log('\n🔥 Chaos Engineering Pipeline');
    console.log('='.repeat(80));

    const experiments = this.getExperiments();
    const startTime = performance.now();

    // Run experiments by severity (low → critical)
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const sortedExperiments = experiments.sort((a, b) => 
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    for (const experiment of sortedExperiments) {
      console.log(`\n📋 ${experiment.severity.toUpperCase()}: ${experiment.name}`);
      console.log(`   Blast Radius: ${(experiment.blastRadius * 100).toFixed(0)}%`);
      console.log(`   Duration: ${experiment.duration}s`);

      const result = await this.runExperiment(experiment);
      this.results.push(result);

      // Brief pause between experiments
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const totalTime = (performance.now() - startTime) / 1000;

    // Generate report
    this.generateReport(totalTime);

    this.isRunning = false;
  }

  /**
   * Generate comprehensive report
   */
  private generateReport(totalTime: number): void {
    const passed = this.results.filter(r => r.status === 'success').length;
    const degraded = this.results.filter(r => r.status === 'degraded').length;
    const failed = this.results.filter(r => r.status === 'failure').length;
    const total = this.results.length;

    const avgResilience = this.results.reduce((sum, r) => sum + r.resilienceScore, 0) / total;
    const avgRecoveryTime = this.results
      .filter(r => r.recoveryTime > 0)
      .reduce((sum, r) => sum + r.recoveryTime, 0) / this.results.filter(r => r.recoveryTime > 0).length;

    const totalFailedRequests = this.results.reduce((sum, r) => sum + r.impact.requestsFailed, 0);
    const maxLatencyIncrease = Math.max(...this.results.map(r => r.impact.latencyIncrease));

    console.log('\n' + '='.repeat(80));
    console.log('📊 CHAOS ENGINEERING PIPELINE REPORT');
    console.log('='.repeat(80));
    console.log(`Total Experiments: ${total}`);
    console.log(`Success: ${passed} | Degraded: ${degraded} | Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`\nAverage Resilience Score: ${avgResilience.toFixed(1)}/100`);
    console.log(`Average Recovery Time: ${avgRecoveryTime.toFixed(2)}ms`);
    console.log(`Total Failed Requests: ${totalFailedRequests}`);
    console.log(`Max Latency Increase: ${maxLatencyIncrease.toFixed(2)}ms`);
    console.log(`Total Pipeline Time: ${totalTime.toFixed(2)}s`);

    // Detailed results
    console.log('\n' + '-'.repeat(80));
    console.log('DETAILED RESULTS:');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const experiment = this.getExperiments().find(e => e.id === result.experimentId);
      const icon = result.status === 'success' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
      
      console.log(`${icon} ${experiment?.name}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}s`);
      console.log(`   Resilience: ${result.resilienceScore.toFixed(1)}/100`);
      console.log(`   Recovery: ${result.recoveryTime.toFixed(2)}ms`);
      console.log(`   Failed Requests: ${result.impact.requestsFailed}`);
      console.log(`   Latency Impact: +${result.impact.latencyIncrease.toFixed(2)}ms`);
      
      if (result.impact.errors.length > 0) {
        console.log(`   Errors: ${result.impact.errors.slice(0, 3).join(', ')}`);
      }
      console.log();
    });

    // Resilience assessment
    console.log('='.repeat(80));
    console.log('RESILIENCE ASSESSMENT:');
    console.log('='.repeat(80));

    if (avgResilience >= 90 && failed === 0) {
      console.log('✅ EXCELLENT: System demonstrates high resilience');
      console.log('   Recommendation: Ready for production deployment');
    } else if (avgResilience >= 75 && failed <= 1) {
      console.log('⚠️  GOOD: System shows adequate resilience');
      console.log('   Recommendation: Address degraded experiments before production');
    } else if (avgResilience >= 60) {
      console.log('❌ ACCEPTABLE: System needs improvement');
      console.log('   Recommendation: Implement additional resilience patterns');
    } else {
      console.log('❌ POOR: System lacks resilience');
      console.log('   Recommendation: Major architectural review required');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Exit code
    const exitCode = (avgResilience >= 75 && failed === 0) ? 0 : 1;
    process.exit(exitCode);
  }

  /**
   * Run scheduled experiments
   */
  async runScheduled(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const schedules = {
      daily: ['net-latency-50ms', 'cache-eviction', 'cpu-stress-50%'],
      weekly: ['net-packet-loss-5%', 'service-degradation', 'disk-io-saturation'],
      monthly: ['net-partition', 'memory-pressure', 'pod-kill-coordinator', 'database-connection-drop'],
    };

    const experimentIds = schedules[type];
    const allExperiments = this.getExperiments();
    const scheduled = allExperiments.filter(e => experimentIds.includes(e.id));

    logger.info(`Running ${type} scheduled chaos experiments`);
    
    // Temporarily replace experiments list
    const originalExperiments = this.getExperiments;
    this.getExperiments = () => scheduled;

    await this.runPipeline();

    // Restore original
    this.getExperiments = originalExperiments;
  }
}

// CLI entry point
if (require.main === module) {
  const pipeline = new ChaosEngineeringPipeline();
  
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'scheduled') {
    const type = args[1] || 'daily';
    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      console.error('Usage: chaos-engineering-pipeline.ts scheduled [daily|weekly|monthly]');
      process.exit(1);
    }
    pipeline.runScheduled(type as any);
  } else if (command === 'full') {
    pipeline.runPipeline();
  } else {
    console.log('Usage:');
    console.log('  chaos-engineering-pipeline.ts full       # Run all experiments');
    console.log('  chaos-engineering-pipeline.ts scheduled [daily|weekly|monthly] # Run scheduled');
    process.exit(1);
  }
}

export { ChaosEngineeringPipeline };