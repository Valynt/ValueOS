/**
 * PersonaSelector Component
 *
 * Allows selection of buyer persona for tailored business case generation.
 * Different personas have different priorities and value drivers.
 */

import React from 'react';
import {
  Briefcase,
  Check,
  DollarSign,
  Settings,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type BuyerPersona = 'economic' | 'technical' | 'user' | 'champion';

export interface PersonaSelectorProps {
  /** Currently selected persona */
  selectedPersona?: BuyerPersona;
  /** Callback when persona is selected */
  onSelectPersona: (persona: BuyerPersona) => void;
  /** Whether selection is disabled */
  disabled?: boolean;
}

interface PersonaConfig {
  id: BuyerPersona;
  label: string;
  title: string;
  description: string;
  priorities: string[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PERSONAS: PersonaConfig[] = [
  {
    id: 'economic',
    label: 'Economic Buyer',
    title: 'CFO / VP Finance',
    description: 'Focused on ROI, cost reduction, and financial impact',
    priorities: ['ROI', 'Payback Period', 'Cost Savings', 'Risk Mitigation'],
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'technical',
    label: 'Technical Buyer',
    title: 'CTO / IT Director',
    description: 'Focused on implementation, integration, and technical fit',
    priorities: ['Integration', 'Security', 'Scalability', 'Performance'],
    icon: Settings,
    color: 'blue',
  },
  {
    id: 'user',
    label: 'User Buyer',
    title: 'End User / Manager',
    description: 'Focused on usability, productivity, and daily impact',
    priorities: ['Ease of Use', 'Time Savings', 'Productivity', 'Training'],
    icon: Users,
    color: 'purple',
  },
  {
    id: 'champion',
    label: 'Champion',
    title: 'Internal Advocate',
    description: 'Focused on building internal consensus and momentum',
    priorities: ['Quick Wins', 'Proof Points', 'Stakeholder Buy-in', 'Timeline'],
    icon: Briefcase,
    color: 'amber',
  },
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    icon: 'bg-green-100 text-green-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    icon: 'bg-blue-100 text-blue-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    icon: 'bg-purple-100 text-purple-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: 'bg-amber-100 text-amber-600',
  },
};

export function PersonaSelector({
  selectedPersona,
  onSelectPersona,
  disabled = false,
}: PersonaSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-1">Target Persona</h3>
        <p className="text-xs text-muted-foreground">
          Select the primary decision-maker to tailor the business case
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => {
          const isSelected = selectedPersona === persona.id;
          const colors = COLOR_CLASSES[persona.color];
          const Icon = persona.icon;

          return (
            <button
              key={persona.id}
              onClick={() => !disabled && onSelectPersona(persona.id)}
              disabled={disabled}
              className={cn(
                'relative p-4 rounded-lg border-2 text-left transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected && [colors.bg, colors.border],
                !isSelected && 'border-border hover:border-muted-foreground/50 hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className={cn(
                  'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center',
                  colors.icon
                )}>
                  <Check className="w-3 h-3" />
                </div>
              )}

              {/* Icon */}
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
                isSelected ? colors.icon : 'bg-muted text-muted-foreground'
              )}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div>
                <p className={cn(
                  'font-medium',
                  isSelected ? colors.text : 'text-foreground'
                )}>
                  {persona.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {persona.title}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected persona details */}
      {selectedPersona && (
        <PersonaDetails persona={PERSONAS.find((p) => p.id === selectedPersona)!} />
      )}
    </div>
  );
}

interface PersonaDetailsProps {
  persona: PersonaConfig;
}

function PersonaDetails({ persona }: PersonaDetailsProps) {
  const colors = COLOR_CLASSES[persona.color];

  return (
    <Card className={cn('p-4', colors.bg, 'border', colors.border)}>
      <p className="text-sm text-muted-foreground mb-2">{persona.description}</p>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Key Priorities:</p>
        <div className="flex flex-wrap gap-1">
          {persona.priorities.map((priority) => (
            <span
              key={priority}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                colors.icon
              )}
            >
              {priority}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Compact version for inline use
 */
export function PersonaSelectorCompact({
  selectedPersona,
  onSelectPersona,
  disabled = false,
}: PersonaSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {PERSONAS.map((persona) => {
        const isSelected = selectedPersona === persona.id;
        const colors = COLOR_CLASSES[persona.color];
        const Icon = persona.icon;

        return (
          <button
            key={persona.id}
            onClick={() => !disabled && onSelectPersona(persona.id)}
            disabled={disabled}
            className={cn(
              'p-2 rounded-lg border transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isSelected && [colors.bg, colors.border, colors.text],
              !isSelected && 'border-border hover:bg-muted/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={`${persona.label}: ${persona.description}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
