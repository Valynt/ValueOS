import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ModeTransition, ModeSkeleton } from './ModeTransition';
import type { WorkspaceMode } from '@shared/domain/Warmth';

describe('ModeTransition', () => {
  it('renders children without animation on initial mount', () => {
    render(
      <ModeTransition currentMode="canvas">
        <div data-testid="content">Canvas Content</div>
      </ModeTransition>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('applies transition styles', () => {
    const { container } = render(
      <ModeTransition currentMode="canvas">
        <div>Content</div>
      </ModeTransition>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({
      transitionProperty: 'opacity, transform',
      transitionDuration: '150ms',
    });
  });

  it('preserves scroll position for narrative mode', async () => {
    const { rerender, container } = render(
      <ModeTransition currentMode="narrative">
        <div style={{ height: '2000px' }}>Long content</div>
      </ModeTransition>
    );

    const wrapper = container.firstChild as HTMLElement;
    wrapper.scrollTop = 500;

    // Switch to canvas then back
    rerender(
      <ModeTransition currentMode="canvas">
        <div>Canvas</div>
      </ModeTransition>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    rerender(
      <ModeTransition currentMode="narrative">
        <div style={{ height: '2000px' }}>Long content</div>
      </ModeTransition>
    );

    // Scroll position should be restored
    expect(wrapper.scrollTop).toBe(500);
  });

  it('shows transitioning state during mode change', async () => {
    const { rerender, container } = render(
      <ModeTransition currentMode="canvas">
        <div>Canvas</div>
      </ModeTransition>
    );

    rerender(
      <ModeTransition currentMode="narrative">
        <div>Narrative</div>
      </ModeTransition>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('data-transitioning', 'true');
  });
});

describe('ModeSkeleton', () => {
  it('renders canvas skeleton', () => {
    render(<ModeSkeleton mode="canvas" />);

    expect(screen.getByTestId('mini-canvas')).toBeInTheDocument();
  });

  it('renders narrative skeleton', () => {
    const { container } = render(<ModeSkeleton mode="narrative" />);

    // Check for skeleton elements
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders copilot skeleton', () => {
    render(<ModeSkeleton mode="copilot" />);

    expect(screen.getByTestId('mini-canvas')).toBeInTheDocument();
  });

  it('renders evidence skeleton', () => {
    const { container } = render(<ModeSkeleton mode="evidence" />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
