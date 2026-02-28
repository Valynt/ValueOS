/**
 * Quantum View Template (Multi-Persona)
 * VOS-UI-005: Displays different perspectives/analyses from multiple AI personas
 * Features: Persona switching, parallel analysis views, consensus indicators
 */

import { 
  Activity, 
  AlertTriangle, 
  Brain, 
  CheckCircle, 
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import AgentBadge from '../components/Agents/AgentBadge';
import ConfidenceIndicator from '../components/Agents/ConfidenceIndicator';

// ============================================================================
// Types
// ============================================================================

export type PersonaType = 'financial' | 'technical' | 'strategic' | 'risk' | 'operational';

export interface PersonaAnalysis {
  id: string;
  persona: PersonaType;
  title: string;
  summary: string;
  confidence: number;
  keyMetrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'neutral';
  }>;
  recommendations: string[];
  risks: string[];
  consensus?: boolean;
  aiGenerated?: boolean;
}

export interface QuantumViewProps {
  title?: string;
  subtitle?: string;
  analyses: PersonaAnalysis[];
  showConsensus?: boolean;
  onPersonaSelect?: (persona: PersonaType) => void;
  onAnalysisClick?: (analysis: PersonaAnalysis) => void;
  autoSync?: boolean;
}

// ============================================================================
// Persona Configuration
// ============================================================================

const PERSONA_CONFIG: Record<PersonaType, { icon: React.ElementType; color: string; label: string }> = {
  financial: { icon: TrendingUp, color: 'text-green-600', label: 'Financial Analyst' },
  technical: { icon: Brain, color: 'text-blue-600', label: 'Technical Architect' },
  strategic: { icon: Users, color: 'text-purple-600', label: 'Strategic Advisor' },
  risk: { icon: Shield, color: 'text-red-600', label: 'Risk Analyst' },
  operational: { icon: Activity, color: 'text-orange-600', label: 'Operations Lead' },
};

// ============================================================================
// Components
// ============================================================================

