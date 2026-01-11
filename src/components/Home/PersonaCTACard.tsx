/**
 * PersonaCTACard Component
 *
 * Displays persona-specific call-to-action cards on the Home Hub.
 * Dynamically adapts content based on user workload and context.
 */

import {
  Lightbulb,
  Target,
  TrendingUp,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type Persona = "strategist" | "closer" | "grower";

export interface PersonaCTA {
  id: string;
  persona: Persona;
  title: string;
  description: string;
  action: string;
  actionPath: string;
  priority: "high" | "medium" | "low";
  metric?: {
    value: string | number;
    label: string;
    trend?: "up" | "down" | "neutral";
  };
  dueDate?: string;
  isNew?: boolean;
}

interface PersonaCTACardProps {
  cta: PersonaCTA;
  onClick: (path: string) => void;
  className?: string;
}

export function PersonaCTACard({ cta, onClick, className }: PersonaCTACardProps) {
  const personaConfig = {
    strategist: {
      icon: Lightbulb,
      color: "purple",
      gradient: "from-purple-500/20 to-purple-600/5",
      border: "border-purple-500/30",
      accent: "text-purple-400",
      badge: "bg-purple-500/10 text-purple-400",
    },
    closer: {
      icon: Target,
      color: "blue",
      gradient: "from-blue-500/20 to-blue-600/5",
      border: "border-blue-500/30",
      accent: "text-blue-400",
      badge: "bg-blue-500/10 text-blue-400",
    },
    grower: {
      icon: TrendingUp,
      color: "green",
      gradient: "from-green-500/20 to-green-600/5",
      border: "border-green-500/30",
      accent: "text-green-400",
      badge: "bg-green-500/10 text-green-400",
    },
  };

  const config = personaConfig[cta.persona];
  const Icon = config.icon;

  const priorityConfig = {
    high: {
      indicator: "bg-red-500",
      label: "Urgent",
    },
    medium: {
      indicator: "bg-amber-500",
      label: "Important",
    },
    low: {
      indicator: "bg-gray-500",
      label: "When ready",
    },
  };

  return (
    <button
      onClick={() => onClick(cta.actionPath)}
      className={cn(
        "w-full text-left rounded-xl border p-4",
        "bg-gradient-to-br",
        config.gradient,
        config.border,
        "hover:border-opacity-60 hover:shadow-lg",
        "transition-all duration-200",
        "group",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg",
            "flex items-center justify-center",
            config.badge
          )}
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {cta.isNew && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                NEW
              </span>
            )}
            {cta.priority === "high" && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                <AlertCircle className="w-3 h-3" />
                Urgent
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold text-white mb-1 line-clamp-1">{cta.title}</h4>
          <p className="text-xs text-gray-400 line-clamp-2 mb-3">{cta.description}</p>

          {/* Metric */}
          {cta.metric && (
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("text-lg font-bold", config.accent)}>{cta.metric.value}</span>
              <span className="text-xs text-gray-500">{cta.metric.label}</span>
              {cta.metric.trend && <TrendIndicator trend={cta.metric.trend} />}
            </div>
          )}

          {/* Due date */}
          {cta.dueDate && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
              <Clock className="w-3.5 h-3.5" />
              <span>Due {cta.dueDate}</span>
            </div>
          )}

          {/* Action */}
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              config.accent,
              "group-hover:gap-2.5 transition-all duration-200"
            )}
          >
            <span>{cta.action}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Priority indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-2 h-2 rounded-full",
            priorityConfig[cta.priority].indicator
          )}
          title={priorityConfig[cta.priority].label}
        />
      </div>
    </button>
  );
}

interface TrendIndicatorProps {
  trend: "up" | "down" | "neutral";
}

function TrendIndicator({ trend }: TrendIndicatorProps) {
  if (trend === "up") {
    return (
      <span className="flex items-center text-green-400 text-xs">
        <TrendingUp className="w-3 h-3" />
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="flex items-center text-red-400 text-xs rotate-180">
        <TrendingUp className="w-3 h-3" />
      </span>
    );
  }
  return null;
}

interface PersonaCTAListProps {
  ctas: PersonaCTA[];
  onCTAClick: (path: string) => void;
  maxItems?: number;
  className?: string;
}

export function PersonaCTAList({ ctas, onCTAClick, maxItems = 4, className }: PersonaCTAListProps) {
  const sortedCTAs = [...ctas]
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, maxItems);

  if (sortedCTAs.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-sm text-gray-400">You're all caught up! No pending actions.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {sortedCTAs.map((cta) => (
        <PersonaCTACard key={cta.id} cta={cta} onClick={onCTAClick} />
      ))}
    </div>
  );
}

export default PersonaCTACard;
