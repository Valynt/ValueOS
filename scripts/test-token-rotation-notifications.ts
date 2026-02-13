#!/usr/bin/env tsx

/**
 * Test script for TokenRotationService notifications
 * Run with: tsx scripts/test-token-rotation-notifications.ts
 */

import { getTokenRotationService } from '../packages/backend/src/services/TokenRotationService.js';

async function testNotifications() {
  const tokenRotationService = getTokenRotationService();

  console.log('🧪 Testing TokenRotationService notifications...\n');

  // Test security event
  const testEvent = {
    type: 'password_change' as const,
    userId: 'test-user-id', // Replace with actual user ID that exists in your system
    tenantId: 'test-tenant-id',
    sessionId: 'test-session-id',
    severity: 'medium' as const,
    timestamp: Date.now(),
    metadata: {
      ipAddress: '192.168.1.1',
      userAgent: 'Test Browser',
    },
  };

  console.log('📧 Sending test security event...');
  console.log('Event:', JSON.stringify(testEvent, null, 2));

  try {
    const result = await tokenRotationService.handleSecurityEvent(testEvent);
    console.log('\n✅ Security event handled successfully!');
    console.log('Result:', result);

    if (result.success) {
      console.log('📊 Sessions revoked:', result.sessionsRevoked);
      console.log('🔄 Tokens invalidated:', result.tokensInvalidated);
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testNotifications().catch(console.error);