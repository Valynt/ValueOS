/**
 * CalculationEngine - HyperFormula-based calculation engine
 *
 * Provides Excel-compatible formula evaluation with Named Expressions,
 * cycle detection, and smart recalculation for value driver trees.
 */

import { HyperFormula } from "hyperformula";

import { logger } from "../lib/logger";

export interface CalculationResult {
  nodeId: string;
  value: number;
  error?: string;
}

export interface CalculationUpdate {
  nodeId: string;
  oldValue: number;
  newValue: number;
  formula?: string;
}

export class CalculationEngine {
  private hf: HyperFormula;
  private nodeIdToNamedExpression: Map<string, string> = new Map();
  private namedExpressionToNodeId: Map<string, string> = new Map();

  constructor() {
    // Initialize HyperFormula with standard configuration
    this.hf = HyperFormula.buildEmpty({
      licenseKey: "gpl-v3", // Using GPL v3 license
      useColumnIndex: false,
      useRowIndex: false,
      dateFormats: ["MM/DD/YYYY", "DD/MM/YYYY"],
      timeFormats: ["hh:mm", "hh:mm:ss.sss"],
      currencySymbol: ["$"],
      decimalSeparator: ".",
      thousandSeparator: ",",
      functionArgSeparator: ",",
      arrayColumnSeparator: ";",
      arrayRowSeparator: "|",
    });

    logger.info("CalculationEngine initialized with HyperFormula");
  }

  /**
   * Register a node with its formula as a Named Expression
   */
  registerNode(nodeId: string, formula: string, initialValue?: number): void {
    try {
      // Sanitize node ID for Named Expression (remove special chars, ensure uniqueness)
      const sanitizedId = this.sanitizeNodeId(nodeId);

      // Remove existing named expression if it exists
      if (this.nodeIdToNamedExpression.has(nodeId)) {
        const oldExpression = this.nodeIdToNamedExpression.get(nodeId)!;
        this.hf.removeNamedExpression(oldExpression);
        this.namedExpressionToNodeId.delete(oldExpression);
      }

      // Add new named expression
      if (formula && formula.trim()) {
        // Parse and validate formula
        const parsedFormula = this.parseFormula(formula, nodeId);
        this.hf.addNamedExpression(sanitizedId, parsedFormula);
      } else if (initialValue !== undefined) {
        // For input nodes without formula, use the value directly
        this.hf.addNamedExpression(sanitizedId, initialValue.toString());
      }

      // Update mappings
      this.nodeIdToNamedExpression.set(nodeId, sanitizedId);
      this.namedExpressionToNodeId.set(sanitizedId, nodeId);

      logger.debug("Registered node", { nodeId, sanitizedId, formula });
    } catch (error) {
      logger.error("Failed to register node", { nodeId, formula, error });
      throw new Error(`Failed to register node ${nodeId}: ${error}`);
    }
  }

  /**
   * Update the value of an input node
   */
  updateInput(nodeId: string, value: number): CalculationResult[] {
    try {
      const sanitizedId = this.nodeIdToNamedExpression.get(nodeId);
      if (!sanitizedId) {
        throw new Error(`Node ${nodeId} not registered`);
      }

      // Update the named expression with the new value
      this.hf.changeNamedExpressionFormula(sanitizedId, value.toString());

      // Get all affected nodes
      return this.recalculate();
    } catch (error) {
      logger.error("Failed to update input", { nodeId, value, error });
      return [
        {
          nodeId,
          value: 0,
          error: `Calculation error: ${error}`,
        },
      ];
    }
  }

  /**
   * Update the formula of a calculated node
   */
  updateFormula(nodeId: string, formula: string): CalculationResult[] {
    try {
      const sanitizedId = this.nodeIdToNamedExpression.get(nodeId);
      if (!sanitizedId) {
        throw new Error(`Node ${nodeId} not registered`);
      }

      // Parse and validate the new formula
      const parsedFormula = this.parseFormula(formula, nodeId);

      // Update the named expression
      this.hf.changeNamedExpressionFormula(sanitizedId, parsedFormula);

      // Get all affected nodes
      return this.recalculate();
    } catch (error) {
      logger.error("Failed to update formula", { nodeId, formula, error });
      return [
        {
          nodeId,
          value: 0,
          error: `Formula error: ${error}`,
        },
      ];
    }
  }

  /**
   * Remove a node and its dependencies
   */
  removeNode(nodeId: string): void {
    try {
      const sanitizedId = this.nodeIdToNamedExpression.get(nodeId);
      if (sanitizedId) {
        this.hf.removeNamedExpression(sanitizedId);
        this.nodeIdToNamedExpression.delete(nodeId);
        this.namedExpressionToNodeId.delete(sanitizedId);
      }

      logger.debug("Removed node", { nodeId });
    } catch (error) {
      logger.error("Failed to remove node", { nodeId, error });
    }
  }

  /**
   * Get the current value of a node
   */
  getValue(nodeId: string): number {
    try {
      const sanitizedId = this.nodeIdToNamedExpression.get(nodeId);
      if (!sanitizedId) {
        return 0;
      }

      const result = this.hf.getNamedExpressionValue(sanitizedId);
      return typeof result === "number" ? result : 0;
    } catch (error) {
      logger.error("Failed to get value", { nodeId, error });
      return 0;
    }
  }

