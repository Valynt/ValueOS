import {
  Building2,
  Calculator,
  Cpu,
  Eye,
  GitBranch,
  Lightbulb,
  MessageSquare,
  Pencil,
  Rocket,
  Shield,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp
} from 'lucide-react';
import { AGENTS, AgentType, AuthorityLevel } from '../../types/agents';

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

const authorityConfig: Record<AuthorityLevel, { icon: React.ElementType; label: string; color: string; border: string }> = {
  read: { icon: Eye, label: 'Read Only', color: 'text-primary', border: 'ring-primary/30' },
  suggest: { icon: MessageSquare, label: 'Can Suggest', color: 'text-neutral-400', border: 'ring-neutral-500/30' },
  write: { icon: Pencil, label: 'Can Modify', color: 'text-primary', border: 'ring-primary/30' },
  govern: { icon: Shield, label: 'Governance', color: 'text-primary', border: 'ring-primary/30' }
};

interface AgentBadgeProps {
  agentId: AgentType;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showDescription?: boolean;
  showAuthority?: boolean;
  pulse?: boolean;
}

export default function AgentBadge({
  agentId,
  size = 'md',
  showName = true,
  showDescription = false,
  showAuthority = false,
  pulse = false
}: AgentBadgeProps) {
  const agent = AGENTS[agentId];
  const IconComponent = iconMap[agent.icon];
  const authority = authorityConfig[agent.authority];
  const AuthorityIcon = authority.icon;

  const sizeClasses = {
    sm: {
      wrapper: 'gap-1.5',
      icon: 'w-4 h-4 p-0.5',
      iconSize: 'w-3 h-3',
      name: 'text-[10px]',
      desc: 'text-[9px]',
      authority: 'text-[8px]'
    },
    md: {
      wrapper: 'gap-2',
      icon: 'w-6 h-6 p-1',
      iconSize: 'w-4 h-4',
      name: 'text-xs',
      desc: 'text-[10px]',
      authority: 'text-[10px]'
    },
    lg: {
      wrapper: 'gap-2.5',
      icon: 'w-8 h-8 p-1.5',
      iconSize: 'w-5 h-5',
      name: 'text-sm',
      desc: 'text-xs',
      authority: 'text-[10px]'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={`inline-flex items-center ${classes.wrapper}`}>
      <div className={`relative rounded ${agent.color} ${classes.icon} flex items-center justify-center text-white ${showAuthority ? `ring-2 ${authority.border}` : ''}`}>
        {IconComponent && <IconComponent className={classes.iconSize} />}
        {pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
        )}
      </div>
      {(showName || showDescription || showAuthority) && (
        <div className="flex flex-col">
          {showName && (
            <span className={`font-medium text-foreground ${classes.name}`}>
              {agent.name}
            </span>
          )}
          {showDescription && (
            <span className={`text-muted-foreground ${classes.desc}`}>
              {agent.description}
            </span>
          )}
          {showAuthority && (
            <span className={`flex items-center gap-1 ${authority.color} ${classes.authority}`}>
              <AuthorityIcon className="w-2.5 h-2.5" />
              {authority.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
