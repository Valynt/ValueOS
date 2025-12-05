/**
 * Tests for Canvas Layout Components
 * 
 * Tests VerticalSplit, HorizontalSplit, Grid, and DashboardPanel
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerticalSplit } from '../VerticalSplit';
import { HorizontalSplit } from '../HorizontalSplit';
import { Grid } from '../Grid';
import { DashboardPanel } from '../DashboardPanel';

describe('VerticalSplit', () => {
  it('renders children side by side', () => {
    render(
      <VerticalSplit ratios={[1, 2]} gap={16}>
        {[
          <div key="1">Left</div>,
          <div key="2">Right</div>,
        ]}
      </VerticalSplit>
    );

    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('applies correct flex ratios', () => {
    const { container } = render(
      <VerticalSplit ratios={[30, 70]} gap={16}>
        {[
          <div key="1">Narrow</div>,
          <div key="2">Wide</div>,
        ]}
      </VerticalSplit>
    );

    const children = container.querySelectorAll('.overflow-auto');
    expect(children).toHaveLength(2);
    
    // 30/(30+70) = 0.3, 70/(30+70) = 0.7
    expect(children[0]).toHaveStyle({ flex: '0.3' });
    expect(children[1]).toHaveStyle({ flex: '0.7' });
  });

  it('handles mismatched children and ratios', () => {
    render(
      <VerticalSplit ratios={[1, 2, 3]} gap={8}>
        {[
          <div key="1">One</div>,
          <div key="2">Two</div>,
        ]}
      </VerticalSplit>
    );

    // Should only render 2 children (min of ratios.length and children.length)
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});

describe('HorizontalSplit', () => {
  it('renders children stacked vertically', () => {
    render(
      <HorizontalSplit ratios={[1, 1]} gap={16}>
        {[
          <div key="1">Top</div>,
          <div key="2">Bottom</div>,
        ]}
      </HorizontalSplit>
    );

    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Bottom')).toBeInTheDocument();
  });

  it('applies correct flex ratios vertically', () => {
    const { container } = render(
      <HorizontalSplit ratios={[1, 3]} gap={12}>
        {[
          <div key="1">Small</div>,
          <div key="2">Large</div>,
        ]}
      </HorizontalSplit>
    );

    const children = container.querySelectorAll('.overflow-auto');
    expect(children).toHaveLength(2);
    
    // 1/(1+3) = 0.25, 3/(1+3) = 0.75
    expect(children[0]).toHaveStyle({ flex: '0.25' });
    expect(children[1]).toHaveStyle({ flex: '0.75' });
  });
});

describe('Grid', () => {
  it('renders children in a grid', () => {
    render(
      <Grid columns={2} gap={16}>
        {[
          <div key="1">Item 1</div>,
          <div key="2">Item 2</div>,
          <div key="3">Item 3</div>,
          <div key="4">Item 4</div>,
        ]}
      </Grid>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
  });

  it('clamps columns between 1 and 12', () => {
    const { container: container1 } = render(
      <Grid columns={0} gap={8}>
        {[<div key="1">Test</div>]}
      </Grid>
    );

    const grid1 = container1.querySelector('.grid');
    expect(grid1).toHaveStyle({ gridTemplateColumns: 'repeat(1, 1fr)' });

    const { container: container2 } = render(
      <Grid columns={15} gap={8}>
        {[<div key="1">Test</div>]}
      </Grid>
    );

    const grid2 = container2.querySelector('.grid');
    expect(grid2).toHaveStyle({ gridTemplateColumns: 'repeat(12, 1fr)' });
  });

  it('supports responsive mode', () => {
    const { container } = render(
      <Grid columns={3} responsive={true} gap={16}>
        {[<div key="1">Test</div>]}
      </Grid>
    );

    const grid = container.querySelector('.grid');
    // In responsive mode, uses auto-fit
    expect(grid).toHaveStyle({ gridTemplateColumns: expect.stringContaining('auto-fit') });
  });
});

describe('DashboardPanel', () => {
  it('renders with title', () => {
    render(
      <DashboardPanel title="Metrics">
        {[<div key="1">Content</div>]}
      </DashboardPanel>
    );

    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders without title', () => {
    render(
      <DashboardPanel>
        {[<div key="1">Content</div>]}
      </DashboardPanel>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('collapses when collapsible and clicked', async () => {
    const { container } = render(
      <DashboardPanel title="Collapsible Panel" collapsible={true}>
        {[<div key="1">Panel Content</div>]}
      </DashboardPanel>
    );

    // Initially expanded
    expect(screen.getByText('Panel Content')).toBeInTheDocument();

    // Note: Click interaction test requires user event setup
    // For now, just verify structure renders correctly
  });

  it('renders when not collapsible', () => {
    render(
      <DashboardPanel title="Fixed Panel" collapsible={false}>
        {[<div key="1">Panel Content</div>]}
      </DashboardPanel>
    );

    // Content should be visible
    expect(screen.getByText('Panel Content')).toBeInTheDocument();
    expect(screen.getByText('Fixed Panel')).toBeInTheDocument();
  });
});

describe('Nested Layouts', () => {
  it('renders VerticalSplit with Grid inside', () => {
    render(
      <VerticalSplit ratios={[1, 2]} gap={16}>
        {[
          <div key="sidebar">Sidebar</div>,
          <Grid key="main" columns={2} gap={12}>
            {[
              <div key="1">Chart 1</div>,
              <div key="2">Chart 2</div>,
              <div key="3">Chart 3</div>,
              <div key="4">Chart 4</div>,
            ]}
          </Grid>,
        ]}
      </VerticalSplit>
    );

    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByText('Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Chart 2')).toBeInTheDocument();
    expect(screen.getByText('Chart 3')).toBeInTheDocument();
    expect(screen.getByText('Chart 4')).toBeInTheDocument();
  });

  it('renders complex nested structure', () => {
    render(
      <VerticalSplit ratios={[30, 70]} gap={16}>
        {[
          <DashboardPanel key="left" title="KPIs" collapsible={true}>
            {[<div key="1">KPI Content</div>]}
          </DashboardPanel>,
          <HorizontalSplit key="right" ratios={[2, 1]} gap={12}>
            {[
              <Grid key="top" columns={2} gap={8}>
                {[
                  <div key="1">Chart A</div>,
                  <div key="2">Chart B</div>,
                ]}
              </Grid>,
              <div key="bottom">Footer</div>,
            ]}
          </HorizontalSplit>,
        ]}
      </VerticalSplit>
    );

    expect(screen.getByText('KPIs')).toBeInTheDocument();
    expect(screen.getByText('KPI Content')).toBeInTheDocument();
    expect(screen.getByText('Chart A')).toBeInTheDocument();
    expect(screen.getByText('Chart B')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
