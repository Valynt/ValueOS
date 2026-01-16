// /workspaces/ValueOS/src/utils/formulas.ts
export function evaluateFormula(formula: string, vars: Record<string, number>): number {
  const sanitizedFormula = formula.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
    if (vars.hasOwnProperty(match)) {
      return vars[match].toString();
    }
    throw new Error(`Unknown variable: ${match}`);
  });
  // Use Function for safe eval
  const func = new Function("Math", `return ${sanitizedFormula}`);
  return func(Math);
}
