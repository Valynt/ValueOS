import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrismCard } from './PrismCard';

describe('PrismCard', () => {
  it('renders children correctly', () => {
    render(
      <PrismCard>
        <div data-testid="prism-content">Test Content</div>
      </PrismCard>
    );
    
    expect(screen.getByTestId('prism-content')).toBeInTheDocument();
  });

  it('applies base styling classes', () => {
    render(
      <PrismCard data-testid="prism-card">Content</PrismCard>
    );
    
    const card = screen.getByTestId('prism-card');
    expect(card).toHaveClass('relative');
    expect(card).toHaveClass('rounded-xl');
  });

  it('applies active state styling when active', () => {
    render(
      <PrismCard active data-testid="prism-card">Content</PrismCard>
    );
    
    const card = screen.getByTestId('prism-card');
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('shadow-lg');
  });

  it('applies subdued styling when not active', () => {
    render(
      <PrismCard data-testid="prism-card">Content</PrismCard>
    );
    
    const card = screen.getByTestId('prism-card');
    expect(card).toHaveClass('bg-white/60');
  });

  it('merges custom className', () => {
    render(
      <PrismCard className="custom-class" data-testid="prism-card">
        Content
      </PrismCard>
    );
    
    expect(screen.getByTestId('prism-card')).toHaveClass('custom-class');
  });

  it('renders with proper padding', () => {
    render(
      <PrismCard data-testid="prism-card">Content</PrismCard>
    );
    
    expect(screen.getByTestId('prism-card')).toHaveClass('p-6');
  });

  it('applies transition for hover effects', () => {
    render(
      <PrismCard data-testid="prism-card">Content</PrismCard>
    );
    
    expect(screen.getByTestId('prism-card')).toHaveClass('transition-all');
  });
});
