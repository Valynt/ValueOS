/**
 * Test script for SecureTokenStorage
 * Run this to verify encryption/decryption works
 */

import { secureTokenStorage } from "./secureStorage.js";

// Test data
const testData = {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature",
  refreshToken: "refresh_token_here",
  expiresAt: Date.now() + 3600000, // 1 hour from now
  userId: "test-user-123",
};

console.log("Testing SecureTokenStorage...");

// Test 1: Store and retrieve token
console.log("Test 1: Store and retrieve token");
secureTokenStorage.setToken(testData);
const retrieved = secureTokenStorage.getToken();

if (retrieved) {
  console.log("✅ Token retrieved successfully");
  console.log("Token matches:", retrieved.token === testData.token);
  console.log("Refresh token matches:", retrieved.refreshToken === testData.refreshToken);
  console.log("User ID matches:", retrieved.userId === testData.userId);
  console.log("Expires at matches:", retrieved.expiresAt === testData.expiresAt);
} else {
  console.log("❌ Failed to retrieve token");
}

// Test 2: Check hasValidToken
console.log("\nTest 2: Check hasValidToken");
const hasValid = secureTokenStorage.hasValidToken();
console.log("Has valid token:", hasValid);

// Test 3: Get access token
console.log("\nTest 3: Get access token");
const accessToken = secureTokenStorage.getAccessToken();
console.log("Access token:", accessToken);

// Test 4: Update token
console.log("\nTest 4: Update token");
const newToken = "new_token_here";
const newExpiresAt = Date.now() + 7200000; // 2 hours
secureTokenStorage.updateToken(newToken, newExpiresAt);
const updated = secureTokenStorage.getToken();
if (updated) {
  console.log("Token updated successfully");
  console.log("New token matches:", updated.token === newToken);
  console.log("New expires at matches:", updated.expiresAt === newExpiresAt);
}

// Test 5: Clear token
console.log("\nTest 5: Clear token");
secureTokenStorage.clearToken();
const afterClear = secureTokenStorage.getToken();
console.log("Token after clear:", afterClear);

console.log("\nAll tests completed!");
