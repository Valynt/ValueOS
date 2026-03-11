import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantService } from '../tenantService';
import { api } from '../../api/client';
import { ValidationError } from '../../errors';

// Mock api
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock logger to avoid cluttering output
vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })
}));

describe('TenantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantService.clearCache();
  });

  describe('getCurrentTenant', () => {
    it('should return tenant when api call succeeds', async () => {
      const mockTenant = { id: 't1', name: 'Test Tenant' };
      (api.get as any).mockResolvedValue(mockTenant);

      const result = await tenantService.getCurrentTenant();
      expect(result).toEqual(mockTenant);
      expect(api.get).toHaveBeenCalledWith('/tenant');
    });

    it('should cache the tenant', async () => {
      const mockTenant = { id: 't1', name: 'Test Tenant' };
      (api.get as any).mockResolvedValue(mockTenant);

      await tenantService.getCurrentTenant();
      await tenantService.getCurrentTenant();

      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('should return null and log error when api call fails', async () => {
      (api.get as any).mockRejectedValue(new Error('API Error'));

      const result = await tenantService.getCurrentTenant();
      expect(result).toBeNull();
    });
  });

  describe('getMembers', () => {
    it('should return members when api call succeeds', async () => {
      const mockMembers = [{ id: 'm1' }];
      (api.get as any).mockResolvedValue(mockMembers);

      const result = await tenantService.getMembers();
      expect(result).toEqual(mockMembers);
      expect(api.get).toHaveBeenCalledWith('/tenant/members');
    });

    it('should cache members', async () => {
      const mockMembers = [{ id: 'm1' }];
      (api.get as any).mockResolvedValue(mockMembers);

      await tenantService.getMembers();
      await tenantService.getMembers();

      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error when api call fails', async () => {
      (api.get as any).mockRejectedValue(new Error('API Error'));

      await expect(tenantService.getMembers()).rejects.toThrow('API Error');
    });
  });

  describe('inviteMember', () => {
    it('should call api with valid data', async () => {
      const email = 'test@example.com';
      const role = 'admin';
      (api.post as any).mockResolvedValue({});

      await tenantService.inviteMember(email, role);

      expect(api.post).toHaveBeenCalledWith('/tenant/members/invite', { email, role });
    });

    it('should throw ValidationError for invalid email', async () => {
      const email = 'invalid-email';
      const role = 'admin';

      await expect(tenantService.inviteMember(email, role)).rejects.toThrow(ValidationError);
      expect(api.post).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid role', async () => {
      const email = 'test@example.com';
      const role = 'invalid-role';

      await expect(tenantService.inviteMember(email, role)).rejects.toThrow(ValidationError);
      expect(api.post).not.toHaveBeenCalled();
    });

    it('should invalidate members cache', async () => {
       const mockMembers = [{ id: 'm1' }];
      (api.get as any).mockResolvedValue(mockMembers);
      await tenantService.getMembers(); // Cache populated
      expect(api.get).toHaveBeenCalledTimes(1);

      (api.post as any).mockResolvedValue({});
      await tenantService.inviteMember('test@example.com', 'admin');

      await tenantService.getMembers(); // Should fetch again
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});
