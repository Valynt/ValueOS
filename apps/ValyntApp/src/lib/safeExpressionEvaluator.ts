// /workspaces/ValueOS/src/lib/safeExpressionEvaluator.ts
/**
 * Safe Mathematical Expression Evaluator
 *
 * This module provides a secure way to evaluate mathematical expressions
 * without using eval() or new Function(), preventing code injection attacks.
 */

// Allowed mathematical functions and constants
const ALLOWED_FUNCTIONS = new Set([
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atanh",
  "atan2",
  "cbrt",
  "ceil",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "fround",
  "hypot",
  "log",
  "log10",
  "log1p",
  "log2",
  "max",
  "min",
  "pow",
  "random",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc",
]);

const ALLOWED_CONSTANTS = new Set([
  "E",
  "PI",
  "SQRT2",
  "SQRT1_2",
  "LN2",
  "LN10",
  "LOG2E",
  "LOG10E",
]);

/**
 * Tokenizes a mathematical expression
 */
function tokenizeExpression(expression: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];

    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }

    if (/[+\-*/()^,]/.test(char)) {
      if (current) tokens.push(current);
      tokens.push(char);
      current = "";
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      current += char;
    } else if (/[0-9.]/.test(char)) {
      current += char;
    } else {
      throw new Error(`Invalid character in expression: ${char}`);
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * Parses tokens into an Abstract Syntax Tree (AST)
 */
function parseTokens(tokens: string[]): any {
  let index = 0;

  function parseExpression(): any {
    return parseBinaryExpression(0);
  }

  function parseBinaryExpression(minPrecedence: number): any {
    let left = parseUnaryExpression();

    while (index < tokens.length) {
      const operator = tokens[index];
      if (!operator) break;

      const precedence = getOperatorPrecedence(operator);

      if (precedence < minPrecedence) break;

      index++;
      const right = parseBinaryExpression(precedence + 1);
      left = { type: "binary", operator, left, right };
    }

    return left;
  }

  function parseUnaryExpression(): any {
    const token = tokens[index];
    if (!token) throw new Error("Unexpected end of expression");

    if (token === "+" || token === "-") {
      index++;
      const argument = parseUnaryExpression();
      return { type: "unary", operator: token, argument };
    }

    return parsePrimaryExpression();
  }

  function parsePrimaryExpression(): any {
    const token = tokens[index];
    if (!token) throw new Error("Unexpected end of expression");

    if (token === "(") {
      index++;
      const expression = parseExpression();
      if (index >= tokens.length || tokens[index] !== ")") {
        throw new Error("Missing closing parenthesis");
      }
      index++;
      return expression;
    }

    if (/^\d+(\.\d+)?$/.test(token)) {
      index++;
      return { type: "number", value: parseFloat(token) };
    }

    if (ALLOWED_CONSTANTS.has(token)) {
      index++;
      return { type: "constant", name: token };
    }

    if (ALLOWED_FUNCTIONS.has(token)) {
      index++;
      if (index >= tokens.length || tokens[index] !== "(") {
        throw new Error(`Expected '(' after function ${token}`);
      }
      index++;

      const args: any[] = [];
      if (index < tokens.length && tokens[index] !== ")") {
        args.push(parseExpression());
        while (index < tokens.length && tokens[index] === ",") {
          index++;
          args.push(parseExpression());
        }
      }

      if (index >= tokens.length || tokens[index] !== ")") {
        throw new Error("Missing closing parenthesis in function call");
      }
      index++;

      return { type: "function", name: token, args };
    }

    // Variable reference
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      index++;
      return { type: "variable", name: token };
    }

    throw new Error(`Unexpected token: ${token}`);
  }

  const result = parseExpression();
  if (index !== tokens.length) {
    throw new Error("Unexpected tokens after expression");
  }

  return result;
}

function getOperatorPrecedence(operator: string): number {
  switch (operator) {
    case "+":
    case "-":
      return 1;
    case "*":
    case "/":
      return 2;
    case "^":
      return 3;
    default:
      return 0;
  }
}

/**
 * Evaluates an AST node with the given variables
 */
function evaluateAST(node: any, vars: Record<string, number>): number {
  switch (node.type) {
    case "number":
      return node.value;

    case "constant":
      return (Math as any)[node.name];

    case "variable":
      if (vars.hasOwnProperty(node.name)) {
        return vars[node.name];
      }
      throw new Error(`Unknown variable: ${node.name}`);

    case "unary":
      const arg = evaluateAST(node.argument, vars);
      return node.operator === "-" ? -arg : arg;

    case "binary":
      const left = evaluateAST(node.left, vars);
      const right = evaluateAST(node.right, vars);

      switch (node.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) throw new Error("Division by zero");
          return left / right;
        case "^":
          return Math.pow(left, right);
        default:
          throw new Error(`Unknown operator: ${node.operator}`);
      }

    case "function":
      const func = (Math as any)[node.name];
      if (typeof func !== "function") {
        throw new Error(`Unknown function: ${node.name}`);
      }

      const evaluatedArgs = node.args.map((arg: any) => evaluateAST(arg, vars));
      const result = func(...evaluatedArgs);
      if (typeof result !== "number" || isNaN(result)) {
        throw new Error(`Function ${node.name} returned invalid result`);
      }
      return result;

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Creates a safe expression evaluator function
 */
export function createSafeEvaluator() {
  return function evaluate(expression: string, vars: Record<string, number> = {}): number {
    // Validate and parse the expression
    const tokens = tokenizeExpression(expression);
    const ast = parseTokens(tokens);

    // Evaluate the AST
    return evaluateAST(ast, vars);
  };
}

/**
 * Validates if an expression is safe to evaluate
 */
export function validateExpression(expression: string): { valid: boolean; error?: string } {
  try {
    const tokens = tokenizeExpression(expression);
    parseTokens(tokens);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
