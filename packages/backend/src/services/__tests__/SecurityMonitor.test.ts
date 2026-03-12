import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getSecurityMonitor, SecurityMonitor } from '../security/SecurityMonitor.js';
import { emailService } from '../EmailService.js';

// Mock the email service
vi.mock('../EmailService.js', () => {
  return {
    emailService: {
      send: vi.fn().mockResolvedValue(undefined),
    },
    EmailService: class {},
  };
});

// Mock logger to avoid noise
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock AuditLogger and SharedContext
vi.mock('../AgentAuditLogger.js', () => ({
  getAuditLogger: () => ({
    query: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../SecureSharedContext.js', () => ({
  getSecureSharedContext: () => ({}),
}));

vi.mock('../../lib/agent-fabric/SecureMessageBus', () => ({
  secureMessageBus: {},
}));

describe('SecurityMonitor Email Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton instance using type casting to access private property
    // @ts-ignore
    SecurityMonitor.instance = undefined;
  });

  it('should send email alert when high sensitivity data access occurs', async () => {
    const monitor = getSecurityMonitor({
        notificationEmails: ['test@example.com'],
        alertThresholds: {
            deniedContextShares: 100,
            invalidSignatures: 100,
            replayAttacks: 100,
            compromisedAgents: 100,
        },
        escalationRules: {
            // Ensure this event type triggers email_alert
            high_sensitivity_data_access: ['email_alert'],
        }
    });

    monitor.recordEvent(
        "high_sensitivity_data_access",
        "high",
        "test-source",
        "Test Description",
        {}
    );

    // Give a small delay for the floating promise in sendAlert to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('HIGH'),
        text: expect.stringContaining('Test Description')
    }));
  });

  it('should send multiple emails if multiple recipients configured', async () => {
    const monitor = getSecurityMonitor({
        notificationEmails: ['admin1@example.com', 'admin2@example.com'],
        escalationRules: {
            high_sensitivity_data_access: ['email_alert'],
        }
    });

    monitor.recordEvent(
        "high_sensitivity_data_access",
        "high",
        "test-source",
        "Test Description",
        {}
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(emailService.send).toHaveBeenCalledTimes(2);
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin1@example.com'
    }));
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin2@example.com'
    }));
  });
});
