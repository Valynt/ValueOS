/**
 * Structural Truth Module
 *
 * Implements the mathematical foundation for business case generation:
 * - Formula registry and evaluation engine
 * - KPI dependency resolution
 * - Benchmark validation
 * - Value driver tree population
 *
 * Part of Phase 3 - Integration & Business Case Generation
 */

import {
  StructuralKPINode,
  StructuralEdge,
  FormulaRegistry,
  StructuralGraph,
  StructuralPersona,
  StructuralIndustry,
  ImprovementDirection,
  FormulaResult,
  FormulaStep,
  ValidationResult,
  checkBenchmarkAlignment,
} from "../types/structural-truth";
import {
  ALL_STRUCTURAL_KPIS,
  EXTENDED_STRUCTURAL_EDGES,
  INITIAL_FORMULA_REGISTRY,
  EXTENDED_STRUCTURAL_PERSONA_MAPS,
} from "../types/structural-data";
import { evaluateFormula } from "@/utils/formulas";

export interface FormulaInput {
  kpiId: string;
  value: number;
  confidence: number;
}

export interface FormulaEvaluationResult {
  success: boolean;
  output?: {
    kpiId: string;
    value: number;
    confidence: number;
  };
  intermediateSteps?: FormulaStep[];
  errors?: string[];
  warnings?: string[];
}

export interface StructuralTruthConfig {
  strictValidation?: boolean;
  maxFormulaDepth?: number;
  enableBenchmarkChecks?: boolean;
}

/**
 * Structural Truth Engine
 *
 * Handles all mathematical relationships and formula calculations
 */
export class StructuralTruth {
  private graph: StructuralGraph;
  private formulaRegistry: Map<string, FormulaRegistry>;
  private kpiMap: Map<string, StructuralKPINode>;
  private edgeMap: Map<string, StructuralEdge[]>;
  private config: StructuralTruthConfig;

  constructor(config: StructuralTruthConfig = {}) {
    this.config = {
      strictValidation: true,
      maxFormulaDepth: 10,
      enableBenchmarkChecks: true,
      ...config,
    };

    this.formulaRegistry = new Map();
    this.kpiMap = new Map();
    this.edgeMap = new Map();

    this.initializeGraph();
  }

  /**
   * Initialize the structural truth graph
   */
  private initializeGraph(): void {
    // Build KPI map
    ALL_STRUCTURAL_KPIS.forEach((kpi) => {
      this.kpiMap.set(kpi.id, kpi);
    });

    // Build edge map
    EXTENDED_STRUCTURAL_EDGES.forEach((edge) => {
      if (!this.edgeMap.has(edge.sourceId)) {
        this.edgeMap.set(edge.sourceId, []);
      }
      this.edgeMap.get(edge.sourceId)!.push(edge);
    });

    // Build formula registry
    INITIAL_FORMULA_REGISTRY.forEach((formula) => {
      this.formulaRegistry.set(formula.formula_id, formula);
    });

    this.graph = {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      nodes: ALL_STRUCTURAL_KPIS,
      edges: EXTENDED_STRUCTURAL_EDGES,
      personaMaps: EXTENDED_STRUCTURAL_PERSONA_MAPS,
      formulas: INITIAL_FORMULA_REGISTRY,
    };

    console.log(
      `[StructuralTruth] Initialized with ${this.kpiMap.size} KPIs, ${this.edgeMap.size} edges, ${this.formulaRegistry.size} formulas`
    );
  }

  /**
   * Get formula registry instance
   */
  getFormulaRegistry(): FormulaRegistryAPI {
    return new FormulaRegistryAPI(this.formulaRegistry, this.kpiMap);
  }

  /**
   * Get KPI benchmark data
   */
  getKPIBenchmark(
    kpiId: string,
    persona?: StructuralPersona
  ): { p25: number; p50: number; p75: number } | null {
    const kpi = this.kpiMap.get(kpiId);
    if (!kpi) return null;

    // Apply persona-specific adjustments if needed
    if (persona) {
      const personaMap = this.graph.personaMaps.find((p) => p.persona === persona);
      if (personaMap && personaMap.keyKPIs.includes(kpiId)) {
        // Persona-critical KPIs get 10% tighter benchmarks
        return {
          p25: kpi.benchmarks.p25 * 1.1,
          p50: kpi.benchmarks.p50,
          p75: kpi.benchmarks.p75 * 0.9,
        };
      }
    }

    return {
      p25: kpi.benchmarks.p25,
      p50: kpi.benchmarks.p50,
      p75: kpi.benchmarks.p75,
    };
  }

