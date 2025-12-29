// Test script to trigger security logging
// Run with: node test-security-logs.js

console.log('=== Testing Security Logging ===\n');

// Test CSP header generation
console.log('1. Testing CSP Header Generation:');
try {
  const { securityHeadersMiddleware } = require('./src/middleware/securityHeaders.ts');
  // Simulate middleware call - this will trigger our console.log
  console.log('CSP middleware imported successfully');
} catch (error) {
  console.log('CSP test error:', error.message);
}

console.log('\n2. Testing Network Segmentation Domain Validation:');
try {
  const { networkSegmentation } = require('./src/services/NetworkSegmentation.ts');
  // This should trigger domain validation logging
  const result = networkSegmentation.validateRequest({
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    agentType: 'llm-agent',
    agentId: 'test-agent'
  });
  console.log('Network validation result:', result);
} catch (error) {
  console.log('Network segmentation test error:', error.message);
}

console.log('\n3. Testing Settings Service Deserialization:');
try {
  const { settingsService } = require('./src/services/SettingsService.ts');
  // This should trigger deserialization logging
  console.log('Settings service imported successfully');
} catch (error) {
  console.log('Settings service test error:', error.message);
}

console.log('\n=== Security Logging Test Complete ===');