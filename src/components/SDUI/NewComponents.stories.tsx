import type { Meta, StoryObj } from '@storybook/react';
import { MetricBadge, MetricBadgeGroup } from './MetricBadge';
import { KPIForm } from './KPIForm';
import { ValueCommitForm } from './ValueCommitForm';
import { RealizationDashboard } from './RealizationDashboard';
import { LifecyclePanel, LifecycleTimeline } from './LifecyclePanel';
import { IntegrityReviewPanel } from './IntegrityReviewPanel';
import { TrendingUp } from 'lucide-react';

// ============================================================================
// MetricBadge Stories
// ============================================================================

const metricBadgeMeta: Meta<typeof MetricBadge> = {
  title: 'SDUI/MetricBadge',
  component: MetricBadge,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
  },
};

export default metricBadgeMeta;

type MetricBadgeStory = StoryObj<typeof MetricBadge>;

export const BasicMetricBadge: MetricBadgeStory = {
  args: {
    label: 'Conversion Rate',
    value: 23.5,
    unit: '%',
    tone: 'success',
  },
};

export const WithIcon: MetricBadgeStory = {
  args: {
    label: 'Revenue',
    value: 150000,
    unit: 'USD',
    tone: 'success',
    icon: <TrendingUp className="h-4 w-4" />,
  },
};

export const AllSizes: MetricBadgeStory = {
  render: () => (
    <div className="space-y-4">
      <MetricBadge label="Small" value={100} size="small" />
      <MetricBadge label="Medium" value={200} size="medium" />
      <MetricBadge label="Large" value={300} size="large" />
    </div>
  ),
};

export const AllTones: MetricBadgeStory = {
  render: () => (
    <div className="space-y-4">
      <MetricBadge label="Success" value={100} tone="success" />
      <MetricBadge label="Warning" value={200} tone="warning" />
      <MetricBadge label="Error" value={300} tone="error" />
      <MetricBadge label="Info" value={400} tone="info" />
    </div>
  ),
};

export const MetricGroup: StoryObj<typeof MetricBadgeGroup> = {
  render: () => (
    <MetricBadgeGroup
      title="Key Metrics"
      metrics={[
        { label: 'Conversion', value: 23.5, unit: '%', tone: 'success' },
        { label: 'Revenue', value: 150000, unit: 'USD', tone: 'success' },
        { label: 'Churn', value: 5.2, unit: '%', tone: 'warning' },
      ]}
    />
  ),
};

// ============================================================================
// KPIForm Stories
// ============================================================================

const kpiFormMeta: Meta<typeof KPIForm> = {
  title: 'SDUI/KPIForm',
  component: KPIForm,
  tags: ['autodocs'],
};

export const KPIFormStories = kpiFormMeta;

type KPIFormStory = StoryObj<typeof KPIForm>;

export const BasicKPIForm: KPIFormStory = {
  args: {
    kpiName: 'Lead Conversion Rate',
    unit: '%',
    onSubmit: (baseline, target) => {
      console.log('Submitted:', { baseline, target });
      alert(`Baseline: ${baseline}, Target: ${target}`);
    },
  },
};

export const WithDescription: KPIFormStory = {
  args: {
    kpiName: 'Manual Hours Reduced',
    description: 'Track reduction in manual processing time',
    unit: 'hours',
    onSubmit: (baseline, target) => console.log({ baseline, target }),
  },
};

export const WithInitialValues: KPIFormStory = {
  args: {
    kpiName: 'Customer Retention Rate',
    unit: '%',
    initialBaseline: 75,
    initialTarget: 85,
    onSubmit: (baseline, target) => console.log({ baseline, target }),
  },
};

export const WithSuccess: KPIFormStory = {
  args: {
    kpiName: 'Revenue Growth',
    unit: 'USD',
    showSuccess: true,
    onSubmit: (baseline, target) => console.log({ baseline, target }),
  },
};

// ============================================================================
// ValueCommitForm Stories
// ============================================================================

const valueCommitFormMeta: Meta<typeof ValueCommitForm> = {
  title: 'SDUI/ValueCommitForm',
  component: ValueCommitForm,
  tags: ['autodocs'],
};

