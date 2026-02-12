import { useState } from 'react';
import Header from '../components/Layout/Header';
import { AlertTriangle, Bell, ChevronRight, FileText, Globe, Package, X } from 'lucide-react';
import AgentBadge from '../components/Agents/AgentBadge';

const kpiCards = [
  { label: 'Realization Rate', value: '108%', subtext: '+8% vs Plan', highlight: true, confidence: 94 },
  { label: 'Customer Health', value: '88', subtext: '/100', progress: 88, confidence: 91 },
  { label: 'Active Alerts', value: '3', subtext: '1 urgent', alert: true },
];

const activityLog = [
  { time: '04:33 AM', text: 'API Update: Time Saved +01S', type: 'success', agent: 'realization' as const },
  { time: '03:25 AM', text: 'System: Data sync complete', type: 'info', agent: 'integrity' as const },
  { time: 'Yesterday', text: 'Milestone: V1.0 Achieved', type: 'milestone', agent: 'realization' as const },
  { time: '2 days ago', text: 'Alert: Adoption below threshold', type: 'warning', agent: 'realization' as const },
];

const expansionOpportunities = [
  {
    id: 1,
    icon: Globe,
    title: 'EMEA Expansion',
    description: 'Replicate efficiency model in German facility',
    value: '$1.8M',
    confidence: 87,
    isNew: true
  },
  {
    id: 2,
    icon: Package,
    title: 'Supply Chain Add-on',
    description: 'Cross-sell MRO inventory optimization',
    value: '$750K',
    confidence: 92,
    isNew: true
  },
];

export default function AgentDashboard() {
  const [dismissedNotifications, _setDismissedNotifications] = useState<number[]>([]);
  const [showExpansionPanel, setShowExpansionPanel] = useState(true);

  const activeNotifications = expansionOpportunities.filter(
    opp => opp.isNew && !dismissedNotifications.includes(opp.id)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <Header
        title="Phase 4: Value Realization"
        breadcrumbs={['Acme Corp', 'Monitoring']}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <AgentBadge agentId="realization" size="md" />
            <AgentBadge agentId="expansion" size="md" pulse={activeNotifications.length > 0} />
          </div>

          {activeNotifications.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg">
              <Bell className="w-4 h-4 text-fuchsia-500" />
              <span className="text-sm text-fuchsia-400">
                {activeNotifications.length} new expansion {activeNotifications.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            </div>
          )}
        </div>

        {activeNotifications.length > 0 && showExpansionPanel && (
          <div className="mb-6 p-4 bg-gradient-to-r from-fuchsia-500/10 to-transparent border border-fuchsia-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AgentBadge agentId="expansion" size="sm" />
                <h3 className="font-semibold text-foreground">New Opportunities Detected</h3>
              </div>
              <button
                onClick={() => setShowExpansionPanel(false)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {activeNotifications.map((opp) => (
                <div
                  key={opp.id}
                  className="p-4 bg-card border border-border rounded-lg hover:border-fuchsia-500/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-fuchsia-500/20 rounded-lg">
                      <opp.icon className="w-4 h-4 text-fuchsia-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{opp.title}</span>
                        <span className="text-green-500 font-semibold">{opp.value} ARR</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{opp.description}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-secondary rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-fuchsia-500 h-full rounded-full"
                            style={{ width: `${opp.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-fuchsia-400">{opp.confidence}% confidence</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 mb-8">
          {kpiCards.map((kpi, i) => (
            <div key={i} className={`card p-6 ${kpi.alert ? 'border-yellow-500/50' : ''} ${kpi.highlight ? 'border-green-500/50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">{kpi.label}</div>
                {kpi.confidence && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                    {kpi.confidence}%
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-foreground mb-2">{kpi.value}</div>
              {kpi.progress ? (
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className="bg-foreground h-full" style={{ width: `${kpi.progress}%` }}></div>
                </div>
              ) : (
                <div className={`text-xs ${kpi.highlight ? 'text-green-500' : kpi.alert ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {kpi.subtext}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <AgentBadge agentId="realization" size="sm" showName={false} />
                <h3 className="font-semibold">Value Trajectory</h3>
              </div>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>

            <div className="h-48 flex items-end justify-between gap-2">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-foreground rounded-t"
                      style={{ height: `${40 + i * 20}px` }}
                    ></div>
                    <div
                      className="w-full bg-secondary rounded-t opacity-50"
                      style={{ height: `${50 + i * 15}px`, marginTop: '-4px' }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{month}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-foreground rounded"></div>
                <span className="text-muted-foreground">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-secondary rounded"></div>
                <span className="text-muted-foreground">Plan</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4 border-yellow-500/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Proactive Alert</span>
                <AgentBadge agentId="realization" size="sm" showName={false} />
                <span className="text-xs text-muted-foreground ml-auto">Just now</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Adoption Rate (28%) is below threshold (30%) for Day 60.
              </p>
              <div className="flex gap-2">
                <button className="btn btn-primary h-8 px-3 text-xs flex-1">
                  Trigger Nudge
                </button>
                <button className="btn btn-outline h-8 px-3 text-xs">
                  Dismiss
                </button>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Activity Log</span>
                <button className="text-xs text-muted-foreground hover:text-foreground">
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {activityLog.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                        log.type === 'success' ? 'bg-green-500' :
                        log.type === 'warning' ? 'bg-yellow-500' :
                        log.type === 'milestone' ? 'bg-foreground' : 'bg-muted-foreground'
                      }`}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">{log.time}</div>
                        <AgentBadge agentId={log.agent} size="sm" showName={false} />
                      </div>
                      <div className="text-xs text-foreground truncate">{log.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <AgentBadge agentId="expansion" size="sm" showName={false} />
              <h3 className="font-semibold">All Expansion Opportunities</h3>
            </div>
            <div className="space-y-4">
              {expansionOpportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <opportunity.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{opportunity.title}</span>
                      {opportunity.isNew && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-fuchsia-500/20 text-fuchsia-400 rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-green-500 text-sm font-medium">{opportunity.value} ARR</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{opportunity.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">QBR Preparation</h3>
              <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-500 rounded-full">
                Ready
              </span>
            </div>

            <div className="text-xs text-muted-foreground mb-4">Next QBR: Jan 15, 2025</div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Value Realization Deck', 'Expansion Proposal', 'Health Score Report'].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/30 text-xs text-muted-foreground">
                  <span className="text-green-500 mr-1">&#10003;</span>
                  {item}
                </div>
              ))}
              <div className="p-3 rounded-lg border border-yellow-500/50 text-xs text-yellow-500">
                <span className="mr-1">&#9684;</span>
                Risk Mitigation Plan
              </div>
            </div>

            <button className="w-full btn btn-primary h-9 text-sm">
              <FileText className="w-4 h-4 mr-2" />
              Generate QBR Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
