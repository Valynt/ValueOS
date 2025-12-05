/**
 * Value Tree Service with Atomic Updates
 * 
 * Manages value tree operations with optimistic locking and impact analysis.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

export interface ValueTreeNode {
  node_id: string;
  label: string;
  type: 'capability' | 'outcome' | 'kpi' | 'financialMetric';
  value?: number;
  reference_id?: string;
}

export interface ValueTreeLink {
  parent_node_id: string;
  child_node_id: string;
  weight: number;
}

export interface ValueTree {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: ValueTreeNode[];
  links: ValueTreeLink[];
  created_at: string;
  updated_at: string;
}

export interface ValueTreeUpdate {
  nodes?: ValueTreeNode[];
  links?: ValueTreeLink[];
  expectedVersion?: number;
}

export interface LifecycleContext {
  userId: string;
  organizationId?: string;
  sessionId?: string;
}

export interface ValueImpactAnalysis {
  directImpact: number;
  downstreamImpacts: NodeImpact[];
  totalImpact: number;
  confidence: number;
}

export interface NodeImpact {
  nodeId: string;
  nodeLabel: string;
  currentValue: number;
  projectedValue: number;
  weight: number;
  confidence: number;
}

export class ConcurrentModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrentModificationError';
  }
}

export class ValueTreeService {
  private locks: Map<string, Promise<void>> = new Map();
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient;
  }

  async updateValueTree(
    treeId: string,
    updates: ValueTreeUpdate,
    context: LifecycleContext
  ): Promise<ValueTree> {
    // Optimistic locking to prevent concurrent modifications
    const lockKey = `tree:${treeId}`;

    // Wait for any existing lock
    if (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
    }

    // Acquire lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.locks.set(lockKey, lockPromise);

    try {
      // Get current version
      const { data: currentTree, error } = await this.supabase
        .from('value_trees')
        .select('*, version')
        .eq('id', treeId)
        .single();

      if (error) throw error;

      // Check version match (optimistic locking)
      if (updates.expectedVersion &&
          currentTree.version !== updates.expectedVersion) {
        throw new ConcurrentModificationError(
          `Tree version mismatch. Expected ${updates.expectedVersion}, got ${currentTree.version}`
        );
      }

      // Apply updates atomically using RPC
      const { data: updatedTree, error: updateError } = await this.supabase
        .rpc('update_value_tree_atomic', {
          p_tree_id: treeId,
          p_nodes: updates.nodes || currentTree.nodes,
          p_links: updates.links || currentTree.links,
          p_expected_version: currentTree.version,
          p_user_id: context.userId
        });

      if (updateError) throw updateError;

      // Invalidate cache
      await this.invalidateTreeCache(treeId);

      // Publish update event
      await this.publishTreeUpdate(treeId, updatedTree, context);

      return updatedTree;

    } finally {
      // Release lock
      releaseLock!();
      this.locks.delete(lockKey);
    }
  }

  async getValueTree(treeId: string): Promise<ValueTree> {
    const { data, error } = await this.supabase
      .from('value_trees')
      .select(`
        *,
        value_tree_nodes(*),
        value_tree_links(*)
      `)
      .eq('id', treeId)
      .single();

    if (error) throw error;

    return {
      ...data,
      nodes: data.value_tree_nodes || [],
      links: data.value_tree_links || []
    };
  }

  async calculateValueImpact(
    treeId: string,
    nodeId: string,
    newValue: number
  ): Promise<ValueImpactAnalysis> {
    // Get tree structure
    const tree = await this.getValueTree(treeId);

    // Find the target node
    const targetNode = tree.nodes.find(n => n.node_id === nodeId);
    if (!targetNode || !targetNode.value) {
      throw new Error(`Node ${nodeId} not found or has no value`);
    }

    // Find all downstream nodes
    const downstreamNodes = this.traverseDownstream(tree, nodeId);

    // Calculate impact using weighted propagation
    const impacts = downstreamNodes.map(node => {
      const path = this.findPath(tree, nodeId, node.node_id);
      const weight = this.calculatePathWeight(path, tree);

      const valueRatio = newValue / targetNode.value!;
      const projectedValue = (node.value || 0) * valueRatio;

      return {
        nodeId: node.node_id,
        nodeLabel: node.label,
        currentValue: node.value || 0,
        projectedValue,
        weight,
        confidence: this.calculateConfidence(path, tree)
      };
    });

    return {
      directImpact: newValue - targetNode.value,
      downstreamImpacts: impacts,
      totalImpact: impacts.reduce((sum, i) =>
        sum + (i.projectedValue - i.currentValue) * i.weight, 0
      ),
      confidence: impacts.length > 0
        ? impacts.reduce((sum, i) => sum + i.confidence, 0) / impacts.length
        : 1.0
    };
  }

  private traverseDownstream(
    tree: ValueTree,
    startNodeId: string,
    visited: Set<string> = new Set()
  ): ValueTreeNode[] {
    if (visited.has(startNodeId)) return [];
    visited.add(startNodeId);

    const downstream: ValueTreeNode[] = [];

    // Find all links where this node is the parent
    const childLinks = tree.links.filter(l => l.parent_node_id === startNodeId);

    for (const link of childLinks) {
      const childNode = tree.nodes.find(n => n.node_id === link.child_node_id);
      if (childNode) {
        downstream.push(childNode);
        downstream.push(...this.traverseDownstream(tree, childNode.node_id, visited));
      }
    }

    return downstream;
  }

  private findPath(
    tree: ValueTree,
    startNodeId: string,
    endNodeId: string,
    currentPath: string[] = []
  ): string[] {
    if (startNodeId === endNodeId) {
      return [...currentPath, endNodeId];
    }

    const childLinks = tree.links.filter(l => l.parent_node_id === startNodeId);

    for (const link of childLinks) {
      if (!currentPath.includes(link.child_node_id)) {
        const path = this.findPath(
          tree,
          link.child_node_id,
          endNodeId,
          [...currentPath, startNodeId]
        );
        if (path.length > 0) {
          return path;
        }
      }
    }

    return [];
  }

  private calculatePathWeight(path: string[], tree: ValueTree): number {
    if (path.length < 2) return 1.0;

    let totalWeight = 1.0;

    for (let i = 0; i < path.length - 1; i++) {
      const link = tree.links.find(
        l => l.parent_node_id === path[i] && l.child_node_id === path[i + 1]
      );
      if (link) {
        totalWeight *= link.weight;
      }
    }

    return totalWeight;
  }

  private calculateConfidence(path: string[], tree: ValueTree): number {
    // Confidence decreases with path length
    const lengthFactor = 1.0 / Math.sqrt(path.length);

    // Confidence decreases with lower weights
    const weight = this.calculatePathWeight(path, tree);
    const weightFactor = Math.sqrt(weight);

    return lengthFactor * weightFactor;
  }

  private async invalidateTreeCache(treeId: string): Promise<void> {
    logger.debug('Invalidating tree cache', { treeId });
    // Implementation would clear cache entries
  }

  private async publishTreeUpdate(
    treeId: string,
    updatedTree: ValueTree,
    context: LifecycleContext
  ): Promise<void> {
    logger.info('Publishing tree update', {
      treeId,
      version: updatedTree.version,
      userId: context.userId
    });

    // Publish to Supabase realtime channel
    await this.supabase
      .channel(`value_tree:${treeId}`)
      .send({
        type: 'broadcast',
        event: 'tree_updated',
        payload: {
          treeId,
          version: updatedTree.version,
          updatedAt: updatedTree.updated_at,
          userId: context.userId
        }
      });
  }
}