export const ValueCommitFormStories = valueCommitFormMeta;

type ValueCommitFormStory = StoryObj<typeof ValueCommitForm>;

export const BasicValueCommitForm: ValueCommitFormStory = {
  args: {
    kpis: ['Lead Conversion Rate', 'Manual Hours Reduced', 'Customer Retention Rate'],
    onCommit: (committed, assumptions) => {
      console.log('Committed:', committed);
      console.log('Assumptions:', assumptions);
      alert(`Committed ${committed.length} KPIs`);
    },
  },
};

export const WithCustomKPIs: ValueCommitFormStory = {
  args: {
    kpis: ['Revenue Growth', 'Cost Reduction'],
    allowCustomKPIs: true,
    onCommit: (committed, assumptions) => console.log({ committed, assumptions }),
  },
};

export const WithInitialData: ValueCommitFormStory = {
  args: {
    kpis: ['Lead Conversion Rate', 'Manual Hours Reduced'],
    initialCommitted: [
      { kpiName: 'Lead Conversion Rate', baseline: 15, target: 25, unit: '%' },
    ],
    initialAssumptions: 'Assumes 20% increase in marketing spend',
    onCommit: (committed, assumptions) => console.log({ committed, assumptions }),
  },
};

// ============================================================================
// RealizationDashboard Stories
// ============================================================================

const realizationDashboardMeta: Meta<typeof RealizationDashboard> = {
  title: 'SDUI/RealizationDashboard',
  component: RealizationDashboard,
  tags: ['autodocs'],
};

export const RealizationDashboardStories = realizationDashboardMeta;

type RealizationDashboardStory = StoryObj<typeof RealizationDashboard>;

export const SingleKPI: RealizationDashboardStory = {
  args: {
    kpiName: 'Lead Conversion Rate',
    baseline: 15,
    target: 25,
    actual: 22,
    unit: '%',
  },
};

export const MultipleKPIs: RealizationDashboardStory = {
  args: {
    kpis: [
      {
        kpiName: 'Lead Conversion Rate',
        baseline: 15,
        target: 25,
        actual: 22,
        unit: '%',
        lastUpdated: new Date(),
      },
      {
        kpiName: 'Manual Hours Reduced',
        baseline: 100,
        target: 50,
        actual: 60,
        unit: 'hours',
        lastUpdated: new Date(),
      },
      {
        kpiName: 'Customer Retention',
        baseline: 75,
        target: 85,
        actual: 88,
        unit: '%',
        lastUpdated: new Date(),
      },
      {
        kpiName: 'Revenue Growth',
        baseline: 100000,
        target: 150000,
        actual: 120000,
        unit: 'USD',
        lastUpdated: new Date(),
      },
    ],
    showDetails: true,
    showTrends: true,
  },
};

export const WithoutDetails: RealizationDashboardStory = {
  args: {
    kpis: [
      {
        kpiName: 'Lead Conversion Rate',
        baseline: 15,
        target: 25,
        actual: 22,
        unit: '%',
      },
    ],
    showDetails: false,
    showTrends: false,
  },
};

// ============================================================================
// LifecyclePanel Stories
// ============================================================================

const lifecyclePanelMeta: Meta<typeof LifecyclePanel> = {
  title: 'SDUI/LifecyclePanel',
  component: LifecyclePanel,
  tags: ['autodocs'],
  argTypes: {
    stage: {
      control: 'select',
      options: ['Opportunity', 'Target', 'Realization', 'Expansion', 'Integrity'],
    },
    variant: {
      control: 'select',
      options: ['default', 'compact', 'detailed'],
    },
  },
};

export const LifecyclePanelStories = lifecyclePanelMeta;

type LifecyclePanelStory = StoryObj<typeof LifecyclePanel>;

export const OpportunityPanel: LifecyclePanelStory = {
  args: {
    stage: 'Opportunity',
    children: <p>Discover and frame business problems</p>,
  },
};

export const TargetPanel: LifecyclePanelStory = {
  args: {
    stage: 'Target',
    children: <p>Define and commit to value targets</p>,
  },
};

