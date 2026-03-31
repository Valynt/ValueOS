import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassCard } from './GlassCard';

describe('GlassCard', () => {
  it('renders children correctly', () => {
    render(
      <GlassCard>
        <div data-testid="content">Test Content</div>
      </GlassCard>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('applies elevation shadow', () => {
    render(
      <GlassCard elevation={3} data-testid="card">Content</GlassCard>
    );

    expect(screen.getByTestId('card')).toHaveClass('shadow-lg');
  });

  it('merges custom className', () => {
    render(
      <GlassCard className="custom-class" data-testid="card">Content</GlassCard>
    );

    expect(screen.getByTestId('card')).toHaveClass('custom-class');
    expect(screen.getByTestId('card')).toHaveClass('rounded-xl');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <GlassCard onClick={handleClick} data-testid="card">
        Click me
      </GlassCard>
    );

    await user.click(screen.getByTestId('card'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables animation when animate=false', () => {
    render(
      <GlassCard animate={false} data-testid="card">Content</GlassCard>
    );

    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
  });
});
