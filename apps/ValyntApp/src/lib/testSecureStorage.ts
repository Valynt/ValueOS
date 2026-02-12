/**
 * Test script for SecureTokenStorage
 * Run this to verify encryption/decryption works
 */

import { secureTokenStorage } from "./secureStorage.js";
import { logger } from "./logger";

// Test data
const testData = {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature",
  refreshToken: "refresh_token_here",
  expiresAt: Date.now() + 3600000, // 1 hour from now
  userId: "test-user-123",
};

logger.info("Testing SecureTokenStorage...");

// Test 1: Store and retrieve token
logger.info("Test 1: Store and retrieve token");
secureTokenStorage.setToken(testData);
const retrieved = secureTokenStorage.getToken();

if (retrieved) {
  logger.info("✅ Token retrieved successfully");
  logger.info("Token matches:", retrieved.token === testData.token);
  logger.info("Refresh token matches:", retrieved.refreshToken === testData.refreshToken);
  logger.info("User ID matches:", retrieved.userId === testData.userId);
  logger.info("Expires at matches:", retrieved.expiresAt === testData.expiresAt);
} else {
  logger.info("❌ Failed to retrieve token");
}

// Test 2: Check hasValidToken
logger.info("\nTest 2: Check hasValidToken");
const hasValid = secureTokenStorage.hasValidToken();
logger.info("Has valid token:", hasValid);

// Test 3: Get access token
logger.info("\nTest 3: Get access token");
const accessToken = secureTokenStorage.getAccessToken();
logger.info("Access token:", accessToken);

// Test 4: Update token
logger.info("\nTest 4: Update token");
const newToken = "new_token_here";
const newExpiresAt = Date.now() + 7200000; // 2 hours
secureTokenStorage.updateToken(newToken, newExpiresAt);
const updated = secureTokenStorage.getToken();
if (updated) {
  logger.info("Token updated successfully");
  logger.info("New token matches:", updated.token === newToken);
  logger.info("New expires at matches:", updated.expiresAt === newExpiresAt);
}

// Test 5: Clear token
logger.info("\nTest 5: Clear token");
secureTokenStorage.clearToken();
const afterClear = secureTokenStorage.getToken();
logger.info("Token after clear:", afterClear);

logger.info("\nAll tests completed!");
