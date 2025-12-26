import { useState } from 'react';
import {
  Building2,
  Calculator,
  ChevronRight,
  Cpu,
  Eye,
  GitBranch,
  Lightbulb,
  Loader2,
  Rocket,
  Send,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import { AgentHandoff, AgentMessage, AGENTS, AgentType, Challenge } from '../../types/agents';
import LogicTrace from './LogicTrace';
import RichAgentWidget from './RichAgentWidget';
import ChallengeCard from './ChallengeCard';

const iconMap: Record<string, React.ElementType> = {
  Building2,
  Lightbulb,
  Target,
  GitBranch,
  Calculator,
  ShieldCheck,
  Swords,
  TrendingUp,
  Rocket,
  Cpu
};

const phaseAgentMap: Record<string, AgentType> = {
  '/': 'orchestrator',
  '/canvas': 'value-mapping',
  '/calculator': 'financial-modeling',
  '/cascade': 'target',
  '/agents': 'orchestrator',
  '/dashboard': 'realization'
};

const mockMessages: AgentMessage[] = [
  {
    id: '1',
    agentId: 'company-intelligence',
    content: 'Analyzed Acme Corp\'s 10-K filing. Found 3 key risk factors affecting operational efficiency.',
    timestamp: new Date(Date.now() - 300000),
    type: 'insight',
    confidence: 92,
    sources: [
      { type: 'document', label: 'ACME 10-K 2024', reference: 'Page 45-48', confidence: 98 },
      { type: 'database', label: 'Industry Benchmarks', reference: 'Manufacturing Sector', confidence: 94 },
      { type: 'document', label: 'Q3 Earnings Call', reference: 'Transcript', confidence: 89 }
    ],
    constraints: ['Conservative risk model', 'Peer comparison filter']
  },
  {
    id: '2',
    agentId: 'opportunity',
    content: 'Based on Intel findings, identified manufacturing automation as high-value opportunity.',
    timestamp: new Date(Date.now() - 240000),
    type: 'action',
    confidence: 87,
    sources: [
      { type: 'model', label: 'Opportunity Scoring Model v2.1', confidence: 91 },
      { type: 'database', label: 'Historical Win Data', confidence: 85 }
    ]
  },
  {
    id: '3',
    agentId: 'financial-modeling',
    content: 'I can adjust the efficiency assumption. What target would you like?',
    timestamp: new Date(Date.now() - 180000),
    type: 'widget',
    widget: {
      type: 'slider',
      config: {
        type: 'slider',
        label: 'Efficiency Gain Assumption',
        min: 5,
        max: 35,
        value: 20,
        unit: '%',
        suggestion: 15
      }
    }
  },
  {
    id: '4',
    agentId: 'adversarial',
    content: 'Automation ROI assumes 20% efficiency gain',
    timestamp: new Date(Date.now() - 120000),
    type: 'challenge',
    metadata: {
      counterArgument: 'Industry benchmarks from Gartner 2024 suggest 12-15% is more realistic for brownfield deployments. Only greenfield implementations typically achieve 20%+.',
      severity: 'medium'
    }
  },
  {
    id: '5',
    agentId: 'integrity',
    content: 'All logic paths verified. Confidence score: 94%. No circular dependencies detected.',
    timestamp: new Date(Date.now() - 60000),
    type: 'validation',
    confidence: 94,
    sources: [
      { type: 'model', label: 'Logic Validator v3.0', confidence: 99 },
      { type: 'model', label: 'Dependency Checker', confidence: 100 }
    ]
  }
];

const mockHandoff: AgentHandoff = {
  from: 'opportunity',
  to: 'financial-modeling',
  reason: 'Opportunity validated, ready for financial modeling',
  timestamp: new Date()
};

interface AgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

export default function AgentSidebar({ isOpen, onClose, currentPath = '/' }: AgentSidebarProps) {
  const [messages] = useState<AgentMessage[]>(mockMessages);
  const [input, setInput] = useState('');
  const [activeHandoff, setActiveHandoff] = useState<AgentHandoff | null>(mockHandoff);
  const [isProcessing, setIsProcessing] = useState(false);
  const [challenges, setChallenges] = useState<Record<string, Challenge['status']>>({});

  const activeAgent = phaseAgentMap[currentPath] || 'orchestrator';
  const activeAgentData = AGENTS[activeAgent];

  const handleSend = () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setInput('');
    }, 1500);
  };

  const getAgentIcon = (agentId: AgentType) => {
    const agent = AGENTS[agentId];
    const IconComponent = iconMap[agent.icon];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const getMessageTypeStyle = (type: AgentMessage['type']) => {
    switch (type) {
      case 'challenge':
        return 'border-l-neutral-500 bg-neutral-800/30';
      case 'validation':
        return 'border-l-primary bg-primary/5';
      case 'handoff':
        return 'border-l-primary bg-primary/5';
      case 'widget':
        return 'border-l-primary bg-primary/5';
      default:
        return 'border-l-border';
    }
  };

  const getAuthorityBadge = (agentId: AgentType) => {
    const agent = AGENTS[agentId];
    const config = {
      read: { label: 'Read', class: 'bg-primary/20 text-primary' },
      suggest: { label: 'Suggest', class: 'bg-neutral-700/50 text-neutral-400' },
      write: { label: 'Write', class: 'bg-primary/20 text-primary' },
      govern: { label: 'Govern', class: 'bg-primary/20 text-primary' }
    };
    return config[agent.authority];
  };

  const handleChallengeResolve = (id: string) => {
    setChallenges(prev => ({ ...prev, [id]: 'resolved' }));
  };

  const handleChallengeAcknowledge = (id: string) => {
    setChallenges(prev => ({ ...prev, [id]: 'acknowledged' }));
  };

  if (!isOpen) return null;

  const ActiveIcon = iconMap[activeAgentData.icon];

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Agent Activity</h3>
            <p className="text-xs text-muted-foreground">5 agents active</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`px-4 py-2.5 border-b border-border flex items-center gap-2 ${activeAgentData.color.replace('bg-', 'bg-')}/10`}>
        <div className={`w-5 h-5 rounded ${activeAgentData.color} flex items-center justify-center text-white`}>
          {ActiveIcon && <ActiveIcon className="w-3 h-3" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{activeAgentData.name}</span> is observing
            </span>
          </div>
        </div>
        <span className={`text-[8px] px-1.5 py-0.5 rounded ${getAuthorityBadge(activeAgent).class}`}>
          {getAuthorityBadge(activeAgent).label}
        </span>
      </div>

      {activeHandoff && (
        <div className="p-3 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-primary font-medium">Agent Handoff</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`px-2 py-1 rounded text-xs font-medium ${AGENTS[activeHandoff.from].color} text-white`}>
              {AGENTS[activeHandoff.from].shortName}
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <div className={`px-2 py-1 rounded text-xs font-medium ${AGENTS[activeHandoff.to].color} text-white`}>
              {AGENTS[activeHandoff.to].shortName}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{activeHandoff.reason}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const agent = AGENTS[message.agentId];
          const authorityBadge = getAuthorityBadge(message.agentId);

          if (message.type === 'challenge') {
            const challenge: Challenge = {
              id: message.id,
              claim: message.content,
              counterArgument: (message.metadata?.counterArgument as string) || 'No additional context available.',
              severity: (message.metadata?.severity as Challenge['severity']) || 'medium',
              status: challenges[message.id] || 'pending'
            };

            return (
              <div key={message.id}>
                <ChallengeCard
                  challenge={challenge}
                  onResolve={handleChallengeResolve}
                  onAcknowledge={handleChallengeAcknowledge}
                />
                <div className="text-[10px] text-muted-foreground/60 mt-1.5 pl-7">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`border-l-2 pl-3 py-2 ${getMessageTypeStyle(message.type)}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-5 h-5 rounded ${agent.color} flex items-center justify-center text-white`}>
                  {getAgentIcon(message.agentId)}
                </div>
                <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                <span className={`text-[8px] px-1 py-0.5 rounded ${authorityBadge.class}`}>
                  {authorityBadge.label}
                </span>
                {message.confidence && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground ml-auto">
                    {message.confidence}% conf
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {message.content}
              </p>

              {message.widget && (
                <div className="mt-3">
                  <RichAgentWidget
                    config={message.widget.config as any}
                    onConfirm={(value) => console.log('Confirmed:', value)}
                    onCancel={() => console.log('Cancelled')}
                  />
                </div>
              )}

              {message.sources && message.sources.length > 0 && !message.widget && (
                <LogicTrace
                  sources={message.sources}
                  constraints={message.constraints}
                  modelVersion="ValueOS v2.4"
                />
              )}

              <div className="text-[10px] text-muted-foreground/60 mt-1.5">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Orchestrator routing request...</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask the agents..."
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="p-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Requests are routed through the Orchestrator to the appropriate agent
        </p>
      </div>
    </div>
  );
}
