import { describe, it, expect } from "vitest";
import { createSafeEvaluator, validateExpression } from "../safeExpressionEvaluator";

describe("safeExpressionEvaluator", () => {
  describe("createSafeEvaluator", () => {
    const evaluate = createSafeEvaluator();

    it("evaluates basic numbers", () => {
      expect(evaluate("0")).toBe(0);
      expect(evaluate("42")).toBe(42);
      expect(evaluate("3.14")).toBe(3.14);
    });

    it("evaluates unary operators", () => {
      expect(evaluate("-5")).toBe(-5);
      expect(evaluate("+5")).toBe(5);
      expect(evaluate("!0")).toBe(1);
      expect(evaluate("!1")).toBe(0);
    });

    it("evaluates basic arithmetic", () => {
      expect(evaluate("1 + 2")).toBe(3);
      expect(evaluate("5 - 3")).toBe(2);
      expect(evaluate("4 * 3")).toBe(12);
      expect(evaluate("10 / 2")).toBe(5);
      expect(evaluate("2 ^ 3")).toBe(8);
    });

    it("respects operator precedence", () => {
      expect(evaluate("1 + 2 * 3")).toBe(7);
      expect(evaluate("1 + 2 * 3 ^ 2")).toBe(19);
      expect(evaluate("10 - 4 / 2")).toBe(8);
      expect(evaluate("10 - 2 * 3 + 4")).toBe(8);
    });

    it("respects parentheses", () => {
      expect(evaluate("(1 + 2) * 3")).toBe(9);
      expect(evaluate("2 * (3 + 4)")).toBe(14);
      expect(evaluate("(10 - 4) / 2")).toBe(3);
      expect(evaluate("-(2 + 3)")).toBe(-5);
    });

    it("evaluates logical and comparison operators", () => {
      expect(evaluate("1 == 1")).toBe(1);
      expect(evaluate("1 == 2")).toBe(0);
      expect(evaluate("1 != 2")).toBe(1);
      expect(evaluate("1 != 1")).toBe(0);
      expect(evaluate("2 > 1")).toBe(1);
      expect(evaluate("1 > 2")).toBe(0);
      expect(evaluate("2 >= 2")).toBe(1);
      expect(evaluate("1 >= 2")).toBe(0);
      expect(evaluate("1 < 2")).toBe(1);
      expect(evaluate("2 < 1")).toBe(0);
      expect(evaluate("1 <= 1")).toBe(1);
      expect(evaluate("2 <= 1")).toBe(0);
      expect(evaluate("1 && 1")).toBe(1);
      expect(evaluate("1 && 0")).toBe(0);
      expect(evaluate("1 || 0")).toBe(1);
      expect(evaluate("0 || 0")).toBe(0);
    });

    it("evaluates with constants", () => {
      expect(evaluate("PI")).toBe(Math.PI);
      expect(evaluate("E")).toBe(Math.E);
      expect(evaluate("PI * 2")).toBe(Math.PI * 2);
    });

    it("evaluates with functions", () => {
      expect(evaluate("sin(0)")).toBe(Math.sin(0));
      expect(evaluate("cos(0)")).toBe(Math.cos(0));
      expect(evaluate("max(1, 5, 3)")).toBe(5);
      expect(evaluate("min(1, 5, 3)")).toBe(1);
      expect(evaluate("pow(2, 3)")).toBe(8);
      expect(evaluate("abs(-5)")).toBe(5);
      expect(evaluate("sqrt(16)")).toBe(4);
    });

    it("evaluates with variables", () => {
      const vars = { x: 10, y: 5, my_var: 3 };
      expect(evaluate("x + y", vars)).toBe(15);
      expect(evaluate("x * my_var", vars)).toBe(30);
      expect(evaluate("(x + y) / my_var", vars)).toBe(5);
    });

    it("handles whitespace correctly", () => {
      expect(evaluate(" 1 +  2 ")).toBe(3);
      expect(evaluate("\t1\n+\n2\t")).toBe(3);
    });

    describe("error handling", () => {
      it("throws on invalid characters", () => {
        expect(() => evaluate("1 + $")).toThrow("Invalid character in expression: $");
        expect(() => evaluate("1 + @")).toThrow("Invalid character in expression: @");
      });

      it("throws on unknown variables", () => {
        expect(() => evaluate("x + 1")).toThrow("Unknown variable: x");
        expect(() => evaluate("x + y", { x: 1 })).toThrow("Unknown variable: y");
      });

      it("throws on division by zero", () => {
        expect(() => evaluate("1 / 0")).toThrow("Division by zero");
      });

      it("throws on missing closing parenthesis", () => {
        expect(() => evaluate("(1 + 2")).toThrow("Missing closing parenthesis");
      });

      it("throws on missing function parenthesis", () => {
        expect(() => evaluate("sin 0")).toThrow("Expected '(' after function sin");
        expect(() => evaluate("sin(0")).toThrow("Missing closing parenthesis in function call");
      });

      it("throws on unexpected tokens", () => {
        expect(() => evaluate("1 + 2 3")).toThrow("Unexpected tokens after expression");
      });

      it("throws on unexpected end of expression", () => {
        expect(() => evaluate("1 +")).toThrow("Unexpected end of expression");
      });

      it("throws on unrecognized token sequence", () => {
         // Things that pass tokenizer but fail parser, or unrecognized functions
         expect(() => evaluate("unknownFunction(1)")).toThrow("Unexpected tokens after expression");
      });
    });

    describe("security and code injection", () => {
      it("prevents calling arbitrary JS functions", () => {
        // The single quote causes the tokenizer to throw first.
        expect(() => evaluate("eval('1+1')")).toThrow("Invalid character in expression: '");

        // Without quotes, 'console' is treated as a variable, but 'console.log' causes parsing errors.
        expect(() => evaluate("console.log(1)")).toThrow("Unexpected token: console.log");
      });

      it("prevents accessing prototype properties", () => {
        // These are parsed as variables and will throw Unknown variable during evaluation
        expect(() => evaluate("__proto__")).toThrow("Unknown variable: __proto__");
        expect(() => evaluate("constructor")).toThrow("Unknown variable: constructor");
      });

      it("prevents access to non-whitelisted math functions", () => {
        // e.g. random is not in the ALLOWED_FUNCTIONS list
        // 'random' is parsed as a variable, and the '(' after it makes it fail parser at 'Unexpected tokens after expression'
        expect(() => evaluate("random()")).toThrow("Unexpected tokens after expression");
      });
    });
  });

  describe("validateExpression", () => {
    it("returns valid for correct expressions", () => {
      expect(validateExpression("1 + 2")).toEqual({ valid: true });
      expect(validateExpression("sin(PI / 2) * max(x, y)")).toEqual({ valid: true });
    });

    it("returns invalid for syntax errors", () => {
      expect(validateExpression("1 + ")).toEqual({
        valid: false,
        error: "Unexpected end of expression",
      });
      expect(validateExpression("(1 + 2")).toEqual({
        valid: false,
        error: "Missing closing parenthesis",
      });
      expect(validateExpression("1 + $")).toEqual({
        valid: false,
        error: "Invalid character in expression: $",
      });
      expect(validateExpression("eval('1+1')")).toEqual({
        valid: false,
        error: "Invalid character in expression: '",
      });
    });

    // validateExpression doesn't evaluate, so it won't catch division by zero or unknown variables
    it("does not catch evaluation errors like division by zero or unknown variables", () => {
      expect(validateExpression("1 / 0")).toEqual({ valid: true });
      expect(validateExpression("unknown_var")).toEqual({ valid: true });
    });
  });
});
