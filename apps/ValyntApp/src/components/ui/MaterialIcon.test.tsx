import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaterialIcon } from './MaterialIcon';

describe('MaterialIcon', () => {
  it('renders the icon name as text content', () => {
    render(<MaterialIcon icon="home" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveTextContent('home');
  });

  it('always applies the material-symbols-outlined base class', () => {
    render(<MaterialIcon icon="home" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('material-symbols-outlined');
  });

  it('applies material-symbols-filled class when filled=true', () => {
    render(<MaterialIcon icon="home" filled data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('material-symbols-filled');
  });

  it('does not apply filled class when filled=false', () => {
    render(<MaterialIcon icon="home" filled={false} data-testid="icon" />);
    expect(screen.getByTestId('icon')).not.toHaveClass('material-symbols-filled');
  });

  it('sets font size from named size prop', () => {
    // size="lg" → 24px per sizeMap
    render(<MaterialIcon icon="home" size="lg" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveStyle({ fontSize: 24 });
  });

  it('sets font size from numeric size prop', () => {
    render(<MaterialIcon icon="home" size={48} data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveStyle({ fontSize: 48 });
  });

  it('merges custom className', () => {
    render(<MaterialIcon icon="home" className="custom-class" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('custom-class');
    expect(screen.getByTestId('icon')).toHaveClass('material-symbols-outlined');
  });

  it('is hidden from assistive technology', () => {
    render(<MaterialIcon icon="settings" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards ref to the span element', () => {
    const ref = { current: null as HTMLElement | null };
    render(<MaterialIcon icon="home" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('SPAN');
  });

  it('applies fontVariationSettings for weight and fill', () => {
    render(<MaterialIcon icon="home" weight={700} filled data-testid="icon" />);
    const style = screen.getByTestId('icon').style.fontVariationSettings;
    expect(style).toContain("'FILL' 1");
    expect(style).toContain("'wght' 700");
  });
});