  /**
   * Recalculate all expressions and return changed values
   */
  recalculate(): CalculationResult[] {
    try {
      // Force recalculation
      this.hf.recalculate();

      const results: CalculationResult[] = [];

      // Get values for all registered nodes
      for (const [nodeId, sanitizedId] of this.nodeIdToNamedExpression.entries()) {
        try {
          const value = this.hf.getNamedExpressionValue(sanitizedId);
          const numericValue = typeof value === "number" ? value : 0;

          results.push({
            nodeId,
            value: numericValue,
          });
        } catch (error) {
          results.push({
            nodeId,
            value: 0,
            error: `Calculation error: ${error}`,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error("Recalculation failed", { error });
      return [];
    }
  }

  /**
   * Validate a formula syntax (without node context)
   */
  validateFormula(formula: string): { isValid: boolean; error?: string; suggestions?: string[] } {
    try {
      if (!formula.trim()) {
        return { isValid: true };
      }

      // Basic syntax check
      if (!formula.startsWith("=")) {
        return {
          isValid: false,
          error: "Formula must start with =",
          suggestions: ["Start formulas with = for Excel compatibility"],
        };
      }

      // Try to parse with HyperFormula
      const tempId = `temp_${Date.now()}`;
      try {
        this.hf.addNamedExpression(tempId, formula.substring(1)); // Remove = prefix
        this.hf.removeNamedExpression(tempId);
        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: `Formula syntax error: ${error}`,
          suggestions: [
            "Check for missing parentheses or operators",
            "Ensure variable names are correct",
          ],
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: "Invalid formula",
        suggestions: ["Check formula syntax and variable references"],
      };
    }
  }

  /**
   * Calculate a preview of a formula result
   */
  calculatePreview(formula: string): number {
    try {
      if (!formula.trim() || !formula.startsWith("=")) {
        return 0;
      }

      const tempId = `preview_${Date.now()}`;
      this.hf.addNamedExpression(tempId, formula.substring(1)); // Remove = prefix
      const result = this.hf.getNamedExpressionValue(tempId);
      this.hf.removeNamedExpression(tempId);

      return typeof result === "number" ? result : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if a function is supported
   */
  isFunctionSupported(functionName: string): boolean {
    return this.hf.isFunctionSupported(functionName);
  }

  /**
   * Get list of supported functions
   */
  getSupportedFunctions(): string[] {
    return this.hf.getSupportedFunctions();
  }

  /**
   * Parse formula and replace node references with sanitized IDs
   */
  private parseFormula(_formula: string, _currentNodeId: string): string {
    // Replace [Node Label] with sanitized_node_id
    // This is a simplified implementation - in production, you'd want more robust parsing
    // For now, assume formulas use direct node IDs or simple references
    // In the full implementation, this would parse the formula and replace human-readable labels

    return _formula;
  }

  /**
   * Sanitize node ID for use as Named Expression
   */
  private sanitizeNodeId(nodeId: string): string {
    // Replace special characters and ensure starts with letter
    return "node_" + nodeId.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Get all dependent nodes for a given node
   */
  getDependents(_nodeId: string): string[] {
    // This would require analyzing the dependency graph in HyperFormula
    // For now, return empty array - implement when needed
    return [];
  }

  /**
   * Batch register multiple nodes
   */
  batchRegister(nodes: Array<{ id: string; formula?: string; value?: number }>): void {
    try {
      // Suspend evaluation for batch operations
      this.hf.suspendEvaluation();

      for (const node of nodes) {
        this.registerNode(node.id, node.formula || "", node.value);
      }

      // Resume evaluation
      this.hf.resumeEvaluation();
      this.recalculate();

      logger.debug("Batch registered nodes", { count: nodes.length });
    } catch (error) {
      logger.error("Batch registration failed", { error });
      throw error;
    }
  }

  /**
   * Serialize the engine state for persistence
   */
  serialize(): unknown {
    return {
      namedExpressions: this.hf.getAllNamedExpressionsSerialized(),
      nodeMappings: {
        nodeIdToNamedExpression: Array.from(this.nodeIdToNamedExpression.entries()),
        namedExpressionToNodeId: Array.from(this.namedExpressionToNodeId.entries()),
      },
    };
  }

  /**
   * Deserialize and restore engine state
   */
  deserialize(data: unknown): void {
    try {
      // Clear existing state
      this.nodeIdToNamedExpression.clear();
      this.namedExpressionToNodeId.clear();

      // Restore mappings
      if (data.nodeMappings) {
        this.nodeIdToNamedExpression = new Map(data.nodeMappings.nodeIdToNamedExpression);
        this.namedExpressionToNodeId = new Map(data.nodeMappings.namedExpressionToNodeId);
      }

      // Restore named expressions
      if (data.namedExpressions) {
        this.hf.setNamedExpressions(data.namedExpressions);
      }

      logger.debug("Deserialized calculation engine state");
    } catch (error) {
      logger.error("Failed to deserialize engine state", { error });
      throw error;
    }
  }
}

// Export singleton instance
export const calculationEngine = new CalculationEngine();
