#!/usr/bin/env node

/**
 * Simple test script to verify auth validation error handling fix
 */

// Import the auth service
import { authService } from "./apps/ValyntApp/src/services/authServiceAbstraction.js";

async function testValidationErrors() {
  console.log("Testing validation error handling...\n");

  // Test cases that should throw validation errors
  const testCases = [
    {
      name: "Missing email and password",
      credentials: { email: "", password: "" },
      expectedError: "Email and password are required",
    },
    {
      name: "Invalid email format",
      credentials: { email: "invalid-email", password: "password123" },
      expectedError: "Invalid email format",
    },
    {
      name: "Password too short",
      credentials: { email: "test@example.com", password: "123" },
      expectedError: "Password must be at least 8 characters",
    },
  ];

  for (const testCase of testCases) {
    try {
      await authService.login(testCase.credentials);
      console.log(`❌ ${testCase.name}: Expected error but got success`);
    } catch (error) {
      if (error.message.includes(testCase.expectedError)) {
        console.log(`✅ ${testCase.name}: Correctly threw error: ${error.message}`);
      } else {
        console.log(
          `❌ ${testCase.name}: Expected "${testCase.expectedError}" but got "${error.message}"`
        );
      }
    }
  }

  console.log("\nValidation error handling test completed.");
}

testValidationErrors().catch(console.error);
