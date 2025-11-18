/**
 * Complete Lifecycle Integration Examples
 * 
 * Demonstrates how to use all SDUI components together to build
 * complete lifecycle workflows.
 */

import React, { useState } from 'react';
import { renderPage } from '../renderPage';
import { SDUIPageDefinition } from '../schema';
import {
  MetricBadge,
  KPIForm,
  ValueCommitForm,
  RealizationDashboard,
  LifecyclePanel,
  LifecycleTimeline,
  IntegrityReviewPanel,
  DiscoveryCard,
  ValueTreeCard,
  InfoBanner,
  ExpansionBlock,
} from '../../components/SDUI';

// ============================================================================
// Example 1: Complete Opportunity Discovery Workflow
// ============================================================================

export function Example1_OpportunityWorkflow() {
  const [discoveryAnswers, setDiscoveryAnswers] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Opportunity Discovery Workflow</h1>

      <LifecyclePanel stage="Opportunity" isActive>
        <InfoBanner
          title="Opportunity Discovery"
          description="Identify and frame business problems with potential value"
          tone="info"
        />

        <DiscoveryCard
          title="Discovery Questions"
          prompt="Answer these questions to frame the opportunity"
          questions={[
            'What business problem are we solving?',
            'Who is the primary persona affected?',
            'What are the current pain points?',
            'What KPIs could be improved?',
            'What is the strategic goal?',
          ]}
        />

        <ValueTreeCard
          title="Potential Value Drivers"
          nodes={[
            'Revenue Growth',
            'Cost Reduction',
            'Risk Mitigation',
            'Efficiency Gains',
          ]}
        />

        <div className="flex gap-2 mt-4">
          <MetricBadge label="Potential Impact" value="High" tone="success" />
          <MetricBadge label="Confidence" value="Medium" tone="warning" />
          <MetricBadge label="Timeline" value="3-6 months" tone="info" />
        </div>
      </LifecyclePanel>
    </div>
  );
}

// ============================================================================
// Example 2: Target Value Commitment Workflow
// ============================================================================