const PersonaCard: React.FC<{
  analysis: PersonaAnalysis;
  selected: boolean;
  onClick: () => void;
  showConsensus?: boolean;
}> = ({ analysis, selected, onClick, showConsensus }) => {
  const config = PERSONA_CONFIG[analysis.persona];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border cursor-pointer transition-all
        ${selected 
          ? 'bg-primary/5 border-primary shadow-lg shadow-primary/20' 
          : 'bg-card border-border hover:border-primary/50 hover:bg-primary/5'
        }
      `}
      role="button"
      tabIndex={0}
      data-testid={`persona-card-${analysis.persona}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-primary/10 ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{analysis.title}</h3>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>
        
        {showConsensus && analysis.consensus && (
          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Consensus
          </div>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {analysis.summary}
      </p>

      {/* Key Metrics */}
      <div className="flex flex-wrap gap-2 mb-3">
        {analysis.keyMetrics.slice(0, 2).map((metric, idx) => (
          <div key={idx} className="px-2 py-1 bg-secondary rounded text-xs">
            <span className="font-medium">{metric.value}</span>
            {metric.unit && <span className="text-muted-foreground ml-1">{metric.unit}</span>}
            {metric.trend && (
              <span className={`ml-1 ${metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between">
        <ConfidenceIndicator
          value={analysis.confidence}
          confidence={analysis.confidence}
          label="Confidence"
          size="sm"
        />
        {analysis.aiGenerated && (
          <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">
            AI
          </span>
        )}
      </div>
    </div>
  );
};

const AnalysisDetail: React.FC<{
  analysis: PersonaAnalysis;
  onBack: () => void;
}> = ({ analysis, onBack }) => {
  const config = PERSONA_CONFIG[analysis.persona];
  const Icon = config.icon;

  return (
    <div className="space-y-6" data-testid={`analysis-detail-${analysis.persona}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg bg-primary/10 ${config.color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{analysis.title}</h2>
            <p className="text-sm text-muted-foreground">{config.label}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary"
        >
          Back to Overview
        </button>
      </div>

      {/* Summary & Confidence */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between mb-3">
          <p className="text-foreground">{analysis.summary}</p>
          <ConfidenceIndicator
            value={analysis.confidence}
            confidence={analysis.confidence}
            label="Confidence"
            size="lg"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Key Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysis.keyMetrics.map((metric, idx) => (
            <div key={idx} className="p-3 bg-secondary rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
              <div className="text-lg font-bold text-foreground">
                {metric.value}
                {metric.unit && <span className="text-muted-foreground ml-1">{metric.unit}</span>}
              </div>
              {metric.trend && (
                <div className={`text-xs mt-1 ${
                  metric.trend === 'up' ? 'text-green-600' : 
                  metric.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {metric.trend === 'up' ? '↑ Improving' : 
                   metric.trend === 'down' ? '↓ Declining' : '→ Stable'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recommendations
        </h3>
        <ul className="space-y-2">
          {analysis.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Risks */}
      {analysis.risks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Risks & Considerations
          </h3>
          <ul className="space-y-2">
            {analysis.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ConsensusView: React.FC<{
  analyses: PersonaAnalysis[];
}> = ({ analyses }) => {
  const consensusAnalyses = analyses.filter(a => a.consensus);
  
  if (consensusAnalyses.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No consensus reached among personas</p>
      </div>
    );
  }

  // Calculate consensus metrics
  const avgConfidence = consensusAnalyses.reduce((sum, a) => sum + a.confidence, 0) / consensusAnalyses.length;
  
  // Find common recommendations
  const allRecommendations = consensusAnalyses.flatMap(a => a.recommendations);
  const recommendationCounts = allRecommendations.reduce((acc, rec) => {
    acc[rec] = (acc[rec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const commonRecommendations = Object.entries(recommendationCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-4" data-testid="consensus-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-primary">Consensus View</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {consensusAnalyses.length} of {analyses.length} personas agree
        </div>
      </div>

      {/* Agreement Score */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">Overall Agreement</span>
          <span className="text-2xl font-bold text-primary">{Math.round(avgConfidence)}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${avgConfidence}%` }}
          />
        </div>
      </div>

      {/* Common Recommendations */}
      {commonRecommendations.length > 0 && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Top Consensus Recommendations</h4>
          <ul className="space-y-2">
            {commonRecommendations.map(([rec, count], idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {count}
                </div>
                <span className="text-foreground">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Persona Agreement List */}
      <div className="space-y-2">
        {consensusAnalyses.map(analysis => {
          const config = PERSONA_CONFIG[analysis.persona];
          const Icon = config.icon;
          return (
            <div key={analysis.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="text-sm font-medium">{analysis.title}</span>
              </div>
              <span className="text-xs text-green-600 font-medium">Agrees</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const QuantumView: React.FC<QuantumViewProps> = ({
  title = 'Quantum View',
  subtitle = 'Multi-Persona Analysis',
  analyses,
  showConsensus = true,
  onPersonaSelect,
  onAnalysisClick,
  autoSync = false,
}) => {
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detail' | 'consensus'>('overview');

  // Derive selected analysis
  const selectedAnalysis = useMemo(() => {
    if (!selectedPersona) return null;
    return analyses.find(a => a.persona === selectedPersona) || null;
  }, [analyses, selectedPersona]);

  // Calculate consensus status
  const consensusCount = useMemo(() => {
    return analyses.filter(a => a.consensus).length;
  }, [analyses]);

  // Handle persona selection
  const handlePersonaSelect = (persona: PersonaType) => {
    setSelectedPersona(persona);
    setViewMode('detail');
    onPersonaSelect?.(persona);
    
    const analysis = analyses.find(a => a.persona === persona);
    if (analysis) {
      onAnalysisClick?.(analysis);
    }
  };

  // Handle consensus view
  const handleConsensusView = () => {
    setViewMode('consensus');
  };

  // Handle back to overview
  const handleBack = () => {
    setViewMode('overview');
    setSelectedPersona(null);
  };

  // Auto-sync effect
  React.useEffect(() => {
    if (autoSync && analyses.length > 0) {
      // Auto-select first persona with highest confidence
      const highestConfidence = analyses.reduce((max, a) => 
        a.confidence > max.confidence ? a : max
      , analyses[0]);
      
      setSelectedPersona(highestConfidence.persona);
      setViewMode('detail');
    }
  }, [autoSync, analyses]);

  if (analyses.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No persona analyses available</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {showConsensus && (
            <button
              onClick={handleConsensusView}
              className={`
                px-3 py-1.5 text-sm rounded border transition-all
                ${viewMode === 'consensus'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-secondary'
                }
              `}
            >
              <UserCheck className="w-4 h-4 inline mr-1" />
              Consensus {consensusCount > 0 && `(${consensusCount})`}
            </button>
          )}
          <AgentBadge agentId="multi-persona" size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'overview' && (
          <div className="space-y-6">
            {/* Persona Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyses.map(analysis => (
                <PersonaCard
                  key={analysis.id}
                  analysis={analysis}
                  selected={selectedPersona === analysis.persona}
                  onClick={() => handlePersonaSelect(analysis.persona)}
                  showConsensus={showConsensus}
                />
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Personas</span>
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-foreground">{analyses.length}</div>
              </div>
              
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Consensus</span>
                  <UserCheck className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">{consensusCount}</div>
              </div>
              
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Avg Confidence</span>
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'detail' && selectedAnalysis && (
          <AnalysisDetail
            analysis={selectedAnalysis}
            onBack={handleBack}
          />
        )}

        {viewMode === 'consensus' && (
          <ConsensusView analyses={analyses} />
        )}
      </div>
    </div>
  );
};

export default QuantumView;