  /**
   * Get all KPIs for a specific industry
   */
  getKPIsByIndustry(industry: StructuralIndustry): StructuralKPINode[] {
    return ALL_STRUCTURAL_KPIS.filter((kpi) => kpi.domain === industry);
  }

  /**
   * Get KPI dependencies
   */
  getDependencies(kpiId: string): string[] {
    const kpi = this.kpiMap.get(kpiId);
    return kpi ? [...kpi.dependencies] : [];
  }

  /**
   * Get KPIs that depend on this one
   */
  getDependents(kpiId: string): string[] {
    const dependents: string[] = [];

    for (const [sourceId, edges] of this.edgeMap) {
      edges.forEach((edge) => {
        if (edge.targetId === kpiId && edge.type === "causal_driver") {
          dependents.push(sourceId);
        }
      });
    }

    // Also check formula dependencies
    this.formulaRegistry.forEach((formula) => {
      if (formula.input_kpis.includes(kpiId)) {
        dependents.push(formula.output_kpi);
      }
    });

    return [...new Set(dependents)];
  }

  /**
   * Evaluate a formula with given inputs
   */
  async evaluateFormula(
    formulaId: string,
    inputs: FormulaInput[]
  ): Promise<FormulaEvaluationResult> {
    const formula = this.formulaRegistry.get(formulaId);
    if (!formula) {
      return {
        success: false,
        errors: [`Formula ${formulaId} not found`],
      };
    }

    // Validate inputs
    const inputMap = new Map(inputs.map((i) => [i.kpiId, i]));
    const missingInputs = formula.input_kpis.filter((id) => !inputMap.has(id));

    if (missingInputs.length > 0) {
      return {
        success: false,
        errors: [`Missing required inputs: ${missingInputs.join(", ")}`],
      };
    }

    // Extract values
    const variables: Record<string, number> = {};
    let avgConfidence = 1.0;

    for (const inputKpi of formula.input_kpis) {
      const input = inputMap.get(inputKpi)!;
      variables[inputKpi] = input.value;
      avgConfidence = Math.min(avgConfidence, input.confidence);
    }

    // Evaluate based on functional form
    let result: number;
    const steps: FormulaStep[] = [];

    try {
      switch (formula.functional_form) {
        case "ratio":
          result = variables[formula.input_kpis[0]] / variables[formula.input_kpis[1]];
          steps.push({
            calculation: `${formula.input_kpis[0]} / ${formula.input_kpis[1]}`,
            result,
            unit: formula.required_units[0],
          });
          break;

        case "difference":
          result =
            variables[formula.input_kpis[0]] +
            variables[formula.input_kpis[1]] -
            variables[formula.input_kpis[2]];
          steps.push({
            calculation: `${formula.input_kpis[0]} + ${formula.input_kpis[1]} - ${formula.input_kpis[2]}`,
            result,
            unit: formula.required_units[0],
          });
          break;

        case "product":
          result = formula.input_kpis.reduce((acc, kpi) => acc * variables[kpi], 1);
          steps.push({
            calculation: formula.input_kpis.join(" * "),
            result,
            unit: formula.required_units[0],
          });
          break;

        default:
          // Custom formula - use safe evaluator
          const expression = formula.formula.replace(/([a-z_]+)/g, (match) => {
            return variables[match] !== undefined ? variables[match].toString() : match;
          });

          // Use safe evaluator instead of eval
          result = evaluateFormula(expression, variables);
          steps.push({
            calculation: formula.formula,
            result,
            unit: formula.required_units[0],
          });
      }

      // Validate against constraints
      const validation = this.validateFormulaResult(formula, result);

      if (!validation.valid && this.config.strictValidation) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          intermediateSteps: steps,
        };
      }

