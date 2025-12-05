import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricBadge, MetricBadgeGroup } from '../MetricBadge';
import { KPIForm } from '../KPIForm';
import { ValueCommitForm } from '../ValueCommitForm';
import { RealizationDashboard } from '../RealizationDashboard';
import { LifecyclePanel, LifecycleTimeline } from '../LifecyclePanel';
import { IntegrityReviewPanel } from '../IntegrityReviewPanel';

describe('MetricBadge', () => {
  it('renders with label and value', () => {
    render(<MetricBadge label="Conversion" value={23.5} />);
    expect(screen.getByText('Conversion:')).toBeInTheDocument();
    expect(screen.getByText('23.5')).toBeInTheDocument();
  });

  it('renders with unit', () => {
    render(<MetricBadge label="Revenue" value={150000} unit="USD" />);
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('applies correct tone classes', () => {
    const { container } = render(<MetricBadge label="Test" value={100} tone="success" />);
    const badge = container.querySelector('[data-testid="metric-badge"]');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<MetricBadge label="Test" value={100} onClick={handleClick} />);
    
    const badge = screen.getByTestId('metric-badge');
    await userEvent.click(badge);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('formats numbers with locale', () => {
    render(<MetricBadge label="Large Number" value={1000000} />);
    expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
  });
});

describe('MetricBadgeGroup', () => {
  it('renders multiple badges', () => {
    render(
      <MetricBadgeGroup
        metrics={[
          { label: 'Metric 1', value: 100 },
          { label: 'Metric 2', value: 200 },
        ]}
      />
    );
    
    expect(screen.getByText('Metric 1:')).toBeInTheDocument();
    expect(screen.getByText('Metric 2:')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(
      <MetricBadgeGroup
        title="Key Metrics"
        metrics={[{ label: 'Test', value: 100 }]}
      />
    );
    
    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
  });
});

describe('KPIForm', () => {
  it('renders form fields', () => {
    render(<KPIForm kpiName="Test KPI" onSubmit={vi.fn()} />);
    
    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByLabelText(/Baseline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target/)).toBeInTheDocument();
  });

  it('validates baseline and target', async () => {
    const handleSubmit = vi.fn();
    render(<KPIForm kpiName="Test KPI" onSubmit={handleSubmit} />);
    
    const submitButton = screen.getByText('Save KPI');
    await userEvent.click(submitButton);
    
    // Should show validation errors
    expect(await screen.findByText(/Baseline must be a positive number/)).toBeInTheDocument();
  });

  it('submits valid data', async () => {
    const handleSubmit = vi.fn();
    render(<KPIForm kpiName="Test KPI" onSubmit={handleSubmit} />);
    
    const baselineInput = screen.getByLabelText(/Baseline/);
    const targetInput = screen.getByLabelText(/Target/);
    
    await userEvent.type(baselineInput, '10');
    await userEvent.type(targetInput, '20');
    
    const submitButton = screen.getByText('Save KPI');
    await userEvent.click(submitButton);
    
    expect(handleSubmit).toHaveBeenCalledWith(10, 20);
  });

  it('calculates improvement percentage', async () => {
    render(<KPIForm kpiName="Test KPI" onSubmit={vi.fn()} />);
    
    const baselineInput = screen.getByLabelText(/Baseline/);
    const targetInput = screen.getByLabelText(/Target/);
    
    await userEvent.type(baselineInput, '100');
    await userEvent.type(targetInput, '150');
    
    expect(await screen.findByText(/50.0%/)).toBeInTheDocument();
  });

  it('shows success message when enabled', async () => {
    render(<KPIForm kpiName="Test KPI" onSubmit={vi.fn()} showSuccess />);
    
    const baselineInput = screen.getByLabelText(/Baseline/);
    const targetInput = screen.getByLabelText(/Target/);
    
    await userEvent.type(baselineInput, '10');
    await userEvent.type(targetInput, '20');
    
    const submitButton = screen.getByText('Save KPI');
    await userEvent.click(submitButton);
    
    expect(await screen.findByText(/saved successfully/)).toBeInTheDocument();
  });
});

describe('ValueCommitForm', () => {
  it('renders KPI selection', () => {
    render(
      <ValueCommitForm
        kpis={['KPI 1', 'KPI 2']}
        onCommit={vi.fn()}
      />
    );
    
    expect(screen.getByText('Value Commitment')).toBeInTheDocument();
    expect(screen.getByLabelText('KPI Name')).toBeInTheDocument();
  });

  it('adds KPI to committed list', async () => {
    render(
      <ValueCommitForm
        kpis={['Test KPI']}
        onCommit={vi.fn()}
      />
    );
    
    // Select KPI
    const select = screen.getByLabelText('KPI Name');
    await userEvent.selectOptions(select, 'Test KPI');
    
    // Enter values
    const baselineInput = screen.getByLabelText('Baseline');
    const targetInput = screen.getByLabelText('Target');
    await userEvent.type(baselineInput, '10');
    await userEvent.type(targetInput, '20');
    
    // Add KPI
    const addButton = screen.getByText('Add KPI');
    await userEvent.click(addButton);
    
    // Check it appears in committed list
    expect(await screen.findByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByText(/Committed KPIs \(1\)/)).toBeInTheDocument();
  });

  it('removes KPI from committed list', async () => {
    render(
      <ValueCommitForm
        kpis={['Test KPI']}
        initialCommitted={[{ kpiName: 'Test KPI', baseline: 10, target: 20 }]}
        onCommit={vi.fn()}
      />
    );
    
    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    
    const removeButton = screen.getByLabelText('Remove Test KPI');
    await userEvent.click(removeButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Test KPI')).not.toBeInTheDocument();
    });
  });

  it('validates assumptions are required', async () => {
    const handleCommit = vi.fn();
    render(
      <ValueCommitForm
        kpis={['Test KPI']}
        initialCommitted={[{ kpiName: 'Test KPI', baseline: 10, target: 20 }]}
        onCommit={handleCommit}
      />
    );
    
    const commitButton = screen.getByText('Commit Value');
    await userEvent.click(commitButton);
    
    expect(await screen.findByText(/provide assumptions/)).toBeInTheDocument();
    expect(handleCommit).not.toHaveBeenCalled();
  });

  it('submits complete commitment', async () => {
    const handleCommit = vi.fn();
    render(
      <ValueCommitForm
        kpis={['Test KPI']}
        initialCommitted={[{ kpiName: 'Test KPI', baseline: 10, target: 20 }]}
        initialAssumptions="Test assumptions"
        onCommit={handleCommit}
      />
    );
    
    const commitButton = screen.getByText('Commit Value');
    await userEvent.click(commitButton);
    
    expect(handleCommit).toHaveBeenCalledWith(
      [{ kpiName: 'Test KPI', baseline: 10, target: 20 }],
      'Test assumptions'
    );
  });
});

describe('RealizationDashboard', () => {
  it('renders single KPI', () => {
    render(
      <RealizationDashboard
        kpiName="Test KPI"
        baseline={10}
        target={20}
        actual={15}
      />
    );
    
    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
  });

  it('renders multiple KPIs', () => {
    render(
      <RealizationDashboard
        kpis={[
          { kpiName: 'KPI 1', baseline: 10, target: 20, actual: 15 },
          { kpiName: 'KPI 2', baseline: 100, target: 150, actual: 130 },
        ]}
      />
    );
    
    expect(screen.getByText('KPI 1')).toBeInTheDocument();
    expect(screen.getByText('KPI 2')).toBeInTheDocument();
  });

  it('shows summary statistics', () => {
    render(
      <RealizationDashboard
        kpis={[
          { kpiName: 'KPI 1', baseline: 10, target: 20, actual: 20 }, // Achieved
          { kpiName: 'KPI 2', baseline: 10, target: 20, actual: 18 }, // On track
        ]}
      />
    );
    
    expect(screen.getByText('Achieved')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('calculates progress correctly', () => {
    render(
      <RealizationDashboard
        kpiName="Test KPI"
        baseline={10}
        target={20}
        actual={15}
      />
    );
    
    // Progress should be 50% ((15-10)/(20-10) * 100)
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<RealizationDashboard kpis={[]} />);
    
    expect(screen.getByText(/No realization data available/)).toBeInTheDocument();
  });
});

describe('LifecyclePanel', () => {
  it('renders with stage', () => {
    render(
      <LifecyclePanel stage="Opportunity">
        <p>Test content</p>
      </LifecyclePanel>
    );
    
    expect(screen.getByText('Opportunity Stage')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('shows active indicator', () => {
    render(
      <LifecyclePanel stage="Target" isActive>
        <p>Test content</p>
      </LifecyclePanel>
    );
    
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows completed indicator', () => {
    render(
      <LifecyclePanel stage="Opportunity" isCompleted>
        <p>Test content</p>
      </LifecyclePanel>
    );
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(
      <LifecyclePanel stage="Target" onClick={handleClick}>
        <p>Test content</p>
      </LifecyclePanel>
    );
    
    const panel = screen.getByTestId('lifecycle-panel');
    await userEvent.click(panel);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders actions', () => {
    render(
      <LifecyclePanel
        stage="Target"
        actions={<button>Test Action</button>}
      >
        <p>Test content</p>
      </LifecyclePanel>
    );
    
    expect(screen.getByText('Test Action')).toBeInTheDocument();
  });
});

describe('LifecycleTimeline', () => {
  it('renders all stages', () => {
    render(
      <LifecycleTimeline
        currentStage="Target"
        completedStages={['Opportunity']}
      />
    );
    
    expect(screen.getByText('Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Realization')).toBeInTheDocument();
    expect(screen.getByText('Expansion')).toBeInTheDocument();
    expect(screen.getByText('Integrity')).toBeInTheDocument();
  });

  it('handles stage clicks', async () => {
    const handleClick = vi.fn();
    render(
      <LifecycleTimeline
        currentStage="Target"
        onStageClick={handleClick}
      />
    );
    
    const opportunityButton = screen.getByLabelText('Opportunity');
    await userEvent.click(opportunityButton);
    
    expect(handleClick).toHaveBeenCalledWith('Opportunity');
  });
});

describe('IntegrityReviewPanel', () => {
  it('renders results', () => {
    render(
      <IntegrityReviewPanel
        results={[
          { rule: 'Rule 1', passed: true },
          { rule: 'Rule 2', passed: false, severity: 'high' },
        ]}
      />
    );
    
    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText('Rule 2')).toBeInTheDocument();
  });

  it('shows summary statistics', () => {
    render(
      <IntegrityReviewPanel
        results={[
          { rule: 'Rule 1', passed: true },
          { rule: 'Rule 2', passed: false, severity: 'critical' },
        ]}
      />
    );
    
    expect(screen.getByText('Total Rules')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('calculates compliance rate', () => {
    render(
      <IntegrityReviewPanel
        results={[
          { rule: 'Rule 1', passed: true },
          { rule: 'Rule 2', passed: true },
          { rule: 'Rule 3', passed: false, severity: 'low' },
        ]}
      />
    );
    
    // 2 out of 3 passed = 66.7%
    expect(screen.getByText(/67%/)).toBeInTheDocument();
  });

  it('groups results by status', () => {
    render(
      <IntegrityReviewPanel
        results={[
          { rule: 'Passed Rule', passed: true },
          { rule: 'Failed Rule', passed: false, severity: 'high' },
        ]}
        groupByStatus
      />
    );
    
    expect(screen.getByText(/Failed Rules/)).toBeInTheDocument();
    expect(screen.getByText(/Passed Rules/)).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<IntegrityReviewPanel results={[]} />);
    
    expect(screen.getByText(/No integrity rules to review/)).toBeInTheDocument();
  });

  it('handles rule clicks', async () => {
    const handleClick = vi.fn();
    render(
      <IntegrityReviewPanel
        results={[{ rule: 'Test Rule', passed: true }]}
        onRuleClick={handleClick}
      />
    );
    
    const ruleItem = screen.getByTestId('rule-result-item');
    await userEvent.click(ruleItem);
    
    expect(handleClick).toHaveBeenCalledWith('Test Rule');
  });
});
