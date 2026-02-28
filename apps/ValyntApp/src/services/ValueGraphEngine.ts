import Decimal from "decimal.js";

import { logger } from "../lib/logger";

export interface GraphNode {
  id: string;
  value: Decimal;
  formula?: (inputs: Decimal[]) => Decimal;
  dependencies: string[];
}

export class ValueGraphEngine {
  private nodes: Map<string, GraphNode> = new Map();

  public setNode(node: GraphNode) {
    this.nodes.set(node.id, node);
  }

  /**
   * 10x Lever: Incremental Update Algorithm
   * Only recalculates nodes affected by the change.
   */
  public updateNodeValue(id: string, newValue: Decimal) {
    const node = this.nodes.get(id);
    if (!node) return;

    node.value = newValue;
    this.propagateChanges(id);
  }

  private propagateChanges(sourceId: string) {
    // Find all nodes that depend on sourceId
    for (const [id, node] of this.nodes.entries()) {
      if (node.dependencies.includes(sourceId) && node.formula) {
        const inputValues = node.dependencies.map(
          (depId) => this.nodes.get(depId)?.value || new Decimal(0)
        );
        const nextValue = node.formula(inputValues);

        if (!nextValue.equals(node.value)) {
          node.value = nextValue;
          logger.info(`[GraphEngine] Incremental update: ${id} = ${node.value.toString()}`);
          this.propagateChanges(id); // Recursive propagation
        }
      }
    }
  }

  public getNodeValue(id: string): string {
    return this.nodes.get(id)?.value.toString() || "0";
  }
}
