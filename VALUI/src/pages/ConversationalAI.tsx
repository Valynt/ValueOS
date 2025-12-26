import Header from '../components/Layout/Header';
import AgentBadge from '../components/Agents/AgentBadge';
import IntegrityStatusBar from '../components/Agents/IntegrityStatusBar';
import { AGENTS, AgentType } from '../types/agents';
import { Activity, Power, Settings } from 'lucide-react';

const agentsByPhase = {
  discovery: ['company-intelligence', 'opportunity'] as AgentType[],
  architecture: ['target', 'value-mapping'] as AgentType[],
  economics: ['financial-modeling'] as AgentType[],
  realization: ['realization', 'expansion'] as AgentType[],
  system: ['orchestrator', 'integrity', 'adversarial'] as AgentType[],
};

const agentStats = {
  'company-intelligence': { queries: 47, accuracy: 94 },
  'opportunity': { queries: 23, accuracy: 89 },
  'target': { queries: 31, accuracy: 92 },
  'value-mapping': { queries: 56, accuracy: 96 },
  'financial-modeling': { queries: 42, accuracy: 91 },
  'integrity': { queries: 128, accuracy: 99 },
  'adversarial': { queries: 18, accuracy: 87 },
  'realization': { queries: 34, accuracy: 93 },
  'expansion': { queries: 12, accuracy: 88 },
  'orchestrator': { queries: 256, accuracy: 98 },
};

export default function ConversationalAI() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <Header
        title="AI Collaborators"
        breadcrumbs={['System', 'Agents']}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <IntegrityStatusBar />
          </div>

          <div className="grid grid-cols-2 gap-8">
            {Object.entries(agentsByPhase).map(([phase, agentIds]) => (
              <div key={phase} className={phase === 'system' ? 'col-span-2' : ''}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  {phase === 'system' ? 'System Agents' : `${phase} Phase`}
                </h2>

                <div className={`grid gap-4 ${phase === 'system' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  {agentIds.map((agentId) => {
                    const agent = AGENTS[agentId];
                    const stats = agentStats[agentId];

                    return (
                      <div
                        key={agentId}
                        className="card p-5 hover:border-muted-foreground/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <AgentBadge agentId={agentId} size="lg" showDescription showAuthority />
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <span className="text-[10px] text-primary font-medium">Active</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="p-3 bg-secondary/50 rounded-lg">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                              Queries (24h)
                            </div>
                            <div className="text-lg font-bold text-foreground">{stats.queries}</div>
                          </div>
                          <div className="p-3 bg-secondary/50 rounded-lg">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                              Accuracy
                            </div>
                            <div className={`text-lg font-bold ${
                              stats.accuracy >= 95 ? 'text-primary' :
                              stats.accuracy >= 85 ? 'text-neutral-400' : 'text-neutral-500'
                            }`}>
                              {stats.accuracy}%
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="flex-1 btn btn-outline h-8 text-xs justify-center">
                            <Settings className="w-3.5 h-3.5 mr-1.5" />
                            Configure
                          </button>
                          <button className="btn btn-ghost h-8 px-3 text-xs text-muted-foreground">
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 card p-6 bg-secondary/30 border-dashed">
            <div className="text-center">
              <h3 className="font-semibold text-foreground mb-2">Agent Orchestration</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
                The Orchestrator automatically routes requests to the appropriate agents based on context.
                Use the persistent Agent Activity panel on the right to interact with the system.
              </p>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>10 agents active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary/70 rounded-full"></div>
                  <span>256 queries today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary/50 rounded-full"></div>
                  <span>98% system accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