export function Example2_TargetWorkflow() {
  const [committed, setCommitted] = useState<any[]>([]);
  const [assumptions, setAssumptions] = useState('');

  const handleCommit = (kpis: any[], assumptionsText: string) => {
    setCommitted(kpis);
    setAssumptions(assumptionsText);
    console.log('Value committed:', { kpis, assumptions: assumptionsText });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Target Value Commitment Workflow</h1>

      <LifecyclePanel stage="Target" isActive>
        <InfoBanner
          title="Target Value Commitment"
          description="Define baseline and target values with conservative assumptions"
          tone="warning"
        />

        <ValueTreeCard
          title="Target Outcomes"
          nodes={[
            'Increase Lead Conversion Rate',
            'Reduce Manual Processing Time',
            'Improve Customer Retention',
          ]}
        />

        <ValueCommitForm
          kpis={[
            'Lead Conversion Rate',
            'Manual Hours Reduced',
            'Customer Retention Rate',
            'Time to Close',
          ]}
          onCommit={handleCommit}
          allowCustomKPIs
          showSuccess
        />

        {committed.length > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">
              Commitment Summary
            </h3>
            <div className="space-y-2">
              {committed.map((kpi, index) => (
                <div key={index} className="flex items-center gap-2">
                  <MetricBadge
                    label={kpi.kpiName}
                    value={`${kpi.baseline} → ${kpi.target}`}
                    unit={kpi.unit}
                    tone="success"
                    size="small"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </LifecyclePanel>
    </div>
  );
}

// ============================================================================
// Example 3: Realization Tracking Workflow
// ============================================================================

export function Example3_RealizationWorkflow() {
  const realizationData = [
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
      kpiName: 'Customer Retention Rate',
      baseline: 75,
      target: 85,
      actual: 88,
      unit: '%',
      lastUpdated: new Date(),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Value Realization Tracking Workflow</h1>

      <LifecyclePanel stage="Realization" isActive>
        <InfoBanner
          title="Value Realization Tracking"
          description="Monitor actual results against committed targets"
          tone="success"
        />

        <RealizationDashboard
          kpis={realizationData}
          showDetails
          showTrends
          onKPIClick={(kpiName) => {
            console.log('Clicked KPI:', kpiName);
          }}
        />

        <DiscoveryCard
          title="Measurement Questions"
          questions={[
            'What is the baseline measurement?',
            'How is uplift being captured?',
            'Which KPI owners are accountable?',
            'What is the measurement frequency?',
          ]}
        />
      </LifecyclePanel>
    </div>
  );
}

// ============================================================================
// Example 4: Expansion Planning Workflow
// ============================================================================

export function Example4_ExpansionWorkflow() {
  const [expansionROI, setExpansionROI] = useState<{
    baseline: number;
    target: number;
  } | null>(null);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Expansion Planning Workflow</h1>

      <LifecyclePanel stage="Expansion" isActive>
        <InfoBanner
          title="Expansion Opportunities"
          description="Identify gaps and model additional value potential"
          tone="info"
        />

        <ExpansionBlock
          gaps={[
            'Advanced Analytics Capability',
            'Multi-Channel Integration',
            'Automated Workflow Engine',
          ]}
          roi={{
            revenue: 150000,
            cost: 25000,
            risk: 10000,
          }}
        />

        <ValueTreeCard
          title="Expansion Value Drivers"
          nodes={[
            'Unlock New Use Cases',
            'Scale to Additional Teams',
            'Integrate New Data Sources',
          ]}
        />

        <KPIForm
          kpiName="Expansion ROI"
          description="Projected return on investment for expansion"
          unit="USD"
          onSubmit={(baseline, target) => {
            setExpansionROI({ baseline, target });
            console.log('Expansion ROI:', { baseline, target });
          }}
          showSuccess
        />

        {expansionROI && (
          <div className="flex gap-2 mt-4">
            <MetricBadge
              label="Current Value"
              value={expansionROI.baseline}
              unit="USD"
              tone="info"
            />
            <MetricBadge
              label="Expansion Value"
              value={expansionROI.target}
              unit="USD"
              tone="success"
            />
            <MetricBadge
              label="Uplift"
              value={
                ((expansionROI.target - expansionROI.baseline) /
                  expansionROI.baseline) *
                100
              }
              unit="%"
              tone="success"
            />
          </div>
        )}
      </LifecyclePanel>
    </div>
  );
}

// ============================================================================
// Example 5: Integrity Validation Workflow
// ============================================================================

export function Example5_IntegrityWorkflow() {
  const validationResults = [
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
      severity: 'critical' as const,
      message: 'ROI assumptions too aggressive',
      remediation: 'Reduce growth assumptions by 20% to align with industry benchmarks',
      principle: 'Manifesto Rule #4',
    },
    {
      rule: 'Standard KPI definitions',
      description: 'KPIs must be from standardized Value Fabric definitions',
      passed: false,
      severity: 'high' as const,
      message: 'Custom KPI not in Value Fabric',
      remediation: 'Replace custom KPI with standard definition from Value Fabric',
      principle: 'Manifesto Rule #2',
    },
    {
      rule: 'Traceable assumptions',
      description: 'All claims must be traceable and auditable',
      passed: false,
      severity: 'medium' as const,
      message: 'Missing source documentation',
      remediation: 'Add references to source data for all assumptions',
      principle: 'Manifesto Rule #9',
    },
    {
      rule: 'Full lifecycle span',
      description: 'Value must span Opportunity → Target → Realization → Expansion',
      passed: true,
      principle: 'Manifesto Rule #5',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Integrity Validation Workflow</h1>

      <LifecyclePanel stage="Integrity" isActive>
        <InfoBanner
          title="Integrity Check"
          description="Validate compliance with VOS Manifesto principles"
          tone="warning"
        />

        <IntegrityReviewPanel
          results={validationResults}
          showDetails
          showRemediation
          groupByStatus
          onRuleClick={(rule) => {
            console.log('Clicked rule:', rule);
          }}
        />

        <DiscoveryCard
          title="Integrity Checklist"
          questions={[
            'Are all outcomes customer-defined?',
            'Are assumptions conservative and evidence-based?',
            'Is the value quantified using Revenue/Cost/Risk?',
            'Are all KPIs from the standard Value Fabric?',
            'Is the ROI calculation using standard methodology?',
          ]}
        />
      </LifecyclePanel>
    </div>
  );
}

// ============================================================================
// Example 6: Complete Lifecycle Timeline
// ============================================================================

export function Example6_CompleteLifecycle() {
  const [currentStage, setCurrentStage] = useState<
    'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity'
  >('Opportunity');
  const [completedStages, setCompletedStages] = useState<
    Array<'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity'>
  >([]);

  const handleStageClick = (
    stage: 'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity'
  ) => {
    setCurrentStage(stage);
  };

  const handleStageComplete = () => {
    if (!completedStages.includes(currentStage)) {
      setCompletedStages([...completedStages, currentStage]);
    }

    // Move to next stage
    const stages: Array<
      'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity'
    > = ['Opportunity', 'Target', 'Realization', 'Expansion', 'Integrity'];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      setCurrentStage(stages[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">Complete Lifecycle Workflow</h1>

      <InfoBanner
        title="Value Operating System"
        description="Complete lifecycle view: Opportunity → Target → Realization → Expansion → Integrity"
        tone="info"
      />

      <LifecycleTimeline
        currentStage={currentStage}
        completedStages={completedStages}
        onStageClick={handleStageClick}
        showDescriptions
      />

      <div className="space-y-6">
        {currentStage === 'Opportunity' && (
          <LifecyclePanel
            stage="Opportunity"
            isActive
            actions={
              <button
                onClick={handleStageComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Complete Opportunity
              </button>
            }
          >
            <DiscoveryCard
              questions={[
                'What business problem are we solving?',
                'Who is the primary persona?',
              ]}
            />
          </LifecyclePanel>
        )}

        {currentStage === 'Target' && (
          <LifecyclePanel
            stage="Target"
            isActive
            actions={
              <button
                onClick={handleStageComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Complete Target
              </button>
            }
          >
            <ValueCommitForm
              kpis={['Lead Conversion Rate', 'Manual Hours Reduced']}
              onCommit={(kpis, assumptions) => {
                console.log('Committed:', kpis, assumptions);
              }}
            />
          </LifecyclePanel>
        )}

        {currentStage === 'Realization' && (
          <LifecyclePanel
            stage="Realization"
            isActive
            actions={
              <button
                onClick={handleStageComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Complete Realization
              </button>
            }
          >
            <RealizationDashboard
              kpis={[
                {
                  kpiName: 'Lead Conversion Rate',
                  baseline: 15,
                  target: 25,
                  actual: 22,
                  unit: '%',
                },
              ]}
              showDetails
              showTrends
            />
          </LifecyclePanel>
        )}

        {currentStage === 'Expansion' && (
          <LifecyclePanel
            stage="Expansion"
            isActive
            actions={
              <button
                onClick={handleStageComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Complete Expansion
              </button>
            }
          >
            <ExpansionBlock
              gaps={['Advanced Analytics']}
              roi={{ revenue: 150000, cost: 25000, risk: 10000 }}
            />
          </LifecyclePanel>
        )}

        {currentStage === 'Integrity' && (
          <LifecyclePanel
            stage="Integrity"
            isActive
            actions={
              <button
                onClick={handleStageComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Complete Integrity
              </button>
            }
          >
            <IntegrityReviewPanel
              results={[
                { rule: 'Value is defined by outcomes', passed: true },
                { rule: 'Conservative quantification', passed: true },
              ]}
            />
          </LifecyclePanel>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Example 7: Using renderPage() with Templates
// ============================================================================

export function Example7_RenderPageIntegration() {
  const opportunityPage: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Opportunity Discovery',
          description: 'Server-driven UI example',
          tone: 'info',
        },
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          questions: ['What is the problem?', 'Who is affected?'],
        },
      },
      {
        type: 'component',
        component: 'MetricBadge',
        version: 1,
        props: {
          label: 'Potential Impact',
          value: 'High',
          tone: 'success',
        },
      },
    ],
  };

  const result = renderPage(opportunityPage, {
    debug: true,
    onComponentRender: (componentName, props) => {
      console.log(`Rendered ${componentName}`, props);
    },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">renderPage() Integration Example</h1>
      {result.element}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Metadata</h3>
        <pre className="text-xs">{JSON.stringify(result.metadata, null, 2)}</pre>
      </div>
    </div>
  );
}

// ============================================================================
// All Examples Component
// ============================================================================

export function AllLifecycleExamples() {
  const [activeExample, setActiveExample] = useState(1);

  const examples = [
    { id: 1, title: 'Opportunity Workflow', component: Example1_OpportunityWorkflow },
    { id: 2, title: 'Target Workflow', component: Example2_TargetWorkflow },
    { id: 3, title: 'Realization Workflow', component: Example3_RealizationWorkflow },
    { id: 4, title: 'Expansion Workflow', component: Example4_ExpansionWorkflow },
    { id: 5, title: 'Integrity Workflow', component: Example5_IntegrityWorkflow },
    { id: 6, title: 'Complete Lifecycle', component: Example6_CompleteLifecycle },
    { id: 7, title: 'renderPage() Integration', component: Example7_RenderPageIntegration },
  ];

  const ActiveComponent = examples.find((ex) => ex.id === activeExample)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold mb-4">SDUI Lifecycle Examples</h1>
          <div className="flex gap-2 flex-wrap">
            {examples.map((example) => (
              <button
                key={example.id}
                onClick={() => setActiveExample(example.id)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeExample === example.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
