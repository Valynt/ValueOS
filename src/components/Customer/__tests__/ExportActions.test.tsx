/**
 * Export Actions Component Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportActions } from '../ExportActions';

// Mock fetch
global.fetch = vi.fn();

describe('ExportActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render export buttons', () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
    expect(screen.getByText('Share via Email')).toBeInTheDocument();
  });

  it('should handle PDF export', async () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const pdfButton = screen.getByText('Export as PDF');
    fireEvent.click(pdfButton);

    expect(screen.getByText('Exporting...')).toBeInTheDocument();

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Exported!')).toBeInTheDocument();
    });
  });

  it('should handle Excel export', async () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const excelButton = screen.getByText('Export as Excel');
    fireEvent.click(excelButton);

    expect(screen.getByText('Exporting...')).toBeInTheDocument();

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Exported!')).toBeInTheDocument();
    });
  });

  it('should open email share modal', () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    expect(screen.getByText('Share Report via Email')).toBeInTheDocument();
  });

  it('should validate email addresses', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'invalid-email');

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Should not add invalid email
    expect(screen.queryByText('invalid-email')).not.toBeInTheDocument();
  });

  it('should add valid email addresses', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'test@example.com');

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should remove email addresses', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'test@example.com');

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    const removeButton = screen.getByLabelText('Remove test@example.com');
    fireEvent.click(removeButton);

    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  it('should send email with message', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'test@example.com');

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    const messageInput = screen.getByPlaceholderText('Add a personal message (optional)');
    await user.type(messageInput, 'Please review this report');

    const sendButton = screen.getByText('Send Report');
    fireEvent.click(sendButton);

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText(/Report sent successfully/)).toBeInTheDocument();
    });
  });

  it('should close modal after sending', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'test@example.com');

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    const sendButton = screen.getByText('Send Report');
    fireEvent.click(sendButton);

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByText('Share Report via Email')).not.toBeInTheDocument();
    });
  });

  it('should disable send button when no recipients', () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const shareButton = screen.getByText('Share via Email');
    fireEvent.click(shareButton);

    const sendButton = screen.getByText('Send Report');
    expect(sendButton).toBeDisabled();
  });

  it('should show loading state during export', async () => {
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" />);

    const pdfButton = screen.getByText('Export as PDF');
    fireEvent.click(pdfButton);

    expect(screen.getByText('Exporting...')).toBeInTheDocument();

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Exported!')).toBeInTheDocument();
    });
  });

  it('should call onExport callback', async () => {
    const onExport = vi.fn();
    render(<ExportActions valueCaseId="vc-123" companyName="Acme Corp" onExport={onExport} />);

    const pdfButton = screen.getByText('Export as PDF');
    fireEvent.click(pdfButton);

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith('pdf');
    });
  });
});
