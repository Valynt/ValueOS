/**
 * Value Tree Calculation Stress Tests
 * 
 * Tests value tree operations under high load and complex scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { performanceMonitor } from '../../utils/performance';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const runPerf = process.env.RUN_PERF_TESTS === 'true';
const describeMaybe = runIntegration && runPerf ? describe : describe.skip;

/**
 * Value Tree Node
 */
interface ValueTreeNode {
  id: string;
  name: string;
  value: number;
  children: ValueTreeNode[];
  metadata?: Record<string, any>;
}

/**
 * Value Tree Calculator
 */
class ValueTreeCalculator {
  /**
   * Calculate total value of tree
   */
  calculateTotalValue(node: ValueTreeNode): number {
    let total = node.value;
    
    for (const child of node.children) {
      total += this.calculateTotalValue(child);
    }
    
    return total;
  }

  /**
   * Calculate weighted value with depth factor
   */
  calculateWeightedValue(node: ValueTreeNode, depth: number = 0): number {
    const depthFactor = Math.pow(0.9, depth); // 10% reduction per level
    let total = node.value * depthFactor;
    
    for (const child of node.children) {
      total += this.calculateWeightedValue(child, depth + 1);
    }
    
    return total;
  }

  /**
   * Calculate ROI for tree
   */
  calculateROI(node: ValueTreeNode, cost: number): number {
    const totalValue = this.calculateTotalValue(node);
    return ((totalValue - cost) / cost) * 100;
  }

  /**
   * Find critical path (highest value path)
   */
  findCriticalPath(node: ValueTreeNode): ValueTreeNode[] {
    const path: ValueTreeNode[] = [node];
    
    if (node.children.length === 0) {
      return path;
    }
    
    // Find child with highest total value
    let maxChild: ValueTreeNode | null = null;
    let maxValue = 0;
    
    for (const child of node.children) {
      const childValue = this.calculateTotalValue(child);
      if (childValue > maxValue) {
        maxValue = childValue;
        maxChild = child;
      }
    }
    
    if (maxChild) {
      path.push(...this.findCriticalPath(maxChild));
    }
    
    return path;
  }

  /**
   * Calculate tree depth
   */
  calculateDepth(node: ValueTreeNode): number {
    if (node.children.length === 0) {
      return 1;
    }
    
    const childDepths = node.children.map(child => this.calculateDepth(child));
    return 1 + Math.max(...childDepths);
  }

  /**
   * Count total nodes
   */
  countNodes(node: ValueTreeNode): number {
    let count = 1;
    
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    
    return count;
  }

  /**
   * Calculate average value per node
   */
  calculateAverageValue(node: ValueTreeNode): number {
    const totalValue = this.calculateTotalValue(node);
    const nodeCount = this.countNodes(node);
    return totalValue / nodeCount;
  }

  /**
   * Find nodes by value threshold
   */
  findNodesByValue(node: ValueTreeNode, threshold: number): ValueTreeNode[] {
    const results: ValueTreeNode[] = [];
    
    if (node.value >= threshold) {
      results.push(node);
    }
    
    for (const child of node.children) {
      results.push(...this.findNodesByValue(child, threshold));
    }
    
    return results;
  }

  /**
   * Calculate value distribution
   */
  calculateValueDistribution(node: ValueTreeNode): {
    min: number;
    max: number;
    avg: number;
    median: number;
    stdDev: number;
  } {
    const values = this.collectAllValues(node);
    values.sort((a, b) => a - b);
    
    const min = values[0];
    const max = values[values.length - 1];
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return { min, max, avg, median, stdDev };
  }

  /**
   * Collect all values from tree
   */
  private collectAllValues(node: ValueTreeNode): number[] {
    const values = [node.value];
    
    for (const child of node.children) {
      values.push(...this.collectAllValues(child));
    }
    
    return values;
  }
}

/**
 * Generate test tree
 */
function generateTree(depth: number, branchingFactor: number, nodeId: number = 0): {
  tree: ValueTreeNode;
  nextId: number;
} {
  const node: ValueTreeNode = {
    id: `node-${nodeId}`,
    name: `Node ${nodeId}`,
    value: Math.random() * 10000,
    children: []
  };
  
  let currentId = nodeId + 1;
  
  if (depth > 1) {
    for (let i = 0; i < branchingFactor; i++) {
      const result = generateTree(depth - 1, branchingFactor, currentId);
      node.children.push(result.tree);
      currentId = result.nextId;
    }
  }
  
  return { tree: node, nextId: currentId };
}

