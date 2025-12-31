import React from 'react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import { renderWithProviders, screen } from '../../test/test-utils';
import { NetworkStatus, NetworkStatusBadge } from './NetworkStatus';

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe('NetworkStatus', () => {
  const setOnlineState = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: online,
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    setOnlineState(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    setOnlineState(true);
  });

  it('shows offline banner and allows retry', async () => {
    const onRetry = vi.fn();

    renderWithProviders(<NetworkStatus onRetry={onRetry} />);

    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent(/no internet connection/i);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('auto hides and retries when connection returns', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<NetworkStatus onRetry={onRetry} />);

    act(() => {
      setOnlineState(true);
      window.dispatchEvent(new Event('online'));
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('NetworkStatusBadge', () => {
  const setOnlineState = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: online,
    });
  };

  it('reflects current connection state', () => {
    setOnlineState(true);
    const { rerender } = renderWithProviders(<NetworkStatusBadge />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/online/i);

    setOnlineState(false);
    rerender(<NetworkStatusBadge />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/offline/i);
  });
});
