import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CRMImportModal } from '../CRMImportModal';

vi.mock('../../../services/CRMOAuthService', () => ({
  crmOAuthService: {
    getStatus: vi.fn().mockResolvedValue({
      hubspot: { connected: false, status: 'not_connected' },
      salesforce: { connected: false, status: 'not_connected' },
    }),
  },
}));

vi.mock('../../../mcp-crm', () => ({
  getMCPCRMServer: vi.fn(),
}));

describe('CRMImportModal integration-ish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows not-connected error when attempting to fetch a HubSpot deal without connection', async () => {
    const onComplete = vi.fn();
    render(
      <CRMImportModal
        isOpen={true}
        onClose={() => {}}
        onComplete={onComplete}
        tenantId="tenant-1"
        userId="user-1"
      />,
    );

    const input = await screen.findByPlaceholderText(/Paste Salesforce or HubSpot URL/i);
    fireEvent.change(input, {
      target: { value: 'https://app.hubspot.com/contacts/123/deal/456' },
    });

    await waitFor(() => expect(screen.getByText(/HubSpot deal detected/i)).toBeInTheDocument());

    const fetchButton = screen.getByRole('button', { name: /Fetch Deal/i });
    fireEvent.click(fetchButton);

    await waitFor(() =>
      expect(screen.getByText(/HubSpot is not connected/i)).toBeInTheDocument(),
    );
    expect(onComplete).not.toHaveBeenCalled();
  });
});
