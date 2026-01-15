import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserNotifications } from '../UserNotifications';
import * as settingsRegistry from '../../../lib/settingsRegistry';

// Mock the settingsRegistry module
vi.mock('../../../lib/settingsRegistry', () => ({
  useSettingsGroup: vi.fn(),
}));

describe('UserNotifications', () => {
  const mockUserId = 'user-123';
  const mockUpdateSetting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (settingsRegistry.useSettingsGroup as any).mockReturnValue({
      values: {},
      loading: true,
      updateSetting: mockUpdateSetting,
    });

    render(<UserNotifications userId={mockUserId} />);

    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('renders notification settings when loaded', () => {
    (settingsRegistry.useSettingsGroup as any).mockReturnValue({
      values: {
        'user.notifications.email': true,
        'user.notifications.push': false,
      },
      loading: false,
      updateSetting: mockUpdateSetting,
    });

    render(<UserNotifications userId={mockUserId} />);

    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('Slack Notifications')).toBeInTheDocument();
  });

  it('calls updateSetting when toggling a notification', async () => {
    (settingsRegistry.useSettingsGroup as any).mockReturnValue({
      values: {
        'user.notifications.email': true,
      },
      loading: false,
      updateSetting: mockUpdateSetting,
    });

    render(<UserNotifications userId={mockUserId} />);

    const emailLabel = screen.getByText('Email Notifications');
    const container = emailLabel.closest('div.flex.items-center.justify-between');
    const toggleButton = container?.querySelector('button');

    expect(toggleButton).toBeDefined();
    if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(mockUpdateSetting).toHaveBeenCalledWith('user.notifications.email', false);
    }
  });

  it('uses memoized context correctly', () => {
    const useSettingsGroupMock = settingsRegistry.useSettingsGroup as any;
    useSettingsGroupMock.mockReturnValue({
      values: {},
      loading: false,
      updateSetting: mockUpdateSetting,
    });

    const { rerender } = render(<UserNotifications userId={mockUserId} />);

    expect(useSettingsGroupMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ userId: mockUserId }),
      expect.any(Object)
    );

    // Capture the context object passed in the first render
    const firstCallContext = useSettingsGroupMock.mock.calls[0][1];

    // Rerender with the same props
    rerender(<UserNotifications userId={mockUserId} />);

    // Capture the context object passed in the second render
    const secondCallContext = useSettingsGroupMock.mock.calls[1][1];

    // They should be the exact same object reference due to useMemo
    expect(firstCallContext).toBe(secondCallContext);
  });
});
