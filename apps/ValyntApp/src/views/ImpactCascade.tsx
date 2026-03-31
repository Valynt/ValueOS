import { ChevronDown, Edit2, GripVertical, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import AgentBadge from '../components/Agents/AgentBadge';
import ChallengeCard from '../components/Agents/ChallengeCard';
import ConfidenceIndicator from '../components/Agents/ConfidenceIndicator';
import Header from '../components/common/Header';
import { Challenge } from '../types/agents';

const drivers = [
  { label: 'Revenue Growth', value: '$8.2M', change: '+12%', type: 'revenue', confidence: 89 },
  { label: 'Cost Reduction', value: '$4.3M', change: '+8%', type: 'cost', confidence: 94 },
];

const subDrivers = [
  { label: 'New Customer Acquisition', value: '$5.1M', parent: 'revenue', confidence: 82 },
  { label: 'Expansion Revenue', value: '$3.1M', parent: 'revenue', confidence: 91 },
  { label: 'OpEx Efficiency', value: '$2.8M', parent: 'cost', confidence: 96, ai: true },
  { label: 'Risk Mitigation', value: '$1.5M', parent: 'cost', confidence: 78 },
];

const features = [
  { id: 1, name: 'Automated Reporting', icon: '📊' },
  { id: 2, name: 'Real-time Dashboard', icon: '📈' },
  { id: 3, name: 'Process Automation', icon: '⚙️' },
];

const mockChallenge: Challenge = {
  id: '1',
  claim: 'OpEx Efficiency projected at $2.8M annual savings',
  counterArgument: 'Industry benchmarks suggest brownfield automation deployments typically achieve 12-15% efficiency gains, not the 20% assumed in this model. Additionally, change management costs are underestimated by approximately 30%.',
  resolution: 'Model adjusted to use 15% efficiency gain with updated change management budget. NPV remains positive at $2.1M, with higher confidence score.',
  severity: 'medium',
  status: 'resolved'
};

export function ImpactCascade() {
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [draggedFeature, setDraggedFeature] = useState<number | null>(null);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <Header
        title="Phase 2: Value Architecture"
        breadcrumbs={['Acme Corp', 'Architecture']}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <AgentBadge agentId="value-mapping" size="md" />
            <AgentBadge agentId="target" size="md" />
            <div className="inline-flex rounded-md border border-border p-0.5 ml-4">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${viewMode === 'tree'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Tree View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${viewMode === 'table'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Table View
              </button>
            </div>
          </div>

          <button className="btn btn-outline h-8 px-3 text-sm">
            Filters
            <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="card p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <AgentBadge agentId="value-mapping" size="sm" showName={false} />
                <h3 className="font-semibold text-sm">Feature Library</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Drag features onto the value tree to auto-map connections
              </p>
              <div className="space-y-2">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    draggable
                    onDragStart={() => setDraggedFeature(feature.id)}
                    onDragEnd={() => setDraggedFeature(null)}
                    className={`p-3 bg-secondary/50 rounded-lg border border-border cursor-grab active:cursor-grabbing flex items-center gap-2 hover:bg-secondary transition-colors ${draggedFeature === feature.id ? 'opacity-50' : ''
                      }`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm text-foreground">{feature.name}</span>
                  </div>
                ))}
                <button className="w-full p-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Feature
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div
              className="card p-8"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => setDraggedFeature(null)}
            >
              <div className="flex flex-col items-center">
                <div className="px-6 py-4 bg-primary text-primary-foreground rounded-xl shadow-lg mb-2 text-center">
                  <div className="text-sm opacity-80 mb-1">Total Impact</div>
                  <div className="text-3xl font-bold">$12.5M</div>
                </div>
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-16 bg-primary h-1.5 rounded-full"></div>
                  <span className="text-xs text-primary font-medium">92% confidence</span>
                </div>

                <div className="w-px h-8 bg-border mb-8"></div>

                <div className="grid grid-cols-2 gap-12 w-full">
                  {drivers.map((d, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-full card p-4 border-l-4 border-l-primary mb-2">
                        <div className="text-sm text-muted-foreground mb-1">{d.label}</div>
                        <ConfidenceIndicator
                          value={d.value as unknown as number}
                          confidence={d.confidence}
                          label={d.change}
                          size="sm"
                        />
                      </div>
                      <div className="w-px h-4 bg-border mb-4"></div>
                      <div className="space-y-2 w-full">
                        {subDrivers.filter(s => s.parent === d.type).map((sub, j) => (
                          <div key={j} className="card p-3">
                            <div className="flex justify-between items-center text-sm mb-2">
                              <div className="flex items-center gap-2">
                                <span>{sub.label}</span>
                                {sub.ai && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                                    AI-mapped
                                  </span>
                                )}
                              </div>
                              <span className="font-medium">{sub.value}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-secondary rounded-full h-1 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${sub.confidence}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{sub.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ChallengeCard challenge={mockChallenge} />
          </div>

          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <AgentBadge agentId="integrity" size="sm" showName={false} />
                <h3 className="font-semibold">Validation Status</h3>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="text-xs font-semibold text-primary uppercase mb-1">Logic Coverage</div>
                  <div className="text-2xl font-bold text-primary">98%</div>
                  <p className="text-xs text-muted-foreground mt-1">All value paths validated</p>
                </div>

                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Data Sources</div>
                  <div className="text-lg font-bold text-foreground">12</div>
                  <p className="text-xs text-muted-foreground mt-1">SEC, CRM, Industry benchmarks</p>
                </div>

                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Challenges</div>
                  <div className="text-lg font-bold text-foreground">1 resolved</div>
                  <p className="text-xs text-muted-foreground mt-1">0 pending review</p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button className="w-full btn btn-outline h-9 text-sm justify-start px-3">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Assumptions
                </button>
                <button className="w-full btn btn-outline h-9 text-sm justify-start px-3">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View History
                </button>
                <button className="w-full btn btn-primary h-9 text-sm justify-start px-3">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run Validation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export { ImpactCascade as default } from './ImpactCascade';
