import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockResend = vi.fn();
  const mockSupabase = {
    auth: {
      resend: mockResend,
      admin: {
          getUserByEmail: vi.fn(),
      },
      getSession: vi.fn(),
      getUser: vi.fn(),
    }
  };

  return {
    mockResend,
    mockSupabase
  };
});

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => mocks.mockSupabase,
  getSupabaseClient: () => mocks.mockSupabase,
  supabase: mocks.mockSupabase
}));

// Mock config with a specific URL
vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    app: { url: 'https://trusted-site.com' }
  })
}));

// Mock secureRouter to return a plain router
vi.mock('../../middleware/secureRouter', () => ({
    createSecureRouter: () => express.Router()
}));

// Mock input validation to pass everything
vi.mock('../../middleware/inputValidation', () => ({
    validateRequest: () => (req, res, next) => next(),
    ValidationSchemas: {
        login: {},
        signup: {},
    }
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    })
}));

// Mock authService
vi.mock('../../services/AuthService', () => ({
    authService: {
        // Mock other methods if needed
    }
}));

// Mock AuditLogService
vi.mock('../../services/AuditLogService', () => ({
    auditLogService: {
        logAudit: vi.fn()
    }
}));

// Import the router AFTER mocks
import authRouter from '../auth';

describe('POST /verify/resend Host Header Injection', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('demonstrates host header injection vulnerability', async () => {
    mocks.mockResend.mockResolvedValue({ error: null });

    // We simulate an attack where the Host header is spoofed
    await request(app)
      .post('/api/auth/verify/resend')
      .set('Host', 'evil.com')
      .send({ email: 'test@example.com' });

    // The vulnerability: emailRedirectTo uses the Host header
    // Ideally this should fail once we fix it
    expect(mocks.mockResend).toHaveBeenCalledWith(expect.objectContaining({
        options: {
            // After fix, it should use the configured app url
            emailRedirectTo: 'https://trusted-site.com/auth/callback'
        }
    }));
  });
});
