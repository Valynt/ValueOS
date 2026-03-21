/**
 * Customer Access Service Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'
import { CustomerAccessService } from '../CustomerAccessService.js'
import { emailService } from '../tenant/EmailService.js'

// Mock dependencies
vi.mock('../tenant/EmailService', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  }
}));

describe('CustomerAccessService', () => {
  let service: CustomerAccessService;

  beforeEach(() => {
    service = new CustomerAccessService();
    vi.clearAllMocks();
  });

  describe('generateCustomerToken', () => {
    it('should generate a new customer token', async () => {
      const mockToken = 'test-token-123';
      const mockExpiresAt = '2026-04-06T00:00:00Z';
      const valueCaseId = 'value-case-123';

      (supabase.rpc as any).mockResolvedValue({
        data: [{
          token: mockToken,
          expires_at: mockExpiresAt
        }],
        error: null
      });

      const result = await service.generateCustomerToken(valueCaseId);

      expect(result).toEqual({
        token: mockToken,
        expires_at: mockExpiresAt,
        portal_url: expect.stringContaining('#token=')
      });

      expect(result.portal_url).not.toContain('?token=');
      expect(result.portal_url).toContain(`#token=${encodeURIComponent(mockToken)}`);

      expect(supabase.rpc).toHaveBeenCalledWith('create_customer_access_token', {
        p_value_case_id: valueCaseId,
        p_expires_in_days: 90
      });
    });

    it('should handle custom expiration days', async () => {
      const valueCaseId = 'value-case-123';
      const expiresInDays = 30;

      (supabase.rpc as any).mockResolvedValue({
        data: [{
          token: 'token',
          expires_at: '2026-02-05T00:00:00Z'
        }],
        error: null
      });

      await service.generateCustomerToken(valueCaseId, expiresInDays);

      expect(supabase.rpc).toHaveBeenCalledWith('create_customer_access_token', {
        p_value_case_id: valueCaseId,
        p_expires_in_days: expiresInDays
      });
    });

    it('should throw error on database failure', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        service.generateCustomerToken('value-case-123')
      ).rejects.toThrow('Failed to generate token');
    });
  });

  describe('validateCustomerToken', () => {
    it('should validate a valid token', async () => {
      const token = 'valid-token';
      const valueCaseId = 'value-case-123';
      const organizationId = 'org-123';

      (supabase.rpc as any).mockResolvedValue({
        data: [{
          value_case_id: valueCaseId,
          organization_id: organizationId,
          is_valid: true,
          error_message: null
        }],
        error: null
      });

      const result = await service.validateCustomerToken(token);

      expect(result).toEqual({
        value_case_id: valueCaseId,
        organization_id: organizationId,
        is_valid: true,
        error_message: null
      });

      expect(supabase.rpc).toHaveBeenCalledWith('validate_customer_token', {
        p_token: token
      });
    });

    it('should return invalid for expired token', async () => {
      const token = 'expired-token';

      (supabase.rpc as any).mockResolvedValue({
        data: [{
          value_case_id: null,
          organization_id: null,
          is_valid: false,
          error_message: 'Token has expired'
        }],
        error: null
      });

      const result = await service.validateCustomerToken(token);

      expect(result.is_valid).toBe(false);
      expect(result.error_message).toBe('Token has expired');
    });

    it('should return invalid for revoked token', async () => {
      const token = 'revoked-token';

      (supabase.rpc as any).mockResolvedValue({
        data: [{
          value_case_id: null,
          organization_id: null,
          is_valid: false,
          error_message: 'Token has been revoked'
        }],
        error: null
      });

      const result = await service.validateCustomerToken(token);

      expect(result.is_valid).toBe(false);
      expect(result.error_message).toBe('Token has been revoked');
    });

    it('should handle database errors gracefully', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await service.validateCustomerToken('token');

      expect(result.is_valid).toBe(false);
      expect(result.error_message).toBeTruthy();
    });
  });

  describe('revokeCustomerToken', () => {
    it('should revoke a token successfully', async () => {
      const token = 'token-to-revoke';
      const revokedBy = 'user-123';
      const reason = 'Customer requested';

      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await service.revokeCustomerToken(token, revokedBy, reason);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('revoke_customer_token', {
        p_token: token,
        p_revoked_by: revokedBy,
        p_reason: reason
      });
    });

    it('should return false for non-existent token', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await service.revokeCustomerToken('invalid-token', 'user-123');

      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        service.revokeCustomerToken('token', 'user-123')
      ).rejects.toThrow('Failed to revoke token');
    });
  });

  describe('getTokensForValueCase', () => {
    it('should fetch all tokens for a value case', async () => {
      const valueCaseId = 'value-case-123';
      const mockTokens = [
        { id: '1', token: 'token1', value_case_id: valueCaseId },
        { id: '2', token: 'token2', value_case_id: valueCaseId }
      ];

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockTokens,
          error: null
        })
      };

      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await service.getTokensForValueCase(valueCaseId);

      expect(result).toEqual(mockTokens);
      expect(supabase.from).toHaveBeenCalledWith('customer_access_tokens');
    });
  });

  describe('getActiveTokensForValueCase', () => {
    it('should fetch only active tokens', async () => {
      const valueCaseId = 'value-case-123';
      const mockTokens = [
        { id: '1', token: 'active-token', revoked_at: null }
      ];

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockTokens,
          error: null
        })
      };

      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await service.getActiveTokensForValueCase(valueCaseId);

      expect(result).toEqual(mockTokens);
    });
  });

  describe('regenerateToken', () => {
    it('should revoke old token and generate new one', async () => {
      const oldToken = 'old-token';
      const valueCaseId = 'value-case-123';
      const revokedBy = 'user-123';
      const newToken = 'new-token';

      // Mock revoke
      (supabase.rpc as any).mockResolvedValueOnce({
        data: true,
        error: null
      });

      // Mock generate
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{
          token: newToken,
          expires_at: '2026-04-06T00:00:00Z'
        }],
        error: null
      });

      const result = await service.regenerateToken(
        oldToken,
        revokedBy,
        valueCaseId
      );

      expect(result.token).toBe(newToken);
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendPortalAccessEmail', () => {
    it('should send an email using emailService', async () => {
      const email = 'customer@example.com';
      const companyName = 'Acme Corp';
      const portalUrl = 'https://app.valuecanvas.com/customer/portal#token=123';

      await service.sendPortalAccessEmail(email, companyName, portalUrl);

      expect(emailService.send).toHaveBeenCalledWith({
        to: email,
        subject: `Your ${companyName} Value Realization Portal`,
        template: 'customer-portal-access',
        data: { companyName, portalUrl }
      });


      const infoPayloads = vi.mocked(logger.info).mock.calls.map(([, meta]) => JSON.stringify(meta));
      expect(infoPayloads.join(' ')).not.toContain(portalUrl);
      expect(infoPayloads.join(' ')).not.toContain(email);
      expect(infoPayloads.join(' ')).toContain('recipient:');
    });

    it('should log an error if email sending fails', async () => {
      const email = 'customer@example.com';
      const companyName = 'Acme Corp';
      const portalUrl = 'https://app.valuecanvas.com/customer/portal#token=123';
      const error = new Error('Email failed');

      // Mock emailService.send to throw an error
      vi.mocked(emailService.send).mockRejectedValueOnce(error);

      await expect(service.sendPortalAccessEmail(email, companyName, portalUrl)).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('Error sending portal access email', error);
    });
  });
});
