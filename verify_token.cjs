const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDY3NDU2MDAsImV4cCI6MTg2NDUxMjAwMH0.VT02HKB4fPIbPPweJSRv0MZ4Vq3XqjGc0TnfwDJseKA";
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";

try {
  const decoded = jwt.verify(token, secret);
  console.log("Token is valid:", decoded);
} catch (err) {
  console.error("Token verification failed:", err.message);
  
  // Try to generate a correct one
  const payload = {
    role: 'service_role',
    iss: 'supabase',
    iat: 1706745600,
    exp: 1864512000
  };
  const newToken = jwt.sign(payload, secret);
  console.log("\nCorrect token should be:");
  console.log(newToken);
}
