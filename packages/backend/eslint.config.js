import js from "@eslint/js";
import tseslint from "typescript-eslint";

const reqAsAnyMessage = "Do not cast req to any. Use typed Express.Request properties from src/types/express.d.ts (e.g., req.tenantId, req.userId, req.sessionId, req.user, req.db).";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // Pre-existing baseline issues — warn only until resolved
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-case-declarations": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-useless-catch": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/**/__tests__/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression[expression.type='Identifier'][expression.name='req'] > TSAnyKeyword",
          message: reqAsAnyMessage,
        },
      ],
    },
  },
  {
    files: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/**/__tests__/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
