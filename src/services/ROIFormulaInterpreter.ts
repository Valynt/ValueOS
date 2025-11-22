/**
 * ROI Formula Interpreter Service
 *
 * Executes ROI calculations using a Domain-Specific Language (DSL) for formulas.
 * Supports:
 * - Variable substitution
 * - Mathematical operations (+, -, *, /, ^, %)
 * - Built-in functions (SUM, AVG, MIN, MAX, IF, ROUND, NPV, IRR)
 * - Sensitivity analysis
 * - Formula validation
 *
 * Example formulas:
 * - "annual_savings * 12 * productivity_gain"
 * - "IF(revenue > 100000, revenue * 0.15, revenue * 0.10)"
 * - "NPV(0.10, cash_flow_1, cash_flow_2, cash_flow_3)"
 */

import { logger } from '../lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  FormulaVariable,
  FormulaContext,
  FormulaResult,
  FormulaStep,
  SensitivityAnalysis,
  SensitivityScenario,
  ROIModelCalculation
} from '../types/vos';
import { securityLogger } from './SecurityLogger';

export class ROIFormulaInterpreter {
  private supabase: SupabaseClient;
  private readonly maxEvaluationMs = 750;
  private readonly maxRecursionDepth = 5;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Execute a single formula with given context
   */
  executeFormula(
    formula: string,
    context: FormulaContext,
    trackSteps: boolean = false
  ): FormulaResult {
    try {
      const intermediateSteps: FormulaStep[] = [];
      const startedAt = Date.now();

      let processedFormula = this.preprocessFormula(formula, context);

      if (trackSteps) {
        intermediateSteps.push({
          calculation: `Original: ${formula}`,
          result: 0,
        });
        intermediateSteps.push({
          calculation: `Substituted: ${processedFormula}`,
          result: 0,
        });
      }

      const result = this.evaluateExpression(processedFormula, context, 0, startedAt);

      if (trackSteps) {
        intermediateSteps.push({
          calculation: `Final Result`,
          result,
        });
      }

      return {
        value: result,
        intermediateSteps: trackSteps ? intermediateSteps : undefined,
      };
    } catch (error) {
      securityLogger.log({
        category: 'formula',
        action: 'execution-error',
        severity: 'warn',
        metadata: { message: error instanceof Error ? error.message : 'Formula execution failed' },
      });
      return {
        value: 0,
        error: error instanceof Error ? error.message : 'Formula execution failed',
      };
    }
  }

  /**
   * Execute multiple calculations in order
   */
  async executeCalculationSequence(
    calculations: ROIModelCalculation[],
    initialContext: FormulaContext
  ): Promise<Record<string, FormulaResult>> {
    const results: Record<string, FormulaResult> = {};
    const context: FormulaContext = {
      variables: { ...initialContext.variables },
      functions: { ...initialContext.functions },
    };

    const sortedCalcs = [...calculations].sort(
      (a, b) => a.calculation_order - b.calculation_order
    );

    for (const calc of sortedCalcs) {
      const result = this.executeFormula(calc.formula, context, true);
      results[calc.name] = result;

      if (!result.error && result.value !== undefined) {
        context.variables[calc.name] = {
          name: calc.name,
          value: result.value,
          unit: calc.unit,
        };
      }
    }

    return results;
  }

  /**
   * Perform sensitivity analysis on a formula
   */
  performSensitivityAnalysis(
    formula: string,
    baseContext: FormulaContext,
    variableName: string,
    scenarios: Array<{ label: string; adjustment: number; adjustmentType: 'percentage' | 'absolute' }>
  ): SensitivityAnalysis {
    const baseVariable = baseContext.variables[variableName];
    if (!baseVariable) {
      throw new Error(`Variable '${variableName}' not found in context`);
    }

    const baselineValue = baseVariable.value;
    const baselineResult = this.executeFormula(formula, baseContext);

    const sensitivityScenarios: SensitivityScenario[] = scenarios.map((scenario) => {
      const adjustedContext = { ...baseContext };
      const adjustedValue =
        scenario.adjustmentType === 'percentage'
          ? baselineValue * (1 + scenario.adjustment / 100)
          : baselineValue + scenario.adjustment;

      adjustedContext.variables = {
        ...baseContext.variables,
        [variableName]: {
          ...baseVariable,
          value: adjustedValue,
        },
      };

      const result = this.executeFormula(formula, adjustedContext);
      const variance = result.value - baselineResult.value;

      return {
        label: scenario.label,
        adjustment: scenario.adjustment,
        adjustmentType: scenario.adjustmentType,
        result: result.value,
        variance,
      };
    });

    return {
      variable: variableName,
      baseline: baselineResult.value,
      scenarios: sensitivityScenarios,
    };
  }

