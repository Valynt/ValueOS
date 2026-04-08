import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WarmthAnnouncer, announceWarmthChange, useWarmthAnnouncement } from './WarmthAnnouncer';
import type { WarmthState } from '@shared/domain/Warmth';

describe('WarmthAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders visually hidden status region', () => {
    render(<WarmthAnnouncer />);

    const announcer = screen.getByTestId('warmth-announcer');
    expect(announcer).toHaveClass('sr-only');
    expect(announcer).toHaveAttribute('role', 'status');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces when warmth changes', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange('forming', 'firm', 'Test Case');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('Test Case is now firm');
  });

  it('clears announcement after timeout', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange('forming', 'firm', 'Test Case');
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('');
  });

  it('supports custom prefix', () => {
    render(<WarmthAnnouncer prefix="Workspace" />);

    act(() => {
      announceWarmthChange('forming', 'verified', 'Test Case');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent(
      'Workspace: Test Case is verified and ready'
    );
  });

  it('handles multiple rapid announcements', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange('forming', 'firm', 'Case A');
    });

    // First announcement shown
    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('Case A is now firm');

    // Clear first announcement
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Now trigger second announcement
    act(() => {
      announceWarmthChange('firm', 'verified', 'Case B');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('Case B is verified and ready');
  });
});

describe('announceWarmthChange', () => {
  it('announces correct message for forming state', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange(null, 'forming', 'New Case');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('New Case is forming');
  });

  it('announces correct message for firm state', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange('forming', 'firm', 'My Case');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('My Case is now firm');
  });

  it('announces correct message for verified state', () => {
    render(<WarmthAnnouncer />);

    act(() => {
      announceWarmthChange('firm', 'verified', 'Important Case');
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent(
      'Important Case is verified and ready'
    );
  });
});

describe('useWarmthAnnouncement', () => {
  it('returns callback function', () => {
    const TestComponent = () => {
      const announce = useWarmthAnnouncement('Test Context');
      return <button onClick={() => announce('forming', 'firm')}>Announce</button>;
    };

    render(
      <>
        <WarmthAnnouncer />
        <TestComponent />
      </>
    );

    const button = screen.getByRole('button');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('warmth-announcer')).toHaveTextContent('Test Context is now firm');
  });
});