describeMaybe('Value Tree Calculation Stress Tests', () => {
  let calculator: ValueTreeCalculator;

  beforeEach(() => {
    calculator = new ValueTreeCalculator();
    performanceMonitor.clear();
  });

  describe('Small Trees (< 100 nodes)', () => {
    it('should calculate total value for small tree', () => {
      const { tree } = generateTree(3, 3); // ~40 nodes
      
      const startTime = Date.now();
      const totalValue = calculator.calculateTotalValue(tree);
      const duration = Date.now() - startTime;
      
      console.log('Small Tree - Total Value:');
      console.log(`  Nodes: ${calculator.countNodes(tree)}`);
      console.log(`  Value: ${totalValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(totalValue).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should calculate weighted value for small tree', () => {
      const { tree } = generateTree(3, 3);
      
      const startTime = Date.now();
      const weightedValue = calculator.calculateWeightedValue(tree);
      const duration = Date.now() - startTime;
      
      console.log('Small Tree - Weighted Value:');
      console.log(`  Value: ${weightedValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(weightedValue).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Medium Trees (100-1000 nodes)', () => {
    it('should calculate total value for medium tree', () => {
      const { tree } = generateTree(5, 4); // ~341 nodes
      
      const startTime = Date.now();
      const totalValue = calculator.calculateTotalValue(tree);
      const duration = Date.now() - startTime;
      
      console.log('Medium Tree - Total Value:');
      console.log(`  Nodes: ${calculator.countNodes(tree)}`);
      console.log(`  Depth: ${calculator.calculateDepth(tree)}`);
      console.log(`  Value: ${totalValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(totalValue).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50);
    });

    it('should find critical path in medium tree', () => {
      const { tree } = generateTree(5, 4);
      
      const startTime = Date.now();
      const criticalPath = calculator.findCriticalPath(tree);
      const duration = Date.now() - startTime;
      
      console.log('Medium Tree - Critical Path:');
      console.log(`  Path Length: ${criticalPath.length}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(criticalPath.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    it('should calculate value distribution for medium tree', () => {
      const { tree } = generateTree(5, 4);
      
      const startTime = Date.now();
      const distribution = calculator.calculateValueDistribution(tree);
      const duration = Date.now() - startTime;
      
      console.log('Medium Tree - Value Distribution:');
      console.log(`  Min: ${distribution.min.toFixed(2)}`);
      console.log(`  Max: ${distribution.max.toFixed(2)}`);
      console.log(`  Avg: ${distribution.avg.toFixed(2)}`);
      console.log(`  Median: ${distribution.median.toFixed(2)}`);
      console.log(`  StdDev: ${distribution.stdDev.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(distribution.avg).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Large Trees (1000+ nodes)', () => {
    it('should calculate total value for large tree', () => {
      const { tree } = generateTree(6, 5); // ~3906 nodes
      
      const startTime = Date.now();
      const totalValue = calculator.calculateTotalValue(tree);
      const duration = Date.now() - startTime;
      
      const nodeCount = calculator.countNodes(tree);
      const depth = calculator.calculateDepth(tree);
      
      console.log('Large Tree - Total Value:');
      console.log(`  Nodes: ${nodeCount}`);
      console.log(`  Depth: ${depth}`);
      console.log(`  Value: ${totalValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Nodes/ms: ${(nodeCount / duration).toFixed(2)}`);
      
      expect(totalValue).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle multiple calculations on large tree', () => {
      const { tree } = generateTree(6, 5);
      const iterations = 10;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        calculator.calculateTotalValue(tree);
        calculator.calculateWeightedValue(tree);
        calculator.calculateDepth(tree);
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('Large Tree - Multiple Calculations:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(200);
    });
  });

  describe('Concurrent Calculations', () => {
    it('should handle concurrent calculations on same tree', async () => {
      const { tree } = generateTree(5, 4);
      const concurrentOps = 100;
      
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentOps }, () =>
        Promise.resolve(calculator.calculateTotalValue(tree))
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      console.log('Concurrent Calculations - Same Tree:');
      console.log(`  Operations: ${concurrentOps}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Ops/Second: ${(concurrentOps / duration * 1000).toFixed(2)}`);
      
      // All results should be the same
      expect(new Set(results).size).toBe(1);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent calculations on different trees', async () => {
      const treeCount = 50;
      const trees = Array.from({ length: treeCount }, () =>
        generateTree(4, 3).tree
      );
      
      const startTime = Date.now();
      
      const promises = trees.map(tree =>
        Promise.resolve(calculator.calculateTotalValue(tree))
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      console.log('Concurrent Calculations - Different Trees:');
      console.log(`  Trees: ${treeCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Trees/Second: ${(treeCount / duration * 1000).toFixed(2)}`);
      
      expect(results.length).toBe(treeCount);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Complex Operations', () => {
    it('should handle complex query on large tree', () => {
      const { tree } = generateTree(6, 5);
      const threshold = 5000;
      
      const startTime = Date.now();
      const highValueNodes = calculator.findNodesByValue(tree, threshold);
      const duration = Date.now() - startTime;
      
      console.log('Complex Query - Find High Value Nodes:');
      console.log(`  Threshold: ${threshold}`);
      console.log(`  Found: ${highValueNodes.length}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(duration).toBeLessThan(500);
    });

    it('should calculate ROI for multiple scenarios', () => {
      const { tree } = generateTree(5, 4);
      const scenarios = [
        { cost: 10000 },
        { cost: 50000 },
        { cost: 100000 },
        { cost: 500000 }
      ];
      
      const startTime = Date.now();
      
      const results = scenarios.map(scenario => ({
        cost: scenario.cost,
        roi: calculator.calculateROI(tree, scenario.cost)
      }));
      
      const duration = Date.now() - startTime;
      
      console.log('ROI Calculations:');
      results.forEach(r => {
        console.log(`  Cost: $${r.cost}, ROI: ${r.roi.toFixed(2)}%`);
      });
      console.log(`  Duration: ${duration}ms`);
      
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Stress', () => {
    it('should handle very deep tree', () => {
      const { tree } = generateTree(10, 2); // Deep but narrow
      
      const startTime = Date.now();
      const depth = calculator.calculateDepth(tree);
      const totalValue = calculator.calculateTotalValue(tree);
      const duration = Date.now() - startTime;
      
      console.log('Very Deep Tree:');
      console.log(`  Depth: ${depth}`);
      console.log(`  Nodes: ${calculator.countNodes(tree)}`);
      console.log(`  Value: ${totalValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(depth).toBe(10);
      expect(duration).toBeLessThan(100);
    });

    it('should handle very wide tree', () => {
      const { tree } = generateTree(3, 10); // Shallow but wide
      
      const startTime = Date.now();
      const nodeCount = calculator.countNodes(tree);
      const totalValue = calculator.calculateTotalValue(tree);
      const duration = Date.now() - startTime;
      
      console.log('Very Wide Tree:');
      console.log(`  Nodes: ${nodeCount}`);
      console.log(`  Depth: ${calculator.calculateDepth(tree)}`);
      console.log(`  Value: ${totalValue.toFixed(2)}`);
      console.log(`  Duration: ${duration}ms`);
      
      expect(nodeCount).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets', () => {
      const testCases = [
        { depth: 3, branching: 3, targetMs: 10, name: 'Small' },
        { depth: 5, branching: 4, targetMs: 50, name: 'Medium' },
        { depth: 6, branching: 5, targetMs: 500, name: 'Large' }
      ];
      
      console.log('Performance Benchmarks:');
      
      testCases.forEach(testCase => {
        const { tree } = generateTree(testCase.depth, testCase.branching);
        const nodeCount = calculator.countNodes(tree);
        
        const startTime = Date.now();
        calculator.calculateTotalValue(tree);
        calculator.calculateWeightedValue(tree);
        calculator.calculateDepth(tree);
        const duration = Date.now() - startTime;
        
        const passed = duration < testCase.targetMs;
        
        console.log(`  ${testCase.name} (${nodeCount} nodes):`);
        console.log(`    Duration: ${duration}ms`);
        console.log(`    Target: ${testCase.targetMs}ms`);
        console.log(`    Status: ${passed ? 'PASS' : 'FAIL'}`);
        
        expect(duration).toBeLessThan(testCase.targetMs);
      });
    });
  });
});
