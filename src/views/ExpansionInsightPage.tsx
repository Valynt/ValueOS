import React, { useState } from 'react';
import { TrendingUp, Target, Zap, AlertCircle, CheckCircle2, ArrowRight, DollarSign, Users } from 'lucide-react';
import { MetricCard } from '../components/Components/MetricCard';
import { InteractiveChart } from '../components/Components/InteractiveChart';
import { NarrativeBlock } from '../components/Components/NarrativeBlock';

export const ExpansionInsightPage: React.FC = () => {
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(null);

  const gapAnalysisData = [
    { name: 'Realized', value: 180, id: 'realized', color: '#10b981' },
    { name: 'Gap', value: 65, id: 'gap', color: '#ef4444' }
  ];

  const expansionOpportunities = [
    {
      id: '1',
      type: 'upsell',
      title: 'Advanced Analytics Module',
      description: 'Real-time dashboards and predictive insights',
      opportunityScore: 87,
      estimatedValue: 85000,
      confidence: 'high',
      status: 'proposed',
      improvements: ['Enhanced Reporting', 'Predictive Analytics', 'Custom Dashboards']
    },
    {
      id: '2',
      type: 'cross_sell',
      title: 'Mobile App Access',
      description: 'iOS and Android apps for field teams',
      opportunityScore: 72,
      estimatedValue: 45000,
      confidence: 'medium',
      status: 'under_review',
      improvements: ['Mobile Access', 'Offline Mode', 'Push Notifications']
    },
    {
      id: '3',
      type: 'optimization',
      title: 'Additional User Licenses',
      description: 'Expand to 5 more departments',
      opportunityScore: 65,
      estimatedValue: 32000,
      confidence: 'high',
      status: 'proposed',
      improvements: ['Broader Adoption', 'Department Coverage', 'Seat Expansion']
    }
  ];

  const kpiPerformance = [
    { name: 'Q1', target: 100, actual: 95, id: 'q1' },
    { name: 'Q2', target: 100, actual: 102, id: 'q2' },
    { name: 'Q3', target: 100, actual: 88, id: 'q3' },
    { name: 'Q4', target: 100, actual: 92, id: 'q4' }
  ];

  const getOpportunityTypeColor = (type: string) => {
    switch (type) {
      case 'upsell': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cross_sell': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'optimization': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-700 bg-green-50';
      case 'medium': return 'text-amber-700 bg-amber-50';
      case 'low': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expansion Insights</h1>
              <p className="text-gray-600 mt-2">Identify upsell opportunities and optimize value realization</p>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
              Generate Proposal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Value Realized"
            value="73%"
            trend="up"
            change="$180K of $245K"
          />
          <MetricCard
            title="Expansion Score"
            value="87"
            trend="up"
            change="High potential"
          />
          <MetricCard
            title="Total Opportunity"
            value="$162K"
            trend="up"
            change="3 opportunities"
          />
          <MetricCard
            title="Time to Close"
            value="45 days"
            trend="neutral"
            change="Avg estimate"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-6">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">Value Gap Analysis</h2>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Current Performance</div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-gray-900">$180K</span>
                    <span className="text-sm text-gray-500">of $245K</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '73%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Expansion Potential</div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-blue-900">$162K</span>
                    <span className="text-sm text-gray-500">additional</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '87%' }}></div>
                  </div>
                </div>
              </div>

              <InteractiveChart
                title="Realized vs Committed Value"
                type="bar"
                data={gapAnalysisData}
                config={{ showValue: true, showLegend: true }}
              />

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 mb-1">Performance Gap Identified</h4>
                    <p className="text-sm text-amber-700">
                      27% of committed value ($65K) remains unrealized. Analysis shows adoption challenges in 2 departments and underutilization of advanced features.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-6">
                <Zap className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Expansion Opportunities</h2>
              </div>

              <div className="space-y-4">
                {expansionOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className={`p-5 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedOpportunity === opp.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => setSelectedOpportunity(opp.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{opp.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded border ${getOpportunityTypeColor(opp.type)}`}>
                            {opp.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{opp.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {opp.improvements.map((imp, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                              {imp}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ${(opp.estimatedValue / 1000).toFixed(0)}K
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Est. Value</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-xs text-gray-500">Score: </span>
                          <span className="text-sm font-semibold text-gray-900">{opp.opportunityScore}/100</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Confidence: </span>
                          <span className={`text-sm font-semibold ${getConfidenceColor(opp.confidence)}`}>
                            {opp.confidence}
                          </span>
                        </div>
                      </div>
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
                        <span>View Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <NarrativeBlock
              title="Executive Summary"
              content="Customer has achieved **73% of committed value** ($180K realized of $245K target) after 9 months. **Gap drivers**: (1) Limited adoption in Sales and Finance departments, (2) Advanced automation features underutilized. **Expansion opportunity**: Strong engagement from power users indicates **87% probability** of upsell success. Recommend **Advanced Analytics Module** ($85K ARR) to address reporting gaps identified in QBRs."
              isEditable={true}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Target className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">KPI Performance</h2>
              </div>

              <div className="space-y-4">
                {kpiPerformance.map((q) => (
                  <div key={q.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{q.name}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${q.actual >= q.target ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${(q.actual / q.target) * 100}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-semibold ${q.actual >= q.target ? 'text-green-700' : 'text-amber-700'}`}>
                        {q.actual}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Avg Performance</span>
                  <span className="font-semibold text-gray-900">94%</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Adoption Metrics</h2>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-green-900">Active Users</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-900">85%</div>
                  <div className="text-xs text-green-700 mt-1">Above target (80%)</div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-amber-900">Feature Usage</span>
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-900">62%</div>
                  <div className="text-xs text-amber-700 mt-1">Below target (75%)</div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-blue-900">Dept Coverage</span>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-900">6 / 8</div>
                  <div className="text-xs text-blue-700 mt-1">Room to expand</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center space-x-2 mb-4">
                <DollarSign className="h-5 w-5 text-green-700" />
                <h3 className="font-semibold text-green-900">Recommended Action</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-green-700 mb-1">Priority</div>
                  <div className="text-sm font-semibold text-green-900">Advanced Analytics Module</div>
                </div>
                <div>
                  <div className="text-xs text-green-700 mb-1">Estimated Value</div>
                  <div className="text-lg font-bold text-green-900">$85,000 ARR</div>
                </div>
                <div>
                  <div className="text-xs text-green-700 mb-1">Close Probability</div>
                  <div className="text-sm font-semibold text-green-900">87% (High)</div>
                </div>
                <button className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm">
                  Create Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
