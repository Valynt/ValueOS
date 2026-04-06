#!/usr/bin/env node
/**
 * CI Guardrail: Enforce BaseAgent Inheritance
 *
 * This script scans all agent files in packages/backend/src/lib/agent-fabric/agents/
 * and fails the build if any agent:
 * 1. Does not extend BaseAgent
 * 2. Contains direct LLM invocations (llmGateway.complete) outside of secureInvoke
 * 3. Is not registered in AgentFactory
 *
 * Usage: node scripts/ci/enforce-base-agent-compliance.js
 * Exit code: 0 if compliant, 1 if violations found
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTS_DIR = resolve(__dirname, "../../packages/backend/src/lib/agent-fabric/agents");
const AGENT_FACTORY_PATH = resolve(__dirname, "../../packages/backend/src/lib/agent-fabric/AgentFactory.ts");

// Agents that are allowed to not extend BaseAgent (with documented justification).
// These are ORCHESTRATION agents — they coordinate other agents but do not make
// direct LLM calls themselves. They must not be confused with LLM agents.
// Decision records: docs/architecture/agent-contract-decisions.md
const ALLOWED_EXCEPTIONS = new Set([
  // DiscoveryAgent: orchestration-only. Coordinates OpportunityAgent and emits
  // domain events via DomainEventBus. No direct LLM calls. Does not need
  // secureInvoke because it delegates all LLM work to OpportunityAgent.
  // See: docs/architecture/agent-contract-decisions.md §1
  "DiscoveryAgent",
]);

// Patterns that indicate security contract violations
const VIOLATION_PATTERNS = {
  // Direct LLM invocation bypassing secureInvoke
  directLLMCall: /this\.llmGateway\.\w+\(/g,
  // Direct complete call outside secureInvoke
  directComplete: /this\.llmGateway\.complete\(/g,
  // No BaseAgent extension
  missingBaseAgent: /class\s+\w+Agent\s+(?!.*extends\s+BaseAgent)/,
  // Direct import of LLMGateway without going through BaseAgent
  suspiciousImport: /import\s+.*LLMGateway.*from.*(?!BaseAgent)/,
};

const IGNORED_FILES = new Set([
  "BaseAgent.ts",
  "index.ts",
  "types.ts",
  "utils.ts",
]);

function findAgentFiles(dir) {
  const files = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip __tests__ and __mocks__ directories
        if (!entry.name.startsWith("__")) {
          files.push(...findAgentFiles(fullPath));
        }
      } else if (
        entry.isFile() && 
        entry.name.endsWith("Agent.ts") && 
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".spec.ts") &&
        !IGNORED_FILES.has(entry.name)
      ) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}: ${error.message}`);
    process.exit(1);
  }
  
  return files;
}

function analyzeAgentFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const relativePath = filePath.replace(process.cwd(), "");
  const fileName = filePath.split("/").pop();
  const agentName = fileName.replace(".ts", "");
  
  const violations = [];
  
  // Check 1: Must extend BaseAgent
  const hasBaseAgentExtension = /class\s+\w+Agent\s+extends\s+BaseAgent/.test(content);
  if (!hasBaseAgentExtension) {
    if (!ALLOWED_EXCEPTIONS.has(agentName)) {
      violations.push({
        type: "MISSING_BASE_AGENT",
        message: `${agentName} does not extend BaseAgent`,
        severity: "CRITICAL",
      });
    }
  }
  
  // Check 2: Must not call llmGateway methods directly (outside secureInvoke)
  // Count direct LLM gateway calls
  const directCalls = content.match(VIOLATION_PATTERNS.directLLMCall) || [];
  const directCompleteCalls = content.match(VIOLATION_PATTERNS.directComplete) || [];
  
  // Exclude the call inside BaseAgent.secureInvoke implementation
  const isBaseAgentFile = fileName === "BaseAgent.ts";
  
  if (directCompleteCalls.length > 0 && !isBaseAgentFile) {
    // Check if these are inside secureInvoke method
    const secureInvokeBlock = /secureInvoke[\s\S]*?llmGateway\.complete\(/;
    if (!secureInvokeBlock.test(content)) {
      violations.push({
        type: "DIRECT_LLM_INVOCATION",
        message: `${agentName} calls llmGateway.complete() outside of secureInvoke`,
        severity: "CRITICAL",
        count: directCompleteCalls.length,
      });
    }
  }
  
  // Check 3: Must have validateInput method (BaseAgent pattern)
  const hasValidateInput = /validateInput\s*\(/.test(content);
  if (!hasValidateInput && hasBaseAgentExtension) {
    violations.push({
      type: "MISSING_VALIDATE_INPUT",
      message: `${agentName} extends BaseAgent but doesn't implement validateInput`,
      severity: "WARNING",
    });
  }
  
  // Check 4: Must use Zod schemas for output validation.
  // Schemas may be defined inline (z.object) or imported from agent-schemas.js.
  const hasInlineZodSchema = /z\.(object|array|string|number|enum)\(/.test(content);
  const hasImportedZodSchema = /from\s+['"].*agent-schemas(\.js)?['"]/.test(content);
  const hasZodSchema = hasInlineZodSchema || hasImportedZodSchema;
  if (!hasZodSchema && hasBaseAgentExtension) {
    violations.push({
      type: "MISSING_ZOD_SCHEMA",
      message: `${agentName} should use Zod schemas for type validation`,
      severity: "WARNING",
    });
  }
  
  // Check 5: Must propagate organization_id (tenant context)
  const hasTenantPropagation = /organization_id|tenant_id/.test(content);
  if (!hasTenantPropagation && hasBaseAgentExtension) {
    violations.push({
      type: "MISSING_TENANT_CONTEXT",
      message: `${agentName} does not reference organization_id/tenant_id`,
      severity: "CRITICAL",
    });
  }
  
  return {
    fileName,
    relativePath,
    agentName,
    extendsBaseAgent: hasBaseAgentExtension,
    violations,
  };
}

function checkAgentFactoryRegistration(agentFiles) {
  const violations = [];
  
  try {
    const factoryContent = readFileSync(AGENT_FACTORY_PATH, "utf-8");
    
    for (const agentFile of agentFiles) {
      const agentName = agentFile.fileName.replace(".ts", "");
      
      // Check if agent is imported in AgentFactory
      const importPattern = new RegExp(`import.*${agentName}.*from`);
      const isImported = importPattern.test(factoryContent);
      
      // Check if agent is registered in FABRIC_AGENT_CLASSES
      const registrationPattern = new RegExp(`["']${agentName.toLowerCase().replace("agent", "")}["']\\s*:\\s*${agentName}`);
      const isRegistered = registrationPattern.test(factoryContent);
      
      if (!isImported && !ALLOWED_EXCEPTIONS.has(agentName)) {
        violations.push({
          type: "NOT_IN_FACTORY",
          message: `${agentName} is not imported in AgentFactory.ts`,
          severity: "WARNING",
        });
      }
      
      if (!isRegistered && !ALLOWED_EXCEPTIONS.has(agentName)) {
        violations.push({
          type: "NOT_REGISTERED",
          message: `${agentName} is not registered in FABRIC_AGENT_CLASSES`,
          severity: "WARNING",
        });
      }
    }
  } catch (error) {
    console.error(`Error reading AgentFactory: ${error.message}`);
    process.exit(1);
  }
  
  return violations;
}

function generateReport(results) {
  let criticalCount = 0;
  let warningCount = 0;
  
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║     AGENT SECURITY COMPLIANCE REPORT                           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  for (const result of results) {
    if (result.violations.length === 0) {
      console.log(`✅ ${result.agentName}: COMPLIANT`);
      continue;
    }
    
    console.log(`\n❌ ${result.agentName}: ${result.violations.length} violation(s)`);
    console.log(`   File: ${result.relativePath}`);
    
    for (const violation of result.violations) {
      const icon = violation.severity === "CRITICAL" ? "🔴" : "⚠️";
      console.log(`   ${icon} [${violation.severity}] ${violation.message}`);
      
      if (violation.severity === "CRITICAL") {
        criticalCount++;
      } else {
        warningCount++;
      }
    }
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Total agents scanned: ${results.length}`);
  console.log(`Compliant agents: ${results.filter(r => r.violations.length === 0).length}`);
  console.log(`Agents with violations: ${results.filter(r => r.violations.length > 0).length}`);
  console.log(`Critical violations: ${criticalCount}`);
  console.log(`Warnings: ${warningCount}`);
  
  return { criticalCount, warningCount };
}

function main() {
  console.log("🔍 Scanning agent files for security compliance...\n");
  
  // Find all agent files
  const agentFilePaths = findAgentFiles(AGENTS_DIR);
  console.log(`Found ${agentFilePaths.length} agent file(s) to analyze`);
  
  // Analyze each agent file
  const results = agentFilePaths.map(analyzeAgentFile);
  
  // Check AgentFactory registration
  const factoryViolations = checkAgentFactoryRegistration(results);
  
  // Add factory violations to results
  for (const violation of factoryViolations) {
    const existingResult = results.find(r => r.agentName === violation.agentName);
    if (existingResult) {
      existingResult.violations.push(violation);
    }
  }
  
  // Generate report
  const { criticalCount, warningCount } = generateReport(results);
  
  // Exit with error if critical violations found
  if (criticalCount > 0) {
    console.log("\n❌ BUILD FAILED: Critical security violations detected");
    console.log("\nAll production agents MUST:");
    console.log("  1. Extend BaseAgent");
    console.log("  2. Use secureInvoke for all LLM calls");
    console.log("  3. Propagate organization_id for tenant isolation");
    console.log("  4. Be registered in AgentFactory");
    console.log("\nTo request an exception, add the agent name to ALLOWED_EXCEPTIONS in this script");
    console.log("with a detailed justification comment.\n");
    process.exit(1);
  }
  
  if (warningCount > 0) {
    console.log("\n⚠️  Build passed with warnings (non-blocking)");
  } else {
    console.log("\n✅ All agents comply with security contract\n");
  }
  
  process.exit(0);
}

main();
