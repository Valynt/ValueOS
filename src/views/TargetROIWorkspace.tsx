import React, { useState } from 'react';
import { Calculator, TrendingUp, GitBranch, DollarSign, AlertTriangle, CheckCircle, Play } from 'lucide-react';
import { MetricCard } from '../components/Components/MetricCard';
import { InteractiveChart } from '../components/Components/InteractiveChart';
import { DataTable } from '../components/Components/DataTable';

export const TargetROIWorkspace: React.FC = () => {
  const [scenarioMode, setScenarioMode] = useState<'pessimistic' | 'expected' | 'optimistic'>('expected');

  const valueTreeData = {
    nodes: [
      { id: '1', label: 'Process Automation', type: 'capability', x: 50, y: 50 },
      { id: '2', label: 'Reduce Manual Tasks', type: 'outcome', x: 200, y: 50 },
      { id: '3', label: 'Time Savings', type: 'kpi', x: 350, y: 50 },
      { id: '4', label: 'Cost Reduction', type: 'financialMetric', x: 500, y: 50 },
    ],
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '4' },
    ]
  };

  const roiScenarios = [
    { name: 'Conservative', value: 180000, id: 'conservative', color: '#ef4444' },
    { name: 'Expected', value: 245000, id: 'expected', color: '#3b82f6' },
    { name: 'Optimistic', value: 320000, id: 'optimistic', color: '#10b981' }
  ];

  const assumptionsData = [
    ['User Adoption Rate', '85%', 'Industry Benchmark', 'High'],
    ['Efficiency Gain', '15%', 'Vendor Claims', 'Medium'],
    ['Implementation Time', '3 months', 'Historical Data', 'High'],
    ['Cost per Hour Saved', '$45', 'Current Payroll', 'High']
  ];

  const benchmarkData = [
    { name: 'Your Target', value: 85, id: 'target', color: '#3b82f6' },
    { name: 'Industry P50', value: 65, id: 'p50', color: '#6b7280' },
    { name: 'Industry P75', value: 78, id: 'p75', color: '#10b981' },
    { name: 'Industry P90', value: 92, id: 'p90', color: '#f59e0b' }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Target ROI Modeling</h1>
              <p className="text-muted-foreground mt-2">Build value trees, ROI models, and value commitments</p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors font-medium">
                Save Draft
              </button>
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-light-blue-sm flex items-center space-x-2">
                <Play className="h-4 w-4" />
                <span>Generate Value Commit</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total ROI"
            value="$245K"
            trend="up"
            change="Expected scenario"
          />
          <MetricCard
            title="Payback Period"
            value="8 months"
            trend="up"
            change="Below industry avg"
          />
          <MetricCard
            title="Confidence Level"
            value="High"
            trend="up"
            change="87% validated"
          />
          <MetricCard
            title="Assumptions"
            value="12"
            trend="neutral"
            change="4 conservative"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-beautiful-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <GitBranch className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-foreground">Value Tree</h2>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Edit Tree
                </button>
              </div>

              <div className="relative bg-gradient-to-br from-background to-muted rounded-lg p-8 border border-border min-h-[300px]">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-100 border-2 border-blue-500 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-xs font-semibold text-blue-700">Capability</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Process<br/>Automation</p>
                  </div>

                  <div className="h-0.5 w-12 bg-muted"></div>

                  <div className="text-center">
                    <div className="w-24 h-24 bg-green-100 border-2 border-green-500 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-xs font-semibold text-green-700">Outcome</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Reduce<br/>Manual Tasks</p>
                  </div>

                  <div className="h-0.5 w-12 bg-gray-400"></div>

                  <div className="text-center">
                    <div className="w-24 h-24 bg-amber-100 border-2 border-amber-500 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-xs font-semibold text-amber-700">KPI</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Time<br/>Savings</p>
                  </div>

                  <div className="h-0.5 w-12 bg-gray-400"></div>

                  <div className="text-center">
                    <div className="w-24 h-24 bg-red-100 border-2 border-red-500 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-xs font-semibold text-red-700">Financial</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Cost<br/>Reduction</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-beautiful-sm">
              <div className="flex items-center space-x-2 mb-6">
                <Calculator className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-foreground">ROI Scenario Analysis</h2>
              </div>

              <div className="mb-4 flex space-x-2 p-1 bg-muted rounded-lg">
                {['pessimistic', 'expected', 'optimistic'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setScenarioMode(mode as any)}
                    className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      scenarioMode === mode
                        ? 'bg-background text-primary shadow-beautiful-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              <InteractiveChart
                title="3-Year Value Projection"
                type="bar"
                data={roiScenarios}
                config={{ showValue: true, showLegend: true }}
              />

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-700 font-medium mb-1">Conservative</div>
                  <div className="text-2xl font-bold text-red-900">$180K</div>
                  <div className="text-xs text-red-600 mt-1">70% adoption</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-700 font-medium mb-1">Expected</div>
                  <div className="text-2xl font-bold text-blue-900">$245K</div>
                  <div className="text-xs text-blue-600 mt-1">85% adoption</div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-700 font-medium mb-1">Optimistic</div>
                  <div className="text-2xl font-bold text-green-900">$320K</div>
                  <div className="text-xs text-green-600 mt-1">95% adoption</div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-beautiful-sm">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-foreground">Key Assumptions</h2>
              </div>
              <DataTable
                title=""
                headers={['Assumption', 'Value', 'Source', 'Confidence']}
                rows={assumptionsData}
                editableColumns={[1]}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-beautiful-sm">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-foreground">Benchmark Comparison</h2>
              </div>
              <InteractiveChart
                title="Adoption Rate vs Industry"
                type="bar"
                data={benchmarkData}
                config={{ showValue: true, showLegend: false }}
              />
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Your Position</span>
                  <span className="font-semibold text-green-700">Above P75</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Percentile Rank</span>
                  <span className="font-semibold text-foreground">82nd</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-beautiful-sm">
              <div className="flex items-center space-x-2 mb-4">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-foreground">Financial Breakdown</h2>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-green-900">Cost Savings</span>
                    <span className="font-bold text-green-900">$175K</span>
                  </div>
                  <div className="text-xs text-green-700">Labor optimization</div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-blue-900">Revenue Impact</span>
                    <span className="font-bold text-blue-900">$50K</span>
                  </div>
                  <div className="text-xs text-blue-700">Faster onboarding</div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-purple-900">Risk Reduction</span>
                    <span className="font-bold text-purple-900">$20K</span>
                  </div>
                  <div className="text-xs text-purple-700">Error mitigation</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total Value</span>
                  <span className="text-2xl font-bold text-foreground">$245K</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-700" />
                <h3 className="font-semibold text-green-900">Value Commit Preview</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-green-700 mb-1">KPI Target</div>
                  <div className="text-sm font-semibold text-green-900">85% time reduction</div>
                </div>
                <div>
                  <div className="text-xs text-green-700 mb-1">Target Date</div>
                  <div className="text-sm font-semibold text-green-900">Q2 2026</div>
                </div>
                <div>
                  <div className="text-xs text-green-700 mb-1">Committed Value</div>
                  <div className="text-lg font-bold text-green-900">$245,000</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
