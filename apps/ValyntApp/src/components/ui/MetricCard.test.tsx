import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Revenue" value="$1.2M" data-testid="metric-card" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1.2M')).toBeInTheDocument();
  });

  it('applies highlight variant class', () => {
    render(
      <MetricCard label="Test" value="100" variant="highlight" data-testid="metric-card" />
    );
    // highlight variant uses bg-md-primary-container per variantClasses
    expect(screen.getByTestId('metric-card')).toHaveClass('bg-md-primary-container');
  });

  it('applies default variant class', () => {
    render(
      <MetricCard label="Test" value="100" variant="default" data-testid="metric-card" />
    );
    expect(screen.getByTestId('metric-card')).toHaveClass('bg-md-surface-container-lowest');
  });

  it('renders trend label when provided', () => {
    render(
      <MetricCard
        label="Growth"
        value="22%"
        trend={{ value: 22, label: 'vs last month' }}
        data-testid="metric-card"
      />
    );
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders positive trend value with + prefix', () => {
    render(
      <MetricCard
        label="Sales"
        value="100"
        trend={{ value: 15, label: 'increase' }}
        data-testid="metric-card"
      />
    );
    expect(screen.getByText('+15%')).toBeInTheDocument();
  });

  it('renders negative trend value without + prefix', () => {
    render(
      <MetricCard
        label="Churn"
        value="5%"
        trend={{ value: -10, label: 'decrease' }}
        data-testid="metric-card"
      />
    );
    expect(screen.getByText('-10%')).toBeInTheDocument();
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

  it('forwards ref to the div element', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<MetricCard label="Test" value="100" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