      return {
        success: true,
        output: {
          kpiId: formula.output_kpi,
          value: result,
          confidence: avgConfidence * validation.confidence,
        },
        intermediateSteps: steps,
        warnings: validation.warnings,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Formula evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
        intermediateSteps: steps,
      };
    }
  }

  /**
   * Validate formula result against constraints
   */
  private validateFormulaResult(formula: FormulaRegistry, result: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Check output range
    const [min, max] = formula.validation_constraints.output_range;
    if (result < min || result > max) {
      if (this.config.strictValidation) {
        errors.push(`Result ${result} outside valid range [${min}, ${max}]`);
        confidence *= 0.5;
      } else {
        warnings.push(`Result ${result} outside typical range [${min}, ${max}]`);
        confidence *= 0.8;
      }
    }

    // Check logical constraints
    for (const check of formula.validation_constraints.logical_checks) {
      try {
        // Simple constraint evaluation - use safe evaluator
        const constraintResult = evaluateFormula(
          check.replace(/([a-z_]+)/g, (match) => {
            return formula.input_kpis.includes(match) ? result.toString() : match;
          }),
          {}
        );

        if (!constraintResult) {
          warnings.push(`Logical check failed: ${check}`);
          confidence *= 0.9;
        }
      } catch (e) {
        warnings.push(`Could not evaluate constraint: ${check}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      confidence,
    };
  }

  /**
   * Calculate cascading impact of a KPI change
   */
  calculateCascadingImpact(
    rootKpiId: string,
    changeAmount: number,
    maxDepth: number = 3
  ): Array<{ kpiId: string; impact: number; depth: number }> {
    const impacts: Array<{ kpiId: string; impact: number; depth: number }> = [];
    const visited = new Set<string>();

    const traverse = (kpiId: string, currentImpact: number, depth: number) => {
      if (depth > maxDepth || visited.has(`${kpiId}-${depth}`)) return;

      visited.add(`${kpiId}-${depth}`);

      // Find formulas that use this KPI as input
      this.formulaRegistry.forEach((formula) => {
        if (formula.input_kpis.includes(kpiId)) {
          // Calculate how much this KPI contributes to the output
          const inputIndex = formula.input_kpis.indexOf(kpiId);
          const sensitivity = this.calculateSensitivity(formula, inputIndex);

          const outputImpact = currentImpact * sensitivity;

          impacts.push({
            kpiId: formula.output_kpi,
            impact: outputImpact,
            depth: depth + 1,
          });

          // Recursively traverse
          traverse(formula.output_kpi, outputImpact, depth + 1);
        }
      });

      // Also check edge relationships
      const edges = this.edgeMap.get(kpiId) || [];
      edges.forEach((edge) => {
        if (edge.type === "causal_driver") {
          const edgeImpact = currentImpact * edge.strength;
          impacts.push({
            kpiId: edge.targetId,
            impact: edgeImpact,
            depth: depth + 1,
          });

          traverse(edge.targetId, edgeImpact, depth + 1);
        }
      });
    };

    traverse(rootKpiId, changeAmount, 0);
    return impacts;
  }

  /**
   * Calculate sensitivity of a formula to one of its inputs
   */
  private calculateSensitivity(formula: FormulaRegistry, inputIndex: number): number {
    const baseInputs = formula.input_kpis.map(() => 100); // Base value
    const perturbedInputs = [...baseInputs];
    perturbedInputs[inputIndex] = 101; // 1% increase

    // Evaluate both
    const baseResult = this.evaluateFormulaWithValues(formula, baseInputs);
    const perturbedResult = this.evaluateFormulaWithValues(formula, perturbedInputs);

    if (baseResult === 0) return 0;
    return (perturbedResult - baseResult) / baseResult;
  }

  /**
   * Evaluate formula with raw values (helper)
   */
  private evaluateFormulaWithValues(formula: FormulaRegistry, values: number[]): number {
    const variables: Record<string, number> = {};
    formula.input_kpis.forEach((kpi, i) => {
      variables[kpi] = values[i];
    });

    switch (formula.functional_form) {
      case "ratio":
        return variables[formula.input_kpis[0]] / variables[formula.input_kpis[1]];
      case "difference":
        return (
          variables[formula.input_kpis[0]] +
          variables[formula.input_kpis[1]] -
          variables[formula.input_kpis[2]]
        );
      case "product":
        return formula.input_kpis.reduce((acc, kpi) => acc * variables[kpi], 1);
      default:
        const expression = formula.formula.replace(/([a-z_]+)/g, (match) => {
          return variables[match] !== undefined ? variables[match].toString() : match;
        });
        return evaluateFormula(expression, variables);
    }
  }

  /**
   * Get complete structural graph
   */
  getGraph(): StructuralGraph {
    return { ...this.graph };
  }

  /**
   * Find KPIs by persona
   */
  getKPIsForPersona(persona: StructuralPersona): StructuralKPINode[] {
    const personaMap = this.graph.personaMaps.find((p) => p.persona === persona);
    if (!personaMap) return [];

    return personaMap.keyKPIs
      .map((id) => this.kpiMap.get(id))
      .filter((kpi): kpi is StructuralKPINode => kpi !== undefined);
  }

  /**
   * Get financial driver for persona
   */
  getFinancialDriver(persona: StructuralPersona): string | undefined {
    const personaMap = this.graph.personaMaps.find((p) => p.persona === persona);
    return personaMap?.financialDriver;
  }
}

/**
 * Formula Registry API
 *
 * Provides a clean interface for formula operations
 */
export class FormulaRegistryAPI {
  constructor(
    private registry: Map<string, FormulaRegistry>,
    private kpiMap: Map<string, StructuralKPINode>
  ) {}

  /**
   * Get formula by ID
   */
  getFormula(formulaId: string): FormulaRegistry | undefined {
    return this.registry.get(formulaId);
  }

  /**
   * Get all formulas for a KPI
   */
  getFormulasForKPI(kpiId: string): FormulaRegistry[] {
    return Array.from(this.registry.values()).filter((f) => f.output_kpi === kpiId);
  }

  /**
   * Get formulas that use this KPI as input
   */
  getFormulasUsingKPI(kpiId: string): FormulaRegistry[] {
    return Array.from(this.registry.values()).filter((f) => f.input_kpis.includes(kpiId));
  }

  /**
   * Get dependencies for a KPI
   */
  getDependencies(kpiId: string): string[] {
    const kpi = this.kpiMap.get(kpiId);
    return kpi ? [...kpi.dependencies] : [];
  }

  /**
   * Get dependents for a KPI
   */
  getDependents(kpiId: string): string[] {
    const dependents: string[] = [];

    this.registry.forEach((formula) => {
      if (formula.input_kpis.includes(kpiId)) {
        dependents.push(formula.output_kpi);
      }
    });

    return [...new Set(dependents)];
  }

  /**
   * Evaluate formula by ID
   */
  evaluate(formulaId: string, inputs: FormulaInput[]): FormulaEvaluationResult {
    const formula = this.registry.get(formulaId);
    if (!formula) {
      return {
        success: false,
        errors: [`Formula ${formulaId} not found`],
      };
    }

    // Use the structural truth engine for evaluation
    // This is a simplified version - in practice, we'd use the main engine
    const inputMap = new Map(inputs.map((i) => [i.kpiId, i]));
    const missingInputs = formula.input_kpis.filter((id) => !inputMap.has(id));

    if (missingInputs.length > 0) {
      return {
        success: false,
        errors: [`Missing required inputs: ${missingInputs.join(", ")}`],
      };
    }

    const variables: Record<string, number> = {};
    let avgConfidence = 1.0;

    for (const inputKpi of formula.input_kpis) {
      const input = inputMap.get(inputKpi)!;
      variables[inputKpi] = input.value;
      avgConfidence = Math.min(avgConfidence, input.confidence);
    }

    try {
      let result: number;

      switch (formula.functional_form) {
        case "ratio":
          result = variables[formula.input_kpis[0]] / variables[formula.input_kpis[1]];
          break;
        case "difference":
          result =
            variables[formula.input_kpis[0]] +
            variables[formula.input_kpis[1]] -
            variables[formula.input_kpis[2]];
          break;
        case "product":
          result = formula.input_kpis.reduce((acc, kpi) => acc * variables[kpi], 1);
          break;
        default:
          const expression = formula.formula.replace(/([a-z_]+)/g, (match) => {
            return variables[match] !== undefined ? variables[match].toString() : match;
          });
          result = evaluateFormula(expression, variables);
      }

      return {
        success: true,
        output: {
          kpiId: formula.output_kpi,
          value: result,
          confidence: avgConfidence,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`],
      };
    }
  }

  /**
   * Get all formulas
   */
  getAllFormulas(): FormulaRegistry[] {
    return Array.from(this.registry.values());
  }
}

// Export types and utilities
export * from "../types/structural-truth";
