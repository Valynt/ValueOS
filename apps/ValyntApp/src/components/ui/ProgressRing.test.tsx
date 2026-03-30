import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from './ProgressRing';

describe('ProgressRing', () => {
  it('renders with default value', () => {
    render(<ProgressRing value={50} data-testid="progress" />);
    
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('displays value when showValue is true', () => {
    render(<ProgressRing value={75} showValue data-testid="progress" />);
    
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('hides value when showValue is false', () => {
    render(<ProgressRing value={75} showValue={false} data-testid="progress" />);
    
    expect(screen.queryByText('75')).not.toBeInTheDocument();
  });

  it('shows label when provided', () => {
    render(<ProgressRing value={60} showValue label="Progress" data-testid="progress" />);
    
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('applies correct size', () => {
    const { rerender } = render(<ProgressRing value={50} size={64} data-testid="progress" />);
    
    const ring = screen.getByTestId('progress');
    expect(ring).toHaveStyle({ width: '64px', height: '64px' });
    
    rerender(<ProgressRing value={50} size={120} data-testid="progress" />);
    expect(ring).toHaveStyle({ width: '120px', height: '120px' });
  });

  it('clamps value between 0 and 100', () => {
    render(<ProgressRing value={150} showValue data-testid="progress" />);
    
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('handles negative values', () => {
    render(<ProgressRing value={-20} showValue data-testid="progress" />);
    
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<ProgressRing value={50} data-testid="progress" />);
    
    const svg = screen.getByTestId('progress').querySelector('circle:last-child');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it('applies custom stroke width', () => {
    render(<ProgressRing value={50} strokeWidth={6} data-testid="progress" />);
    
    const svg = screen.getByTestId('progress').querySelector('circle');
    expect(svg).toHaveAttribute('stroke-width', '6');
  });
});
