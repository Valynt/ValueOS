/**
 * Simple verification that validation errors are properly thrown
 * This simulates the key parts of the auth service to test the fix
 */

// Simulate the validateCredentials method from authServiceAbstraction
function validateCredentials(credentials) {
  if (!credentials.email || !credentials.password) {
    throw new Error("Email and password are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(credentials.email)) {
    throw new Error("Invalid email format");
  }

  if (credentials.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

// Simulate the login method error handling (after our fix)
async function simulateLogin(credentials) {
  try {
    // Validate input
    validateCredentials(credentials);

    // If validation passes, continue with login logic...
    return { success: true, user: { id: "1", email: credentials.email } };
  } catch (error) {
    // Re-throw validation errors so tests can catch them
    if (
      error instanceof Error &&
      (error.message.includes("Email and password are required") ||
        error.message.includes("Invalid email format") ||
        error.message.includes("Password must be at least 8 characters"))
    ) {
      throw error;
    }

    // Handle other errors (network, API) by returning result object
    console.error("Login error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during login",
    };
  }
}

// Test the validation error handling
async function testValidationErrors() {
  console.log("Testing validation error handling...\n");

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
    {
      name: "Valid credentials (should succeed)",
      credentials: { email: "test@example.com", password: "password123" },
      expectedError: null,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await simulateLogin(testCase.credentials);

      if (testCase.expectedError) {
        console.log(`❌ ${testCase.name}: Expected error but got success`);
        failed++;
      } else {
        console.log(`✅ ${testCase.name}: Successfully logged in`);
        passed++;
      }
    } catch (error) {
      if (testCase.expectedError && error.message.includes(testCase.expectedError)) {
        console.log(`✅ ${testCase.name}: Correctly threw error: ${error.message}`);
        passed++;
      } else if (testCase.expectedError) {
        console.log(
          `❌ ${testCase.name}: Expected "${testCase.expectedError}" but got "${error.message}"`
        );
        failed++;
      } else {
        console.log(`❌ ${testCase.name}: Expected success but got error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("🎉 All validation error handling tests passed!");
  }
}

testValidationErrors().catch(console.error);
