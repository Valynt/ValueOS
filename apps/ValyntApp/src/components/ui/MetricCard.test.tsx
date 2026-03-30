import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(
      <MetricCard label="Revenue" value="$1.2M" data-testid="metric-card" />
    );
    
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1.2M')).toBeInTheDocument();
  });

  it('applies highlight variant styling', () => {
    render(
      <MetricCard label="Test" value="100" variant="highlight" data-testid="metric-card" />
    );
    
    const card = screen.getByTestId('metric-card');
    expect(card).toHaveClass('bg-md-tertiary-container/10');
    expect(card).toHaveClass('border-md-on-tertiary-container/20');
  });

  it('renders trend when provided', () => {
    render(
      <MetricCard 
        label="Growth" 
        value="+22%" 
        trend={{ value: 22, label: 'vs last month' }}
        data-testid="metric-card"
      />
    );
    
    expect(screen.getByText('+22%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('shows positive trend indicator', () => {
    render(
      <MetricCard 
        label="Sales" 
        value="100" 
        trend={{ value: 15, label: 'increase' }}
        data-testid="metric-card"
      />
    );
    
    expect(screen.getByText('trending_up')).toBeInTheDocument();
  });

  it('shows negative trend indicator', () => {
    render(
      <MetricCard 
        label="Churn" 
        value="5%" 
        trend={{ value: -10, label: 'increase' }}
        data-testid="metric-card"
      />
    );
    
    expect(screen.getByText('trending_down')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <MetricCard 
        label="Metric" 
        value="100" 
        description="This is a description"
        data-testid="metric-card"
      />
    );
    
    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <MetricCard label="Test" value="100" className="custom-class" data-testid="metric-card" />
    );
    
    expect(screen.getByTestId('metric-card')).toHaveClass('custom-class');
  });

  it('renders large value text', () => {
    render(
      <MetricCard label="Revenue" value="$1.2M" data-testid="metric-card" />
    );
    
    const value = screen.getByText('$1.2M');
    expect(value).toHaveClass('text-2xl');
    expect(value).toHaveClass('font-bold');
  });
});
