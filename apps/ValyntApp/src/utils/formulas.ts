// /workspaces/ValueOS/src/utils/formulas.ts
import { createSafeEvaluator } from "@/lib/safeExpressionEvaluator";

export function evaluateFormula(formula: string, vars: Record<string, number>): number {
  // Validate input
  if (typeof formula !== "string" || formula.trim() === "") {
    throw new Error("Formula must be a non-empty string");
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /constructor\s*\(/,
    /prototype\s*\./,
    /__proto__/,
    /import\s+/,
    /require\s*\(/,
    /process\./,
    /global\./,
    /window\./,
    /document\./,
    /console\./,
    /setTimeout/,
    /setInterval/,
    /\<script/i,
    /javascript:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(formula)) {
      throw new Error("Dangerous code pattern detected in formula");
    }
  }

  // Use safe evaluator
  const evaluate = createSafeEvaluator();
  return evaluate(formula, vars);
}
