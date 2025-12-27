/**
 * Together AI Startup Validation Script
 *
 * Run this script at application startup or in CI/CD to validate
 * that Together AI is properly configured.
 *
 * Usage:
 *   npx tsx scripts/validate-together-ai.ts
 */

import { validateTogetherAIStartup } from "../src/utils/togetherAIValidation";

console.log("🔍 Validating Together AI Configuration...\n");

const result = validateTogetherAIStartup();

// Display results
console.log("Provider Configuration:");
console.log(`  Provider: ${result.info.provider.configProvider}`);
console.log(`  Embedding Model: ${result.info.provider.embeddingModel}`);
console.log(
  `  Embedding Dimensions: ${result.info.provider.embeddingDimension}`
);
console.log("");

console.log("Environment Configuration:");
console.log(`  Provider: ${result.info.environment.provider}`);
console.log(`  Valid: ${result.info.environment.valid ? "✅" : "❌"}`);
console.log("");

console.log("API Key Configuration:");
console.log(`  Configured: ${result.info.apiKey.configured ? "✅" : "❌"}`);
console.log("");

// Display errors
if (result.errors.length > 0) {
  console.log("❌ ERRORS:");
  result.errors.forEach((error) => {
    console.log(`  - ${error}`);
  });
  console.log("");
}

// Display warnings
if (result.warnings.length > 0) {
  console.log("⚠️  WARNINGS:");
  result.warnings.forEach((warning) => {
    console.log(`  - ${warning}`);
  });
  console.log("");
}

// Final result
if (result.success) {
  console.log("✅ Together AI validation PASSED");
  console.log(
    "   Application is correctly configured to use Together AI as the sole provider."
  );
  process.exit(0);
} else {
  console.log("❌ Together AI validation FAILED");
  console.log("   Please fix the errors above before proceeding.");
  process.exit(1);
}
