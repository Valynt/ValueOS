import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerService from '../CustomerService';
import SecurityEnforcementService from '../../SecurityEnforcementService';

vi.mock('../../SecurityEnforcementService');

const tenantId = 'test-tenant';
const orgName = 'Test Org';
const email = 'test@example.com';

describe('CustomerService (Security Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs privileged action on customer creation', async () => {
    // Arrange
    const logSpy = vi.spyOn(SecurityEnforcementService.prototype, 'logSecurityAction').mockResolvedValue();
    // Mock Stripe and Supabase as needed
    // ...
    // Act
    try {
      await CustomerService.createCustomer(tenantId, orgName, email);
    } catch {}
    // Assert
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('billing_customer_create'),
      expect.objectContaining({ tenantId })
    );
  });
});