  /**
   * Validate formula syntax without executing
   */
  validateFormula(formula: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formula || formula.trim().length === 0) {
      errors.push('Formula is empty');
      return { valid: false, errors };
    }

    const balancedParens = this.checkBalancedParentheses(formula);
    if (!balancedParens) {
      errors.push('Unbalanced parentheses');
    }

    const invalidChars = /[^\w\s+\-*/^().,<>=!&|]/.exec(formula);
    if (invalidChars) {
      errors.push(`Invalid character found: '${invalidChars[0]}'`);
    }

    const functionPattern = /([A-Z_]+)\(/g;
    let match;
    while ((match = functionPattern.exec(formula)) !== null) {
      const funcName = match[1];
      if (!this.isBuiltInFunction(funcName)) {
        errors.push(`Unknown function: ${funcName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Preprocess formula by substituting variables
   */
  private preprocessFormula(formula: string, context: FormulaContext): string {
    let processed = formula;

    for (const [varName, variable] of Object.entries(context.variables)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      processed = processed.replace(regex, String(variable.value));
    }

    return processed;
  }

  /**
   * Evaluate mathematical expression
   */
  private evaluateExpression(
    expression: string,
    context: FormulaContext,
    depth: number = 0,
    startedAt: number = Date.now()
  ): number {
    expression = expression.trim();

    if (Date.now() - startedAt > this.maxEvaluationMs) {
      throw new Error('Formula execution timeout');
    }
    if (depth > this.maxRecursionDepth) {
      throw new Error('Formula exceeds maximum allowed depth');
    }

    expression = this.evaluateFunctions(expression, context, depth, startedAt);

    expression = expression.replace(/\s+/g, '');

    try {
      const tokens = this.tokenize(expression);
      const postfix = this.infixToPostfix(tokens);
      return this.evaluatePostfix(postfix);
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluate built-in functions
   */
  private evaluateFunctions(
    expression: string,
    context: FormulaContext,
    depth: number,
    startedAt: number
  ): string {
    const functionPattern = /([A-Z_]+)\(([^()]*)\)/g;

    let result = expression;
    let match;
    let iterations = 0;
    const maxIterations = 10;

    while ((match = functionPattern.exec(result)) !== null && iterations < maxIterations) {
      const funcName = match[1];
      const argsString = match[2];
      const args = argsString.split(',').map(arg => {
        const trimmed = arg.trim();
        return this.evaluateExpression(trimmed, context, depth + 1, startedAt);
      });

      const funcResult = this.executeBuiltInFunction(funcName, args);
      result = result.substring(0, match.index) + funcResult + result.substring(match.index + match[0].length);

      functionPattern.lastIndex = 0;
      iterations++;
    }

    return result;
  }

  /**
   * Execute built-in function
   */
  private executeBuiltInFunction(name: string, args: number[]): number {
    switch (name) {
      case 'SUM':
        return args.reduce((sum, val) => sum + val, 0);

      case 'AVG':
        return args.length > 0 ? args.reduce((sum, val) => sum + val, 0) / args.length : 0;

      case 'MIN':
        return Math.min(...args);

      case 'MAX':
        return Math.max(...args);

      case 'IF':
        if (args.length !== 3) throw new Error('IF requires 3 arguments');
        return args[0] !== 0 ? args[1] : args[2];

      case 'ROUND':
        if (args.length < 1 || args.length > 2) throw new Error('ROUND requires 1 or 2 arguments');
        const decimals = args[1] !== undefined ? args[1] : 0;
        return Math.round(args[0] * Math.pow(10, decimals)) / Math.pow(10, decimals);

      case 'NPV':
        if (args.length < 2) throw new Error('NPV requires at least 2 arguments (rate, cashflow1, ...)');
        const rate = args[0];
        const cashflows = args.slice(1);
        return cashflows.reduce((npv, cf, index) => npv + cf / Math.pow(1 + rate, index + 1), 0);

      case 'ABS':
        return Math.abs(args[0]);

      case 'SQRT':
        return Math.sqrt(args[0]);

      case 'POW':
        if (args.length !== 2) throw new Error('POW requires 2 arguments');
        return Math.pow(args[0], args[1]);

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  /**
   * Check if function name is built-in
   */
  private isBuiltInFunction(name: string): boolean {
    return ['SUM', 'AVG', 'MIN', 'MAX', 'IF', 'ROUND', 'NPV', 'ABS', 'SQRT', 'POW'].includes(name);
  }

  /**
   * Tokenize expression
   */
  private tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (/\d|\./.test(char)) {
        currentToken += char;
      } else if (/[+\-*/^()%]/.test(char)) {
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = '';
        }
        tokens.push(char);
      }
    }

    if (currentToken) {
      tokens.push(currentToken);
    }

    return tokens;
  }

  /**
   * Convert infix notation to postfix (Reverse Polish Notation)
   */
  private infixToPostfix(tokens: string[]): string[] {
    const output: string[] = [];
    const operators: string[] = [];
    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
      '%': 2,
      '^': 3,
    };

    for (const token of tokens) {
      if (/^[\d.]+$/.test(token)) {
        output.push(token);
      } else if (token === '(') {
        operators.push(token);
      } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          output.push(operators.pop()!);
        }
        operators.pop();
      } else if (precedence[token] !== undefined) {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          precedence[operators[operators.length - 1]] >= precedence[token]
        ) {
          output.push(operators.pop()!);
        }
        operators.push(token);
      }
    }

    while (operators.length > 0) {
      output.push(operators.pop()!);
    }

    return output;
  }

  /**
   * Evaluate postfix expression
   */
  private evaluatePostfix(tokens: string[]): number {
    const stack: number[] = [];

    for (const token of tokens) {
      if (/^[\d.]+$/.test(token)) {
        stack.push(parseFloat(token));
      } else {
        const b = stack.pop();
        const a = stack.pop();

        if (a === undefined || b === undefined) {
          throw new Error('Invalid expression');
        }

        switch (token) {
          case '+':
            stack.push(a + b);
            break;
          case '-':
            stack.push(a - b);
            break;
          case '*':
            stack.push(a * b);
            break;
          case '/':
            if (b === 0) throw new Error('Division by zero');
            stack.push(a / b);
            break;
          case '%':
            stack.push(a % b);
            break;
          case '^':
            stack.push(Math.pow(a, b));
            break;
          default:
            throw new Error(`Unknown operator: ${token}`);
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid expression');
    }

    return stack[0];
  }

  /**
   * Check if parentheses are balanced
   */
  private checkBalancedParentheses(formula: string): boolean {
    let count = 0;
    for (const char of formula) {
      if (char === '(') count++;
      if (char === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Get formula from database by ROI model ID
   */
  async getROIModelFormulas(roiModelId: string): Promise<ROIModelCalculation[]> {
    const { data, error } = await this.supabase
      .from('roi_model_calculations')
      .select('*')
      .eq('roi_model_id', roiModelId)
      .order('calculation_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create default formula context from KPI hypotheses
   */
  async createContextFromKPIs(valueCaseId: string): Promise<FormulaContext> {
    const { data, error } = await this.supabase
      .from('kpi_hypotheses')
      .select('*')
      .eq('value_case_id', valueCaseId);

    if (error) throw error;

    const variables: Record<string, FormulaVariable> = {};

    for (const kpi of data || []) {
      const varName = this.sanitizeVariableName(kpi.kpi_name);
      variables[varName] = {
        name: varName,
        value: kpi.baseline_value || 0,
        unit: kpi.unit,
        source: `kpi:${kpi.id}`,
      };

      if (kpi.target_value) {
        variables[`${varName}_target`] = {
          name: `${varName}_target`,
          value: kpi.target_value,
          unit: kpi.unit,
          source: `kpi:${kpi.id}`,
        };
      }
    }

    return {
      variables,
      functions: {},
    };
  }

  /**
   * Sanitize KPI name to valid variable name
   */
  private sanitizeVariableName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
