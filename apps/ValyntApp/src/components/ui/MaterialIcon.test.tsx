import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaterialIcon } from './MaterialIcon';

describe('MaterialIcon', () => {
  it('renders with icon name', () => {
    render(<MaterialIcon icon="home" data-testid="icon" />);
    
    const icon = screen.getByTestId('icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('home');
  });

  it('applies size classes', () => {
    const { rerender } = render(<MaterialIcon icon="home" size="sm" data-testid="icon" />);
    
    expect(screen.getByTestId('icon')).toHaveClass('text-lg');
    
    rerender(<MaterialIcon icon="home" size="lg" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('text-2xl');
    
    rerender(<MaterialIcon icon="home" size="xl" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('text-3xl');
  });

  it('applies filled style when filled prop is true', () => {
    render(<MaterialIcon icon="home" filled data-testid="icon" />);
    
    expect(screen.getByTestId('icon')).toHaveClass('material-icons');
  });

  it('applies outlined style when filled is false', () => {
    render(<MaterialIcon icon="home" filled={false} data-testid="icon" />);
    
    expect(screen.getByTestId('icon')).toHaveClass('material-icons-outlined');
  });

  it('merges custom className', () => {
    render(<MaterialIcon icon="home" className="custom-class" data-testid="icon" />);
    
    expect(screen.getByTestId('icon')).toHaveClass('custom-class');
    expect(screen.getByTestId('icon')).toHaveClass('material-icons');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null as HTMLElement | null };
    render(<MaterialIcon icon="home" ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('has correct font family', () => {
    render(<MaterialIcon icon="settings" data-testid="icon" />);
    
    expect(screen.getByTestId('icon')).toHaveStyle({ fontFamily: "'Material Symbols Outlined', 'Material Icons', sans-serif" });
  });
});
