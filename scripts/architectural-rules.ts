/**
 * Architectural Policy Rules
 *
 * Defines and enforces architectural boundaries for ValueOS.
 * Prevents common anti-patterns and maintains clean architecture.
 *
 * Usage:
 *   npm run policy:check
 *   tsx scripts/architectural-rules.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  buildDependencyGraph,
  type DependencyGraph,
} from "./analyze-dependencies";

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  severity: "error" | "warning";
  validate: (graph: DependencyGraph) => Promise<PolicyViolation[]>;
}

export interface PolicyViolation {
  ruleId: string;
  severity: "error" | "warning";
  file: string;
  message: string;
  suggestion?: string;
}

/**
 * Rule 1: Frontend must not directly import backend/database
 */
const frontendDatabaseRule: PolicyRule = {
  id: "no-frontend-database",
  name: "Frontend → Database (Forbidden)",
  description:
    "Frontend components should not directly access database clients",
  severity: "error",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];

    for (const [filePath, node] of graph.nodes) {
      // Check if file is in frontend (components, views, hooks)
      const isFrontend =
        filePath.includes("/components/") ||
        filePath.includes("/views/") ||
        filePath.includes("/hooks/");

      if (!isFrontend) continue;

      // Check if it imports database/backend directly
      for (const importPath of node.imports) {
        const isDatabase =
          importPath.includes("lib/supabase") ||
          importPath.includes("lib/database") ||
          importPath === "src/lib/supabase.ts";

        if (isDatabase) {
          violations.push({
            ruleId: "no-frontend-database",
            severity: "error",
            file: filePath,
            message: `Frontend file "${filePath}" imports database client directly`,
            suggestion: "Use a service layer or API route instead",
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Rule 2: No circular dependencies
 */
const noCircularDependenciesRule: PolicyRule = {
  id: "no-circular-deps",
  name: "No Circular Dependencies",
  description: "Files should not have circular import chains",
  severity: "error",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function detectCycle(node: string, path: string[]): boolean {
      if (recursionStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);

        violations.push({
          ruleId: "no-circular-deps",
          severity: "error",
          file: node,
          message: `Circular dependency detected: ${cycle.join(" → ")}`,
          suggestion: "Refactor to break the circular dependency",
        });
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const graphNode = graph.nodes.get(node);
      if (graphNode) {
        for (const importPath of graphNode.imports) {
          detectCycle(importPath, [...path, node]);
        }
      }

      recursionStack.delete(node);
      return false;
    }

    for (const [filePath] of graph.nodes) {
      if (!visited.has(filePath)) {
        detectCycle(filePath, []);
      }
    }

    return violations;
  },
};

/**
 * Rule 3: Services must not import from views
 */
const servicesViewsRule: PolicyRule = {
  id: "no-services-import-views",
  name: "Services → Views (Forbidden)",
  description: "Business logic services should not import UI components",
  severity: "error",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];

    for (const [filePath, node] of graph.nodes) {
      const isService = filePath.includes("/services/");
      if (!isService) continue;

      for (const importPath of node.imports) {
        const isView =
          importPath.includes("/views/") || importPath.includes("/components/");

        if (isView) {
          violations.push({
            ruleId: "no-services-import-views",
            severity: "error",
            file: filePath,
            message: `Service "${filePath}" imports view/component "${importPath}"`,
            suggestion:
              "Services should be UI-agnostic. Move shared logic to lib/",
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Rule 4: Test files must not be imported by source files
 */
const noImportTestsRule: PolicyRule = {
  id: "no-import-tests",
  name: "Source → Test Files (Forbidden)",
  description: "Production code should not import from test files",
  severity: "error",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];

    for (const [filePath, node] of graph.nodes) {
      const isTest =
        filePath.includes(".test.") ||
        filePath.includes(".spec.") ||
        filePath.includes("__tests__");
      if (isTest) continue; // Tests can import other tests

      for (const importPath of node.imports) {
        const importsTest =
          importPath.includes(".test.") ||
          importPath.includes(".spec.") ||
          importPath.includes("__tests__") ||
          importPath.includes("/tests/");

        if (importsTest) {
          violations.push({
            ruleId: "no-import-tests",
            severity: "error",
            file: filePath,
            message: `Source file "${filePath}" imports test file "${importPath}"`,
            suggestion: "Move shared test utilities to a separate helper file",
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Rule 5: Agent services must use LLM Gateway (not direct API calls)
 */
const agentLLMGatewayRule: PolicyRule = {
  id: "agents-use-llm-gateway",
  name: "Agents Must Use LLM Gateway",
  description: "Agent services should use LLMGateway, not direct API clients",
  severity: "warning",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];

    for (const [filePath, node] of graph.nodes) {
      const isAgent =
        filePath.includes("/lib/agent-fabric/agents/") ||
        (filePath.includes("Agent.ts") && filePath.includes("/services/"));

      if (!isAgent) continue;

      // Check for direct API client imports
      for (const importPath of node.imports) {
        const isDirectAPIClient =
          importPath.includes("openai") ||
          importPath.includes("@anthropic") ||
          importPath.includes("together-ai");

        if (isDirectAPIClient) {
          violations.push({
            ruleId: "agents-use-llm-gateway",
            severity: "warning",
            file: filePath,
            message: `Agent "${filePath}" uses direct API client instead of LLMGateway`,
            suggestion:
              "Import and use LLMGateway for centralized rate limiting, caching, and cost tracking",
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Rule 6: Core services must have test coverage
 */
const coreServiceTestCoverageRule: PolicyRule = {
  id: "core-services-must-test",
  name: "Core Services Must Have Tests",
  description: "Critical services must have corresponding test files",
  severity: "warning",
  validate: async (graph) => {
    const violations: PolicyViolation[] = [];

    const coreServices = [
      "UnifiedAgentOrchestrator",
      "LlmProxyClient",
      "SessionManager",
      "SemanticMemory",
      "AgentQueryService",
      "AgentChatService",
    ];

    for (const [filePath] of graph.nodes) {
      const isCoreService = coreServices.some((svc) => filePath.includes(svc));
      if (!isCoreService) continue;

      // Check if test file exists
      const testPatterns = [
        filePath.replace(".ts", ".test.ts"),
        filePath.replace(".ts", ".spec.ts"),
        filePath
          .replace("/services/", "/services/__tests__/")
          .replace(".ts", ".test.ts"),
      ];

      const hasTest = testPatterns.some((testPath) => {
        const fullPath = path.join(process.cwd(), testPath);
        return fs.existsSync(fullPath);
      });

      if (!hasTest) {
        violations.push({
          ruleId: "core-services-must-test",
          severity: "warning",
          file: filePath,
          message: `Core service "${filePath}" is missing test coverage`,
          suggestion: `Create test file at ${testPatterns[0]}`,
        });
      }
    }

    return violations;
  },
};

/**
 * All policy rules
 */
export const POLICY_RULES: PolicyRule[] = [
  frontendDatabaseRule,
  noCircularDependenciesRule,
  servicesViewsRule,
  noImportTestsRule,
  agentLLMGatewayRule,
  coreServiceTestCoverageRule,
];

/**
 * Run all policy checks
 */
export async function checkPolicies(): Promise<PolicyViolation[]> {
  console.log("🔍 Building dependency graph...\n");
  const rootDir = path.join(process.cwd(), "src");
  const graph = buildDependencyGraph(rootDir);

  console.log(`📋 Running ${POLICY_RULES.length} policy checks...\n`);

  const allViolations: PolicyViolation[] = [];

  for (const rule of POLICY_RULES) {
    console.log(`  Checking: ${rule.name}`);
    const violations = await rule.validate(graph);

    if (violations.length > 0) {
      console.log(`    ❌ ${violations.length} violation(s) found`);
      allViolations.push(...violations);
    } else {
      console.log(`    ✅ Passed`);
    }
  }

  return allViolations;
}

/**
 * Format violations for output
 */
export function formatViolations(violations: PolicyViolation[]): string {
  if (violations.length === 0) {
    return "✅ No policy violations found!\n";
  }

  let output = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `❌ Found ${violations.length} policy violation(s)\n`;
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  if (errors.length > 0) {
    output += `🔴 ERRORS (${errors.length}):\n\n`;
    for (const violation of errors) {
      output += `  Rule: ${violation.ruleId}\n`;
      output += `  File: ${violation.file}\n`;
      output += `  Issue: ${violation.message}\n`;
      if (violation.suggestion) {
        output += `  Fix: ${violation.suggestion}\n`;
      }
      output += "\n";
    }
  }

  if (warnings.length > 0) {
    output += `🟡 WARNINGS (${warnings.length}):\n\n`;
    for (const violation of warnings) {
      output += `  Rule: ${violation.ruleId}\n`;
      output += `  File: ${violation.file}\n`;
      output += `  Issue: ${violation.message}\n`;
      if (violation.suggestion) {
        output += `  Fix: ${violation.suggestion}\n`;
      }
      output += "\n";
    }
  }

  return output;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  checkPolicies()
    .then((violations) => {
      const output = formatViolations(violations);
      console.log(output);

      // Write to file
      fs.writeFileSync(
        "policy-violations.json",
        JSON.stringify(violations, null, 2)
      );

      // Exit with error code if there are errors
      const errors = violations.filter((v) => v.severity === "error");
      if (errors.length > 0) {
        console.error(
          `\n❌ ${errors.length} error(s) must be fixed before merging.\n`
        );
        process.exit(1);
      }

      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Policy check failed:", error);
      process.exit(1);
    });
}