export const RealizationPanel: LifecyclePanelStory = {
  args: {
    stage: 'Realization',
    children: <p>Track and prove value delivery</p>,
  },
};

export const ExpansionPanel: LifecyclePanelStory = {
  args: {
    stage: 'Expansion',
    children: <p>Identify and pursue expansion opportunities</p>,
  },
};

export const IntegrityPanel: LifecyclePanelStory = {
  args: {
    stage: 'Integrity',
    children: <p>Validate manifesto compliance</p>,
  },
};

export const ActivePanel: LifecyclePanelStory = {
  args: {
    stage: 'Target',
    isActive: true,
    children: <p>This is the current active stage</p>,
  },
};

export const CompletedPanel: LifecyclePanelStory = {
  args: {
    stage: 'Opportunity',
    isCompleted: true,
    children: <p>This stage has been completed</p>,
  },
};

export const WithActions: LifecyclePanelStory = {
  args: {
    stage: 'Target',
    children: <p>Panel with action buttons</p>,
    actions: (
      <>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Continue
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-md">
          Cancel
        </button>
      </>
    ),
  },
};

export const Timeline: StoryObj<typeof LifecycleTimeline> = {
  render: () => (
    <LifecycleTimeline
      currentStage="Target"
      completedStages={['Opportunity']}
      onStageClick={(stage) => alert(`Clicked: ${stage}`)}
      showDescriptions
    />
  ),
};

// ============================================================================
// IntegrityReviewPanel Stories
// ============================================================================

const integrityReviewPanelMeta: Meta<typeof IntegrityReviewPanel> = {
  title: 'SDUI/IntegrityReviewPanel',
  component: IntegrityReviewPanel,
  tags: ['autodocs'],
};

export const IntegrityReviewPanelStories = integrityReviewPanelMeta;

type IntegrityReviewPanelStory = StoryObj<typeof IntegrityReviewPanel>;

export const AllPassed: IntegrityReviewPanelStory = {
  args: {
    results: [
      {
        rule: 'Value is defined by outcomes',
        passed: true,
        principle: 'Manifesto Rule #1',
      },
      {
        rule: 'Conservative quantification',
        passed: true,
        principle: 'Manifesto Rule #4',
      },
      {
        rule: 'Standard KPI definitions',
        passed: true,
        principle: 'Manifesto Rule #2',
      },
    ],
  },
};

export const WithFailures: IntegrityReviewPanelStory = {
  args: {
    results: [
      {
        rule: 'Value is defined by outcomes',
        passed: true,
        principle: 'Manifesto Rule #1',
      },
      {
        rule: 'Conservative quantification',
        passed: false,
        severity: 'critical',
        message: 'ROI assumptions too aggressive',
        remediation: 'Reduce growth assumptions by 20% to align with industry benchmarks',
        principle: 'Manifesto Rule #4',
      },
      {
        rule: 'Standard KPI definitions',
        passed: false,
        severity: 'high',
        message: 'Custom KPI not in Value Fabric',
        remediation: 'Replace custom KPI with standard definition from Value Fabric',
        principle: 'Manifesto Rule #2',
      },
      {
        rule: 'Traceable assumptions',
        passed: false,
        severity: 'medium',
        message: 'Missing source documentation',
        remediation: 'Add references to source data for all assumptions',
        principle: 'Manifesto Rule #9',
      },
    ],
  },
};

export const WithDetails: IntegrityReviewPanelStory = {
  args: {
    results: [
      {
        rule: 'Value is defined by outcomes',
        description: 'Every artifact must answer: What business outcome does this enable?',
        passed: true,
        principle: 'Manifesto Rule #1',
      },
      {
        rule: 'Conservative quantification',
        description: 'All estimates must withstand CFO-level scrutiny',
        passed: false,
        severity: 'critical',
        message: 'ROI assumptions too aggressive',
        remediation: 'Reduce growth assumptions by 20%',
        principle: 'Manifesto Rule #4',
      },
    ],
    showDetails: true,
    showRemediation: true,
  },
};

export const EmptyState: IntegrityReviewPanelStory = {
  args: {
    results: [],
  },
};
