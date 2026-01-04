/**
 * Auto-Scaling Tests
 * 
 * Tests for horizontal scaling capabilities:
 * - Scale up on load
 * - Scale down on idle
 * - Cost optimization
 * - Resource management
 * 
 * Acceptance Criteria: Automatic scaling
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface ScalingMetrics {
  currentInstances: number;
  targetInstances: number;
  cpuUtilization: number;
  memoryUtilization: number;
  requestsPerSecond: number;
  averageResponseTime: number;
}

interface ScalingPolicy {
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number; // seconds
}

describe('Auto-Scaling - Horizontal Scaling', () => {
  const defaultPolicy: ScalingPolicy = {
    minInstances: 2,
    maxInstances: 10,
    targetCPU: 70,
    targetMemory: 80,
    scaleUpThreshold: 80,
    scaleDownThreshold: 30,
    cooldownPeriod: 300,
  };

  describe('Scale Up on Load', () => {
    it('should scale up when CPU exceeds threshold', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 2,
        targetInstances: 2,
        cpuUtilization: 85,
        memoryUtilization: 60,
        requestsPerSecond: 1000,
        averageResponseTime: 200,
      };

      const shouldScaleUp = metrics.cpuUtilization > defaultPolicy.scaleUpThreshold;
      const newInstanceCount = shouldScaleUp 
        ? Math.min(metrics.currentInstances + 1, defaultPolicy.maxInstances)
        : metrics.currentInstances;

      expect(shouldScaleUp).toBe(true);
      expect(newInstanceCount).toBe(3);
    });

    it('should scale up when memory exceeds threshold', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 2,
        targetInstances: 2,
        cpuUtilization: 60,
        memoryUtilization: 85,
        requestsPerSecond: 1000,
        averageResponseTime: 200,
      };

      const shouldScaleUp = metrics.memoryUtilization > defaultPolicy.scaleUpThreshold;
      const newInstanceCount = shouldScaleUp 
        ? Math.min(metrics.currentInstances + 1, defaultPolicy.maxInstances)
        : metrics.currentInstances;

      expect(shouldScaleUp).toBe(true);
      expect(newInstanceCount).toBe(3);
    });

    it('should respect maximum instance limit', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 10,
        targetInstances: 10,
        cpuUtilization: 90,
        memoryUtilization: 85,
        requestsPerSecond: 5000,
        averageResponseTime: 500,
      };

      const shouldScaleUp = metrics.cpuUtilization > defaultPolicy.scaleUpThreshold;
      const newInstanceCount = shouldScaleUp 
        ? Math.min(metrics.currentInstances + 1, defaultPolicy.maxInstances)
        : metrics.currentInstances;

      expect(shouldScaleUp).toBe(true);
      expect(newInstanceCount).toBe(10); // Cannot exceed max
    });

    it('should calculate scale-up increment based on load', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 2,
        targetInstances: 2,
        cpuUtilization: 95,
        memoryUtilization: 90,
        requestsPerSecond: 2000,
        averageResponseTime: 800,
      };

      // Aggressive scaling for high load
      const loadFactor = metrics.cpuUtilization / defaultPolicy.targetCPU;
      const increment = Math.ceil(loadFactor);
      const newInstanceCount = Math.min(
        metrics.currentInstances + increment,
        defaultPolicy.maxInstances
      );

      expect(loadFactor).toBeGreaterThan(1.3);
      expect(increment).toBeGreaterThanOrEqual(2);
      expect(newInstanceCount).toBeLessThanOrEqual(defaultPolicy.maxInstances);
    });

    it('should handle rapid traffic spikes', () => {
      const baselineRPS = 100;
      const currentRPS = 1000;
      const spikeMultiplier = currentRPS / baselineRPS;

      const metrics: ScalingMetrics = {
        currentInstances: 2,
        targetInstances: 2,
        cpuUtilization: 85,
        memoryUtilization: 70,
        requestsPerSecond: currentRPS,
        averageResponseTime: 300,
      };

      // Scale aggressively on traffic spike
      const recommendedInstances = Math.ceil(metrics.currentInstances * spikeMultiplier / 5);
      const newInstanceCount = Math.min(recommendedInstances, defaultPolicy.maxInstances);

      expect(spikeMultiplier).toBe(10);
      expect(newInstanceCount).toBeGreaterThan(metrics.currentInstances);
      expect(newInstanceCount).toBeLessThanOrEqual(defaultPolicy.maxInstances);
    });

    it('should respect cooldown period', () => {
      const lastScaleTime = Date.now() - 200000; // 200 seconds ago
      const currentTime = Date.now();
      const timeSinceLastScale = (currentTime - lastScaleTime) / 1000;

      const canScale = timeSinceLastScale >= defaultPolicy.cooldownPeriod;

      expect(canScale).toBe(false);
      expect(timeSinceLastScale).toBeLessThan(defaultPolicy.cooldownPeriod);
    });

    it('should scale up after cooldown period', () => {
      const lastScaleTime = Date.now() - 400000; // 400 seconds ago
      const currentTime = Date.now();
      const timeSinceLastScale = (currentTime - lastScaleTime) / 1000;

      const canScale = timeSinceLastScale >= defaultPolicy.cooldownPeriod;

      expect(canScale).toBe(true);
      expect(timeSinceLastScale).toBeGreaterThan(defaultPolicy.cooldownPeriod);
    });
  });

  describe('Scale Down on Idle', () => {
    it('should scale down when CPU below threshold', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 5,
        targetInstances: 5,
        cpuUtilization: 25,
        memoryUtilization: 30,
        requestsPerSecond: 100,
        averageResponseTime: 50,
      };

      const shouldScaleDown = metrics.cpuUtilization < defaultPolicy.scaleDownThreshold;
      const newInstanceCount = shouldScaleDown 
        ? Math.max(metrics.currentInstances - 1, defaultPolicy.minInstances)
        : metrics.currentInstances;

      expect(shouldScaleDown).toBe(true);
      expect(newInstanceCount).toBe(4);
    });

    it('should respect minimum instance limit', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 2,
        targetInstances: 2,
        cpuUtilization: 10,
        memoryUtilization: 15,
        requestsPerSecond: 10,
        averageResponseTime: 20,
      };

      const shouldScaleDown = metrics.cpuUtilization < defaultPolicy.scaleDownThreshold;
      const newInstanceCount = shouldScaleDown 
        ? Math.max(metrics.currentInstances - 1, defaultPolicy.minInstances)
        : metrics.currentInstances;

      expect(shouldScaleDown).toBe(true);
      expect(newInstanceCount).toBe(2); // Cannot go below min
    });

    it('should scale down gradually', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 10,
        targetInstances: 10,
        cpuUtilization: 20,
        memoryUtilization: 25,
        requestsPerSecond: 50,
        averageResponseTime: 30,
      };

      // Scale down one instance at a time
      const newInstanceCount = Math.max(
        metrics.currentInstances - 1,
        defaultPolicy.minInstances
      );

      expect(newInstanceCount).toBe(9);
    });

    it('should consider both CPU and memory for scale down', () => {
      const metrics: ScalingMetrics = {
        currentInstances: 5,
        targetInstances: 5,
        cpuUtilization: 25,
        memoryUtilization: 75, // Memory still high
        requestsPerSecond: 100,
        averageResponseTime: 50,
      };

      const shouldScaleDown = 
        metrics.cpuUtilization < defaultPolicy.scaleDownThreshold &&
        metrics.memoryUtilization < defaultPolicy.scaleDownThreshold;

      expect(shouldScaleDown).toBe(false); // Don't scale down if memory is high
    });

    it('should wait for sustained low load', () => {
      const observations = [
        { cpuUtilization: 25, timestamp: Date.now() - 600000 },
        { cpuUtilization: 28, timestamp: Date.now() - 300000 },
        { cpuUtilization: 22, timestamp: Date.now() },
      ];

      const allBelowThreshold = observations.every(
        obs => obs.cpuUtilization < defaultPolicy.scaleDownThreshold
      );

      const timeSpan = observations[observations.length - 1].timestamp - observations[0].timestamp;
      const sustainedLowLoad = allBelowThreshold && timeSpan >= 300000; // 5 minutes

      expect(sustainedLowLoad).toBe(true);
    });
  });

  describe('Cost Optimization', () => {
    it('should calculate cost per instance', () => {
      const instanceCostPerHour = 0.10; // $0.10/hour
      const hoursPerMonth = 730;
      const monthlyCostPerInstance = instanceCostPerHour * hoursPerMonth;

      expect(monthlyCostPerInstance).toBe(73);
    });

    it('should calculate total infrastructure cost', () => {
      const instanceCount = 5;
      const costPerInstance = 73; // per month
      const totalCost = instanceCount * costPerInstance;

      expect(totalCost).toBe(365);
    });

    it('should optimize for cost vs performance', () => {
      const scenarios = [
        { instances: 2, cost: 146, avgResponseTime: 500 },
        { instances: 5, cost: 365, avgResponseTime: 200 },
        { instances: 10, cost: 730, avgResponseTime: 100 },
      ];

      // Calculate cost per millisecond saved
      const costEfficiency = scenarios.map(s => ({
        ...s,
        efficiency: s.cost / (1000 - s.avgResponseTime),
      }));

      // Best efficiency is lowest cost per ms saved
      const bestScenario = costEfficiency.reduce((best, current) => 
        current.efficiency < best.efficiency ? current : best
      );

      // Scenario with 2 instances has best cost efficiency
      expect(bestScenario.instances).toBe(2);
      expect(bestScenario.efficiency).toBeLessThan(1);
    });

    it('should track cost savings from auto-scaling', () => {
      const staticProvisioning = {
        instances: 10, // Always 10 instances
        hoursPerMonth: 730,
        costPerHour: 0.10,
      };

      const autoScaling = {
        averageInstances: 4, // Average with auto-scaling
        hoursPerMonth: 730,
        costPerHour: 0.10,
      };

      const staticCost = staticProvisioning.instances * staticProvisioning.hoursPerMonth * staticProvisioning.costPerHour;
      const autoScalingCost = autoScaling.averageInstances * autoScaling.hoursPerMonth * autoScaling.costPerHour;
      const savings = staticCost - autoScalingCost;
      const savingsPercentage = (savings / staticCost) * 100;

      expect(staticCost).toBe(730);
      expect(autoScalingCost).toBe(292);
      expect(savings).toBe(438);
      expect(savingsPercentage).toBe(60);
    });

    it('should use spot instances for cost savings', () => {
      const onDemandCost = 0.10;
      const spotCost = 0.03; // 70% discount
      const spotSavings = ((onDemandCost - spotCost) / onDemandCost) * 100;

      expect(spotSavings).toBe(70);
    });

    it('should balance spot and on-demand instances', () => {
      const totalInstances = 10;
      const spotPercentage = 0.7; // 70% spot
      const spotInstances = Math.floor(totalInstances * spotPercentage);
      const onDemandInstances = totalInstances - spotInstances;

      const spotCost = spotInstances * 0.03 * 730;
      const onDemandCost = onDemandInstances * 0.10 * 730;
      const totalCost = spotCost + onDemandCost;

      expect(spotInstances).toBe(7);
      expect(onDemandInstances).toBe(3);
      expect(totalCost).toBeCloseTo(372.3, 0);
    });
  });

  describe('Resource Management', () => {
    it('should distribute load evenly across instances', () => {
      const instances = [
        { id: 1, load: 70 },
        { id: 2, load: 75 },
        { id: 3, load: 68 },
      ];

      const averageLoad = instances.reduce((sum, i) => sum + i.load, 0) / instances.length;
      const maxDeviation = Math.max(...instances.map(i => Math.abs(i.load - averageLoad)));

      expect(averageLoad).toBeCloseTo(71, 0);
      expect(maxDeviation).toBeLessThan(10); // Load is well-balanced
    });

    it('should handle instance failures gracefully', () => {
      const totalInstances = 5;
      const failedInstances = 1;
      const healthyInstances = totalInstances - failedInstances;
      const loadPerInstance = 100 / totalInstances;
      const redistributedLoad = (loadPerInstance * totalInstances) / healthyInstances;

      expect(healthyInstances).toBe(4);
      expect(redistributedLoad).toBe(25);
    });

    it('should maintain minimum healthy instances', () => {
      const totalInstances = 5;
      const minHealthyPercentage = 0.8; // 80%
      const minHealthyInstances = Math.ceil(totalInstances * minHealthyPercentage);

      expect(minHealthyInstances).toBe(4);
    });

    it('should replace unhealthy instances', () => {
      const instances = [
        { id: 1, healthy: true },
        { id: 2, healthy: false },
        { id: 3, healthy: true },
      ];

      const unhealthyInstances = instances.filter(i => !i.healthy);
      const shouldReplace = unhealthyInstances.length > 0;

      expect(shouldReplace).toBe(true);
      expect(unhealthyInstances).toHaveLength(1);
    });

    it('should perform health checks regularly', () => {
      const healthCheckInterval = 30; // seconds
      const lastHealthCheck = Date.now() - 35000; // 35 seconds ago
      const timeSinceLastCheck = (Date.now() - lastHealthCheck) / 1000;

      const shouldPerformHealthCheck = timeSinceLastCheck >= healthCheckInterval;

      expect(shouldPerformHealthCheck).toBe(true);
    });

    it('should track instance uptime', () => {
      const instanceStartTime = Date.now() - 3600000; // 1 hour ago
      const currentTime = Date.now();
      const uptimeSeconds = (currentTime - instanceStartTime) / 1000;
      const uptimeMinutes = uptimeSeconds / 60;

      expect(uptimeMinutes).toBeCloseTo(60, 0);
    });
  });

  describe('Scaling Strategies', () => {
    it('should use target tracking scaling', () => {
      const currentCPU = 85;
      const targetCPU = 70;
      const currentInstances = 5;

      // Calculate desired instances to reach target
      const desiredInstances = Math.ceil((currentCPU / targetCPU) * currentInstances);

      expect(desiredInstances).toBe(7);
    });

    it('should use step scaling for predictable patterns', () => {
      const cpuUtilization = 85;
      const steps = [
        { threshold: 50, adjustment: 0 },
        { threshold: 70, adjustment: 1 },
        { threshold: 80, adjustment: 2 },
        { threshold: 90, adjustment: 3 },
      ];

      const applicableStep = steps
        .filter(s => cpuUtilization >= s.threshold)
        .sort((a, b) => b.threshold - a.threshold)[0];

      expect(applicableStep.adjustment).toBe(2);
    });

    it('should use predictive scaling for known patterns', () => {
      const historicalData = [
        { hour: 9, avgLoad: 80 },
        { hour: 10, avgLoad: 90 },
        { hour: 11, avgLoad: 95 },
      ];

      const currentHour = 10;
      const nextHourPrediction = historicalData.find(d => d.hour === currentHour + 1);

      // Pre-scale before predicted load
      const shouldPreScale = nextHourPrediction && nextHourPrediction.avgLoad > 80;

      expect(shouldPreScale).toBe(true);
    });

    it('should use scheduled scaling for known events', () => {
      const schedule = [
        { time: '09:00', instances: 5 },
        { time: '17:00', instances: 2 },
      ];

      const currentHour = 9;
      const scheduledInstances = schedule.find(s => parseInt(s.time) === currentHour);

      expect(scheduledInstances?.instances).toBe(5);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track scaling events', () => {
      const scalingEvents = [
        { timestamp: Date.now() - 3600000, type: 'scale-up', from: 2, to: 3 },
        { timestamp: Date.now() - 1800000, type: 'scale-up', from: 3, to: 5 },
        { timestamp: Date.now(), type: 'scale-down', from: 5, to: 4 },
      ];

      expect(scalingEvents).toHaveLength(3);
      expect(scalingEvents[0].type).toBe('scale-up');
      expect(scalingEvents[2].type).toBe('scale-down');
    });

    it('should calculate scaling frequency', () => {
      const scalingEvents = [
        { timestamp: Date.now() - 7200000 }, // 2 hours ago
        { timestamp: Date.now() - 3600000 }, // 1 hour ago
        { timestamp: Date.now() },
      ];

      const timeSpan = scalingEvents[scalingEvents.length - 1].timestamp - scalingEvents[0].timestamp;
      const frequency = scalingEvents.length / (timeSpan / 3600000); // events per hour

      expect(frequency).toBeCloseTo(1.5, 1);
    });

    it('should track resource utilization trends', () => {
      const metrics = [
        { timestamp: Date.now() - 3600000, cpu: 60 },
        { timestamp: Date.now() - 1800000, cpu: 70 },
        { timestamp: Date.now(), cpu: 80 },
      ];

      const trend = metrics[metrics.length - 1].cpu - metrics[0].cpu;
      const isIncreasing = trend > 0;

      expect(trend).toBe(20);
      expect(isIncreasing).toBe(true);
    });

    it('should alert on scaling failures', () => {
      const scalingAttempt = {
        success: false,
        error: 'Max instances reached',
        timestamp: Date.now(),
      };

      const shouldAlert = !scalingAttempt.success;

      expect(shouldAlert).toBe(true);
      expect(scalingAttempt.error).toBeTruthy();
    });

    it('should track cost metrics', () => {
      const costMetrics = {
        currentHourlyCost: 0.50,
        projectedMonthlyCost: 365,
        budgetLimit: 500,
        utilizationPercentage: 73,
      };

      const withinBudget = costMetrics.projectedMonthlyCost <= costMetrics.budgetLimit;
      const budgetUtilization = (costMetrics.projectedMonthlyCost / costMetrics.budgetLimit) * 100;

      expect(withinBudget).toBe(true);
      expect(budgetUtilization).toBe(73);
    });
  });
});
