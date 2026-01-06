/**
 * Value Summary Card Component Tests
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValueSummaryCard, ValueSummaryCardCompact } from '../ValueSummaryCard';

describe('ValueSummaryCard', () => {
  it('should display total value and target', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('$1.2M')).toBeInTheDocument();
    expect(screen.getByText(/vs \$1.0M target/)).toBeInTheDocument();
  });

  it('should calculate achievement percentage correctly', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('120% achieved')).toBeInTheDocument();
  });

  it('should display variance amount and percentage', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('+$200K')).toBeInTheDocument();
    expect(screen.getByText('+20.0%')).toBeInTheDocument();
  });

  it('should show negative variance correctly', () => {
    render(
      <ValueSummaryCard
        totalValue={800000}
        targetValue={1000000}
        trend="down"
      />
    );

    expect(screen.getByText('-$200K')).toBeInTheDocument();
    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });

  it('should display trend indicator for up trend', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('Trending up')).toBeInTheDocument();
  });

  it('should display trend indicator for down trend', () => {
    render(
      <ValueSummaryCard
        totalValue={800000}
        targetValue={1000000}
        trend="down"
      />
    );

    expect(screen.getByText('Trending down')).toBeInTheDocument();
  });

  it('should display trend indicator for flat trend', () => {
    render(
      <ValueSummaryCard
        totalValue={1000000}
        targetValue={1000000}
        trend="flat"
      />
    );

    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('should display custom period', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
        period="Q4 2025"
      />
    );

    expect(screen.getByText('Q4 2025')).toBeInTheDocument();
  });

  it('should format large numbers with B suffix', () => {
    render(
      <ValueSummaryCard
        totalValue={2500000000}
        targetValue={2000000000}
        trend="up"
      />
    );

    expect(screen.getByText('$2.50B')).toBeInTheDocument();
  });

  it('should format medium numbers with M suffix', () => {
    render(
      <ValueSummaryCard
        totalValue={2500000}
        targetValue={2000000}
        trend="up"
      />
    );

    expect(screen.getByText('$2.50M')).toBeInTheDocument();
  });

  it('should format small numbers with K suffix', () => {
    render(
      <ValueSummaryCard
        totalValue={2500}
        targetValue={2000}
        trend="up"
      />
    );

    expect(screen.getByText('$2K')).toBeInTheDocument();
  });

  it('should show exceptional performance message for 120%+', () => {
    render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText(/Exceptional performance/)).toBeInTheDocument();
  });

  it('should show great work message for 100-119%', () => {
    render(
      <ValueSummaryCard
        totalValue={1100000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText(/Great work/)).toBeInTheDocument();
  });

  it('should show warning message for 80-99%', () => {
    render(
      <ValueSummaryCard
        totalValue={900000}
        targetValue={1000000}
        trend="flat"
      />
    );

    expect(screen.getByText(/Good progress/)).toBeInTheDocument();
  });

  it('should show below target message for 60-79%', () => {
    render(
      <ValueSummaryCard
        totalValue={700000}
        targetValue={1000000}
        trend="down"
      />
    );

    expect(screen.getByText(/Below target/)).toBeInTheDocument();
  });

  it('should show critical message for <60%', () => {
    render(
      <ValueSummaryCard
        totalValue={500000}
        targetValue={1000000}
        trend="down"
      />
    );

    expect(screen.getByText(/Significantly below target/)).toBeInTheDocument();
  });

  it('should display loading state', () => {
    const { container } = render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
        loading={true}
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should handle zero target gracefully', () => {
    render(
      <ValueSummaryCard
        totalValue={1000000}
        targetValue={0}
        trend="up"
      />
    );

    expect(screen.getByText('0% achieved')).toBeInTheDocument();
  });

  it('should use green color for achievement >= 100%', () => {
    const { container } = render(
      <ValueSummaryCard
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    const badge = container.querySelector('.bg-green-50');
    expect(badge).toBeInTheDocument();
  });

  it('should use yellow color for achievement 80-99%', () => {
    const { container } = render(
      <ValueSummaryCard
        totalValue={900000}
        targetValue={1000000}
        trend="flat"
      />
    );

    const badge = container.querySelector('.bg-yellow-50');
    expect(badge).toBeInTheDocument();
  });

  it('should use red color for achievement < 80%', () => {
    const { container } = render(
      <ValueSummaryCard
        totalValue={700000}
        targetValue={1000000}
        trend="down"
      />
    );

    const badge = container.querySelector('.bg-red-50');
    expect(badge).toBeInTheDocument();
  });
});

describe('ValueSummaryCardCompact', () => {
  it('should render compact version', () => {
    render(
      <ValueSummaryCardCompact
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('$1.2M')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('should display trend indicator in compact mode', () => {
    render(
      <ValueSummaryCardCompact
        totalValue={1200000}
        targetValue={1000000}
        trend="up"
      />
    );

    expect(screen.getByText('Trending up')).toBeInTheDocument();
  });
});
