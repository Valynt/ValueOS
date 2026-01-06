/**
 * Persona Selector Component
 * 
 * Allows selection of buyer persona to customize business case output.
 * Maps to appropriate templates and language for each stakeholder type.
 * 
 * EXPLAINABILITY: Each persona shows what they care about most
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

export type BuyerPersona = 'cfo' | 'vp_sales' | 'vp_product' | 'cto' | 'coo' | 'director_finance';

interface PersonaConfig {
  id: BuyerPersona;
  title: string;
  role: string;
  icon: string;
  focusAreas: string[];
  template: string;
  description: string;
}

const personas: PersonaConfig[] = [
  {
    id: 'cfo',
    title: 'CFO',
    role: 'Chief Financial Officer',
    icon: '💰',
    focusAreas: ['ROI', 'NPV', 'Cash Flow', 'Risk Analysis'],
    template: 'TrinityDashboard',
    description: 'Focuses on financial metrics, risk mitigation, and long-term value'
  },
  {
    id: 'vp_sales',
    title: 'VP Sales',
    role: 'Vice President of Sales',
    icon: '📈',
    focusAreas: ['Revenue Growth', 'Win Rates', 'Sales Efficiency', 'Pipeline'],
    template: 'ScenarioMatrix',
    description: 'Cares about revenue impact and sales team productivity'
  },
  {
    id: 'vp_product',
    title: 'VP Product',
    role: 'Vice President of Product',
    icon: '🎯',
    focusAreas: ['Feature Impact', 'User Adoption', 'Product Metrics', 'Innovation'],
    template: 'ImpactCascadeTemplate',
    description: 'Interested in product outcomes and customer value delivery'
  },
  {
    id: 'cto',
    title: 'CTO',
    role: 'Chief Technology Officer',
    icon: '⚙️',
    focusAreas: ['Technical Efficiency', 'System Performance', 'Integration', 'Scalability'],
    template: 'TechnicalDeepDive',
    description: 'Evaluates technical feasibility and operational efficiency'
  },
  {
    id: 'coo',
    title: 'COO',
    role: 'Chief Operating Officer',
    icon: '🔧',
    focusAreas: ['Operational Efficiency', 'Process Improvement', 'Cost Reduction', 'Quality'],
    template: 'OperationalImpact',
    description: 'Focuses on operational improvements and cost optimization'
  },
  {
    id: 'director_finance',
    title: 'Finance Director',
    role: 'Director of Finance',
    icon: '📊',
    focusAreas: ['Budget Impact', 'Cost Analysis', 'Financial Planning', 'Reporting'],
    template: 'TrinityDashboard',
    description: 'Concerned with budget allocation and financial reporting'
  }
];

interface PersonaSelectorProps {
  selectedPersona?: BuyerPersona;
  onSelectPersona: (persona: BuyerPersona) => void;
  disabled?: boolean;
}

export function PersonaSelector({ selectedPersona, onSelectPersona, disabled = false }: PersonaSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Who are you presenting to?</h3>
        <p className="text-sm text-muted-foreground">
          Select the primary decision maker to customize the business case for their priorities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => {
          const isSelected = selectedPersona === persona.id;

          return (
            <Card
              key={persona.id}
              className={`relative p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? 'border-2 border-primary bg-primary/5'
                  : 'border-2 border-border hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && onSelectPersona(persona.id)}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              {/* Persona Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{persona.icon}</div>
                <div className="flex-1">
                  <h4 className="font-semibold">{persona.title}</h4>
                  <p className="text-xs text-muted-foreground">{persona.role}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-3">
                {persona.description}
              </p>

              {/* Focus Areas */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Key Focus Areas
                </p>
                <div className="flex flex-wrap gap-1">
                  {persona.focusAreas.map((area) => (
                    <Badge
                      key={area}
                      variant="secondary"
                      className="text-xs"
                    >
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Template Info */}
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Template: <span className="font-medium">{persona.template}</span>
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Selected Persona Summary */}
      {selectedPersona && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {personas.find(p => p.id === selectedPersona)?.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                Business case will be optimized for{' '}
                <span className="font-bold">
                  {personas.find(p => p.id === selectedPersona)?.title}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Using {personas.find(p => p.id === selectedPersona)?.template} template
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Get template name for persona
 */
export function getTemplateForPersona(persona: BuyerPersona): string {
  return personas.find(p => p.id === persona)?.template || 'TrinityDashboard';
}

/**
 * Get persona configuration
 */
export function getPersonaConfig(persona: BuyerPersona): PersonaConfig | undefined {
  return personas.find(p => p.id === persona);
}
