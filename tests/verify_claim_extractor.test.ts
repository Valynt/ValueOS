import { UnifiedTruthLayer } from "../src/mcp-ground-truth/core/UnifiedTruthLayer";
import { logger } from "../src/lib/logger";

// Mock logger
logger.info = () => {};
logger.warn = () => {};
logger.error = () => {};

async function verifyClaimExtractorIntegration() {
  console.log("--- Verifying Claim Extraction in UnifiedTruthLayer ---");

  const truthLayer = new UnifiedTruthLayer();

  // Test Case 1: Revenue (Original regex handled this)
  const claim1 = "Revenue was $100 million.";
  console.log(`\nTesting Claim 1: "${claim1}"`);

  // We use verifyClaim. Since we don't have modules connected, it will fail verification step
  // but we check if it detected the claim (discrepancy != 'No numeric claims found in text').
  const result1 = await truthLayer.verifyClaim(claim1, "TEST_ENTITY");

  if (result1.discrepancy === "No numeric claims found in text") {
    console.log("FAIL: Revenue claim NOT detected.");
  } else {
    console.log("PASS: Revenue claim detected.");
  }

  // Test Case 2: Net Income (Original regex FAILED this)
  const claim2 = "Net income was $50 million.";
  console.log(`\nTesting Claim 2: "${claim2}"`);

  const result2 = await truthLayer.verifyClaim(claim2, "TEST_ENTITY");

  if (result2.discrepancy === "No numeric claims found in text") {
    console.log("FAIL: Net Income claim NOT detected.");
  } else {
    console.log("PASS: Net Income claim detected.");
  }

  // Test Case 3: Operating Margin (Original regex FAILED this)
  const claim3 = "Operating margin is 15%.";
  console.log(`\nTesting Claim 3: "${claim3}"`);

  const result3 = await truthLayer.verifyClaim(claim3, "TEST_ENTITY");

  if (result3.discrepancy === "No numeric claims found in text") {
    console.log("FAIL: Operating Margin claim NOT detected.");
  } else {
    console.log("PASS: Operating Margin claim detected.");
  }

  // Test Case 4: EPS (Original regex FAILED this)
  const claim4 = "EPS of $2.50";
  console.log(`\nTesting Claim 4: "${claim4}"`);

  const result4 = await truthLayer.verifyClaim(claim4, "TEST_ENTITY");

  if (result4.discrepancy === "No numeric claims found in text") {
    console.log("FAIL: EPS claim NOT detected.");
  } else {
    console.log("PASS: EPS claim detected.");
  }
}

verifyClaimExtractorIntegration().catch(console.error);
