import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadNotesModal } from '../UploadNotesModal';

const parseAndExtractMock = vi.fn();

vi.mock('../../../services/DocumentParserService', () => ({
  documentParserService: {
    parseAndExtract: (...args: unknown[]) => parseAndExtractMock(...args),
    extractInsights: vi.fn(),
  },
}));

describe('UploadNotesModal integration path', () => {
  beforeEach(() => {
    parseAndExtractMock.mockResolvedValue({
      document: { text: 'Hello world', metadata: { fileName: 'notes.txt', fileType: 'text/plain' } },
      insights: { summary: 'hello', painPoints: [], stakeholders: [], opportunities: [], nextSteps: [] },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('uploads a file and calls onComplete with parsed text', async () => {
    const onComplete = vi.fn();
    render(
      <UploadNotesModal
        isOpen={true}
        onClose={() => {}}
        onComplete={onComplete}
      />,
    );

    const chooseButton = await screen.findByText(/Choose File/i);
    const input = chooseButton.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    const analyzeButton = screen.getByRole('button', { name: /Analyze Notes/i });
    fireEvent.click(analyzeButton);

    await vi.runAllTimersAsync();
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    const payload = onComplete.mock.calls[0][0];
    expect(payload.rawText).toBe('Hello world');
    expect(parseAndExtractMock).toHaveBeenCalled();
  });
});
